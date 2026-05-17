"use client";

import { useState } from "react";
import Link from "next/link";
import type { ApprovalStatus, AuditLogEntry, CandidateDetail, ExtractedField } from "@/lib/types";
import { FIELD_LABELS, FIELD_ORDER, effectiveValue } from "@/lib/types";
import { updateApproval, confirmField, getCandidateAudit, ApiError } from "@/lib/api";
import FieldRow from "@/components/review/FieldRow";
import MissingFieldsBanner from "@/components/review/MissingFieldsBanner";
import ExportButton from "@/components/review/ExportButton";
import { AnalysisPanel } from "@/components/review/AnalysisPanel";
import { SummaryDraftPanel } from "@/components/review/SummaryDraftPanel";

interface Props { initial: CandidateDetail }

// ---------------------------------------------------------------------------
// Approval config
// ---------------------------------------------------------------------------

const APPROVAL_CONFIG: Record<ApprovalStatus, { label: string; dot: string; text: string }> = {
  needs_review: { label: "Needs review", dot: "bg-warning-DEFAULT",  text: "text-warning-text"  },
  approved:     { label: "Approved",      dot: "bg-positive-DEFAULT", text: "text-positive-text" },
  rejected:     { label: "Rejected",      dot: "bg-negative-DEFAULT", text: "text-negative-text" },
};

// ---------------------------------------------------------------------------
// Priority groups
// ---------------------------------------------------------------------------

const PRIORITY_GROUPS: Array<{
  key: string;
  label: string;
  description: string;
  filter: (f: ExtractedField) => boolean;
  headerBg: string;
}> = [
  {
    key: "attention",
    label: "Needs attention",
    description: "Missing, unresolved, or ambiguous",
    filter: (f) => ["unresolved", "missing", "ambiguous"].includes(f.status),
    headerBg: "bg-warning-light border-b border-warning-border text-warning-text",
  },
  {
    key: "extracted",
    label: "AI extracted",
    description: "Review and confirm",
    filter: (f) => f.status === "extracted",
    headerBg: "bg-stone-50 dark:bg-stone-800/50 border-b border-stone-100 dark:border-stone-800 text-stone-500 dark:text-stone-400",
  },
  {
    key: "reviewed",
    label: "Reviewed",
    description: "Edited or confirmed by recruiter",
    filter: (f) => ["edited", "confirmed", "reviewed"].includes(f.status),
    headerBg: "bg-teal-50 dark:bg-teal-900/10 border-b border-teal-100 dark:border-teal-900 text-teal-700 dark:text-teal-400",
  },
];

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  extracted:        "AI extracted",
  edited:           "Edited",
  confirmed:        "Confirmed",
  unresolved:       "Flagged as unresolved",
  approval_updated: "Approval changed",
  exported:         "Exported",
};

function formatAuditValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function AuditTimeline({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-stone-400 dark:text-stone-500 italic py-6 text-center">
        No audit events yet.
      </p>
    );
  }
  return (
    <ol className="space-y-0.5">
      {entries.map((e) => {
        const label    = ACTION_LABELS[e.action] ?? e.action;
        const fieldLbl = e.field_name ? (FIELD_LABELS[e.field_name] ?? e.field_name) : null;
        const newVal   = e.new_value as Record<string, unknown> | null;
        const oldVal   = e.old_value as Record<string, unknown> | null;
        const showDelta = e.action === "edited" && newVal?.value !== undefined;

        return (
          <li key={e.id} className="flex gap-3 py-2 border-b border-stone-100 dark:border-stone-800 last:border-0">
            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-700 dark:text-stone-300 leading-snug">
                {label}
                {fieldLbl && <span className="font-normal text-stone-400 dark:text-stone-500"> · {fieldLbl}</span>}
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
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ReviewWorkspace({ initial }: Props) {
  const [detail]          = useState(initial);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showAudit,      setShowAudit]      = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(initial.candidate.approval_status);
  const [approving,      setApproving]      = useState(false);
  const [approvalError,  setApprovalError]  = useState<string | null>(null);
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [auditEntries,   setAuditEntries]   = useState<AuditLogEntry[]>([]);
  const [auditLoading,   setAuditLoading]   = useState(false);
  const [auditError,     setAuditError]     = useState<string | null>(null);
  const [auditKey,       setAuditKey]       = useState(0);
  const [lastLoadedKey,  setLastLoadedKey]  = useState(0);

  const { candidate, extraction, conversation } = detail;

  const [fieldMap, setFieldMap] = useState<Record<string, ExtractedField>>(
    () => Object.fromEntries(initial.fields.map((f) => [f.field_name, f])),
  );

  function handleFieldUpdate(updated: ExtractedField) {
    setFieldMap((p) => ({ ...p, [updated.field_name]: updated }));
    setAuditKey((k) => k + 1);
  }

  // Approval
  async function handleApproval(next: ApprovalStatus) {
    setApproving(true); setApprovalError(null);
    try {
      const u = await updateApproval(candidate.id, next);
      setApprovalStatus(u.approval_status);
      setAuditKey((k) => k + 1);
    } catch (err) {
      setApprovalError(err instanceof ApiError ? err.detail : "Failed to update.");
    } finally { setApproving(false); }
  }

  // Bulk confirm
  const extractedFields = Object.values(fieldMap).filter((f) => f.status === "extracted");
  async function handleBulkConfirm() {
    setBulkConfirming(true);
    try {
      await Promise.all(extractedFields.map(async (f) => {
        const u = await confirmField(candidate.id, f.id);
        setFieldMap((p) => ({ ...p, [u.field_name]: u }));
      }));
      setAuditKey((k) => k + 1);
    } finally { setBulkConfirming(false); }
  }

  // Audit
  async function handleAuditToggle() {
    const opening = !showAudit;
    setShowAudit(opening);
    if (opening) {
      setAuditLoading(true); setAuditError(null);
      try { setAuditEntries((await getCandidateAudit(candidate.id)).entries); }
      catch { setAuditError("Could not load audit trail."); }
      finally { setAuditLoading(false); }
    }
  }

  if (showAudit && auditKey !== lastLoadedKey && !auditLoading) {
    setLastLoadedKey(auditKey);
    setAuditLoading(true);
    getCandidateAudit(candidate.id)
      .then((r) => setAuditEntries(r.entries))
      .catch(() => setAuditError("Could not refresh audit."))
      .finally(() => setAuditLoading(false));
  }

  // Field grouping
  const orderedFields = FIELD_ORDER.map((n) => fieldMap[n]).filter((f): f is ExtractedField => f !== undefined);
  const groups = PRIORITY_GROUPS.map((g) => ({ ...g, fields: orderedFields.filter(g.filter) })).filter((g) => g.fields.length > 0);

  // Stats
  const allFields       = Object.values(fieldMap);
  const editedCount     = allFields.filter((f) => f.edited).length;
  const confirmedCount  = allFields.filter((f) => f.status === "confirmed").length;
  const unresolvedCount = allFields.filter((f) => f.status === "unresolved").length;
  const confidencePct   = extraction.overall_confidence ? Math.round(extraction.overall_confidence * 100) : null;
  const liveMissingFields = allFields.filter((f) => f.status === "missing" && !f.edited).map((f) => f.field_name);

  const candidateName = (() => {
    const f = fieldMap["full_name"];
    if (!f) return null;
    const v = effectiveValue(f);
    return typeof v === "string" && v ? v : null;
  })();

  const approvalCfg = APPROVAL_CONFIG[approvalStatus];

  return (
    <div className="page space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/candidates" className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 mb-1.5 inline-flex items-center gap-1 transition-colors">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Candidate queue
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            {candidateName ?? "Candidate review"}
          </h1>

          {/* Meta chips */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {conversation.job_reference && (
              <span className="text-xs text-stone-500 dark:text-stone-400">
                Job: {conversation.job_reference}
              </span>
            )}
            {confidencePct !== null && (
              <span className="text-xs text-stone-400 dark:text-stone-500">
                Confidence: {confidencePct}%
              </span>
            )}
            {editedCount > 0 && (
              <span className="badge bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300">
                {editedCount} edited
              </span>
            )}
            {confirmedCount > 0 && (
              <span className="badge bg-positive-light border-positive-border text-positive-text">
                {confirmedCount} confirmed
              </span>
            )}
            {unresolvedCount > 0 && (
              <span className="badge bg-negative-light border-negative-border text-negative-text">
                {unresolvedCount} unresolved
              </span>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${approvalCfg.dot}`} />
            <span className={`text-xs font-medium ${approvalCfg.text}`}>{approvalCfg.label}</span>
          </div>

          {approvalStatus !== "approved" && (
            <button onClick={() => handleApproval("approved")} disabled={approving} className="btn-primary text-xs py-1.5">
              {approving ? "…" : "Approve"}
            </button>
          )}
          {approvalStatus !== "rejected" && (
            <button onClick={() => handleApproval("rejected")} disabled={approving} className="btn-danger text-xs py-1.5">
              {approving ? "…" : "Reject"}
            </button>
          )}
          {(approvalStatus === "approved" || approvalStatus === "rejected") && (
            <button onClick={() => handleApproval("needs_review")} disabled={approving} className="btn-secondary text-xs py-1.5">
              Reset
            </button>
          )}

          <ExportButton candidateId={candidate.id} />
        </div>
      </div>

      {/* Approval error */}
      {approvalError && (
        <div className="rounded-lg border border-negative-border bg-negative-light px-4 py-3 text-sm text-negative-text">
          {approvalError}
        </div>
      )}

      {/* ── Candidate summary ───────────────────────────────────────────────── */}
      {extraction.candidate_summary && (
        <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 px-6 py-4 shadow-card">
          <p className="section-label mb-2">AI summary</p>
          <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
            {extraction.candidate_summary}
          </p>
        </div>
      )}

      {/* Missing / ambiguous banner */}
      <MissingFieldsBanner
        missingFields={liveMissingFields}
        ambiguousFields={extraction.ambiguous_fields}
      />

      {/* Follow-up questions */}
      {extraction.suggested_follow_up_questions.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 px-6 py-4 shadow-card">
          <p className="section-label mb-2.5">Suggested follow-up questions</p>
          <ol className="space-y-1.5">
            {extraction.suggested_follow_up_questions.map((q, i) => (
              <li key={i} className="text-sm text-stone-700 dark:text-stone-300 flex gap-2">
                <span className="text-stone-400 dark:text-stone-500 shrink-0 tabular-nums">{i + 1}.</span>
                {q}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Extracted fields ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-3.5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Extracted fields</h2>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
              Confirm correct · edit mistakes · flag unresolvable.
            </p>
          </div>
          {extractedFields.length > 0 && (
            <button onClick={handleBulkConfirm} disabled={bulkConfirming} className="btn-secondary text-xs py-1.5">
              {bulkConfirming ? "Confirming…" : `Confirm all AI (${extractedFields.length})`}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50 dark:bg-stone-800/60 border-b border-stone-100 dark:border-stone-800">
                <th className="py-2.5 pl-3 pr-4 section-label w-40">Field</th>
                <th className="py-2.5 pr-4 section-label">Value</th>
                <th className="py-2.5 pr-4 section-label">Evidence</th>
                <th className="py-2.5 pr-4 section-label w-20">Confidence</th>
                <th className="py-2.5 pr-3 section-label w-24">Status</th>
                <th className="py-2.5 pr-3 w-32" />
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <>
                  <tr key={`hdr-${group.key}`}>
                    <td colSpan={6} className={`py-2 pl-3 pr-4 ${group.headerBg}`}>
                      <span className="text-2xs font-semibold uppercase tracking-label">{group.label}</span>
                      <span className="ml-2 text-2xs font-normal opacity-60">{group.description}</span>
                    </td>
                  </tr>
                  {group.fields.map((f) => (
                    <FieldRow key={f.id} field={f} candidateId={candidate.id} onUpdate={handleFieldUpdate} />
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Summary draft ───────────────────────────────────────────────────── */}
      <CollapsibleSection title="Candidate summary draft" subtitle="AI-generated from reviewed fields · editable · included in export">
        <SummaryDraftPanel candidateId={candidate.id} />
      </CollapsibleSection>

      {/* ── JD fit analysis ─────────────────────────────────────────────────── */}
      <CollapsibleSection title="JD fit analysis" subtitle="Evaluate this candidate against a job description">
        <AnalysisPanel candidateId={candidate.id} />
      </CollapsibleSection>

      {/* ── Audit trail ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
        <button
          onClick={handleAuditToggle}
          className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors text-left"
        >
          <div>
            <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">Audit trail</span>
            {auditEntries.length > 0 && (
              <span className="ml-2 text-xs font-normal text-stone-400 dark:text-stone-500">
                {auditEntries.length} events
              </span>
            )}
          </div>
          <ChevronIcon open={showAudit} />
        </button>
        {showAudit && (
          <div className="border-t border-stone-100 dark:border-stone-800 px-6 py-4 max-h-96 overflow-y-auto">
            {auditLoading && <p className="text-xs text-stone-400 text-center py-4">Loading…</p>}
            {auditError && !auditLoading && <p className="text-xs text-negative-text">{auditError}</p>}
            {!auditLoading && !auditError && <AuditTimeline entries={auditEntries} />}
          </div>
        )}
      </div>

      {/* ── Source transcript ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
        <button
          onClick={() => setShowTranscript((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors text-left"
        >
          <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            Source transcript
            <span className="ml-2 text-xs font-normal text-stone-400 dark:text-stone-500 tabular-nums">
              {(conversation.char_count ?? 0).toLocaleString()} chars
            </span>
          </span>
          <ChevronIcon open={showTranscript} />
        </button>
        {showTranscript && (
          <div className="border-t border-stone-100 dark:border-stone-800 px-6 py-4">
            <pre className="whitespace-pre-wrap text-xs text-stone-600 dark:text-stone-400 font-mono leading-relaxed max-h-96 overflow-y-auto">
              {conversation.raw_text}
            </pre>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-stone-400 dark:text-stone-500 text-right tabular-nums">
        Extracted using {extraction.model_used} · {new Date(extraction.created_at).toLocaleString()}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function CollapsibleSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors text-left"
      >
        <div>
          <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">{title}</span>
          {subtitle && <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{subtitle}</p>}
        </div>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="border-t border-stone-100 dark:border-stone-800 px-6 py-5">
          {children}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-stone-400 dark:text-stone-500 transition-transform ${open ? "" : "rotate-180"}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}
