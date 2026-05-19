/**
 * SoraBase Capture — bridge content script (injected into SoraBase pages)
 *
 * Enables communication between the SoraBase web app and the extension.
 * The app sends postMessage pings; this script responds with extension info.
 * Also relays recording state changes to the app.
 */

// Announce extension presence to the page
window.postMessage({ type: "SORABASE_EXT_PRESENT", version: "1.0.0" }, "*");

// Listen for pings from the SoraBase app
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data?.type === "SORABASE_EXT_PING") {
    chrome.runtime.sendMessage({ action: "get-state" }, (state) => {
      window.postMessage({
        type:      "SORABASE_EXT_PONG",
        version:   "1.0.0",
        recording: state?.active || false,
        mode:      state?.mode,
        startTime: state?.startTime,
        label:     state?.label,
      }, "*");
    });
  }

  if (event.data?.type === "SORABASE_EXT_REQUEST_STATE") {
    chrome.runtime.sendMessage({ action: "get-state" }, (state) => {
      window.postMessage({
        type:      "SORABASE_EXT_STATE",
        recording: state?.active || false,
        mode:      state?.mode,
        startTime: state?.startTime,
        label:     state?.label,
      }, "*");
    });
  }
});

// Forward recording state changes from SW to the page
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "recording-started") {
    window.postMessage({ type: "SORABASE_RECORDING_STARTED", ...msg }, "*");
  }
  if (msg.action === "recording-stopped") {
    window.postMessage({ type: "SORABASE_RECORDING_STOPPED" }, "*");
  }
});
