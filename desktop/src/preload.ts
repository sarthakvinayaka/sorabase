/**
 * Preload — runs in a privileged context bridging main ↔ renderer.
 * contextBridge.exposeInMainWorld keeps the renderer sandboxed while
 * giving it exactly the IPC surface it needs.
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("sorabase", {
  // Auth
  checkAuth: () => ipcRenderer.invoke("auth:check"),
  login:     () => ipcRenderer.invoke("auth:login"),
  logout:    () => ipcRenderer.invoke("auth:logout"),

  // Capture lifecycle (renderer → main)
  startCapture:  (opts: { mode: string; label: string }) =>
    ipcRenderer.invoke("capture:start", opts),
  cancelCapture: () => ipcRenderer.invoke("capture:cancel"),

  // Audio data streaming — legacy path (no Deepgram key) (renderer → main, fire-and-forget)
  sendChunk:     (b64: string) => ipcRenderer.send("capture:chunk", b64),
  doneRecording: ()            => ipcRenderer.send("capture:done"),

  // Live text chunk streaming — Deepgram path (renderer → main, fire-and-forget)
  sendTextChunk: (text: string, speaker?: string, confidence?: number) =>
    ipcRenderer.send("capture:text-chunk", { text, speaker, confidence }),
  doneRecordingLive: () => ipcRenderer.send("capture:done-live"),

  // Events pushed from main → renderer
  onStatus:     (cb: (s: StatusPayload) => void) =>
    ipcRenderer.on("status", (_e, s) => cb(s)),
  onAuthSignedIn: (cb: () => void) =>
    ipcRenderer.on("auth:signed-in", () => cb()),
  onStopFromTray:   (cb: () => void) => ipcRenderer.on("capture:stop-from-tray",   () => cb()),
  onCancelFromTray: (cb: () => void) => ipcRenderer.on("capture:cancel-from-tray", () => cb()),

  // OS permission check (screen recording)
  screenPermission: () => ipcRenderer.invoke("permission:screen"),

  // Open System Settings (can't use shell directly in sandboxed renderer)
  openSystemSettings: () => ipcRenderer.invoke("open:system-settings"),

  // Expose env vars the renderer needs (read-only, set before app launch)
  // DEEPGRAM_API_KEY — set this env var to enable Granola-style live transcription.
  // When absent the app falls back to the existing audio-upload + Whisper path.
  deepgramKey: () => (process.env.DEEPGRAM_API_KEY ?? null) as string | null,
  sorabaseUrl: () => (process.env.SORABASE_URL ?? "https://www.sorabase.org"),

  // Clean up listeners to avoid leaks on hot-reload in dev
  off: (channel: string) => ipcRenderer.removeAllListeners(channel),
});

// Type declarations consumed by the renderer
export interface StatusPayload {
  state: "uploading" | "done" | "error";
  message?: string;
  result?: {
    redirect_url?: string;
    conversation_id?: string;
    lecture_id?: string;
  };
}
