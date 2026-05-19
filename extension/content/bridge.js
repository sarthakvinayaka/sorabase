/**
 * SoraBase Capture — bridge content script (injected into SoraBase pages)
 *
 * Responsibilities:
 *  1. Announce extension presence to the SoraBase web app on load.
 *  2. Answer ping/state-request messages from the app.
 *  3. Forward recording state changes from the service worker to the app.
 *
 * Security notes:
 *  - All postMessage events are checked for origin and source === window.
 *  - The extension never forwards arbitrary page messages to chrome.runtime;
 *    only known, typed messages are relayed.
 *  - No sensitive data (tokens, user IDs) is exposed via postMessage.
 */

// ─── Announce presence ────────────────────────────────────────────────────────

window.postMessage(
  { type: "SORABASE_EXT_PRESENT", version: chrome.runtime.getManifest().version },
  window.location.origin,
);

// ─── Listen for app → extension messages ─────────────────────────────────────

window.addEventListener("message", (event) => {
  // Reject messages from other frames or cross-origin sources.
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;

  const msg = event.data;
  if (!msg?.type) return;

  switch (msg.type) {

    // App pings to check if extension is installed.
    case "SORABASE_EXT_PING":
      chrome.runtime.sendMessage({ action: "get-state" }, (state) => {
        if (chrome.runtime.lastError) return; // extension context gone
        window.postMessage({
          type:      "SORABASE_EXT_PONG",
          version:   chrome.runtime.getManifest().version,
          recording: state?.active    || false,
          mode:      state?.mode      || null,
          startTime: state?.startTime || null,
          label:     state?.label     || null,
        }, window.location.origin);
      });
      break;

    // App requests current capture state.
    case "SORABASE_EXT_REQUEST_STATE":
      chrome.runtime.sendMessage({ action: "get-state" }, (state) => {
        if (chrome.runtime.lastError) return;
        window.postMessage({
          type:      "SORABASE_EXT_STATE",
          recording: state?.active    || false,
          mode:      state?.mode      || null,
          startTime: state?.startTime || null,
          label:     state?.label     || null,
          tabTitle:  state?.tabTitle  || null,
        }, window.location.origin);
      });
      break;

    // App requests cancellation of an active recording.
    case "SORABASE_EXT_CANCEL":
      chrome.runtime.sendMessage({ action: "cancel-capture" }, () => {});
      break;

    default:
      break;
  }
});

// ─── Relay service-worker state changes to the app ───────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg?.action) return;

  if (msg.action === "recording-started") {
    window.postMessage({
      type: "SORABASE_RECORDING_STARTED",
      mode: msg.mode || null,
    }, window.location.origin);
  }

  if (msg.action === "recording-stopped") {
    window.postMessage({ type: "SORABASE_RECORDING_STOPPED" }, window.location.origin);
  }
});
