/**
 * SoraBase Capture — offscreen document
 *
 * Runs MediaRecorder + Web Audio API mixing.
 * Receives messages from the service worker to start/stop recording.
 * Sends audio chunks back as base64 strings via chrome.runtime.sendMessage.
 *
 * MV3 requirement: MediaRecorder and getUserMedia must run here, not in the
 * service worker, because service workers cannot access media APIs.
 */

let mediaRecorder  = null;
let audioContext   = null;
let tabStream      = null;
let micStream      = null;
let destination    = null;

// ─── Message listener ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.action) {
        case "offscreen-start":
          await startRecording(msg.streamId, msg.micEnabled !== false);
          sendResponse({ ok: true });
          break;

        case "offscreen-stop":
          stopRecording();
          sendResponse({ ok: true });
          break;

        default:
          sendResponse({ ok: false });
      }
    } catch (err) {
      console.error("[SoraBase offscreen]", err);
      sendResponse({ ok: false, error: String(err) });
    }
  })();
  return true;
});

// ─── Recording ───────────────────────────────────────────────────────────────

async function startRecording(streamId, micEnabled) {
  if (mediaRecorder) stopRecording();

  // 1. Capture tab audio using the stream ID from tabCapture.getMediaStreamId
  tabStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource:   "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  // 2. Create AudioContext for mixing
  audioContext = new AudioContext();
  destination  = audioContext.createMediaStreamDestination();

  const tabSource = audioContext.createMediaStreamSource(tabStream);
  tabSource.connect(destination);

  // 3. Mix in microphone if requested
  if (micEnabled) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(destination);
    } catch (err) {
      console.warn("[SoraBase offscreen] Mic unavailable, continuing with tab audio only:", err.message);
    }
  }

  // 4. Start MediaRecorder on mixed stream
  const mimeType = getSupportedMimeType();
  const options  = mimeType ? { mimeType } : {};

  mediaRecorder = new MediaRecorder(destination.stream, options);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      // Convert Blob to base64 and send to service worker
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(",")[1];
        chrome.runtime.sendMessage({ action: "audio-chunk", data: base64 });
      };
      reader.readAsDataURL(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    // Signal that recording is fully done
    chrome.runtime.sendMessage({ action: "recording-done" });
    cleanup();
  };

  // Collect chunks every 10 seconds for smoother data flow
  mediaRecorder.start(10_000);
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop(); // triggers onstop → recording-done
  } else {
    chrome.runtime.sendMessage({ action: "recording-done" });
    cleanup();
  }
}

function cleanup() {
  if (tabStream) { tabStream.getTracks().forEach((t) => t.stop()); tabStream = null; }
  if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
  if (audioContext) { audioContext.close(); audioContext = null; }
  mediaRecorder = null;
  destination   = null;
}

// ─── Codec selection ─────────────────────────────────────────────────────────

function getSupportedMimeType() {
  const preferred = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  for (const type of preferred) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}
