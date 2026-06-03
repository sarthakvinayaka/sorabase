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

  // Audio data streaming (renderer → main, fire-and-forget)
  sendChunk:     (b64: string) => ipcRenderer.send("capture:chunk", b64),
  doneRecording: ()            => ipcRenderer.send("capture:done"),

  // Events pushed from main → renderer
  onStatus:     (cb: (s: StatusPayload) => void) =>
    ipcRenderer.on("status", (_e, s) => cb(s)),
  onAuthSignedIn: (cb: () => void) =>
    ipcRenderer.on("auth:signed-in", () => cb()),

  // OS permission check (screen recording)
  screenPermission: () => ipcRenderer.invoke("permission:screen"),

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
