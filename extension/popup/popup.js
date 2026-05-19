/**
 * SoraBase Capture — popup script
 *
 * Manages popup UI state, detects meeting pages, communicates with the
 * service worker to start/stop capture.
 */

const SORABASE_URLS = [
  "https://sorabase.org",
  "https://www.sorabase.org",
  "http://localhost:3000",
];

const MEETING_PATTERNS = [
  { host: "meet.google.com",    name: "Google Meet"   },
  { host: "zoom.us",            name: "Zoom"          },
  { host: "teams.microsoft.com", name: "Microsoft Teams" },
  { host: "app.teams.microsoft.com", name: "Microsoft Teams" },
];

// ─── State ──────────────────────────────────────────────────────────────────

let timerInterval = null;
let micOn         = true;

// ─── DOM helpers ─────────────────────────────────────────────────────────────

function $  (id)          { return document.getElementById(id); }
function show(id)         { $(id).classList.remove("hidden"); }
function hide(id)         { $(id).classList.add("hidden"); }
function setText(id, txt) { $(id).textContent = txt; }

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  setupToggle();
  setupSorabaseLink();
  await checkAuthAndRender();
});

async function checkAuthAndRender() {
  const sorabaseUrl = await getSorabaseUrl();

  // Check NextAuth session
  let session = null;
  try {
    const res = await fetch(`${sorabaseUrl}/api/auth/session`, { credentials: "include" });
    if (res.ok) session = await res.json();
  } catch (_) {
    // SoraBase not reachable
  }

  if (!session?.user) {
    // Not signed in
    show("not-signed-in");
    $("signin-btn").addEventListener("click", () => {
      chrome.tabs.create({ url: `${sorabaseUrl}/signin` });
    });
    return;
  }

  // Signed in
  show("signed-in");
  setText("user-email", session.user.email || session.user.name || "");

  // Check if already recording
  const state = await sw("get-state");
  if (state?.active) {
    showRecordingPanel(state.startTime);
  } else {
    await setupConfigPanel(sorabaseUrl);
  }
}

// ─── Config panel ─────────────────────────────────────────────────────────────

async function setupConfigPanel(sorabaseUrl) {
  show("config-panel");

  // Detect meeting on active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const match = detectMeeting(tab?.url);

  if (match) {
    setText("meeting-label", `${match.name} — active`);
    show("meeting-info");
    hide("no-meeting");
  } else {
    hide("meeting-info");
    show("no-meeting");
  }

  // Load stored mode preference
  const stored = await chrome.storage.local.get(["mode", "label"]);
  if (stored.mode) {
    document.querySelector(`input[name="mode"][value="${stored.mode}"]`).checked = true;
  }
  if (stored.label) {
    $("session-label").value = stored.label;
  }

  // Start button
  $("start-btn").addEventListener("click", async () => {
    const mode  = document.querySelector('input[name="mode"]:checked')?.value || "general";
    const label = $("session-label").value.trim();

    // Save preferences
    await chrome.storage.local.set({ mode, label });

    await startCapture(tab, mode, label, sorabaseUrl);
  });
}

async function startCapture(tab, mode, label, sorabaseUrl) {
  $("start-btn").disabled = true;
  $("start-btn").textContent = "Starting…";

  try {
    // tabCapture.getMediaStreamId must be called from the popup (user gesture context)
    const streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId(
        { targetTabId: tab.id },
        (id) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(id);
        },
      );
    });

    const result = await sw("start-capture", {
      streamId,
      tabId:      tab.id,
      tabTitle:   tab.title || "",
      mode,
      label,
      micEnabled: micOn,
      sorabaseUrl,
    });

    if (result?.ok) {
      showRecordingPanel(Date.now());
    } else {
      showError(result?.error || "Could not start capture.");
    }
  } catch (err) {
    showError(err.message || "Failed to start capture. Check permissions.");
  }
}

// ─── Recording panel ──────────────────────────────────────────────────────────

function showRecordingPanel(startTime) {
  hide("config-panel");
  hide("processing-panel");
  hide("error-panel");
  show("recording-panel");
  show("recording-badge");

  startTimer(startTime);

  $("stop-btn").onclick = async () => {
    stopTimer();
    hide("recording-panel");
    hide("recording-badge");
    show("processing-panel");
    await sw("stop-capture");
    // Processing is now async in the service worker;
    // popup will close naturally after user navigates away
    setTimeout(() => window.close(), 3000);
  };

  $("cancel-btn").onclick = async () => {
    stopTimer();
    await sw("cancel-capture");
    hide("recording-panel");
    hide("recording-badge");
    const sorabaseUrl = await getSorabaseUrl();
    await setupConfigPanel(sorabaseUrl);
  };
}

// ─── Error panel ──────────────────────────────────────────────────────────────

function showError(message) {
  hide("config-panel");
  hide("recording-panel");
  hide("processing-panel");
  show("error-panel");
  setText("error-message", message);

  $("retry-btn").onclick = async () => {
    hide("error-panel");
    const sorabaseUrl = await getSorabaseUrl();
    await setupConfigPanel(sorabaseUrl);
    show("config-panel");
  };
}

// ─── Timer ────────────────────────────────────────────────────────────────────

function startTimer(startTime) {
  stopTimer();
  function tick() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    setText("recording-timer", `${m}:${String(s).padStart(2, "0")}`);
  }
  tick();
  timerInterval = setInterval(tick, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ─── Toggle setup ─────────────────────────────────────────────────────────────

function setupToggle() {
  const btn = $("mic-toggle");
  btn.setAttribute("aria-checked", "true");

  btn.addEventListener("click", () => {
    micOn = !micOn;
    btn.setAttribute("aria-checked", String(micOn));
  });
}

// ─── SoraBase link ───────────────────────────────────────────────────────────

async function setupSorabaseLink() {
  const url = await getSorabaseUrl();
  const link = $("sorabase-link");
  if (link) link.href = url;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectMeeting(url) {
  if (!url) return null;
  for (const p of MEETING_PATTERNS) {
    if (url.includes(p.host)) return p;
  }
  return null;
}

async function getSorabaseUrl() {
  const stored = await chrome.storage.local.get("sorabaseUrl");
  return stored.sorabaseUrl || "https://sorabase.org";
}

// Send a message to the service worker and await the response
function sw(action, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...data }, (response) => {
      resolve(response);
    });
  });
}
