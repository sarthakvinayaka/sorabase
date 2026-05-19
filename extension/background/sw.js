/**
 * SoraBase Capture — background service worker (Manifest V3)
 *
 * Responsibilities:
 *  - Manage offscreen document lifecycle
 *  - Orchestrate recording start/stop between popup and offscreen
 *  - Accumulate audio chunks from offscreen into session storage
 *  - Upload assembled audio to SoraBase via the extension upload endpoint
 *  - Notify popup/content-scripts of state changes
 *  - Open the created SoraBase record in the correct review flow
 *
 * MV3 notes:
 *  - Service workers can be terminated by Chrome at any time. All recording
 *    state is persisted to chrome.storage.session so that it survives a
 *    service-worker restart mid-recording.
 *  - chrome.offscreen.hasDocument() does NOT exist in MV3. Use
 *    chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }).
 *  - chrome.tabCapture.getMediaStreamId() is called in popup.js (requires a
 *    user-gesture context). The resulting stream ID is passed here.
 *  - Notifications require an absolute icon path via chrome.runtime.getURL().
 */

const OFFSCREEN_URL    = chrome.runtime.getURL("offscreen/offscreen.html");
const SORABASE_ORIGINS = [
  "https://sorabase.org",
  "https://www.sorabase.org",
  "http://localhost:3000",
];

// ---------------------------------------------------------------------------
// State helpers — persisted to chrome.storage.session for SW-restart resilience
// ---------------------------------------------------------------------------

const DEFAULT_STATE = {
  active:      false,
  tabId:       null,
  tabTitle:    "",
  mode:        "general",   // "general" | "recruiting" | "study"
  label:       "",
  micEnabled:  true,
  startTime:   null,
  sorabaseUrl: "https://sorabase.org",
  // Chunk data is stored separately as a flat list of base64 strings to avoid
  // the 8MB chrome.storage.session value-size limit on single keys.
  chunkCount:  0,
};

async function getState() {
  const { captureState } = await chrome.storage.session.get("captureState");
  return captureState ?? { ...DEFAULT_STATE };
}

async function setState(patch) {
  const current = await getState();
  await chrome.storage.session.set({ captureState: { ...current, ...patch } });
}

async function resetState() {
  // Clear state and all stored audio chunks.
  const { chunkCount } = await getState();
  const chunkKeys = Array.from({ length: chunkCount }, (_, i) => `chunk_${i}`);
  await chrome.storage.session.remove(["captureState", ...chunkKeys]);
}

// ---------------------------------------------------------------------------
// Offscreen document helpers
// ---------------------------------------------------------------------------

async function ensureOffscreen() {
  // chrome.offscreen.hasDocument() does not exist — use getContexts().
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [OFFSCREEN_URL],
  });
  if (existing.length > 0) return;

  await chrome.offscreen.createDocument({
    url:           OFFSCREEN_URL,
    reasons:       ["USER_MEDIA"],
    justification: "Record browser tab audio for SoraBase structured extraction",
  });
}

async function closeOffscreen() {
  try {
    const existing = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [OFFSCREEN_URL],
    });
    if (existing.length > 0) await chrome.offscreen.closeDocument();
  } catch (_) {
    // Already closed or not available.
  }
}

// ---------------------------------------------------------------------------
// Message routing
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.action) {

        case "start-capture": {
          const state = await getState();
          if (state.active) {
            sendResponse({ ok: false, error: "Already recording." });
            return;
          }

          const { streamId, tabId, tabTitle, mode, label, micEnabled, sorabaseUrl } = msg;

          await setState({
            active:      true,
            tabId,
            tabTitle:    tabTitle || "",
            mode:        mode || "general",
            label:       label || "",
            micEnabled:  micEnabled !== false,
            startTime:   Date.now(),
            sorabaseUrl: sorabaseUrl || "https://sorabase.org",
            chunkCount:  0,
          });

          await ensureOffscreen();

          await chrome.runtime.sendMessage({
            action:     "offscreen-start",
            streamId,
            micEnabled: micEnabled !== false,
          });

          await chrome.action.setBadgeText({ text: "REC" });
          await chrome.action.setBadgeBackgroundColor({ color: "#c0392b" });

          // Show in-page indicator on the captured tab.
          chrome.tabs.sendMessage(tabId, { action: "show-indicator" }).catch(() => {});

          // Inform any open SoraBase pages.
          notifySoraBasePages("recording-started", { mode: mode || "general" });

          sendResponse({ ok: true });
          break;
        }

        case "stop-capture": {
          const state = await getState();
          if (!state.active) {
            sendResponse({ ok: false, error: "No active recording." });
            return;
          }
          await chrome.runtime.sendMessage({ action: "offscreen-stop" });
          sendResponse({ ok: true });
          break;
        }

        case "cancel-capture": {
          const state = await getState();
          if (state.tabId) {
            chrome.tabs.sendMessage(state.tabId, { action: "hide-indicator" }).catch(() => {});
          }
          notifySoraBasePages("recording-stopped");
          await chrome.action.setBadgeText({ text: "" });
          await closeOffscreen();
          await resetState();
          sendResponse({ ok: true });
          break;
        }

        // Offscreen sends one message per MediaRecorder.ondataavailable event.
        case "audio-chunk": {
          if (!msg.data) { sendResponse({ ok: true }); return; }

          const state = await getState();
          const idx   = state.chunkCount;

          // Store each chunk under its own key to avoid size limits.
          await chrome.storage.session.set({ [`chunk_${idx}`]: msg.data });
          await setState({ chunkCount: idx + 1 });
          sendResponse({ ok: true });
          break;
        }

        // Offscreen fires this after MediaRecorder.onstop — all chunks delivered.
        case "recording-done": {
          await chrome.action.setBadgeText({ text: "" });
          await closeOffscreen();

          const state = await getState();
          if (state.tabId) {
            chrome.tabs.sendMessage(state.tabId, { action: "hide-indicator" }).catch(() => {});
          }
          notifySoraBasePages("recording-stopped");

          if (state.chunkCount === 0) {
            await notifyError("Recording captured no audio. Please try again.");
            await resetState();
            sendResponse({ ok: false });
            return;
          }

          try {
            const result = await assembleAndUpload(state);
            if (result.ok) {
              await openInSoraBase(result, state);
              await notifySuccess(state.mode);
            } else {
              await notifyError(result.error || "Upload failed. Please try again.");
            }
          } catch (err) {
            await notifyError(String(err));
          }

          await resetState();
          sendResponse({ ok: true });
          break;
        }

        case "get-state": {
          const state = await getState();
          sendResponse({
            active:    state.active,
            mode:      state.mode,
            label:     state.label,
            startTime: state.startTime,
            tabTitle:  state.tabTitle,
          });
          break;
        }

        default:
          sendResponse({ ok: false, error: `Unknown action: ${msg.action}` });
      }
    } catch (err) {
      console.error("[SoraBase SW]", err);
      sendResponse({ ok: false, error: String(err) });
    }
  })();
  return true; // keep message channel open for async response
});

// ---------------------------------------------------------------------------
// Audio assembly + upload
// ---------------------------------------------------------------------------

async function assembleAndUpload(state) {
  const { chunkCount, tabTitle, label, mode, sorabaseUrl } = state;

  // Re-assemble chunks from session storage.
  const keys   = Array.from({ length: chunkCount }, (_, i) => `chunk_${i}`);
  const stored = await chrome.storage.session.get(keys);

  const parts = keys.map((k) => stored[k]).filter(Boolean);

  // Decode base64 → ArrayBuffer → Uint8Array and concatenate.
  const arrays = parts.map((b64) => {
    const bin  = atob(b64);
    const buf  = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf;
  });

  const totalLength = arrays.reduce((acc, a) => acc + a.length, 0);
  const combined    = new Uint8Array(totalLength);
  let   offset      = 0;
  for (const arr of arrays) {
    combined.set(arr, offset);
    offset += arr.length;
  }

  const blob     = new Blob([combined], { type: "audio/webm;codecs=opus" });
  const filename = `sorabase-capture-${Date.now()}.webm`;
  const form     = new FormData();

  form.append("file",          blob, filename);
  form.append("mode",          mode);
  form.append("job_reference", label || tabTitle || "Browser capture");

  if (mode === "study") {
    // Populate study-specific fields from stored preferences.
    const prefs = await chrome.storage.local.get(["studyCourse", "studyTitle"]);
    if (prefs.studyCourse) form.append("course",  prefs.studyCourse);
    if (prefs.studyTitle)  form.append("title",   prefs.studyTitle);
    form.append("template_slug", "lecture_notes");
  }

  // Use the dedicated extension upload endpoint — standard session cookies.
  // credentials:"include" works from a service-worker fetch when the target
  // origin is listed in host_permissions and the browser has a session cookie.
  const endpoint = `${sorabaseUrl}/api/extension/upload`;

  let res;
  try {
    res = await fetch(endpoint, {
      method:      "POST",
      body:        form,
      credentials: "include",
    });
  } catch (err) {
    return { ok: false, error: `Network error: ${err.message}. Is SoraBase open?` };
  }

  if (!res.ok) {
    let detail = `Server error (${res.status})`;
    try {
      const body = await res.json();
      detail = body.detail || body.error || detail;
    } catch (_) {}

    if (res.status === 401) {
      return {
        ok: false,
        error: "Not signed in to SoraBase. Please open SoraBase, sign in, then try again.",
      };
    }
    return { ok: false, error: detail };
  }

  const data = await res.json();
  return { ok: true, ...data };
}

// ---------------------------------------------------------------------------
// Post-upload navigation
// ---------------------------------------------------------------------------

async function openInSoraBase(result, state) {
  const { sorabaseUrl, mode } = state;

  let url;
  if (mode === "study" && result.lecture_id) {
    url = `${sorabaseUrl}/study/processing/${result.lecture_id}?source=capture`;
  } else if (mode === "general" && result.conversation_id) {
    url = `${sorabaseUrl}/general/schema/${result.conversation_id}?source=capture`;
  } else if (result.conversation_id) {
    url = `${sorabaseUrl}/workflow?conv=${result.conversation_id}&source=capture`;
  } else {
    return; // nothing to open
  }

  // Reuse an existing SoraBase tab if one is open.
  const soraPatterns = SORABASE_ORIGINS.map((o) => `${o}/*`);
  const tabs = await chrome.tabs.query({ url: soraPatterns });

  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { url, active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const ICON = chrome.runtime.getURL("icons/icon48.png");

async function notifySuccess(mode) {
  const message = {
    general:    "Schema extraction ready. Open SoraBase to review.",
    recruiting: "Recording sent. Run your workflow to extract candidate data.",
    study:      "Lecture captured. Extraction in progress — open SoraBase to review.",
  }[mode] ?? "Recording processed. Open SoraBase to review.";

  chrome.notifications.create({
    type:    "basic",
    iconUrl: ICON,
    title:   "SoraBase — Recording processed",
    message,
  });
}

async function notifyError(message) {
  chrome.notifications.create({
    type:    "basic",
    iconUrl: ICON,
    title:   "SoraBase — Capture failed",
    message,
  });
}

// ---------------------------------------------------------------------------
// Relay recording state to open SoraBase pages (bridge.js listens for these)
// ---------------------------------------------------------------------------

async function notifySoraBasePages(action, extra = {}) {
  const patterns = SORABASE_ORIGINS.map((o) => `${o}/*`);
  const tabs = await chrome.tabs.query({ url: patterns });
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { action, ...extra }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Stop recording if the captured tab closes or reloads mid-session
// ---------------------------------------------------------------------------

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (state.active && state.tabId === tabId) {
    chrome.runtime.sendMessage({ action: "offscreen-stop" }).catch(() => {});
    await chrome.action.setBadgeText({ text: "" });
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  const state = await getState();
  if (state.active && state.tabId === tabId) {
    // Tab navigated away — stop and discard.
    chrome.runtime.sendMessage({ action: "offscreen-stop" }).catch(() => {});
    await chrome.action.setBadgeText({ text: "" });
    await closeOffscreen();
    await resetState();
  }
});
