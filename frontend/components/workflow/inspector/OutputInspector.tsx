"use client";

import Link from "next/link";
import { useWorkflowStoreContext, useWorkflowMode } from "@/lib/workflow-store-context";
import type { DataSource, ExtraOutputFormat, OutputNodeData } from "@/lib/workflow-types";

interface Props { id: string; data: OutputNodeData }

const EXTRA_FORMATS: { value: ExtraOutputFormat; label: string; desc: string; implemented: boolean }[] = [
  { value: "json", label: "JSON",     desc: "Structured candidate record",   implemented: true  },
  { value: "csv",  label: "CSV",      desc: "Spreadsheet-compatible export", implemented: false },
  { value: "api",  label: "API POST", desc: "Deliver to a webhook URL",      implemented: false },
];

const DATA_SOURCES: { value: DataSource; label: string }[] = [
  { value: "reviewed",  label: "Recruiter reviewed (preferred)" },
  { value: "extracted", label: "AI extracted only" },
];

const CONTENT_TOGGLES_RECRUITING: { key: keyof OutputNodeData; label: string }[] = [
  { key: "includeStructuredData", label: "Structured profile (35 fields)" },
  { key: "includeAnalysis",       label: "JD fit analysis & score" },
  { key: "includeTranscript",     label: "Raw transcript text" },
  { key: "includeEvidence",       label: "Field evidence snippets" },
];

const CONTENT_TOGGLES_GENERAL: { key: keyof OutputNodeData; label: string }[] = [
  { key: "includeStructuredData", label: "Extracted fields" },
  { key: "includeTranscript",     label: "Raw transcript text" },
  { key: "includeEvidence",       label: "Field evidence snippets" },
];

export default function OutputInspector({ id, data }: Props) {
  const update       = useWorkflowStoreContext((s) => s.updateNodeData);
  const { mode }     = useWorkflowMode();
  const isGeneral    = mode === "general";
  const extraFormats = (data.extraFormats ?? []) as ExtraOutputFormat[];
  const contentToggles = isGeneral ? CONTENT_TOGGLES_GENERAL : CONTENT_TOGGLES_RECRUITING;

  function toggleFormat(fmt: ExtraOutputFormat) {
    const next = extraFormats.includes(fmt)
      ? extraFormats.filter((f) => f !== fmt)
      : [...extraFormats, fmt];
    update(id, { extraFormats: next });
  }

  function toggleContent(key: keyof OutputNodeData) {
    update(id, { [key]: !data[key] });
  }

  return (
    <div className="space-y-5">

      {/* ── Dashboard (fixed, always on) ──────────────────────────────────── */}
      <Field label="Primary output">
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              {isGeneral ? "Results dashboard" : "Recruiter dashboard"}
            </p>
            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 mt-0.5">
              Results always appear here after every run.
            </p>
          </div>
          <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-100 dark:bg-emerald-900/50 rounded px-1.5 py-0.5 flex-shrink-0">
            Always on
          </span>
        </div>
      </Field>

      {/* ── Additional delivery formats ───────────────────────────────────── */}
      <Field label="Additional delivery">
        <div className="space-y-1.5">
          {EXTRA_FORMATS.map((fmt) => {
            const active = extraFormats.includes(fmt.value);
            return (
              <button
                key={fmt.value}
                type="button"
                disabled={!fmt.implemented}
                onClick={() => fmt.implemented && toggleFormat(fmt.value)}
                className={[
                  "w-full text-left rounded-lg border px-3 py-2 transition-colors",
                  !fmt.implemented
                    ? "opacity-40 cursor-not-allowed border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                    : active
                      ? "border-teal-400 dark:border-teal-600 bg-teal-50 dark:bg-teal-950/30"
                      : "border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:border-stone-300 dark:hover:border-stone-600",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={[
                      "w-3.5 h-3.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                      active
                        ? "border-teal-500 bg-teal-500"
                        : "border-stone-300 dark:border-stone-600",
                    ].join(" ")}>
                      {active && (
                        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                      {fmt.label}
                    </span>
                  </div>
                  {!fmt.implemented && (
                    <span className="text-[9px] font-medium text-stone-400 dark:text-stone-500 tracking-wide uppercase">
                      Soon
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5 ml-5">
                  {fmt.desc}
                </p>
              </button>
            );
          })}
        </div>
      </Field>

      {/* ── Content settings ─────────────────────────────────────────────── */}
      <Field label="Include in exports">
        <div className="space-y-0.5">
          {contentToggles.map(({ key, label }) => {
            const on = !!data[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleContent(key)}
                className="w-full flex items-center justify-between py-1.5 text-left group"
              >
                <span className="text-xs text-stone-600 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200 transition-colors">
                  {label}
                </span>
                <div className={[
                  "w-7 h-3.5 rounded-full transition-colors flex-shrink-0 relative",
                  on ? "bg-teal-500" : "bg-stone-200 dark:bg-stone-700",
                ].join(" ")}>
                  <span className={[
                    "absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-transform",
                    on ? "translate-x-3.5" : "translate-x-0.5",
                  ].join(" ")} />
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1.5">
          Applies to additional delivery formats. Dashboard always shows full data.
        </p>
      </Field>

      {/* ── Data source ───────────────────────────────────────────────────── */}
      <Field label="Data source">
        <div className="flex flex-col gap-1.5">
          {DATA_SOURCES.map((s) => (
            <label key={s.value} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                className="sr-only"
                name={`dataSource-${id}`}
                value={s.value}
                checked={data.dataSource === s.value}
                onChange={() => update(id, { dataSource: s.value })}
              />
              <div className={[
                "w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors",
                data.dataSource === s.value
                  ? "border-emerald-500 bg-emerald-500"
                  : "border-stone-300 dark:border-stone-600 group-hover:border-stone-400",
              ].join(" ")} />
              <span className="text-sm text-stone-600 dark:text-stone-400">{s.label}</span>
            </label>
          ))}
        </div>
      </Field>

      {/* ── Export label ─────────────────────────────────────────────────── */}
      <Field label="Export label" hint="optional">
        <input
          type="text"
          className={[
            "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2",
            "text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400",
            "border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-teal-500",
          ].join(" ")}
          placeholder="e.g. candidate-export"
          value={data.exportLabel ?? ""}
          onChange={(e) => update(id, { exportLabel: e.target.value })}
        />
      </Field>

      {/* ── Last run output link ─────────────────────────────────────────── */}
      {data.status === "completed" && data.candidateId && (
        <Field label="Last run">
          <Link
            href={isGeneral ? `/general/results/${data.candidateId}` : `/review/${data.candidateId}`}
            className="flex items-center justify-between rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
          >
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Open in dashboard
            </span>
            <span className="text-emerald-500 text-sm">→</span>
          </Link>
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
        {hint && <span className="text-[10px] text-stone-400 dark:text-stone-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
