"use client";

import { useState } from "react";
import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import { overrideAnalysisScore } from "@/lib/api";
import type { AnalysisNodeData } from "@/lib/workflow-types";

interface Props { id: string; data: AnalysisNodeData }

const TIER_LABEL: Record<string, string> = {
  strong_fit:  "Strong fit",
  good_fit:    "Good fit",
  partial_fit: "Partial fit",
  weak_fit:    "Weak fit",
  no_fit:      "No fit",
};

const TIER_COLOR: Record<string, string> = {
  strong_fit:  "text-rose-800 dark:text-rose-400",
  good_fit:    "text-blue-600 dark:text-blue-400",
  partial_fit: "text-amber-600 dark:text-amber-400",
  weak_fit:    "text-orange-600 dark:text-orange-400",
  no_fit:      "text-red-600 dark:text-red-400",
};

const RUBRIC_ITEMS = [
  { key: "skills",     label: "Skills",      weight: "35%" },
  { key: "experience", label: "Experience",  weight: "20%" },
  { key: "domain",     label: "Domain",      weight: "15%" },
  { key: "logistics",  label: "Logistics",   weight: "30%" },
];

export default function AnalysisInspector({ id, data }: Props) {
  const update = useWorkflowStoreContext((s) => s.updateNodeData);

  // Override form state
  const [showOverride, setShowOverride] = useState(false);
  const [overrideInput, setOverrideInput] = useState(
    data.finalScore !== undefined && data.scoreStatus === "overridden"
      ? String((data.finalScore / 10).toFixed(1))
      : "",
  );
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState("");

  const displayScore = (score: number) => (score / 10).toFixed(1);

  const effectiveScore =
    data.scoreStatus === "overridden" && data.finalScore !== undefined
      ? data.finalScore
      : data.aiScore;

  async function handleSaveOverride() {
    if (!data.analysisRunId) return;
    const rawVal = parseFloat(overrideInput);
    if (isNaN(rawVal) || rawVal < 0 || rawVal > 10) {
      setOverrideError("Enter a score between 0 and 10.");
      return;
    }
    if (!overrideReason.trim()) {
      setOverrideError("Reason is required.");
      return;
    }

    // Extract candidateId from analysisRunId — we need candidateId for the API call.
    // It's stored on the extractionNode → look it up from the store.
    // Simpler: keep it in the store via updateNodeData during the run. We rely on WorkflowBuilder
    // having stored candidateId on the extraction node; here we get it from the node's own data.
    // The candidate_id is not directly on AnalysisNodeData. We'll derive it from the
    // extraction node at the parent level — but the inspector only receives `id` and `data`.
    // Workaround: WorkflowBuilder stores candidateId on analysisNodeData during the run.
    const candidateId = (data as Record<string, unknown>).candidateId as string | undefined;
    if (!candidateId) {
      setOverrideError("Run the workflow first to generate an AI score.");
      return;
    }

    setOverrideSaving(true);
    setOverrideError("");
    try {
      const backend100 = Math.round(rawVal * 10);
      await overrideAnalysisScore(candidateId, data.analysisRunId, backend100, overrideReason.trim());
      update(id, {
        finalScore:  backend100,
        scoreStatus: "overridden",
      });
      setShowOverride(false);
    } catch {
      setOverrideError("Failed to save override. Try again.");
    } finally {
      setOverrideSaving(false);
    }
  }

  function handleClearOverride() {
    update(id, { finalScore: undefined, scoreStatus: "ai_scored" });
    setShowOverride(false);
    setOverrideInput("");
    setOverrideReason("");
    setOverrideError("");
  }

  return (
    <div className="space-y-5">

      {/* ── JD Title ──────────────────────────────────────────────────────── */}
      <Field label="Job title">
        <input
          type="text"
          placeholder="e.g. Senior Software Engineer"
          value={data.jdTitle}
          onChange={(e) => update(id, { jdTitle: e.target.value })}
          className={[
            "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2",
            "text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400 dark:placeholder:text-stone-600",
            "border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-400",
          ].join(" ")}
        />
      </Field>

      {/* ── JD Text ───────────────────────────────────────────────────────── */}
      <Field label="Job description" hint={data.jdText ? `${data.jdText.length.toLocaleString()} chars` : undefined}>
        <textarea
          placeholder={"Paste the full job description here.\nThe AI will score the candidate against it."}
          value={data.jdText}
          onChange={(e) => update(id, { jdText: e.target.value })}
          rows={7}
          className={[
            "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2 resize-y",
            "text-xs text-stone-800 dark:text-stone-200 placeholder:text-stone-400 dark:placeholder:text-stone-600",
            "border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-400",
          ].join(" ")}
        />
        {!data.jdText && (
          <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1.5">
            A job description is required to run AI scoring. Job is created automatically on first run.
          </p>
        )}
      </Field>

      {/* ── Scoring rubric (informational) ────────────────────────────────── */}
      <Field label="Scoring rubric">
        <div className="rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden">
          {RUBRIC_ITEMS.map((item, i) => (
            <div
              key={item.key}
              className={[
                "flex items-center justify-between px-3 py-2",
                i > 0 ? "border-t border-stone-100 dark:border-stone-800" : "",
              ].join(" ")}
            >
              <span className="text-xs text-stone-600 dark:text-stone-400">{item.label}</span>
              <span className="text-[10px] font-mono text-stone-400 dark:text-stone-500">{item.weight}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1.5">
          Output: score 0–10 + tier + per-dimension rationale.
        </p>
      </Field>

      {/* ── Options ───────────────────────────────────────────────────────── */}
      <Field label="Options">
        <button
          type="button"
          onClick={() => update(id, { includeRationale: !data.includeRationale })}
          className="w-full flex items-center justify-between text-left group"
        >
          <span className="text-xs text-stone-600 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200 transition-colors">
            Include rationale
          </span>
          <div className={[
            "w-7 h-3.5 rounded-full transition-colors flex-shrink-0 relative",
            data.includeRationale ? "bg-amber-400" : "bg-stone-200 dark:bg-stone-700",
          ].join(" ")}>
            <span className={[
              "absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-transform",
              data.includeRationale ? "translate-x-3.5" : "translate-x-0.5",
            ].join(" ")} />
          </div>
        </button>
      </Field>

      {/* ── AI Score result ───────────────────────────────────────────────── */}
      {data.status === "completed" && data.aiScore !== undefined && (
        <Field label="AI Score">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-stone-800 dark:text-stone-100">
                  {displayScore(effectiveScore ?? data.aiScore)}
                </span>
                <span className="text-xs text-stone-400 dark:text-stone-500">/10</span>
              </div>
              <div className="flex items-center gap-1.5">
                {data.aiTier && (
                  <span className={`text-xs font-semibold ${TIER_COLOR[data.aiTier] ?? "text-stone-500"}`}>
                    {TIER_LABEL[data.aiTier] ?? data.aiTier}
                  </span>
                )}
                {data.scoreStatus === "overridden" && (
                  <span className="text-[9px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 rounded px-1.5 py-0.5">
                    override
                  </span>
                )}
              </div>
            </div>

            {/* Per-dimension breakdown placeholder */}
            <p className="text-[10px] text-amber-700 dark:text-amber-500">
              AI score {displayScore(data.aiScore)}/10
              {data.scoreStatus === "overridden" && data.finalScore !== undefined
                ? ` · recruiter override ${displayScore(data.finalScore)}/10`
                : ""}
            </p>

            {/* Override actions */}
            <div className="mt-2.5 flex gap-2">
              {data.scoreStatus === "overridden" ? (
                <button
                  type="button"
                  onClick={handleClearOverride}
                  className="text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Clear override
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowOverride((v) => !v)}
                  className="text-[10px] font-medium text-amber-700 dark:text-amber-400 hover:underline"
                >
                  {showOverride ? "Cancel" : "Override score"}
                </button>
              )}
            </div>
          </div>

          {/* Override form */}
          {showOverride && data.scoreStatus !== "overridden" && (
            <div className="mt-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 px-3 py-3 space-y-2.5">
              <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wide">
                Recruiter override
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  placeholder="0–10"
                  value={overrideInput}
                  onChange={(e) => { setOverrideInput(e.target.value); setOverrideError(""); }}
                  className={[
                    "w-20 rounded border bg-white dark:bg-stone-800 px-2 py-1.5 text-sm text-stone-800 dark:text-stone-200",
                    "border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-violet-400",
                  ].join(" ")}
                />
                <span className="text-xs text-stone-400">/10</span>
              </div>
              <textarea
                placeholder="Why are you overriding? (required)"
                value={overrideReason}
                onChange={(e) => { setOverrideReason(e.target.value); setOverrideError(""); }}
                rows={2}
                className={[
                  "w-full rounded border bg-white dark:bg-stone-800 px-2 py-1.5 text-xs text-stone-800 dark:text-stone-200 resize-none",
                  "border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-violet-400",
                ].join(" ")}
              />
              {overrideError && (
                <p className="text-[10px] text-red-500">{overrideError}</p>
              )}
              <button
                type="button"
                disabled={overrideSaving}
                onClick={handleSaveOverride}
                className={[
                  "w-full rounded-md py-1.5 text-xs font-semibold transition-colors",
                  overrideSaving
                    ? "bg-stone-100 dark:bg-stone-800 text-stone-400 cursor-not-allowed"
                    : "bg-violet-600 hover:bg-violet-700 text-white",
                ].join(" ")}
              >
                {overrideSaving ? "Saving…" : "Save override"}
              </button>
            </div>
          )}
        </Field>
      )}

    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
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
