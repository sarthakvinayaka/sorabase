/**
 * SoraBase Capture — background service worker (Manifest V3)
 *
 * Responsibilities:
 *  - Manage offscreen document lifecycle
 *  - Orchestrate recording start/stop between popup and offscreen
 *  - Accumulate audio chunks from offscreen
 *  - Upload assembled audio to SoraBase backend
 *  - Notify popup and open result in a new tab
 */

const OFFSCREEN_URL = chrome.runtime.getURL("offscreen/offscreen.html");
const OFFSCREEN_REASON = "USER_MEDIA";

// ─── State ──────────────────────────────────────────────────────────────────

let recordingState = {
  active:        false,
  tabId:         null,
  tabTitle:      "",
  mode:          "general", // "general" | "recruiting"
  label:         "",
  micEnabled:    true,
  startTime:     null,
  chunks:        [],        // ArrayBuffer[]
  sorabaseUrl:   "https://sorabase.org",
};

// ─── Offscreen document helpers ─────────────────────────────────────────────

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url:           OFFSCREEN_URL,
      reasons:       [OFFSCREEN_REASON],
      justification: "Recording browser audio for SoraBase structured extraction",
    });
  }
}

async function closeOffscreen() {
  try {
    if (await chrome.offscreen.hasDocument()) {
      await chrome.offscreen.closeDocument();
    }
  } catch (_) {
    // ignore
  }
}

// ─── Message routing ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.action) {

        case "start-capture": {
          const { streamId, tabId, tabTitle, mode, label, micEnabled, sorabaseUrl } = msg;
          if (recordingState.active) {
            sendResponse({ ok: false, error: "Already recording." });
            return;
          }
          recordingState = {
            active:      true,
            tabId,
            tabTitle:    tabTitle || "",
            mode:        mode || "general",
            label:       label || "",
            micEnabled:  micEnabled !== false,
            startTime:   Date.now(),
            chunks:      [],
            sorabaseUrl: sorabaseUrl || "https://sorabase.org",
          };

          await ensureOffscreen();

          // Forward stream ID to offscreen
          await chrome.runtime.sendMessage({
            action:     "offscreen-start",
            streamId,
            micEnabled: recordingState.micEnabled,
          });

          // Badge
          await chrome.action.setBadgeText({ text: "REC" });
          await chrome.action.setBadgeBackgroundColor({ color: "#c0392b" });

          // Show recording indicator on meeting tab
          chrome.tabs.sendMessage(tabId, { action: "show-indicator" }).catch(() => {});

          // Notify SoraBase pages of recording start
          notifySoraBasePages("recording-started", { mode: recordingState.mode });

          sendResponse({ ok: true });
          break;
        }

        case "stop-capture": {
          if (!recordingState.active) {
            sendResponse({ ok: false, error: "No active recording." });
            return;
          }
          // Tell offscreen to stop; it will send chunks back via "audio-chunk" + "recording-done"
          await chrome.runtime.sendMessage({ action: "offscreen-stop" });
          sendResponse({ ok: true });
          break;
        }

        case "audio-chunk": {
          // Offscreen sends individual MediaRecorder chunks as base64
          if (msg.data) {
            const binary = atob(msg.data);
            const bytes  = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            recordingState.chunks.push(bytes.buffer);
          }
          break;
        }

        case "recording-done": {
          // All chunks received — assemble and upload
          await chrome.action.setBadgeText({ text: "" });
          await closeOffscreen();

          // Hide indicator on meeting tab
          if (recordingState.tabId) {
            chrome.tabs.sendMessage(recordingState.tabId, { action: "hide-indicator" }).catch(() => {});
          }
          notifySoraBasePages("recording-stopped");

          if (recordingState.chunks.length === 0) {
            await notifyError("Recording captured no audio. Please try again.");
            recordingState.active = false;
            sendResponse({ ok: false });
            return;
          }

          try {
            const result = await uploadAudio(recordingState);
            if (result.ok) {
              await openInSoraBase(result, recordingState);
              await notifySuccess(recordingState.mode);
            } else {
              await notifyError(result.error || "Upload failed. Please try again.");
            }
          } catch (err) {
            await notifyError(String(err));
          }

          recordingState.active = false;
          recordingState.chunks = [];
          sendResponse({ ok: true });
          break;
        }

        case "get-state": {
          sendResponse({
            active:    recordingState.active,
            mode:      recordingState.mode,
            label:     recordingState.label,
            startTime: recordingState.startTime,
            tabTitle:  recordingState.tabTitle,
          });
          break;
        }

        case "cancel-capture": {
          await chrome.action.setBadgeText({ text: "" });
          if (recordingState.tabId) {
            chrome.tabs.sendMessage(recordingState.tabId, { action: "hide-indicator" }).catch(() => {});
          }
          notifySoraBasePages("recording-stopped");
          await closeOffscreen();
          recordingState.active  = false;
          recordingState.chunks  = [];
          sendResponse({ ok: true });
          break;
        }

        default:
          sendResponse({ ok: false, error: `Unknown action: ${msg.action}` });
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  })();
  return true; // keep message channel open for async response
});

// ─── Audio upload ─────────────────────────────────────────────────────────────

async function uploadAudio(state) {
  const { chunks, tabTitle, label, mode, sorabaseUrl } = state;

  // Assemble chunks into a single ArrayBuffer
  const totalLength = chunks.reduce((acc, buf) => acc + buf.byteLength, 0);
  const combined    = new Uint8Array(totalLength);
  let   offset      = 0;
  for (const chunk of chunks) {
    combined.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }

  const blob     = new Blob([combined], { type: "audio/webm;codecs=opus" });
  const filename = `sorabase-capture-${Date.now()}.webm`;
  const form     = new FormData();
  form.append("file",          blob, filename);
  form.append("job_reference", label || tabTitle || "Browser capture");

  const endpoint = `${sorabaseUrl}/api/audio`;

  let res;
  try {
    res = await fetch(endpoint, {
      method:      "POST",
      body:        form,
      credentials: "include", // send session cookies
    });
  } catch (err) {
    return { ok: false, error: `Network error: ${err.message}. Is SoraBase open?` };
  }

  if (!res.ok) {
    let detail = `Server error (${res.status})`;
    try {
      const body = await res.json();
      detail = body.detail || body.message || detail;
    } catch (_) {}

    if (res.status === 401) {
      return { ok: false, error: "Not signed in to SoraBase. Please sign in and try again." };
    }
    return { ok: false, error: detail };
  }

  const data = await res.json();
  return { ok: true, conversationId: data.conversation_id, transcriptReady: data.transcript_ready };
}

// ─── Post-upload navigation ────────────────────────────────────────────────

async function openInSoraBase({ conversationId, transcriptReady }, state) {
  const { sorabaseUrl, mode } = state;

  let url;
  if (mode === "general") {
    url = `${sorabaseUrl}/general/schema/${conversationId}?source=capture`;
  } else {
    // Recruiting: transcript conversation exists, user can run workflow on it
    url = `${sorabaseUrl}/workflow?conv=${conversationId}&source=capture`;
  }

  // Open in existing SoraBase tab or create new one
  const tabs = await chrome.tabs.query({ url: [`${sorabaseUrl}/*`, "http://localhost:3000/*"] });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { url, active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}

// ─── Notifications ─────────────────────────────────────────────────────────

async function notifySuccess(mode) {
  chrome.notifications.create({
    type:    "basic",
    iconUrl: "../icons/icon48.png",
    title:   "SoraBase — Recording processed",
    message: mode === "general"
      ? "Your recording is ready. Select a schema to extract structured data."
      : "Recording sent to SoraBase. Run your workflow to extract candidate data.",
  });
}

async function notifyError(message) {
  chrome.notifications.create({
    type:    "basic",
    iconUrl: "../icons/icon48.png",
    title:   "SoraBase — Capture failed",
    message,
  });
}

// ─── Notify SoraBase pages of recording state changes ───────────────────────

async function notifySoraBasePages(action, extra = {}) {
  const tabs = await chrome.tabs.query({
    url: ["https://sorabase.org/*", "https://www.sorabase.org/*", "http://localhost:3000/*"],
  });
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { action, ...extra }).catch(() => {});
  }
}

// ─── Tab removed listener (stop recording if captured tab closes) ───────────

chrome.tabs.onRemoved.addListener((tabId) => {
  if (recordingState.active && recordingState.tabId === tabId) {
    chrome.runtime.sendMessage({ action: "offscreen-stop" }).catch(() => {});
    chrome.action.setBadgeText({ text: "" });
    recordingState.active = false;
    recordingState.chunks = [];
    closeOffscreen();
  }
});
