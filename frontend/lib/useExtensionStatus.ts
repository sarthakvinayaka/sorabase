"use client";

import { useEffect, useRef, useState } from "react";

export interface ExtensionState {
  installed:  boolean;
  recording:  boolean;
  mode:       string | null;
  startTime:  number | null;
  label:      string | null;
  version:    string | null;
}

const INITIAL: ExtensionState = {
  installed:  false,
  recording:  false,
  mode:       null,
  startTime:  null,
  label:      null,
  version:    null,
};

const PING_TIMEOUT_MS = 600;

/**
 * Detects whether the Sorabase Capture Chrome extension is installed and
 * whether a recording is currently in progress.
 *
 * Uses a postMessage handshake with the extension's bridge content script.
 * The bridge responds with SORABASE_EXT_PONG carrying version + recording state.
 */
export function useExtensionStatus(): ExtensionState {
  const [state, setState] = useState<ExtensionState>(INITIAL);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;

      const { type, ...rest } = event.data ?? {};

      if (type === "SORABASE_EXT_PONG" || type === "SORABASE_EXT_PRESENT") {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setState({
          installed: true,
          recording: rest.recording ?? false,
          mode:      rest.mode     ?? null,
          startTime: rest.startTime ?? null,
          label:     rest.label    ?? null,
          version:   rest.version  ?? null,
        });
      }

      if (type === "SORABASE_RECORDING_STARTED") {
        setState((s) => ({
          ...s,
          installed: true,
          recording: true,
          mode:      rest.mode ?? s.mode,
        }));
      }

      if (type === "SORABASE_RECORDING_STOPPED") {
        setState((s) => ({
          ...s,
          recording: false,
          startTime: null,
        }));
      }
    }

    window.addEventListener("message", handleMessage);

    // Send ping; bridge responds if extension is installed
    window.postMessage({ type: "SORABASE_EXT_PING" }, "*");

    // If no pong within timeout, extension is not installed
    timeoutRef.current = setTimeout(() => {
      setState((s) => (s.installed ? s : INITIAL));
    }, PING_TIMEOUT_MS);

    return () => {
      window.removeEventListener("message", handleMessage);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return state;
}

/**
 * Subscribe to recording state changes only — lightweight version
 * for the nav indicator.
 */
export function useRecordingStatus(): { recording: boolean; installed: boolean } {
  const { recording, installed } = useExtensionStatus();
  return { recording, installed };
}
