"use client";

import { useWorkflowStoreContext, useWorkflowMode } from "@/lib/workflow-store-context";
import {
  EXTRACTION_TEMPLATES,
  FIELD_GROUP_DEFS,
  templateDefaultGroups,
  type ConfidenceThreshold,
  type ExtractionFieldGroup,
  type ExtractionNodeData,
  type ExtractionTemplate,
  type FieldGroupId,
  type MissingFieldBehavior,
} from "@/lib/workflow-types";

interface Props { id: string; data: ExtractionNodeData }

export default function ExtractionInspector({ id, data }: Props) {
  const update      = useWorkflowStoreContext((s) => s.updateNodeData);
  const { mode }    = useWorkflowMode();
  const isGeneral   = mode === "general";

  // ── Helpers ────────────────────────────────────────────────────────────────

  const groups = (data.fieldGroups ?? []) as ExtractionFieldGroup[];

  function isGroupActive(groupId: FieldGroupId): boolean {
    return groups.find((g) => g.id === groupId)?.active ?? true;
  }

  function toggleGroup(groupId: FieldGroupId) {
    const updated = FIELD_GROUP_DEFS.map((def) => ({
      id: def.id,
      active: def.id === groupId ? !isGroupActive(def.id) : isGroupActive(def.id),
    }));
    update(id, { fieldGroups: updated });
  }

  function handleTemplateChange(templateId: ExtractionTemplate) {
    update(id, { template: templateId, fieldGroups: templateDefaultGroups(templateId) });
  }

  const activeGroupCount = FIELD_GROUP_DEFS.filter((g) => isGroupActive(g.id)).length;
  const activeFieldCount = FIELD_GROUP_DEFS
    .filter((g) => isGroupActive(g.id))
    .reduce((sum, g) => sum + g.fieldCount, 0);
  const totalFieldCount = FIELD_GROUP_DEFS.reduce((sum, g) => sum + g.fieldCount, 0);

  return (
    <div className="space-y-5">

      {/* ── Template (Recruiting Mode only — General Mode uses Schema node) ── */}
      {!isGeneral && <Field label="Template">
        <div className="space-y-1.5">
          {EXTRACTION_TEMPLATES.map((tmpl) => {
            const active = data.template === tmpl.id;
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleTemplateChange(tmpl.id)}
                className={[
                  "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
                  active
                    ? "border-teal-400 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20"
                    : "border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:border-stone-300 dark:hover:border-stone-600",
                ].join(" ")}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                    {tmpl.label}
                  </span>
                  {tmpl.recommended && (
                    <span className="text-[9px] font-semibold text-teal-600 bg-teal-50 dark:bg-teal-900 rounded px-1.5 py-0.5">
                      Recommended
                    </span>
                  )}
                  {active && !tmpl.recommended && (
                    <span className="text-[10px] font-semibold text-teal-600">✓</span>
                  )}
                </div>
                <p className="text-[10px] text-stone-400 dark:text-stone-500">{tmpl.description}</p>
              </button>
            );
          })}
        </div>
      </Field>}

      {/* ── Field groups (Recruiting Mode only) ───────────────────────────── */}
      {!isGeneral && <Field
        label="Field groups"
        hint={`${activeGroupCount} / ${FIELD_GROUP_DEFS.length} · ${activeFieldCount} fields`}
      >
        <div className="rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden">
          {FIELD_GROUP_DEFS.map((groupDef, i) => {
            const active = isGroupActive(groupDef.id);
            return (
              <button
                key={groupDef.id}
                type="button"
                onClick={() => toggleGroup(groupDef.id)}
                className={[
                  "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                  i > 0 ? "border-t border-stone-100 dark:border-stone-800" : "",
                  active
                    ? "hover:bg-stone-50 dark:hover:bg-stone-800/50"
                    : "bg-stone-50/50 dark:bg-stone-800/30 hover:bg-stone-50 dark:hover:bg-stone-800/50",
                ].join(" ")}
              >
                {/* Checkbox */}
                <div className={[
                  "w-3.5 h-3.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                  active
                    ? "border-teal-500 bg-teal-500"
                    : "border-stone-300 dark:border-stone-600",
                ].join(" ")}>
                  {active && (
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="2">
                      <path d="M2 5l2.5 2.5 3.5-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                {/* Label */}
                <span className={[
                  "text-xs flex-1 transition-colors",
                  active
                    ? "text-stone-700 dark:text-stone-300"
                    : "text-stone-300 dark:text-stone-600 line-through",
                ].join(" ")}>
                  {groupDef.label}
                </span>
                {/* Count */}
                <span className={[
                  "text-[10px] font-mono flex-shrink-0",
                  active ? "text-stone-400 dark:text-stone-500" : "text-stone-200 dark:text-stone-700",
                ].join(" ")}>
                  {groupDef.fieldCount}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1.5">
          Changing template resets group selection to its defaults.
        </p>
      </Field>}

      {/* ── Confidence threshold ─────────────────────────────────────────── */}
      <Field label="Confidence threshold">
        <div className="flex gap-1.5">
          {(["high", "medium", "low"] as ConfidenceThreshold[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => update(id, { confidenceThreshold: level })}
              className={[
                "flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors capitalize",
                data.confidenceThreshold === level
                  ? "border-teal-400 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400"
                  : "border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600",
              ].join(" ")}
            >
              {level}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1.5">
          Fields below this threshold are flagged for recruiter review.
        </p>
      </Field>

      {/* ── Review options ───────────────────────────────────────────────── */}
      <Field label="Review options">
        <div className="space-y-2">
          {([
            { key: "flagLowConfidence" as const, label: "Flag low-confidence values" },
            { key: "includeEvidence"   as const, label: "Include evidence snippets" },
          ] as { key: keyof ExtractionNodeData; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => update(id, { [key]: !data[key] })}
              className="w-full flex items-center justify-between text-left group"
            >
              <span className="text-xs text-stone-600 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200 transition-colors">
                {label}
              </span>
              <div className={[
                "w-7 h-3.5 rounded-full transition-colors flex-shrink-0 relative",
                data[key] ? "bg-teal-500" : "bg-stone-200 dark:bg-stone-700",
              ].join(" ")}>
                <span className={[
                  "absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-transform",
                  data[key] ? "translate-x-3.5" : "translate-x-0.5",
                ].join(" ")} />
              </div>
            </button>
          ))}
        </div>
      </Field>

      {/* ── Missing field handling ───────────────────────────────────────── */}
      <Field label="Missing fields">
        <div className="flex flex-col gap-1.5">
          {([
            { value: "mark_missing", label: "Mark as missing" },
            { value: "skip_field",   label: "Skip field" },
          ] as { value: MissingFieldBehavior; label: string }[]).map((opt) => (
            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                className="sr-only"
                name={`missingField-${id}`}
                value={opt.value}
                checked={data.missingFieldBehavior === opt.value}
                onChange={() => update(id, { missingFieldBehavior: opt.value })}
              />
              <div className={[
                "w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors",
                data.missingFieldBehavior === opt.value
                  ? "border-teal-500 bg-teal-500"
                  : "border-stone-300 dark:border-stone-600 group-hover:border-stone-400",
              ].join(" ")} />
              <span className="text-sm text-stone-600 dark:text-stone-400">{opt.label}</span>
            </label>
          ))}
        </div>
        <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1.5">
          Applies when the AI cannot extract a value from the transcript.
        </p>
      </Field>

      {/* ── Last run ─────────────────────────────────────────────────────── */}
      {data.status === "completed" && data.extractedCount !== undefined && (
        <Field label="Last run">
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 px-3 py-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {data.extractedCount}{!isGeneral && ` / ${totalFieldCount}`} fields extracted
              </span>
              {data.overallConfidence !== undefined && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-500">
                  {Math.round(data.overallConfidence * 100)}% confidence
                </span>
              )}
            </div>
          </div>
        </Field>
      )}

    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
          {label}
        </span>
        {hint && <span className="text-[10px] text-stone-400 dark:text-stone-500 tabular-nums">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
