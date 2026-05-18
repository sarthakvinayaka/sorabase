"use client";

import { useState } from "react";
import type { ExtractedField, FieldValue } from "@/lib/types";
import { effectiveValue, aiValue } from "@/lib/types";
import { editField, confirmField, unresolveField } from "@/lib/api";
import EvidencePanel from "./EvidencePanel";

interface Props {
  field: ExtractedField;
  candidateId: string;
  columnType: string;  // text | number | boolean | list | date
  columnLabel: string; // human-readable label
  onUpdate: (updated: ExtractedField) => void;
}

// ---------------------------------------------------------------------------
// Status config — identical to FieldRow
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; border: string; bg: string }> = {
  extracted:  { label: "AI",         dot: "bg-rose-400",           text: "text-rose-900 dark:text-rose-300",        border: "border-rose-200 dark:border-rose-900",   bg: "bg-rose-50 dark:bg-rose-950/20"   },
  missing:    { label: "Missing",    dot: "bg-stone-300",          text: "text-stone-500 dark:text-stone-400",      border: "border-stone-200 dark:border-stone-700", bg: "bg-stone-50 dark:bg-stone-800"    },
  ambiguous:  { label: "Ambiguous",  dot: "bg-warning-DEFAULT",    text: "text-warning-text",                       border: "border-warning-border",                  bg: "bg-warning-light"                 },
  reviewed:   { label: "Reviewed",   dot: "bg-info-DEFAULT",       text: "text-info-text",                          border: "border-info-border",                     bg: "bg-info-light"                    },
  edited:     { label: "Edited",     dot: "bg-rose-700",           text: "text-rose-900 dark:text-rose-300",        border: "border-rose-200 dark:border-rose-900",   bg: "bg-rose-50 dark:bg-rose-950/20"   },
  confirmed:  { label: "Confirmed",  dot: "bg-positive-DEFAULT",   text: "text-positive-text",                      border: "border-positive-border",                 bg: "bg-positive-light"                },
  unresolved: { label: "Unresolved", dot: "bg-negative-DEFAULT",   text: "text-negative-text",                      border: "border-negative-border",                 bg: "bg-negative-light"                },
};

// ---------------------------------------------------------------------------
// Value display + parsing
// ---------------------------------------------------------------------------

function formatGenDisplay(type: string, val: FieldValue): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

function parseGenValue(type: string, draft: string): unknown {
  if (draft.trim() === "") return null;
  switch (type) {
    case "number": {
      const n = parseFloat(draft);
      return isNaN(n) ? null : n;
    }
    case "boolean":
      return draft === "true" ? true : draft === "false" ? false : null;
    case "list":
      return draft.split(",").map((s) => s.trim()).filter(Boolean);
    default: // text | date
      return draft;
  }
}

function canConfirm(s: string)   { return ["extracted", "ambiguous", "edited", "unresolved", "reviewed"].includes(s); }
function canUnresolve(s: string) { return s !== "unresolved"; }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GeneralFieldRow({ field, candidateId, columnType, columnLabel, onUpdate }: Props) {
  const [editing,     setEditing]     = useState(false);
  const [draft,       setDraft]       = useState("");
  const [saving,      setSaving]      = useState(false);
  const [confirming,  setConfirming]  = useState(false);
  const [unresolving, setUnresolving] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const current   = effectiveValue(field);
  const original  = aiValue(field);
  const isMissing = field.status === "missing" && !field.edited;
  const anyBusy   = saving || confirming || unresolving;
  const showDelta = field.edited && field.reviewed_value !== null && field.reviewed_value !== original;
  const sc        = STATUS_CONFIG[field.status] ?? STATUS_CONFIG.extracted;
  const confidencePct = Math.round(field.confidence * 100);

  function startEdit() {
    let d: string;
    if (columnType === "boolean") {
      d = typeof current === "boolean" ? String(current) : "";
    } else if (columnType === "list") {
      d = Array.isArray(current) ? (current as string[]).join(", ") : typeof current === "string" ? current : "";
    } else {
      d = current != null ? String(current) : "";
    }
    setDraft(d);
    setEditing(true);
    setError(null);
  }

  async function saveEdit() {
    setSaving(true); setError(null);
    try {
      const reviewed = parseGenValue(columnType, draft) as FieldValue;
      const updated  = await editField(candidateId, field.id, reviewed);
      onUpdate(updated); setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  }

  async function handleConfirm() {
    setConfirming(true); setError(null);
    try { onUpdate(await confirmField(candidateId, field.id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setConfirming(false); }
  }

  async function handleUnresolve() {
    setUnresolving(true); setError(null);
    try { onUpdate(await unresolveField(candidateId, field.id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setUnresolving(false); }
  }

  const inputCls = "w-full rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2.5 py-1.5 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-rose-700 transition-colors";

  return (
    <tr className="border-b border-stone-100 dark:border-stone-800 last:border-0 hover:bg-stone-50/60 dark:hover:bg-stone-800/30 transition-colors align-top">

      {/* Field name */}
      <td className="py-3 pr-4 pl-3 w-40 shrink-0">
        <span className="text-xs font-medium text-stone-600 dark:text-stone-300">{columnLabel}</span>
      </td>

      {/* Value */}
      <td className="py-3 pr-4 max-w-xs">
        {editing ? (
          <div className="space-y-2">
            {columnType === "boolean" ? (
              <select autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} className={inputCls}>
                <option value="">— Unknown —</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : columnType === "number" ? (
              <input autoFocus type="number" step="any" min="0" value={draft} onChange={(e) => setDraft(e.target.value)} className={inputCls} />
            ) : (
              <input
                autoFocus
                type={columnType === "date" ? "date" : "text"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={columnType === "list" ? "Comma-separated values" : columnType === "date" ? "YYYY-MM-DD" : undefined}
                className={inputCls}
              />
            )}
            {error && <p className="text-xs text-negative-text">{error}</p>}
            <div className="flex gap-1.5">
              <button onClick={saveEdit} disabled={saving} className="btn-primary text-xs py-1 px-2.5">
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditing(false)} className="btn-secondary text-xs py-1 px-2.5">
                Cancel
              </button>
            </div>
          </div>
        ) : columnType === "list" && Array.isArray(current) && (current as string[]).length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {(current as string[]).map((tag, i) => (
              <span key={i} className="inline-block bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs px-1.5 py-0.5 rounded-xs">
                {tag}
              </span>
            ))}
            {showDelta && (
              <span className="w-full mt-1 text-xs text-stone-400 dark:text-stone-500">
                AI: {formatGenDisplay(columnType, original)}
              </span>
            )}
          </div>
        ) : (
          <div>
            <span className={`text-sm break-words ${isMissing ? "text-stone-400 dark:text-stone-500 italic" : "text-stone-900 dark:text-stone-100"}`}>
              {formatGenDisplay(columnType, current)}
            </span>
            {showDelta && (
              <span className="block mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                AI: {formatGenDisplay(columnType, original)}
              </span>
            )}
          </div>
        )}
      </td>

      {/* Evidence */}
      <td className="py-3 pr-4 max-w-[200px]">
        <EvidencePanel snippet={field.evidence_snippet} />
      </td>

      {/* Confidence bar */}
      <td className="py-3 pr-4 w-20">
        {field.status !== "missing" ? (
          <div className="flex items-center gap-1.5">
            <div className="h-1 w-10 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  confidencePct >= 85 ? "bg-rose-700" : confidencePct >= 60 ? "bg-amber-400" : "bg-red-400"
                }`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
            <span className="text-xs text-stone-400 dark:text-stone-500 tabular-nums">{confidencePct}%</span>
          </div>
        ) : (
          <span className="text-xs text-stone-300 dark:text-stone-600">—</span>
        )}
      </td>

      {/* Status badge */}
      <td className="py-3 pr-3 w-24">
        <div className={`inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 border text-2xs font-semibold ${sc.bg} ${sc.border}`}>
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
          <span className={sc.text}>{sc.label}</span>
        </div>
      </td>

      {/* Actions */}
      <td className="py-3 pr-3 w-32 text-right">
        {error && !editing && <p className="text-xs text-negative-text mb-1">{error}</p>}
        {!editing && (
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {canConfirm(field.status) && (
              <button onClick={handleConfirm} disabled={anyBusy} className="text-xs font-medium text-positive-text hover:opacity-70 transition-opacity disabled:opacity-30">
                {confirming ? "…" : "Confirm"}
              </button>
            )}
            {canUnresolve(field.status) && (
              <button onClick={handleUnresolve} disabled={anyBusy} className="text-xs font-medium text-warning-text hover:opacity-70 transition-opacity disabled:opacity-30">
                {unresolving ? "…" : "Flag"}
              </button>
            )}
            <button onClick={startEdit} disabled={anyBusy} className="text-xs font-medium text-rose-800 dark:text-rose-400 hover:opacity-70 transition-opacity disabled:opacity-30">
              Edit
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
