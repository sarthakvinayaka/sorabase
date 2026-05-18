"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkflowStoreContext, useWorkflowMode } from "@/lib/workflow-store-context";
import { listConversations, listMeetingSessions, createBotSession, getBotSession, cancelBotSession } from "@/lib/api";
import type { BotSession, ConversationSummary, MeetingSession } from "@/lib/types";
import type { SourceInputMode, SourceNodeData } from "@/lib/workflow-types";

interface Props { id: string; data: SourceNodeData }

const MODES: { value: SourceInputMode; label: string }[] = [
  { value: "transcript_paste", label: "Paste transcript" },
  { value: "audio_upload",     label: "Audio upload" },
  { value: "zoom_bot",         label: "Zoom bot (live)" },
  { value: "zoom",             label: "Zoom cloud recording" },
];

export default function SourceInspector({ id, data }: Props) {
  const update      = useWorkflowStoreContext((s) => s.updateNodeData);
  const { mode }    = useWorkflowMode();

  return (
    <div className="space-y-5">

      {/* Input mode */}
      <Field label="Input type">
        <div className="flex flex-col gap-1.5">
          {MODES.map((m) => (
            <label key={m.value} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                className="sr-only"
                name={`inputMode-${id}`}
                value={m.value}
                checked={data.inputMode === m.value}
                onChange={() => update(id, { inputMode: m.value })}
              />
              <div
                className={[
                  "w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors",
                  data.inputMode === m.value
                    ? "border-aubergine-700 bg-aubergine-700"
                    : "border-stone-300 dark:border-stone-600 group-hover:border-stone-400",
                ].join(" ")}
              />
              <span className="text-sm text-stone-700 dark:text-stone-300">{m.label}</span>
            </label>
          ))}
        </div>
      </Field>

      {/* Transcript paste */}
      {data.inputMode === "transcript_paste" && (
        <Field label="Transcript" hint={`${data.transcript.length.toLocaleString()} / 50,000 chars`}>
          <textarea
            className={[
              "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2",
              "text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400",
              "border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700",
              "resize-none font-mono leading-relaxed",
            ].join(" ")}
            rows={10}
            maxLength={50000}
            placeholder={
              mode === "general"
                ? "Speaker A: Let's go through the agenda.\nSpeaker B: Sure, I'd like to start with…"
                : "Recruiter: Tell me about yourself.\nCandidate: Sure, I've been…"
            }
            value={data.transcript}
            onChange={(e) => update(id, { transcript: e.target.value })}
          />
        </Field>
      )}

      {/* Audio upload placeholder */}
      {data.inputMode === "audio_upload" && (
        <Field label="Audio file">
          <div className="rounded-lg border border-dashed border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-4 py-6 text-center">
            <p className="text-xs text-stone-400 dark:text-stone-500">Audio upload available on the intake page.</p>
            <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">MP3, M4A, WAV — max 25 MB</p>
          </div>
        </Field>
      )}

      {/* Zoom bot (live capture) */}
      {data.inputMode === "zoom_bot" && (
        <ZoomBotPanel id={id} data={data} update={update} mode={mode} />
      )}

      {/* Zoom cloud recording picker */}
      {data.inputMode === "zoom" && (
        <>
          <ZoomPicker id={id} data={data} update={update} />
          <AutoSessionsPanel />
        </>
      )}

      {/* Reference field — shown for all transcript modes */}
      {data.inputMode !== "zoom_bot" && (
        <Field label={mode === "general" ? "Session label" : "Job reference"} hint="optional">
          <input
            type="text"
            className={[
              "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2",
              "text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400",
              "border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700",
            ].join(" ")}
            placeholder={mode === "general" ? "e.g. Q4 planning call" : "e.g. REQ-1042"}
            value={data.jobReference}
            onChange={(e) => update(id, { jobReference: e.target.value })}
          />
        </Field>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zoom bot panel
// ---------------------------------------------------------------------------

const BOT_STATUS_META: Record<string, { dot: string; label: string; hint: string }> = {
  joining:               { dot: "bg-amber-400 animate-pulse", label: "Joining…",            hint: "Bot is connecting to the meeting." },
  waiting_for_admission: { dot: "bg-amber-400 animate-pulse", label: "Waiting for admission", hint: "Bot is in the waiting room." },
  in_meeting:            { dot: "bg-blue-400",                label: "In meeting",           hint: "Bot joined. Recording not started yet." },
  recording:             { dot: "bg-blue-500 animate-pulse",  label: "Recording",            hint: "Bot is actively recording." },
  transcribing:          { dot: "bg-aubergine-400 animate-pulse",  label: "Transcribing…",        hint: "Call ended. Generating transcript." },
  ready:                 { dot: "bg-aubergine-700",                label: "Transcript ready",     hint: "Running extraction pipeline." },
  extracting:            { dot: "bg-aubergine-400 animate-pulse",  label: "Extracting…",         hint: "Running AI extraction." },
  complete:              { dot: "bg-aubergine-700",             label: "Complete",             hint: "Workflow finished. Results ready." },
  failed:                { dot: "bg-red-500",                 label: "Failed",               hint: "Something went wrong." },
};

const BOT_TERMINAL = new Set(["complete", "failed"]);
const BOT_ACTIVE   = new Set(["joining", "waiting_for_admission", "in_meeting", "recording", "transcribing", "ready", "extracting"]);

interface ZoomBotPanelProps {
  id: string;
  data: SourceNodeData;
  update: (id: string, patch: Partial<Record<string, unknown>>) => void;
  mode: string;
}

function ZoomBotPanel({ id, data, update, mode }: ZoomBotPanelProps) {
  const isGeneral = mode === "general";
  const [url,   setUrl]   = useState(data.botMeetingUrl   ?? "");
  const [label, setLabel] = useState(data.botMeetingLabel ?? "");
  const [autoRun, setAutoRun] = useState(data.botAutoRun ?? !isGeneral);
  const [sending, setSending] = useState(false);
  const [error, setError]    = useState("");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionId   = data.botSessionId;
  const botStatus   = data.botStatus ?? "idle";
  const isActive    = BOT_ACTIVE.has(botStatus);
  const isTerminal  = BOT_TERMINAL.has(botStatus);
  const meta        = BOT_STATUS_META[botStatus];

  // Poll backend while bot is active
  const poll = useCallback(() => {
    if (!sessionId) return;
    getBotSession(sessionId)
      .then((s: BotSession) => {
        update(id, {
          botStatus:         s.status,
          botCandidateId:    s.candidate_id ?? undefined,
          botTranscriptChars: s.transcript_chars ?? undefined,
          botErrorMessage:   s.error_message ?? undefined,
        });
        if (!BOT_TERMINAL.has(s.status)) {
          pollRef.current = setTimeout(poll, 5000);
        }
      })
      .catch(() => {
        pollRef.current = setTimeout(poll, 10000); // retry on network error
      });
  }, [sessionId, id, update]);

  useEffect(() => {
    if (sessionId && isActive) {
      poll();
    }
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [sessionId, isActive, poll]);

  async function handleSendBot() {
    if (!url.trim()) { setError("Paste a Zoom meeting URL first."); return; }
    setError("");
    setSending(true);
    try {
      const session = await createBotSession({
        meeting_url:   url.trim(),
        meeting_label: label.trim() || undefined,
        job_reference: data.jobReference || undefined,
        auto_run:      autoRun,
        mode:          mode,
      });
      update(id, {
        botMeetingUrl:   url.trim(),
        botMeetingLabel: label.trim() || undefined,
        botAutoRun:      autoRun,
        botSessionId:    session.id,
        botStatus:       session.status,
        status:          "configured",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start bot.");
    } finally {
      setSending(false);
    }
  }

  async function handleCancel() {
    if (!sessionId) return;
    try {
      await cancelBotSession(sessionId);
      update(id, { botStatus: "failed", botErrorMessage: "Cancelled by recruiter", status: "idle" });
    } catch {
      // best-effort
    }
  }

  function handleReset() {
    if (pollRef.current) clearTimeout(pollRef.current);
    update(id, {
      botSessionId: undefined, botStatus: undefined,
      botCandidateId: undefined, botTranscriptChars: undefined,
      botErrorMessage: undefined, status: "idle",
    });
    setUrl(""); setLabel(""); setError("");
  }

  // ── Active / completed session view ──────────────────────────────────────
  if (sessionId && botStatus !== "idle") {
    return (
      <>
        <Field label="Zoom bot">
          <div className={[
            "rounded-lg border px-3 py-2.5",
            botStatus === "complete"
              ? "border-aubergine-200 dark:border-aubergine-900 bg-aubergine-50 dark:bg-aubergine-950/20"
              : botStatus === "failed"
              ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20"
              : "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20",
          ].join(" ")}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${meta?.dot ?? "bg-stone-300"}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-stone-700 dark:text-stone-300 truncate">
                    {data.botMeetingLabel || data.botMeetingUrl || "Meeting"}
                  </p>
                  <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
                    {meta?.label ?? botStatus}
                    {data.botTranscriptChars ? ` · ${data.botTranscriptChars.toLocaleString()} chars` : ""}
                  </p>
                  {meta?.hint && (
                    <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5 leading-relaxed">
                      {meta.hint}
                    </p>
                  )}
                  {botStatus === "failed" && data.botErrorMessage && (
                    <p className="text-[10px] text-red-500 mt-0.5 truncate">{data.botErrorMessage}</p>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                {botStatus === "complete" && data.botCandidateId && (
                  <a
                    href={`/review/${data.botCandidateId}`}
                    className="text-[10px] font-medium text-aubergine-800 hover:text-aubergine-900"
                  >
                    Review →
                  </a>
                )}
                {isActive && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="text-[10px] font-medium text-stone-400 hover:text-red-500 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[10px] font-medium text-stone-400 hover:text-stone-600 transition-colors"
                >
                  {isTerminal ? "New bot" : "Reset"}
                </button>
              </div>
            </div>
          </div>
        </Field>

        {/* Job reference visible for bot sessions too */}
        <Field label="Job reference" hint="optional">
          <input
            type="text"
            className={[
              "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2",
              "text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400",
              "border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700",
            ].join(" ")}
            placeholder="e.g. REQ-1042"
            value={data.jobReference}
            onChange={(e) => update(id, { jobReference: e.target.value })}
          />
        </Field>
      </>
    );
  }

  // ── Setup form ────────────────────────────────────────────────────────────
  return (
    <>
      <Field label="Meeting URL">
        <input
          type="url"
          className={[
            "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2",
            "text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400",
            "border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700",
          ].join(" ")}
          placeholder="https://zoom.us/j/12345678901"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>

      <Field label="Label" hint="optional">
        <input
          type="text"
          className={[
            "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2",
            "text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400",
            "border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700",
          ].join(" ")}
          placeholder="e.g. Acme Corp – Eng screen"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </Field>

      <Field label="Job reference" hint="optional">
        <input
          type="text"
          className={[
            "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2",
            "text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400",
            "border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700",
          ].join(" ")}
          placeholder="e.g. REQ-1042"
          value={data.jobReference}
          onChange={(e) => update(id, { jobReference: e.target.value })}
        />
      </Field>

      {/* Auto-run toggle — hidden in General Mode (schema approval controls when extraction runs) */}
      {!isGeneral && (
        <Field label="Auto-run workflow">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-stone-600 dark:text-stone-400">
              Run extraction automatically when transcript is ready
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={autoRun}
              onClick={() => setAutoRun((v) => !v)}
              className={[
                "relative inline-flex w-8 h-4.5 rounded-full border-2 transition-colors flex-shrink-0 ml-3",
                autoRun
                  ? "bg-aubergine-700 border-aubergine-700"
                  : "bg-stone-200 dark:bg-stone-700 border-stone-200 dark:border-stone-700",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block w-3 h-3 rounded-full bg-white shadow transition-transform duration-150",
                  autoRun ? "translate-x-3.5" : "translate-x-0.5",
                ].join(" ")}
              />
            </button>
          </label>
        </Field>
      )}

      {error && (
        <p className="text-[10px] text-red-500 -mt-2">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSendBot}
        disabled={sending || !url.trim()}
        className={[
          "w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          "bg-aubergine-800 text-white hover:bg-aubergine-900 active:bg-aubergine-900",
          "disabled:opacity-40 disabled:cursor-not-allowed",
        ].join(" ")}
      >
        {sending ? "Sending bot…" : "Send bot"}
      </button>

      <p className="text-[10px] text-stone-400 dark:text-stone-500 leading-relaxed -mt-2">
        A bot joins the meeting as a participant, records the conversation, and triggers the workflow automatically when the call ends.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Zoom cloud recording picker (unchanged)
// ---------------------------------------------------------------------------

interface ZoomPickerProps {
  id: string;
  data: SourceNodeData;
  update: (id: string, patch: Partial<Record<string, unknown>>) => void;
}

function ZoomPicker({ id, data, update }: ZoomPickerProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    listConversations({ source_type: "zoom", transcript_status: "ready", limit: 30 })
      .then(setConversations)
      .catch(() => setError("Failed to load recordings. Check backend connection."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSelect(conv: ConversationSummary) {
    const meta = (conv.source_metadata ?? {}) as Record<string, unknown>;
    update(id, {
      zoomConversationId: conv.id,
      zoomMeetingId:      String(meta.meeting_id ?? ""),
      zoomCharCount:      conv.char_count ?? 0,
      zoomCreatedAt:      conv.created_at,
    });
  }

  function handleClear() {
    update(id, {
      zoomConversationId: undefined,
      zoomMeetingId:      undefined,
      zoomCharCount:      undefined,
      zoomCreatedAt:      undefined,
    });
  }

  if (data.zoomConversationId) {
    return (
      <Field label="Zoom recording">
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400 truncate">
                {data.zoomMeetingId ? `Meeting ${data.zoomMeetingId}` : "Zoom recording"}
              </p>
              <p className="text-[10px] text-blue-600 dark:text-blue-500 mt-0.5">
                {data.zoomCharCount ? `${data.zoomCharCount.toLocaleString()} chars · ` : ""}
                {data.zoomCreatedAt
                  ? new Date(data.zoomCreatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-[10px] font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 flex-shrink-0 mt-0.5"
            >
              Change
            </button>
          </div>
        </div>
        <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1.5">
          Transcript already available — click Run to extract.
        </p>
      </Field>
    );
  }

  return (
    <Field label="Zoom recording">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] text-stone-400 dark:text-stone-500">Select a processed recording below</p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-[10px] font-medium text-aubergine-800 hover:text-aubergine-900 disabled:opacity-40"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <p className="text-[10px] text-red-500 mb-2">{error}</p>}

      {!loading && conversations.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-4 py-5 text-center">
          <p className="text-xs font-medium text-stone-400 dark:text-stone-500">No recordings yet</p>
          <p className="text-[10px] text-stone-300 dark:text-stone-600 mt-1 leading-relaxed">
            Configure your Zoom app to send webhooks to{" "}
            <span className="font-mono">/api/webhooks/zoom</span>.
          </p>
        </div>
      )}

      {conversations.length > 0 && (
        <div className="rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden">
          {conversations.map((conv, i) => {
            const meta     = (conv.source_metadata ?? {}) as Record<string, unknown>;
            const meetingId = String(meta.meeting_id ?? "");
            const host      = String(meta.host_email ?? "");
            const duration  = typeof meta.duration_seconds === "number"
              ? `${Math.round(meta.duration_seconds / 60)} min` : null;
            const date = new Date(conv.created_at).toLocaleDateString(undefined, {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            });
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => handleSelect(conv)}
                className={[
                  "w-full text-left px-3 py-2.5 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors",
                  i > 0 ? "border-t border-stone-100 dark:border-stone-800" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stone-700 dark:text-stone-300 truncate">
                      {meetingId ? `Meeting ${meetingId}` : conv.id.slice(0, 8)}
                    </p>
                    <p className="text-[10px] text-stone-400 dark:text-stone-500 truncate mt-0.5">
                      {host && `${host} · `}{date}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {duration && <p className="text-[10px] text-stone-400">{duration}</p>}
                    {conv.char_count && (
                      <p className="text-[10px] font-mono text-stone-300 dark:text-stone-600">
                        {conv.char_count.toLocaleString()} ch
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1.5">
        Only recordings already transcribed by the backend are shown.
      </p>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Auto-sessions panel (Zoom cloud recording path)
// ---------------------------------------------------------------------------

const STATUS_META: Record<MeetingSession["status"], { dot: string; label: string }> = {
  transcribing: { dot: "bg-amber-400",   label: "Transcribing…" },
  extracting:   { dot: "bg-blue-400",    label: "Extracting…"   },
  complete:     { dot: "bg-aubergine-700", label: "Complete"      },
  failed:       { dot: "bg-red-500",     label: "Failed"        },
};

const TERMINAL = new Set<MeetingSession["status"]>(["complete", "failed"]);

function AutoSessionsPanel() {
  const [sessions, setSessions] = useState<MeetingSession[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    listMeetingSessions({ limit: 10 })
      .then((data) => {
        setSessions(data);
        const hasActive = data.some((s) => !TERMINAL.has(s.status));
        if (hasActive) {
          timerRef.current = setTimeout(load, 5000);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [load]);

  if (sessions.length === 0) return null;

  return (
    <Field label="Auto-processed">
      <div className="rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden">
        {sessions.map((s, i) => {
          const meta    = STATUS_META[s.status] ?? STATUS_META.failed;
          const dateStr = new Date(s.created_at).toLocaleDateString(undefined, {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          });
          return (
            <div
              key={s.id}
              className={[
                "px-3 py-2 flex items-start justify-between gap-2",
                i > 0 ? "border-t border-stone-100 dark:border-stone-800" : "",
              ].join(" ")}
            >
              <div className="min-w-0 flex items-start gap-2">
                <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-stone-700 dark:text-stone-300 truncate">
                    {s.meeting_id ? `Meeting ${s.meeting_id}` : s.id.slice(0, 8)}
                  </p>
                  <p className="text-[10px] text-stone-400 dark:text-stone-500 truncate mt-0.5">
                    {s.host_email ? `${s.host_email} · ` : ""}{dateStr}
                  </p>
                  {s.status === "failed" && s.error_message && (
                    <p className="text-[10px] text-red-500 mt-0.5 truncate">{s.error_message}</p>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className={`text-[10px] font-medium ${s.status === "complete" ? "text-aubergine-700" : s.status === "failed" ? "text-red-500" : "text-stone-400"}`}>
                  {meta.label}
                </p>
                {s.status === "complete" && s.candidate_id && (
                  <a href={`/review/${s.candidate_id}`} className="text-[10px] text-aubergine-800 hover:text-aubergine-900 font-medium">
                    Review →
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
          {label}
        </span>
        {hint && <span className="text-[10px] text-stone-400 dark:text-stone-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
