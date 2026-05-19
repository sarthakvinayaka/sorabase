/**
 * SoraBase Capture — recording indicator (injected into meeting tabs)
 *
 * Shows a visible recording badge so meeting participants know they
 * are being recorded by SoraBase Capture.
 */

let indicator = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "show-indicator") {
    showIndicator();
  } else if (msg.action === "hide-indicator") {
    hideIndicator();
  }
});

function showIndicator() {
  if (indicator) return;

  indicator = document.createElement("div");
  indicator.id = "sorabase-capture-indicator";
  indicator.innerHTML = `
    <span class="sb-rec-dot"></span>
    <span class="sb-rec-label">Recording — SoraBase Capture</span>
  `;
  document.body.appendChild(indicator);
}

function hideIndicator() {
  if (indicator) {
    indicator.remove();
    indicator = null;
  }
}

// Check current recording state on load
chrome.runtime.sendMessage({ action: "get-state" }, (state) => {
  if (state?.active) showIndicator();
});
