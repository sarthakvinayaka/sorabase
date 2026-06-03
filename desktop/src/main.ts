/**
 * Sorabase Desktop — main process
 *
 * System audio is captured in the renderer via navigator.mediaDevices.getDisplayMedia().
 * We intercept that call with setDisplayMediaRequestHandler and pass audio:'loopback'
 * so Electron uses ScreenCaptureKit (macOS 13+) or WASAPI loopback (Windows) to
 * capture whatever is playing on the system — no bot, no browser tab required.
 *
 * Flow:
 *  1. User clicks tray icon → panel window appears
 *  2. User picks mode, optionally labels the session, clicks Start
 *  3. Renderer calls getDisplayMedia; main auto-approves with loopback audio
 *  4. MediaRecorder chunks are sent to main via IPC as base64 strings
 *  5. On Stop, main assembles chunks → multipart POST to /api/extension/upload
 *  6. On success, opens the Sorabase review page in the default browser
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

const SORABASE_URL =
  process.env.SORABASE_URL || "https://www.sorabase.org";
const isDev = process.argv.includes("--dev");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let tray: Tray | null = null;
let panelWin: BrowserWindow | null = null;
let authWin: BrowserWindow | null = null;

const audioChunks: string[] = [];
let isRecording = false;
let captureMode = "general";
let captureLabel = "";

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

function createTray() {
  const iconPath = path.join(__dirname, "../assets/tray-template.png");
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true); // adapts to macOS dark/light mode automatically

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
    width: 320,
    height: 500,
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

  // Critical: auto-approve getDisplayMedia with loopback system audio.
  // This is the Granola trick — no picker dialog, always captures system output.
  // setDisplayMediaRequestHandler lives on Session, not WebContents.
  panelWin.webContents.session.setDisplayMediaRequestHandler(
    async (
      _req: Electron.DisplayMediaRequestHandlerHandlerRequest,
      callback: (streams: Electron.Streams) => void,
    ) => {
      const sources = await desktopCapturer.getSources({ types: ["screen"] });
      callback({
        video: sources[0],  // required even though we discard the video track
        audio: "loopback",  // ← ScreenCaptureKit (macOS 13+) / WASAPI loopback (Windows)
      });
    },
  );

  // panel.html is copied to dist/renderer/ by esbuild.config.mjs
  panelWin.loadFile(path.join(__dirname, "renderer/panel.html"));

  if (isDev) panelWin.webContents.openDevTools({ mode: "detach" });

  // Hide when user clicks outside, but only when not recording
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
  // On macOS the menu bar is at the top; on Windows the taskbar is usually at bottom
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
    width: 520,
    height: 680,
    title: "Sign in to Sorabase",
    webPreferences: {
      partition: "persist:sorabase",
    },
  });

  authWin.loadURL(`${SORABASE_URL}/signin`);

  authWin.webContents.on("did-navigate", (_: Electron.Event, url: string) => {
    // Sign-in redirects away from /signin — treat as authenticated
    if (
      !url.includes("/signin") &&
      !url.includes("/signup") &&
      url.startsWith(SORABASE_URL)
    ) {
      authWin?.close();
      panelWin?.webContents.send("auth:signed-in");
    }
  });

  authWin.on("closed", () => {
    authWin = null;
  });
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

ipcMain.handle("auth:check", async () => {
  return checkAuth();
});

ipcMain.handle("auth:login", () => {
  showAuthWindow();
});

ipcMain.handle("auth:logout", async () => {
  const ses = session.fromPartition("persist:sorabase");
  await ses.clearStorageData();
  return { ok: true };
});

ipcMain.handle("capture:start", (_event: Electron.IpcMainInvokeEvent, opts: { mode: string; label: string }) => {
  audioChunks.length = 0;
  isRecording = true;
  captureMode = opts.mode || "general";
  captureLabel = opts.label || "";
  setTrayRecording(true);
  refreshTrayMenu();
  return { ok: true };
});

ipcMain.on("capture:chunk", (_event: Electron.IpcMainEvent, b64: string) => {
  if (b64) audioChunks.push(b64);
});

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
// Auth helper — uses the app's own persisted session (shared with auth window)
// ---------------------------------------------------------------------------

function checkAuth(): Promise<{ authenticated: boolean; user?: { id: string; email: string; name: string } }> {
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
// Upload — assembles base64 chunks into multipart POST to Sorabase
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

  // audio file
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/webm\r\n\r\n`,
    ),
  );
  for (const b64 of chunks) {
    parts.push(Buffer.from(b64, "base64"));
  }
  parts.push(Buffer.from("\r\n"));

  // mode
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="mode"\r\n\r\n${mode}\r\n`,
    ),
  );

  // job_reference
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
          reject(
            new Error(
              "Not signed in. Click the user icon to sign in again.",
            ),
          );
        } else {
          try {
            const body = JSON.parse(raw);
            reject(new Error(body.detail || `Upload failed (${res.statusCode})`));
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
// App lifecycle
// ---------------------------------------------------------------------------

// Menubar / tray app: hide from Dock on macOS
app.dock?.hide();

app.whenReady().then(() => {
  createTray();
  createPanel();
  // Show panel on first launch so user knows the app started
  setTimeout(showPanel, 400);
});

// Keep the app alive even when all windows are closed (lives in tray)
app.on("window-all-closed", () => {
  /* intentional no-op */
});

app.on("before-quit", () => {
  tray?.destroy();
});
