/**
 * Renderer — panel UI + audio capture
 *
 * The Granola-style capture works because main.ts installs
 * setDisplayMediaRequestHandler with audio:'loopback'. When we call
 * getDisplayMedia() here, Electron intercepts it and returns a system-audio
 * stream (ScreenCaptureKit on macOS 13+, WASAPI loopback on Windows) without
 * showing the OS screen-picker dialog to the user.
 *
 * MediaRecorder chunks the stream every 10 s and sends each chunk to main
 * as a base64 string. Main assembles them and POSTs to Sorabase.
 */

export {}; // make this file a module so declare global is valid

declare global {
  interface Window {
    sorabase: {
      checkAuth():         Promise<{ authenticated: boolean; user?: { id: string; email: string; name: string } }>;
      login():             Promise<void>;
      logout():            Promise<void>;
      startCapture(o: { mode: string; label: string }): Promise<{ ok: boolean }>;
      cancelCapture():     Promise<{ ok: boolean }>;
      sendChunk(b: string): void;
      doneRecording():     void;
      onStatus(cb: (s: StatusPayload) => void): void;
      onAuthSignedIn(cb: () => void): void;
      screenPermission(): Promise<string>;
      off(channel: string): void;
    };
  }
}

interface StatusPayload {
  state: "uploading" | "done" | "error";
  message?: string;
  result?: { redirect_url?: string };
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type ViewId =
  | "checking"
  | "auth"
  | "permission"
  | "idle"
  | "recording"
  | "uploading"
  | "done"
  | "error";

let currentView: ViewId = "checking";
let selectedMode = "general";
let mediaRecorder: MediaRecorder | null = null;
let captureStream: MediaStream | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let startTime = 0;

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function showView(id: ViewId) {
  currentView = id;
  document.querySelectorAll<HTMLElement>(".view").forEach((el) => {
    el.classList.toggle("active", el.id === `view-${id}`);
  });
}

function setUserDisplay(email: string, online: boolean) {
  $("user-label").textContent = email ? shortenEmail(email) : (online ? "Signed in" : "Not signed in");
  $<HTMLElement>("user-dot").className = `user-dot${online ? "" : " offline"}`;
}

function shortenEmail(email: string): string {
  return email.length > 18 ? email.split("@")[0] : email;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  showView("checking");
  setupListeners();
  await checkPermissionThenAuth();
}

async function checkPermissionThenAuth() {
  // On macOS, check Screen Recording permission before showing the idle view.
  // On Windows, permission is not required upfront — it's implicit in the API call.
  const status = await window.sorabase.screenPermission();

  if (status === "denied") {
    showView("permission");
    setUserDisplay("", false);
    return;
  }

  await checkAuth();
}

async function checkAuth() {
  const result = await window.sorabase.checkAuth();
  if (result.authenticated && result.user) {
    setUserDisplay(result.user.email ?? result.user.name ?? "Signed in", true);
    showView("idle");
  } else {
    setUserDisplay("", false);
    showView("auth");
  }
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

function setupListeners() {
  // IPC events from main
  window.sorabase.onStatus((payload) => {
    if (payload.state === "uploading") {
      showView("uploading");
    } else if (payload.state === "done") {
      showView("done");
    } else if (payload.state === "error") {
      showError(payload.message ?? "Unknown error");
    }
  });

  window.sorabase.onAuthSignedIn(async () => {
    await checkAuth();
  });

  // Auth view
  $("btn-login").addEventListener("click", () => {
    window.sorabase.login();
  });

  // User pill — click to sign out when signed in, sign in when not
  $("user-pill").addEventListener("click", async () => {
    if (currentView === "auth") {
      window.sorabase.login();
    } else {
      await window.sorabase.logout();
      setUserDisplay("", false);
      showView("auth");
    }
  });

  // Permission view
  $("btn-open-settings").addEventListener("click", () => {
    // Open macOS System Settings directly to Screen Recording pane
    const { shell } = window.require?.("electron") ?? {};
    if (shell) {
      shell.openExternal(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
      );
    }
  });

  $("btn-recheck-permission").addEventListener("click", async () => {
    showView("checking");
    await checkPermissionThenAuth();
  });

  // Mode buttons
  document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".mode-btn")
        .forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedMode = btn.dataset.mode ?? "general";
    });
  });

  // Start capture
  $("btn-start").addEventListener("click", startCapture);

  // Stop capture
  $("btn-stop").addEventListener("click", stopCapture);

  // Cancel capture
  $("btn-cancel").addEventListener("click", cancelCapture);

  // New session after done/error
  $("btn-new").addEventListener("click", () => showView("idle"));
  $("btn-retry").addEventListener("click", () => showView("idle"));
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

async function startCapture() {
  const label = $<HTMLInputElement>("session-label").value.trim();

  $<HTMLButtonElement>("btn-start").disabled = true;

  let stream: MediaStream;
  try {
    // getDisplayMedia is intercepted by main's setDisplayMediaRequestHandler.
    // audio:'loopback' is injected server-side — here we just declare we want audio.
    // We request a minimal video track to satisfy the API contract; it gets discarded.
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 1, max: 1 } as MediaTrackConstraints["frameRate"],
        width: { ideal: 1 },
        height: { ideal: 1 },
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 48_000,
        channelCount: 2,
      },
    });
  } catch (err: unknown) {
    $<HTMLButtonElement>("btn-start").disabled = false;
    const e = err as DOMException;
    if (e.name === "NotAllowedError") return; // user cancelled — do nothing
    if (e.name === "NotFoundError" || e.name === "NotReadableError") {
      // macOS permission not granted yet
      showView("permission");
      return;
    }
    showError(e.message ?? "Could not start capture");
    return;
  }

  // Drop video — audio only
  stream.getVideoTracks().forEach((t) => t.stop());

  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    $<HTMLButtonElement>("btn-start").disabled = false;
    showError(
      "No system audio track was returned. " +
      "Make sure Screen Recording permission is granted in System Settings.",
    );
    return;
  }

  captureStream = stream;

  // Tell main to flip into recording state (updates tray badge, etc.)
  await window.sorabase.startCapture({ mode: selectedMode, label });

  // Set up MediaRecorder
  const mimeType = pickMimeType();
  mediaRecorder = new MediaRecorder(
    new MediaStream(audioTracks),
    mimeType ? { mimeType } : undefined,
  );

  mediaRecorder.ondataavailable = (evt) => {
    if (!evt.data || evt.data.size === 0) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = (reader.result as string).split(",")[1];
      if (b64) window.sorabase.sendChunk(b64);
    };
    reader.readAsDataURL(evt.data);
  };

  mediaRecorder.onstop = () => {
    captureStream?.getTracks().forEach((t) => t.stop());
    captureStream = null;
    window.sorabase.doneRecording();
  };

  mediaRecorder.start(10_000); // 10-second chunks match the extension behaviour
  startTime = Date.now();

  // Update UI
  const modeName = { general: "General mode", recruiting: "Recruiter mode", study: "Study mode" }[
    selectedMode
  ] ?? selectedMode;
  $("rec-mode-label").textContent = label ? `${modeName} · ${label}` : modeName;

  startTimer();
  showView("recording");
}

function stopCapture() {
  stopTimer();
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop(); // triggers onstop → doneRecording
  } else {
    captureStream?.getTracks().forEach((t) => t.stop());
    captureStream = null;
    window.sorabase.doneRecording();
  }
  mediaRecorder = null;
  showView("uploading");
}

function cancelCapture() {
  stopTimer();
  mediaRecorder?.stop();
  mediaRecorder = null;
  captureStream?.getTracks().forEach((t) => t.stop());
  captureStream = null;
  window.sorabase.cancelCapture();
  $<HTMLButtonElement>("btn-start").disabled = false;
  showView("idle");
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

function startTimer() {
  stopTimer();
  const tick = () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    $("rec-timer").textContent = `${m}:${String(s).padStart(2, "0")}`;
  };
  tick();
  timerInterval = setInterval(tick, 1_000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

function showError(message: string) {
  stopTimer();
  $("error-message").textContent = message;
  showView("error");
}

// ---------------------------------------------------------------------------
// Audio codec selection
// ---------------------------------------------------------------------------

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", init);
