"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  AuditLogEntry,
  CandidateDetail,
  ExtractedField,
  FieldValue,
  ProposedColumn,
  StoredSchema,
} from "@/lib/types";
import { effectiveValue } from "@/lib/types";
import { getCandidateAudit } from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prettyLabel(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(type: string, val: FieldValue): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

function confidenceDot(c: number) {
  if (c >= 0.85) return "bg-emerald-500";
  if (c >= 0.60) return "bg-amber-400";
  return "bg-red-400";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Audit helpers
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  extracted:        "AI extracted",
  edited:           "Edited",
  confirmed:        "Confirmed",
  unresolved:       "Flagged",
  approval_updated: "Approval changed",
  exported:         "Exported",
};

function formatAuditValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-stone-400 transition-transform ${open ? "" : "rotate-180"}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs text-stone-400 dark:text-stone-500">{label}</span>
      <span className="text-xs font-medium text-stone-700 dark:text-stone-300 tabular-nums">{value}</span>
    </div>
  );
}

function NavAction({
  href,
  icon,
  label,
  description,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "group flex items-center gap-3 rounded-lg border px-4 py-3 transition-all",
        primary
          ? "border-aubergine-700 bg-aubergine-800 hover:bg-aubergine-900 text-white"
          : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800/50",
      ].join(" ")}
    >
      <div className={`flex-shrink-0 ${primary ? "text-aubergine-200" : "text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300"}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-semibold leading-snug ${primary ? "text-white" : "text-stone-700 dark:text-stone-200"}`}>
          {label}
        </p>
        <p className={`text-2xs leading-snug mt-0.5 ${primary ? "text-aubergine-200" : "text-stone-400 dark:text-stone-500"}`}>
          {description}
        </p>
      </div>
      <svg
        className={`ml-auto w-3.5 h-3.5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity ${primary ? "text-aubergine-200" : "text-stone-400"}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Field card — clean read-only view
// ---------------------------------------------------------------------------

function FieldItem({
  field,
  colType,
  label,
}: {
  field: ExtractedField;
  colType: string;
  label: string;
}) {
  const val     = effectiveValue(field);
  const display = formatValue(colType, val);
  const isMissing = field.status === "missing" && val === null;
  const confPct = Math.round(field.confidence * 100);
  const isList  = colType === "list" && Array.isArray(val);

  return (
    <div className="py-3.5 border-b border-stone-100 dark:border-stone-800 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <p className="text-2xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mt-0.5">
          {label}
        </p>
        {!isMissing && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${confidenceDot(field.confidence)}`} />
            <span className="text-2xs text-stone-400 dark:text-stone-500 tabular-nums">{confPct}%</span>
            {field.edited && (
              <span className="text-2xs font-medium text-aubergine-700 dark:text-aubergine-400 bg-aubergine-50 dark:bg-aubergine-950/30 border border-aubergine-200 dark:border-aubergine-900 px-1.5 py-0.5 rounded-xs">
                edited
              </span>
            )}
          </div>
        )}
      </div>

      {isMissing ? (
        <p className="text-sm text-stone-300 dark:text-stone-600 italic mt-1">Not extracted</p>
      ) : isList ? (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {(val as string[]).map((tag, i) => (
            <span
              key={i}
              className="inline-block bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs px-2 py-0.5 rounded-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone-900 dark:text-stone-100 mt-1 leading-relaxed break-words">
          {display}
        </p>
      )}

      {field.evidence_snippet && !isMissing && (
        <p className="text-2xs text-stone-400 dark:text-stone-500 mt-1.5 italic leading-relaxed border-l-2 border-stone-200 dark:border-stone-700 pl-2">
          &ldquo;{field.evidence_snippet}&rdquo;
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props { initial: CandidateDetail }

export default function ApprovedRecordView({ initial }: Props) {
  const { candidate, extraction, conversation } = initial;

  const [columns,       setColumns]      = useState<ProposedColumn[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showAudit,      setShowAudit]     = useState(false);
  const [auditEntries,   setAuditEntries]  = useState<AuditLogEntry[]>([]);
  const [auditLoading,   setAuditLoading]  = useState(false);
  const [auditError,     setAuditError]    = useState<string | null>(null);

  // Read schema columns from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(`sorabase-schema-${conversation.id}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const cols: ProposedColumn[] = Array.isArray(parsed)
        ? parsed
        : (parsed as StoredSchema).columns ?? [];
      setColumns(cols);
    } catch { /* ignore */ }
  }, [conversation.id]);

  // Load audit on mount
  useEffect(() => {
    getCandidateAudit(candidate.id)
      .then((r) => setAuditEntries(r.entries))
      .catch(() => {/* silent */});
  }, [candidate.id]);

  // Schema-ordered fields
  const colMap = Object.fromEntries(columns.map((c) => [c.name, c]));
  function colType(name: string)  { return colMap[name]?.type ?? "text"; }
  function colLabel(name: string) { return prettyLabel(name); }

  const orderedFields: ExtractedField[] =
    columns.length > 0
      ? columns.map((c) => initial.fields.find((f) => f.field_name === c.name)).filter((f): f is ExtractedField => f !== undefined)
      : initial.fields;

  const extractedFields = orderedFields.filter((f) => f.status !== "missing" || (f.status === "missing" && effectiveValue(f) !== null));
  const missingFields   = orderedFields.filter((f) => f.status === "missing" && effectiveValue(f) === null);

  const confidencePct = extraction.overall_confidence
    ? Math.round(extraction.overall_confidence * 100)
    : null;
  const fillRate = orderedFields.length > 0
    ? Math.round((extractedFields.length / orderedFields.length) * 100)
    : null;
  const editedCount    = initial.fields.filter((f) => f.edited).length;
  const confirmedCount = initial.fields.filter((f) => f.status === "confirmed").length;

  async function handleAuditToggle() {
    if (!showAudit && auditEntries.length === 0) {
      setAuditLoading(true);
      setAuditError(null);
      try { setAuditEntries((await getCandidateAudit(candidate.id)).entries); }
      catch { setAuditError("Could not load audit trail."); }
      finally { setAuditLoading(false); }
    }
    setShowAudit((v) => !v);
  }

  return (
    <div className="page space-y-6 max-w-3xl">

      {/* ── Success banner ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-positive-light border border-positive-border rounded-lg px-4 py-3">
        <div className="w-6 h-6 rounded-full bg-positive-DEFAULT flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-positive-text">Record approved</p>
          <p className="text-2xs text-positive-text opacity-75 mt-0.5">
            Approved on {fmtDate(candidate.updated_at)} · Changes saved
          </p>
        </div>
        <Link
          href={`/general/results/${candidate.id}`}
          className="text-xs font-medium text-positive-text hover:opacity-75 transition-opacity flex-shrink-0"
        >
          Edit record →
        </Link>
      </div>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="section-label mb-1">General mode · Record</p>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Extraction results
          </h1>
          <div className="flex items-center gap-4 mt-2.5 flex-wrap">
            {confidencePct !== null && (
              <StatPill label="Confidence"   value={`${confidencePct}%`} />
            )}
            {fillRate !== null && (
              <StatPill label="Fill rate"    value={`${fillRate}%`} />
            )}
            {orderedFields.length > 0 && (
              <StatPill label="Fields"       value={String(orderedFields.length)} />
            )}
            {editedCount > 0 && (
              <StatPill label="Edited"       value={String(editedCount)} />
            )}
            {confirmedCount > 0 && (
              <StatPill label="Confirmed"    value={String(confirmedCount)} />
            )}
            <StatPill
              label="Extracted"
              value={fmtDateTime(extraction.created_at)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/general/results/${candidate.id}`}
            className="btn-secondary text-xs py-1.5"
          >
            Edit record
          </Link>
          <Link
            href="/general"
            className="btn-primary text-xs py-1.5"
          >
            New session
          </Link>
        </div>
      </div>

      {/* ── Next-step navigation ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <NavAction
          href="/general"
          primary
          label="New session"
          description="Start another extraction"
          icon={
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          }
        />
        <NavAction
          href="/general/dashboard"
          label="Dashboard"
          description="Analytics & overview"
          icon={
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <NavAction
          href="/general/dashboard?tab=data"
          label="All records"
          description="Browse extracted data"
          icon={
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 4v16M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
            </svg>
          }
        />
        <NavAction
          href={`/general/results/${candidate.id}`}
          label="Edit record"
          description="Review or adjust fields"
          icon={
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          }
        />
      </div>

      {/* ── AI summary ─────────────────────────────────────────────────────── */}
      {extraction.candidate_summary && (
        <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 px-6 py-5 shadow-card">
          <p className="section-label mb-2.5">AI summary</p>
          <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
            {extraction.candidate_summary}
          </p>
        </div>
      )}

      {/* ── Extracted fields ────────────────────────────────────────────────── */}
      {extractedFields.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Extracted data</h2>
              <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
                {extractedFields.length} field{extractedFields.length !== 1 ? "s" : ""} extracted · approved
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-positive-DEFAULT" />
              <span className="text-xs font-medium text-positive-text">Approved</span>
            </div>
          </div>

          <div className="px-6 divide-y divide-stone-100 dark:divide-stone-800">
            {extractedFields.map((f) => (
              <FieldItem
                key={f.id}
                field={f}
                colType={colType(f.field_name)}
                label={colLabel(f.field_name)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Missing fields ─────────────────────────────────────────────────── */}
      {missingFields.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 px-5 py-4 shadow-card">
          <p className="section-label mb-2.5">Not extracted ({missingFields.length})</p>
          <div className="flex flex-wrap gap-2">
            {missingFields.map((f) => (
              <span
                key={f.id}
                className="text-xs text-stone-400 dark:text-stone-500 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-2 py-0.5 rounded-xs"
              >
                {colLabel(f.field_name)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Source transcript ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTranscript((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Source transcript
            </span>
            <span className="text-xs font-normal text-stone-400 dark:text-stone-500 tabular-nums">
              {(conversation.char_count ?? 0).toLocaleString()} chars
            </span>
          </div>
          <ChevronIcon open={showTranscript} />
        </button>
        {showTranscript && (
          <div className="border-t border-stone-100 dark:border-stone-800 px-6 py-4">
            {conversation.raw_text ? (
              <pre className="whitespace-pre-wrap text-xs text-stone-600 dark:text-stone-400 font-mono leading-relaxed max-h-96 overflow-y-auto">
                {conversation.raw_text}
              </pre>
            ) : (
              <p className="text-xs text-stone-400 dark:text-stone-500 italic py-4 text-center">
                Transcript not available.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Audit trail ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
        <button
          type="button"
          onClick={handleAuditToggle}
          className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Audit trail
            </span>
            {auditEntries.length > 0 && (
              <span className="text-xs font-normal text-stone-400 dark:text-stone-500">
                {auditEntries.length} events
              </span>
            )}
          </div>
          <ChevronIcon open={showAudit} />
        </button>
        {showAudit && (
          <div className="border-t border-stone-100 dark:border-stone-800 px-6 py-4 max-h-80 overflow-y-auto">
            {auditLoading && (
              <p className="text-xs text-stone-400 text-center py-4">Loading…</p>
            )}
            {auditError && !auditLoading && (
              <p className="text-xs text-negative-text">{auditError}</p>
            )}
            {!auditLoading && !auditError && auditEntries.length === 0 && (
              <p className="text-xs text-stone-400 dark:text-stone-500 italic py-4 text-center">
                No audit events yet.
              </p>
            )}
            {!auditLoading && !auditError && auditEntries.length > 0 && (
              <ol className="space-y-0.5">
                {auditEntries.map((e) => {
                  const label    = ACTION_LABELS[e.action] ?? e.action;
                  const fieldLbl = e.field_name ? colLabel(e.field_name) : null;
                  const newVal   = e.new_value as Record<string, unknown> | null;
                  const oldVal   = e.old_value as Record<string, unknown> | null;
                  const showDelta = e.action === "edited" && newVal?.value !== undefined;

                  return (
                    <li key={e.id} className="flex gap-3 py-2 border-b border-stone-100 dark:border-stone-800 last:border-0">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-stone-700 dark:text-stone-300 leading-snug">
                          {label}
                          {fieldLbl && (
                            <span className="font-normal text-stone-400 dark:text-stone-500"> · {fieldLbl}</span>
                          )}
                        </p>
                        {showDelta && (
                          <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                            {formatAuditValue(oldVal?.value)} → {formatAuditValue(newVal?.value)}
                          </p>
                        )}
                        {e.action === "approval_updated" && (
                          <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                            {formatAuditValue(oldVal?.approval_status)} → {formatAuditValue(newVal?.approval_status)}
                          </p>
                        )}
                        <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5 tabular-nums">
                          {new Date(e.created_at).toLocaleString()} · {e.actor_id}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-stone-400 dark:text-stone-500 text-right tabular-nums">
        Extracted using {extraction.model_used} · Session {conversation.id.slice(0, 8)}
      </p>
    </div>
  );
}
