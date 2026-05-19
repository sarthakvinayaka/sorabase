/**
 * SoraBase Capture — popup script
 *
 * State machine:
 *   unauthenticated → config → recording → processing → (result|error)
 *
 * Auth strategy:
 *   The popup fetches /api/auth/session with credentials:"include". In Chrome,
 *   extension fetch() calls include cookies when the target is in host_permissions,
 *   bypassing SameSite restrictions (unlike regular cross-site requests). If the
 *   user is signed in to SoraBase in the same browser profile, this returns a valid
 *   session without any additional auth setup.
 *
 * Modes:
 *   general    → review at /general/schema/{conversationId}
 *   recruiting → workflow at /workflow?conv={conversationId}
 *   study      → processing at /study/processing/{lectureId}
 */

const MEETING_PATTERNS = [
  { host: "meet.google.com",        name: "Google Meet"      },
  { host: "zoom.us",                name: "Zoom"             },
  { host: "teams.microsoft.com",    name: "Microsoft Teams"  },
  { host: "app.teams.microsoft.com",name: "Microsoft Teams"  },
  { host: "webex.com",              name: "Webex"            },
  { host: "whereby.com",            name: "Whereby"          },
];

// ─── State ───────────────────────────────────────────────────────────────────

let timerInterval = null;
let micOn         = true;

// ─── DOM helpers ─────────────────────────────────────────────────────────────

const $       = (id) => document.getElementById(id);
const show    = (id) => $(id).classList.remove("hidden");
const hide    = (id) => $(id).classList.add("hidden");
const setText = (id, txt) => $(id).textContent = txt;

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  setupMicToggle();
  setupModeToggle();
  setupSoraBaseLink();
  await checkAuthAndRender();
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function checkAuthAndRender() {
  const sorabaseUrl = await getSorabaseUrl();
  let session = null;

  try {
    // credentials:"include" sends session cookies — works from extension SW
    // when the target is in host_permissions.
    const res = await fetch(`${sorabaseUrl}/api/auth/session`, {
      credentials: "include",
    });
    if (res.ok) {
      const body = await res.json();
      // NextAuth returns {} (empty object) for unauthenticated sessions.
      if (body?.user) session = body;
    }
  } catch (_) {
    // SoraBase is unreachable (offline or not open).
  }

  if (!session?.user) {
    show("not-signed-in");
    $("signin-btn").addEventListener("click", () => {
      chrome.tabs.create({ url: `${sorabaseUrl}/signin` });
    });
    return;
  }

  show("signed-in");
  setText("user-email", session.user.email || session.user.name || "");

  // Restore stored preferences.
  const prefs = await chrome.storage.local.get(["mode", "label", "studyTitle", "studyCourse"]);
  if (prefs.mode) {
    const radio = document.querySelector(`input[name="mode"][value="${prefs.mode}"]`);
    if (radio) { radio.checked = true; toggleStudyFields(prefs.mode); }
  }
  if (prefs.label)       $("session-label").value  = prefs.label;
  if (prefs.studyTitle)  $("study-title").value    = prefs.studyTitle;
  if (prefs.studyCourse) $("study-course").value   = prefs.studyCourse;

  // Check if a recording is already active (SW may have been running before popup opened).
  const state = await sw("get-state");
  if (state?.active) {
    showRecordingPanel(state.startTime, sorabaseUrl);
  } else {
    await setupConfigPanel(sorabaseUrl);
  }
}

// ─── Config panel ─────────────────────────────────────────────────────────────

async function setupConfigPanel(sorabaseUrl) {
  show("config-panel");

  // Detect meeting on active tab.
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

  $("start-btn").addEventListener("click", async () => {
    const mode        = document.querySelector('input[name="mode"]:checked')?.value || "general";
    const label       = $("session-label").value.trim();
    const studyTitle  = $("study-title").value.trim();
    const studyCourse = $("study-course").value.trim();

    // Persist preferences for next time.
    await chrome.storage.local.set({ mode, label, studyTitle, studyCourse });

    await startCapture(tab, mode, label, sorabaseUrl);
  });
}

async function startCapture(tab, mode, label, sorabaseUrl) {
  $("start-btn").disabled = true;
  $("start-btn").textContent = "Starting…";

  try {
    // tabCapture.getMediaStreamId must be called from a user-gesture context
    // (i.e., in response to a click in the popup). It cannot be called from
    // the service worker directly.
    const streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId(
        { targetTabId: tab.id },
        (id) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(id);
          }
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
      showRecordingPanel(Date.now(), sorabaseUrl);
    } else {
      showError(result?.error || "Could not start capture.");
    }
  } catch (err) {
    // tabCapture.getMediaStreamId fails if the tab is a chrome:// page,
    // a different extension's popup, or if the user denied tab capture.
    showError(err.message || "Could not access tab audio. Check permissions.");
  }
}

// ─── Recording panel ──────────────────────────────────────────────────────────

function showRecordingPanel(startTime, sorabaseUrl) {
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
    // The service worker handles upload asynchronously and opens SoraBase when
    // done. The popup can close — the SW will complete the upload independently.
    setTimeout(() => window.close(), 4000);
  };

  $("cancel-btn").onclick = async () => {
    stopTimer();
    await sw("cancel-capture");
    hide("recording-panel");
    hide("recording-badge");
    show("config-panel");
    $("start-btn").disabled = false;
    $("start-btn").textContent = "Start capture";
    $("start-btn").innerHTML = '<span class="btn-dot"></span> Start capture';
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
    show("config-panel");
    $("start-btn").disabled = false;
    $("start-btn").innerHTML = '<span class="btn-dot"></span> Start capture';
  };
}

// ─── Timer ────────────────────────────────────────────────────────────────────

function startTimer(startTime) {
  stopTimer();
  const tick = () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    setText("recording-timer", `${m}:${String(s).padStart(2, "0")}`);
  };
  tick();
  timerInterval = setInterval(tick, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ─── Mic toggle ───────────────────────────────────────────────────────────────

function setupMicToggle() {
  const btn = $("mic-toggle");
  btn.setAttribute("aria-checked", "true");

  btn.addEventListener("click", () => {
    micOn = !micOn;
    btn.setAttribute("aria-checked", String(micOn));
  });
}

// ─── Mode toggle — show/hide Study fields ─────────────────────────────────────

function setupModeToggle() {
  document.querySelectorAll('input[name="mode"]').forEach((radio) => {
    radio.addEventListener("change", () => toggleStudyFields(radio.value));
  });
}

function toggleStudyFields(mode) {
  if (mode === "study") {
    show("study-fields");
  } else {
    hide("study-fields");
  }
}

// ─── SoraBase link ────────────────────────────────────────────────────────────

async function setupSoraBaseLink() {
  const url = await getSorabaseUrl();
  const link = $("sorabase-link");
  if (link) link.href = url;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function sw(action, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...data }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}
