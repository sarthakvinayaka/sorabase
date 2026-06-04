/**
 * Renderer — panel UI + audio capture
 *
 * Two paths depending on whether DEEPGRAM_API_KEY env var is set:
 *
 * Live transcription (Deepgram key set):
 *   getDisplayMedia → AudioContext → raw PCM → Deepgram WebSocket
 *   → finalized utterances → IPC text-chunk → main → backend CaptureSession
 *   → on Stop → IPC done-live → main → /api/extension/text-complete
 *
 * Audio upload (no Deepgram key):
 *   getDisplayMedia → MediaRecorder → 10-second base64 chunks → IPC chunk → main
 *   → on Stop → IPC done → main → /api/extension/upload → Whisper
 */

export {};

declare global {
  interface Window {
    sorabase: {
      checkAuth(): Promise<{
        authenticated: boolean;
        user?: { id: string; email: string; name: string };
      }>;
      login(): Promise<void>;
      logout(): Promise<void>;
      startCapture(o: { mode: string; label: string; live?: boolean }): Promise<{
        ok: boolean;
        session_id?: string | null;
      }>;
      cancelCapture(): Promise<{ ok: boolean }>;
      // Audio upload path
      sendChunk(b: string): void;
      doneRecording(): void;
      // Live transcription path
      sendTextChunk(text: string, speaker?: string, confidence?: number): void;
      doneRecordingLive(): void;
      // Events from main
      onStatus(cb: (s: StatusPayload) => void): void;
      onAuthSignedIn(cb: () => void): void;
      onStopFromTray(cb: () => void): void;
      onCancelFromTray(cb: () => void): void;
      // OS permission
      screenPermission(): Promise<string>;
      openSystemSettings(): void;
      // Env vars
      deepgramKey(): string | null;
      sorabaseUrl(): string;
      // Cleanup
      off(channel: string): void;
    };
  }
}

interface StatusPayload {
  state: "uploading" | "done" | "error";
  message?: string;
  result?: { redirect_url?: string; conversation_id?: string; lecture_id?: string };
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

// Audio path (no Deepgram key)
let mediaRecorder: MediaRecorder | null = null;
let captureStream: MediaStream | null = null;

// Live path (Deepgram key available)
let deepgramWs: WebSocket | null = null;
let audioCtx: AudioContext | null = null;
let scriptProcessor: ScriptProcessorNode | null = null;
let useLivePath = false;

let timerInterval: ReturnType<typeof setInterval> | null = null;
let startTime = 0;
let isCancelled = false; // prevents onstop from uploading after cancelCapture()

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
  $("user-label").textContent =
    email ? shortenEmail(email) : online ? "Signed in" : "Not signed in";
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
  try {
    await checkPermissionThenAuth();
  } catch (err) {
    showError(`Startup error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function checkPermissionThenAuth({ skipStatusCheck = false } = {}) {
  if (!skipStatusCheck) {
    const status = await window.sorabase.screenPermission();
    if (status === "denied") {
      showView("permission");
      setUserDisplay("", false);
      return;
    }
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

  $("btn-login").addEventListener("click", () => window.sorabase.login());

  $("user-pill").addEventListener("click", async () => {
    if (currentView === "auth") {
      window.sorabase.login();
    } else {
      await window.sorabase.logout();
      setUserDisplay("", false);
      showView("auth");
    }
  });

  $("btn-open-settings").addEventListener("click", () => {
    window.sorabase.openSystemSettings();
  });

  $("btn-recheck-permission").addEventListener("click", async () => {
    showView("checking");
    // Skip the TCC status check — macOS 16 can lag in reflecting the
    // updated value after the user grants permission in System Settings.
    // Just proceed to auth; if capture still fails the permission view
    // will show again via the NotAllowedError handler in startCapture.
    await checkPermissionThenAuth({ skipStatusCheck: true });
  });

  document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedMode = btn.dataset.mode ?? "general";
    });
  });

  $("btn-start").addEventListener("click", startCapture);
  $("btn-stop").addEventListener("click", stopCapture);
  $("btn-cancel").addEventListener("click", cancelCapture);
  $("btn-new").addEventListener("click", () => {
    $<HTMLButtonElement>("btn-start").disabled = false;
    showView("idle");
  });
  $("btn-retry").addEventListener("click", () => {
    $<HTMLButtonElement>("btn-start").disabled = false;
    showView("idle");
  });

  // Tray menu shortcuts — work even when panel is not in focus
  window.sorabase.onStopFromTray(stopCapture);
  window.sorabase.onCancelFromTray(cancelCapture);
}

// ---------------------------------------------------------------------------
// Capture — path selection
// ---------------------------------------------------------------------------

async function startCapture() {
  isCancelled = false;
  const label = $<HTMLInputElement>("session-label").value.trim();
  $<HTMLButtonElement>("btn-start").disabled = true;

  const deepgramKey = window.sorabase.deepgramKey();
  useLivePath = deepgramKey !== null && deepgramKey.length > 0;

  let stream: MediaStream;
  try {
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
    // NotAllowedError means the handler returned empty (Screen Recording not granted).
    // NotFoundError / NotReadableError also indicate a permission/device issue.
    // In all three cases show the permission view so the user knows what to do.
    if (
      e.name === "NotAllowedError" ||
      e.name === "NotFoundError" ||
      e.name === "NotReadableError"
    ) {
      showView("permission");
      return;
    }
    showError(e.message ?? "Could not start capture");
    return;
  }

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

  // Tell main to flip into recording state (also creates CaptureSession if live)
  await window.sorabase.startCapture({ mode: selectedMode, label, live: useLivePath });

  const modeName =
    ({ general: "General mode", recruiting: "Recruiter mode", study: "Study mode" } as Record<string, string>)[
      selectedMode
    ] ?? selectedMode;
  $("rec-mode-label").textContent = label ? `${modeName} · ${label}` : modeName;

  // Show/hide live transcript UI
  const liveIndicator = document.getElementById("live-indicator");
  const liveWrap = document.getElementById("live-transcript-wrap");
  if (liveIndicator) liveIndicator.style.display = useLivePath ? "flex" : "none";
  if (liveWrap) liveWrap.style.display = useLivePath ? "block" : "none";
  // Clear prior transcript
  const liveEl = document.getElementById("live-transcript");
  if (liveEl) liveEl.innerHTML = '<p class="live-placeholder">Listening…</p>';

  if (useLivePath && deepgramKey) {
    startDeepgramCapture(audioTracks, deepgramKey);
  } else {
    startMediaRecorderCapture(audioTracks);
  }

  startTimer();
  showView("recording");
}

// ---------------------------------------------------------------------------
// Live path — Deepgram WebSocket + AudioContext → PCM streaming
// ---------------------------------------------------------------------------

function startDeepgramCapture(tracks: MediaStreamTrack[], apiKey: string) {
  const params = new URLSearchParams({
    model: "nova-2",
    diarize: "true",
    interim_results: "false",
    encoding: "linear16",
    sample_rate: "48000",
    channels: "1",
    language: "en",
    punctuate: "true",
    smart_format: "true",
  });

  deepgramWs = new WebSocket(
    `wss://api.deepgram.com/v1/listen?${params}`,
    ["token", apiKey],
  );

  deepgramWs.binaryType = "arraybuffer";

  deepgramWs.onopen = () => {
    const audioStream = new MediaStream(tracks);

    // ScriptProcessor is deprecated but universally supported in Electron's Chromium.
    audioCtx = new AudioContext({ sampleRate: 48_000 });
    const source = audioCtx.createMediaStreamSource(audioStream);
    scriptProcessor = audioCtx.createScriptProcessor(4_096, 1, 1);
    source.connect(scriptProcessor);
    scriptProcessor.connect(audioCtx.destination);

    scriptProcessor.onaudioprocess = (evt) => {
      if (!deepgramWs || deepgramWs.readyState !== WebSocket.OPEN) return;
      const floats = evt.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(floats.length);
      for (let i = 0; i < floats.length; i++) {
        int16[i] = Math.max(-32_768, Math.min(32_767, floats[i] * 32_768));
      }
      deepgramWs.send(int16.buffer);
    };
  };

  deepgramWs.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data as string);
      if (data.type !== "Results") return;
      const alt = data?.channel?.alternatives?.[0];
      const transcript: string = alt?.transcript ?? "";
      if (!transcript || !data.is_final) return;

      const words: Array<{ speaker?: number; confidence?: number }> = alt?.words ?? [];
      const speaker =
        words[0]?.speaker !== undefined ? `Speaker ${words[0].speaker}` : undefined;
      const confidence: number | undefined = alt?.confidence;

      // Send to main → backend CaptureSession
      window.sorabase.sendTextChunk(transcript, speaker, confidence);

      // Update live transcript display
      appendLiveTranscript(transcript, speaker);
    } catch {
      // malformed JSON — ignore
    }
  };

  deepgramWs.onerror = () => {
    stopDeepgramCapture();
    showError(
      "Deepgram connection error. Check your DEEPGRAM_API_KEY and network connection.",
    );
  };

  deepgramWs.onclose = () => {
    stopDeepgramCapture();
  };
}

function stopDeepgramCapture() {
  scriptProcessor?.disconnect();
  scriptProcessor = null;
  audioCtx?.close().catch(() => {});
  audioCtx = null;
  captureStream?.getTracks().forEach((t) => t.stop());
  captureStream = null;

  if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
    deepgramWs.close(1000, "Recording stopped");
  }
  deepgramWs = null;
}

function appendLiveTranscript(text: string, speaker?: string) {
  const el = document.getElementById("live-transcript");
  if (!el) return;
  // Remove placeholder on first real utterance
  const placeholder = el.querySelector(".live-placeholder");
  if (placeholder) placeholder.remove();
  const line = document.createElement("p");
  line.className = "live-line";
  if (speaker) {
    const sp = document.createElement("span");
    sp.className = "live-speaker";
    sp.textContent = speaker + ": ";
    line.appendChild(sp);
  }
  line.appendChild(document.createTextNode(text));
  el.appendChild(line);
  const wrap = document.getElementById("live-transcript-wrap");
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

// ---------------------------------------------------------------------------
// Audio upload path — MediaRecorder → base64 chunks
// ---------------------------------------------------------------------------

function startMediaRecorderCapture(tracks: MediaStreamTrack[]) {
  const mimeType = pickMimeType();
  mediaRecorder = new MediaRecorder(
    new MediaStream(tracks),
    mimeType ? { mimeType } : undefined,
  );

  // Accumulate all blobs in memory and convert once at stop time.
  // This avoids the race condition where onstop fires before the last
  // FileReader.onloadend, causing doneRecording() to arrive at main
  // before the final chunk and resulting in "No audio was captured".
  const blobs: Blob[] = [];

  mediaRecorder.ondataavailable = (evt) => {
    if (!evt.data || evt.data.size === 0) return;
    blobs.push(evt.data);
  };

  mediaRecorder.onstop = () => {
    captureStream?.getTracks().forEach((t) => t.stop());
    captureStream = null;

    // If the user cancelled, do not upload — cancelCapture() already sent
    // capture:cancel to main. Calling doneRecording() here would send
    // capture:done after the cancel cleared audioChunks, causing a false
    // "No audio was captured" error to overwrite the idle view.
    if (isCancelled) {
      isCancelled = false;
      return;
    }

    if (blobs.length === 0) {
      window.sorabase.doneRecording();
      return;
    }

    const combined = new Blob(blobs, { type: blobs[0].type || "audio/webm" });
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = (reader.result as string).split(",")[1];
      if (b64) window.sorabase.sendChunk(b64);
      window.sorabase.doneRecording();
    };
    reader.readAsDataURL(combined);
  };

  mediaRecorder.start(10_000);
}

// ---------------------------------------------------------------------------
// Stop / cancel
// ---------------------------------------------------------------------------

function stopCapture() {
  stopTimer();

  if (useLivePath) {
    stopDeepgramCapture();
    window.sorabase.doneRecordingLive();
    showView("uploading");
  } else {
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
}

function cancelCapture() {
  stopTimer();
  isCancelled = true; // must be set before mediaRecorder.stop() triggers onstop

  if (useLivePath) {
    stopDeepgramCapture();
  } else {
    mediaRecorder?.stop();
    mediaRecorder = null;
    captureStream?.getTracks().forEach((t) => t.stop());
    captureStream = null;
  }

  window.sorabase.cancelCapture();
  $<HTMLButtonElement>("btn-start").disabled = false;
  showView("idle");
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

function startTimer() {
  stopTimer();
  startTime = Date.now();
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
