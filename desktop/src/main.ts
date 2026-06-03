/**
 * Sorabase Desktop — main process
 *
 * Two capture paths depending on whether DEEPGRAM_API_KEY is set:
 *
 * ── Live transcription path (Deepgram key available) ──────────────────────
 *  1. User clicks Start → main creates a CaptureSession (POST /api/capture-sessions)
 *  2. Renderer connects to Deepgram WebSocket, streams system audio
 *  3. Each final utterance → renderer sends capture:text-chunk → main appends chunk
 *     to the session (POST /api/capture-sessions/{id}/chunks)
 *  4. User clicks Stop → renderer sends capture:done-live → main calls
 *     POST /api/extension/text-complete → backend assembles text → Conversation
 *  5. Main opens the redirect URL in the default browser
 *
 * ── Audio upload path (no Deepgram key) ───────────────────────────────────
 *  1–3. Same Start flow; renderer uses MediaRecorder and sends base64 chunks via IPC
 *  4. User clicks Stop → renderer sends capture:done → main calls
 *     POST /api/extension/upload (existing path, Whisper transcription)
 *  5. Same redirect
 *
 * The system audio capture trick (Granola-style) is identical in both paths:
 * setDisplayMediaRequestHandler intercepts getDisplayMedia() and returns
 * audio:"loopback" so the OS routes system audio to the renderer without
 * showing the picker dialog.
 */

import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  Menu,
  nativeImage,
  net,
  session,
  shell,
  Tray,
  systemPreferences,
} from "electron";
import path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SORABASE_URL = process.env.SORABASE_URL || "https://www.sorabase.org";
const isDev = process.argv.includes("--dev");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let tray: Tray | null = null;
let panelWin: BrowserWindow | null = null;
let authWin: BrowserWindow | null = null;

// Audio upload path state
const audioChunks: string[] = [];

// Shared recording state
let isRecording = false;
let captureMode = "general";
let captureLabel = "";

// Live transcription path state
let captureSessionId: string | null = null;
let isLiveTranscription = false;

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

function createTray() {
  const iconPath = path.join(__dirname, "../assets/tray-template.png");
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip("Sorabase Capture");
  refreshTrayMenu();

  tray.on("click", togglePanel);
  tray.on("right-click", () => tray?.popUpContextMenu());
}

function refreshTrayMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: isRecording ? "● Recording…" : "Sorabase Capture",
      enabled: false,
    },
    { type: "separator" },
    { label: isRecording ? "Show panel" : "Start capture", click: showPanel },
    { label: "Open Sorabase", click: () => shell.openExternal(SORABASE_URL) },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
  tray?.setContextMenu(menu);
}

function setTrayRecording(recording: boolean) {
  const name = recording ? "tray-rec-template.png" : "tray-template.png";
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "../assets", name),
  );
  icon.setTemplateImage(true);
  tray?.setImage(icon);
  tray?.setToolTip(recording ? "Sorabase — Recording" : "Sorabase Capture");
}

// ---------------------------------------------------------------------------
// Panel window
// ---------------------------------------------------------------------------

function createPanel() {
  panelWin = new BrowserWindow({
    width: 340,
    height: 540,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Auto-approve getDisplayMedia with system audio loopback.
  // desktopCapturer.getSources() returns [] when Screen Recording permission
  // is not yet granted — passing undefined to callback crashes Electron,
  // so we guard and let the renderer handle NotFoundError gracefully.
  panelWin.webContents.session.setDisplayMediaRequestHandler(
    async (
      _req: Electron.DisplayMediaRequestHandlerHandlerRequest,
      callback: (streams: Electron.Streams) => void,
    ) => {
      try {
        const sources = await desktopCapturer.getSources({ types: ["screen"] });
        if (!sources || sources.length === 0) {
          // No permission yet — returning empty triggers NotFoundError in renderer
          callback({} as Electron.Streams);
          return;
        }
        callback({ video: sources[0], audio: "loopback" });
      } catch {
        callback({} as Electron.Streams);
      }
    },
  );

  panelWin.loadFile(path.join(__dirname, "renderer/panel.html"));

  if (isDev) panelWin.webContents.openDevTools({ mode: "detach" });

  panelWin.on("blur", () => {
    if (!isRecording) panelWin?.hide();
  });
}

function togglePanel() {
  if (panelWin?.isVisible()) {
    panelWin.hide();
  } else {
    showPanel();
  }
}

function showPanel() {
  if (!panelWin || panelWin.isDestroyed()) createPanel();
  if (!panelWin!.isVisible()) {
    positionNearTray();
    panelWin!.show();
  }
  panelWin!.focus();
}

function positionNearTray() {
  const bounds = tray?.getBounds();
  if (!bounds || !panelWin) return;

  const [winW, winH] = panelWin.getSize();
  const x = Math.round(bounds.x + bounds.width / 2 - winW / 2);
  const y =
    process.platform === "darwin"
      ? bounds.y + bounds.height + 4
      : bounds.y - winH - 4;

  panelWin.setPosition(x, Math.max(0, y));
}

// ---------------------------------------------------------------------------
// Auth window
// ---------------------------------------------------------------------------

function showAuthWindow() {
  if (authWin && !authWin.isDestroyed()) {
    authWin.focus();
    return;
  }

  authWin = new BrowserWindow({
    width: 460,
    height: 620,
    title: "Sign in to Sorabase",
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      partition: "persist:sorabase",
    },
  });

  authWin.loadURL(`${SORABASE_URL}/signin`);

  // Poll the session endpoint every 2 s. NextAuth uses fetch() + client-side
  // redirect after sign-in, which never fires did-navigate, so URL watching
  // doesn't work. Polling detects auth within 2 s regardless of the redirect type.
  let pollTimer: ReturnType<typeof setInterval> | null = setInterval(async () => {
    if (!authWin || authWin.isDestroyed()) return;
    try {
      const result = await checkAuth();
      if (result.authenticated) {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        authWin?.close();
        panelWin?.webContents.send("auth:signed-in");
        setTimeout(() => showPanel(), 300);
      }
    } catch { /* keep polling */ }
  }, 2000);

  authWin.on("closed", () => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    authWin = null;
  });
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function checkAuth(): Promise<{
  authenticated: boolean;
  user?: { id: string; email: string; name: string };
}> {
  return new Promise((resolve) => {
    const ses = session.fromPartition("persist:sorabase");
    const req = net.request({
      method: "GET",
      url: `${SORABASE_URL}/api/extension/session`,
      session: ses,
    });

    req.on("response", (res: Electron.IncomingMessage) => {
      let raw = "";
      res.on("data", (chunk: Buffer) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve({ authenticated: false });
        }
      });
    });

    req.on("error", () => resolve({ authenticated: false }));
    req.end();
  });
}

// ---------------------------------------------------------------------------
// CaptureSession helpers (live transcription path)
// ---------------------------------------------------------------------------

function createCaptureSession(
  mode: string,
  label: string,
): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const ses = session.fromPartition("persist:sorabase");
    const body = Buffer.from(
      JSON.stringify({ mode, label: label || undefined, source: "desktop_live" }),
    );
    const req = net.request({
      method: "POST",
      url: `${SORABASE_URL}/api/capture-sessions`,
      session: ses,
    });
    req.setHeader("content-type", "application/json");
    req.setHeader("content-length", String(body.length));

    req.on("response", (res: Electron.IncomingMessage) => {
      let raw = "";
      res.on("data", (chunk: Buffer) => (raw += chunk));
      res.on("end", () => {
        if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300) {
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error("Invalid JSON from server"));
          }
        } else {
          reject(new Error(`Create session failed (${res.statusCode})`));
        }
      });
    });

    req.on("error", (err: Error) => reject(err));
    req.write(body);
    req.end();
  });
}

function appendTextChunk(
  sessionId: string,
  text: string,
  speaker?: string,
  confidence?: number,
): Promise<void> {
  return new Promise((resolve) => {
    const ses = session.fromPartition("persist:sorabase");
    const bodyObj: Record<string, unknown> = { text };
    if (speaker) bodyObj.speaker = speaker;
    if (confidence !== undefined) bodyObj.confidence = confidence;
    const body = Buffer.from(JSON.stringify(bodyObj));

    const req = net.request({
      method: "POST",
      url: `${SORABASE_URL}/api/capture-sessions/${sessionId}/chunks`,
      session: ses,
    });
    req.setHeader("content-type", "application/json");
    req.setHeader("content-length", String(body.length));

    req.on("response", (res: Electron.IncomingMessage) => {
      res.on("data", () => {});
      res.on("end", resolve);
    });
    req.on("error", () => resolve()); // fire-and-forget: don't fail on chunk errors
    req.write(body);
    req.end();
  });
}

function completeLiveSession(
  sessionId: string,
  mode: string,
  label: string,
): Promise<{ redirect_url?: string; conversation_id?: string; lecture_id?: string }> {
  return new Promise((resolve, reject) => {
    const ses = session.fromPartition("persist:sorabase");
    const body = Buffer.from(
      JSON.stringify({
        session_id: sessionId,
        mode,
        label: label || undefined,
      }),
    );
    const req = net.request({
      method: "POST",
      url: `${SORABASE_URL}/api/extension/text-complete`,
      session: ses,
    });
    req.setHeader("content-type", "application/json");
    req.setHeader("content-length", String(body.length));

    req.on("response", (res: Electron.IncomingMessage) => {
      let raw = "";
      res.on("data", (chunk: Buffer) => (raw += chunk));
      res.on("end", () => {
        if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300) {
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error("Invalid JSON from server"));
          }
        } else if (res.statusCode === 401) {
          reject(new Error("Not signed in. Click the user icon to sign in again."));
        } else {
          try {
            const parsed = JSON.parse(raw);
            reject(new Error(parsed.detail || `Complete failed (${res.statusCode})`));
          } catch {
            reject(new Error(`Complete failed (${res.statusCode})`));
          }
        }
      });
    });

    req.on("error", (err: Error) => reject(err));
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Audio upload helper (legacy path — no Deepgram key)
// ---------------------------------------------------------------------------

function assembleAndUpload(
  chunks: string[],
  mode: string,
  label: string,
): Promise<{ redirect_url?: string; conversation_id?: string; lecture_id?: string }> {
  const boundary = `----SorabaseBoundary${Date.now()}`;
  const filename = `sorabase-capture-${Date.now()}.webm`;
  const jobRef = label || "Desktop capture";

  const parts: Buffer[] = [];

  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/webm\r\n\r\n`,
    ),
  );
  for (const b64 of chunks) {
    parts.push(Buffer.from(b64, "base64"));
  }
  parts.push(Buffer.from("\r\n"));
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="mode"\r\n\r\n${mode}\r\n`,
    ),
  );
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="job_reference"\r\n\r\n${jobRef}\r\n`,
    ),
  );
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  return new Promise((resolve, reject) => {
    const ses = session.fromPartition("persist:sorabase");
    const req = net.request({
      method: "POST",
      url: `${SORABASE_URL}/api/extension/upload`,
      session: ses,
    });

    req.setHeader("Content-Type", `multipart/form-data; boundary=${boundary}`);
    req.setHeader("Content-Length", String(body.length));

    req.on("response", (res: Electron.IncomingMessage) => {
      let raw = "";
      res.on("data", (chunk: Buffer) => (raw += chunk));
      res.on("end", () => {
        if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300) {
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error("Invalid JSON from server"));
          }
        } else if (res.statusCode === 401) {
          reject(new Error("Not signed in. Click the user icon to sign in again."));
        } else {
          try {
            const parsed = JSON.parse(raw);
            reject(new Error(parsed.detail || `Upload failed (${res.statusCode})`));
          } catch {
            reject(new Error(`Upload failed (${res.statusCode})`));
          }
        }
      });
    });

    req.on("error", (err: Error) => reject(err));
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

ipcMain.handle("auth:check", async () => checkAuth());
ipcMain.handle("auth:login", () => showAuthWindow());
ipcMain.handle("auth:logout", async () => {
  const ses = session.fromPartition("persist:sorabase");
  await ses.clearStorageData();
  return { ok: true };
});

ipcMain.handle(
  "capture:start",
  async (
    _event: Electron.IpcMainInvokeEvent,
    opts: { mode: string; label: string; live?: boolean },
  ) => {
    audioChunks.length = 0;
    isRecording = true;
    captureMode = opts.mode || "general";
    captureLabel = opts.label || "";
    isLiveTranscription = opts.live === true;
    captureSessionId = null;

    setTrayRecording(true);
    refreshTrayMenu();

    // If live transcription, create a CaptureSession now so chunks can be appended
    if (isLiveTranscription) {
      try {
        const created = await createCaptureSession(captureMode, captureLabel);
        captureSessionId = created.id;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        // Non-fatal: fall back to audio upload path if session creation fails
        isLiveTranscription = false;
        panelWin?.webContents.send("status", {
          state: "error",
          message: `Could not create live session: ${message}. Using audio upload instead.`,
        });
      }
    }

    return { ok: true, session_id: captureSessionId };
  },
);

// Live transcription: renderer sends each finalized Deepgram utterance
ipcMain.on(
  "capture:text-chunk",
  (_event: Electron.IpcMainEvent, payload: { text: string; speaker?: string; confidence?: number }) => {
    if (!captureSessionId || !isLiveTranscription) return;
    appendTextChunk(
      captureSessionId,
      payload.text,
      payload.speaker,
      payload.confidence,
    ).catch(() => {}); // fire-and-forget
  },
);

// Live transcription: renderer signals done (after Deepgram WS closed)
ipcMain.on("capture:done-live", async () => {
  isRecording = false;
  setTrayRecording(false);
  refreshTrayMenu();

  if (!captureSessionId) {
    panelWin?.webContents.send("status", {
      state: "error",
      message: "No live session was active.",
    });
    return;
  }

  panelWin?.webContents.send("status", { state: "uploading" });

  try {
    const result = await completeLiveSession(
      captureSessionId,
      captureMode,
      captureLabel,
    );
    captureSessionId = null;
    panelWin?.webContents.send("status", { state: "done", result });
    if (result.redirect_url) {
      shell.openExternal(result.redirect_url);
    }
  } catch (err: unknown) {
    captureSessionId = null;
    const message = err instanceof Error ? err.message : String(err);
    panelWin?.webContents.send("status", { state: "error", message });
  }
});

// Audio upload path: renderer sends base64 audio chunks
ipcMain.on("capture:chunk", (_event: Electron.IpcMainEvent, b64: string) => {
  if (b64) audioChunks.push(b64);
});

// Audio upload path: renderer signals recording stopped
ipcMain.on("capture:done", async () => {
  isRecording = false;
  setTrayRecording(false);
  refreshTrayMenu();

  if (audioChunks.length === 0) {
    panelWin?.webContents.send("status", {
      state: "error",
      message: "No audio was captured. Check system audio permissions.",
    });
    return;
  }

  panelWin?.webContents.send("status", { state: "uploading" });

  try {
    const result = await assembleAndUpload(
      [...audioChunks],
      captureMode,
      captureLabel,
    );
    audioChunks.length = 0;
    panelWin?.webContents.send("status", { state: "done", result });
    if (result.redirect_url) {
      shell.openExternal(result.redirect_url);
    }
  } catch (err: unknown) {
    audioChunks.length = 0;
    const message = err instanceof Error ? err.message : String(err);
    panelWin?.webContents.send("status", { state: "error", message });
  }
});

ipcMain.handle("capture:cancel", () => {
  audioChunks.length = 0;
  captureSessionId = null;
  isLiveTranscription = false;
  isRecording = false;
  setTrayRecording(false);
  refreshTrayMenu();
  return { ok: true };
});

ipcMain.handle("permission:screen", () => {
  if (process.platform !== "darwin") return "granted";
  return systemPreferences.getMediaAccessStatus("screen");
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.dock?.hide();

app.whenReady().then(() => {
  createTray();
  createPanel();
  setTimeout(showPanel, 400);
});

app.on("window-all-closed", () => {
  /* intentional no-op — lives in tray */
});

app.on("before-quit", () => {
  tray?.destroy();
});
