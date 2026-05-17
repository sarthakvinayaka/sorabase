"use client";

import { useEffect, useRef, useState } from "react";
import {
  downloadGeneralJson,
  downloadGeneralCsv,
  getGeneralExportPayload,
  sendGeneralWebhook,
  ApiError,
} from "@/lib/api";

interface Props {
  candidateId: string;
}

type Panel = "menu" | "webhook" | "api" | null;
type ActionState = "idle" | "loading" | "done" | "error";

// ─── Root component ───────────────────────────────────────────────────────────

export default function GeneralExportMenu({ candidateId }: Props) {
  const [panel,      setPanel]      = useState<Panel>(null);
  const [copyState,  setCopyState]  = useState<ActionState>("idle");
  const [copyError,  setCopyError]  = useState<string | null>(null);
  const [jsonState,  setJsonState]  = useState<ActionState>("idle");
  const [csvState,   setCsvState]   = useState<ActionState>("idle");
  const [dlError,    setDlError]    = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!panel) return;
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setPanel(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panel]);

  async function handleJson() {
    setJsonState("loading"); setDlError(null);
    try {
      await downloadGeneralJson(candidateId);
      setJsonState("done");
      setTimeout(() => { setJsonState("idle"); setPanel(null); }, 800);
    } catch (err) {
      setDlError(err instanceof ApiError ? err.detail : "Download failed.");
      setJsonState("error");
    }
  }

  async function handleCsv() {
    setCsvState("loading"); setDlError(null);
    try {
      await downloadGeneralCsv(candidateId);
      setCsvState("done");
      setTimeout(() => { setCsvState("idle"); setPanel(null); }, 800);
    } catch (err) {
      setDlError(err instanceof ApiError ? err.detail : "Download failed.");
      setCsvState("error");
    }
  }

  async function handleCopy() {
    setCopyState("loading"); setCopyError(null);
    try {
      const payload = await getGeneralExportPayload(candidateId);
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyState("done");
      setTimeout(() => { setCopyState("idle"); setPanel(null); }, 1200);
    } catch (err) {
      setCopyError(err instanceof ApiError ? err.detail : "Copy failed.");
      setCopyState("error");
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setPanel((p) => (p === "menu" ? null : "menu"))}
        className="btn-secondary text-xs py-1.5 flex items-center gap-1"
      >
        Export
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Dropdown menu ─────────────────────────────────────────────────── */}
      {panel === "menu" && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg z-20 py-1 text-xs">

          {/* JSON download */}
          <MenuButton
            icon={<DownloadIcon />}
            label={jsonState === "loading" ? "Downloading…" : jsonState === "done" ? "Downloaded ✓" : "Export JSON"}
            disabled={jsonState === "loading"}
            onClick={handleJson}
          />

          {/* CSV download */}
          <MenuButton
            icon={<DownloadIcon />}
            label={csvState === "loading" ? "Downloading…" : csvState === "done" ? "Downloaded ✓" : "Export CSV"}
            disabled={csvState === "loading"}
            onClick={handleCsv}
          />

          {/* Copy payload */}
          <MenuButton
            icon={<ClipboardIcon />}
            label={
              copyState === "loading" ? "Copying…" :
              copyState === "done"    ? "Copied to clipboard ✓" :
              copyState === "error"   ? "Copy failed" :
                                        "Copy payload"
            }
            disabled={copyState === "loading"}
            onClick={handleCopy}
          />

          <div className="my-1 border-t border-stone-100 dark:border-stone-800" />

          {/* Webhook */}
          <MenuButton
            icon={<WebhookIcon />}
            label="Send to webhook…"
            onClick={() => setPanel("webhook")}
          />

          {/* API endpoint */}
          <MenuButton
            icon={<ApiIcon />}
            label="API endpoint"
            onClick={() => setPanel("api")}
          />

          {/* Error */}
          {dlError && (
            <p className="px-3 py-2 text-2xs text-red-500 dark:text-red-400">{dlError}</p>
          )}
          {copyError && (
            <p className="px-3 py-2 text-2xs text-red-500 dark:text-red-400">{copyError}</p>
          )}
        </div>
      )}

      {/* ── Webhook panel ─────────────────────────────────────────────────── */}
      {panel === "webhook" && (
        <WebhookPanel
          candidateId={candidateId}
          onClose={() => setPanel(null)}
        />
      )}

      {/* ── API endpoint panel ────────────────────────────────────────────── */}
      {panel === "api" && (
        <ApiPanel
          candidateId={candidateId}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}

// ─── Webhook panel ────────────────────────────────────────────────────────────

function WebhookPanel({ candidateId, onClose }: { candidateId: string; onClose: () => void }) {
  const [url,                setUrl]                = useState("");
  const [includeTranscript,  setIncludeTranscript]  = useState(false);
  const [includeSummary,     setIncludeSummary]      = useState(true);
  const [state,              setState]              = useState<ActionState>("idle");
  const [result,             setResult]             = useState<{
    status: "delivered" | "failed";
    http_status: number | null;
    attempt: number;
    error_message: string | null;
  } | null>(null);

  async function handleSend() {
    if (!url.trim()) return;
    setState("loading");
    setResult(null);
    try {
      const r = await sendGeneralWebhook(candidateId, url.trim(), {
        includeTranscript,
        includeSummary,
      });
      setResult(r);
      setState(r.status === "delivered" ? "done" : "error");
    } catch (err) {
      setResult({
        status: "failed",
        http_status: null,
        attempt: 1,
        error_message: err instanceof ApiError ? err.detail : "Request failed.",
      });
      setState("error");
    }
  }

  return (
    <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg z-20 p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-stone-700 dark:text-stone-300">Send to webhook</p>
        <CloseButton onClick={onClose} />
      </div>

      <input
        type="url"
        placeholder="https://your-server.example.com/hook"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="input text-xs w-full"
        disabled={state === "loading"}
      />

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 cursor-pointer text-stone-600 dark:text-stone-400">
          <input
            type="checkbox"
            checked={includeSummary}
            onChange={(e) => setIncludeSummary(e.target.checked)}
            className="h-3 w-3 rounded text-teal-600"
          />
          Include AI summary
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-stone-600 dark:text-stone-400">
          <input
            type="checkbox"
            checked={includeTranscript}
            onChange={(e) => setIncludeTranscript(e.target.checked)}
            className="h-3 w-3 rounded text-teal-600"
          />
          Include transcript text
        </label>
      </div>

      {result && (
        <div className={[
          "rounded-lg border px-3 py-2 space-y-0.5",
          result.status === "delivered"
            ? "bg-positive-light border-positive-border text-positive-text"
            : "bg-negative-light border-negative-border text-negative-text",
        ].join(" ")}>
          <p className="font-medium">
            {result.status === "delivered"
              ? `Delivered (HTTP ${result.http_status})`
              : `Failed after ${result.attempt} attempt${result.attempt !== 1 ? "s" : ""}`}
          </p>
          {result.error_message && (
            <p className="text-2xs opacity-80">{result.error_message}</p>
          )}
          {result.http_status && result.status !== "delivered" && (
            <p className="text-2xs opacity-80">HTTP {result.http_status}</p>
          )}
        </div>
      )}

      <p className="text-2xs text-stone-400 dark:text-stone-500 leading-relaxed">
        Retries up to 3× on server errors. Sends{" "}
        <code className="font-mono bg-stone-100 dark:bg-stone-800 px-0.5 rounded">
          X-Pilot-Event: general.extraction.exported
        </code>
        .
      </p>

      <button
        type="button"
        onClick={handleSend}
        disabled={!url.trim() || state === "loading"}
        className="btn-primary text-xs py-1.5 w-full justify-center flex items-center gap-1.5"
      >
        {state === "loading" && <Spinner />}
        {state === "loading" ? "Sending…" : "Send"}
      </button>
    </div>
  );
}

// ─── API endpoint panel ───────────────────────────────────────────────────────

function ApiPanel({ candidateId, onClose }: { candidateId: string; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  const endpoints = [
    {
      method: "GET",
      label:  "JSON payload",
      path:   `/api/candidates/${candidateId}/general-export/payload`,
    },
    {
      method: "GET",
      label:  "JSON download",
      path:   `/api/candidates/${candidateId}/general-export`,
    },
    {
      method: "GET",
      label:  "CSV download",
      path:   `/api/candidates/${candidateId}/general-export/csv`,
    },
    {
      method: "POST",
      label:  "Webhook delivery",
      path:   `/api/candidates/${candidateId}/general-export/webhook`,
    },
  ];

  async function handleCopy(path: string) {
    const full = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(full);
    setCopied(path);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="absolute right-0 top-full mt-1 w-96 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg z-20 p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-stone-700 dark:text-stone-300">API endpoints</p>
        <CloseButton onClick={onClose} />
      </div>

      <p className="text-2xs text-stone-400 dark:text-stone-500 leading-relaxed">
        Hit these directly from any HTTP client. Add{" "}
        <code className="font-mono bg-stone-100 dark:bg-stone-800 px-0.5 rounded">?include_transcript=true</code>{" "}
        to GET requests to include transcript text.
      </p>

      <div className="space-y-1.5">
        {endpoints.map((ep) => (
          <div
            key={ep.path}
            className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800 rounded px-2.5 py-2"
          >
            <span className={[
              "shrink-0 font-mono font-semibold text-2xs px-1 py-0.5 rounded",
              ep.method === "GET"
                ? "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400"
                : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
            ].join(" ")}>
              {ep.method}
            </span>
            <code className="font-mono text-2xs text-stone-600 dark:text-stone-400 flex-1 truncate">
              {ep.path}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(ep.path)}
              className="shrink-0 text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
              title="Copy full URL"
            >
              {copied === ep.path
                ? <CheckIcon />
                : <ClipboardIcon />}
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-stone-100 dark:border-stone-800 pt-2.5">
        <p className="text-2xs text-stone-400 dark:text-stone-500 mb-1.5">
          Webhook body shape (POST):
        </p>
        <pre className="text-2xs font-mono bg-stone-50 dark:bg-stone-800 rounded p-2 text-stone-600 dark:text-stone-400 overflow-x-auto">{`{
  "url": "https://...",
  "include_transcript": false,
  "include_summary": true
}`}</pre>
      </div>
    </div>
  );
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function MenuButton({
  icon, label, onClick, disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-3 py-2 flex items-center gap-2 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <span className="text-stone-400 dark:text-stone-500 shrink-0">{icon}</span>
      {label}
    </button>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

function Spinner() {
  return (
    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function WebhookIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ApiIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}
