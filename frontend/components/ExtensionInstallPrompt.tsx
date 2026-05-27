"use client";

import { useExtensionStatus } from "@/lib/useExtensionStatus";

interface Props {
  /** Variant: "inline" = card in a content area, "banner" = dismissible top banner */
  variant?: "inline" | "banner";
  /** Only show if extension is NOT installed (default true) */
  onlyWhenMissing?: boolean;
  className?: string;
}

const CHROME_STORE_URL = "https://chrome.google.com/webstore/detail/sorabase-capture/EXTENSION_ID";

export default function ExtensionInstallPrompt({
  variant = "inline",
  onlyWhenMissing = true,
  className = "",
}: Props) {
  const { installed } = useExtensionStatus();

  if (onlyWhenMissing && installed) return null;
  if (!onlyWhenMissing && installed) return null;

  if (variant === "banner") {
    return (
      <div className={`flex items-center gap-3 bg-aubergine-50 dark:bg-aubergine-950/20 border border-aubergine-200 dark:border-aubergine-900 rounded-lg px-4 py-3 ${className}`}>
        <MicIcon />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-aubergine-900 dark:text-aubergine-300">
            Sorabase Capture not installed
          </p>
          <p className="text-2xs text-aubergine-700 dark:text-aubergine-400 mt-0.5">
            Install the extension to record browser meetings and capture audio directly.
          </p>
        </div>
        <a
          href={CHROME_STORE_URL}
          target="_blank"
          rel="noreferrer"
          className="flex-shrink-0 rounded bg-aubergine-800 text-white text-xs font-semibold px-3 py-1.5 hover:bg-aubergine-900 transition-colors whitespace-nowrap"
        >
          Install →
        </a>
      </div>
    );
  }

  // Inline card
  return (
    <div className={`rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 ${className}`}>
      <div className="flex items-start gap-3.5 mb-4">
        <div className="w-9 h-9 rounded-lg bg-aubergine-50 dark:bg-aubergine-950/30 border border-aubergine-100 dark:border-aubergine-900 flex items-center justify-center flex-shrink-0">
          <MicIcon />
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">
            Sorabase Capture
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
            Chrome extension · free
          </p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {[
          "Record Google Meet, Zoom, and Teams directly in your browser",
          "Mix tab audio and microphone into a clean recording",
          "Automatically send the transcript to your Sorabase workflow",
        ].map((feat) => (
          <div key={feat} className="flex items-start gap-2">
            <svg className="w-3.5 h-3.5 text-positive-DEFAULT flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-xs text-stone-600 dark:text-stone-400">{feat}</p>
          </div>
        ))}
      </div>

      <a
        href={CHROME_STORE_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 w-full justify-center rounded bg-aubergine-800 text-white text-xs font-semibold px-4 py-2.5 hover:bg-aubergine-900 transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Install extension
      </a>

      <p className="text-2xs text-stone-400 dark:text-stone-500 text-center mt-2">
        Chrome 112+ · Requires consent before recording
      </p>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-aubergine-700 dark:text-aubergine-400">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M9 11V7a3 3 0 116 0v4a3 3 0 11-6 0z"/>
    </svg>
  );
}
