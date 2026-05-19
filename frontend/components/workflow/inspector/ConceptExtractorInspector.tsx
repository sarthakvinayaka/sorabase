"use client";

import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import type { ConceptExtractorNodeData, ConfidenceThreshold } from "@/lib/workflow-types";

interface Props { id: string; data: ConceptExtractorNodeData }

const inputCls = "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700";

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-start justify-between gap-3 cursor-pointer">
      <div>
        <span className="text-xs text-stone-600 dark:text-stone-400">{label}</span>
        {hint && <p className="text-2xs text-stone-400 dark:text-stone-500 leading-tight">{hint}</p>}
      </div>
      <button type="button" role="switch" aria-checked={checked} onClick={onChange}
        className={["relative inline-flex w-8 h-4 rounded-full border-2 transition-colors flex-shrink-0 mt-0.5",
          checked ? "bg-aubergine-700 border-aubergine-700" : "bg-stone-200 dark:bg-stone-700 border-stone-200 dark:border-stone-700",
        ].join(" ")}>
        <span className={["inline-block w-3 h-3 rounded-full bg-white shadow transition-transform duration-150 mt-px",
          checked ? "translate-x-3.5" : "translate-x-0.5"].join(" ")} />
      </button>
    </label>
  );
}

export default function ConceptExtractorInspector({ id, data }: Props) {
  const update = useWorkflowStoreContext((s) => s.updateNodeData);

  return (
    <div className="space-y-5">

      <Field label="Max concepts" hint={`currently ${data.maxConcepts}`}>
        <input type="number" min={3} max={50} value={data.maxConcepts}
          onChange={(e) => update(id, { maxConcepts: Number(e.target.value) })}
          className={inputCls} />
        <p className="text-2xs text-stone-400 dark:text-stone-500 mt-1">
          The extractor will surface the most important concepts up to this limit.
        </p>
      </Field>

      <Field label="Confidence threshold">
        <div className="flex gap-1.5">
          {(["high", "medium", "low"] as ConfidenceThreshold[]).map((t) => (
            <button key={t} type="button"
              onClick={() => update(id, { confidenceThreshold: t })}
              className={["flex-1 py-1.5 rounded border text-xs font-medium capitalize transition-colors",
                data.confidenceThreshold === t
                  ? "bg-aubergine-800 border-aubergine-800 text-white"
                  : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-300",
              ].join(" ")}>
              {t}
            </button>
          ))}
        </div>
        <p className="text-2xs text-stone-400 dark:text-stone-500 mt-1">
          High = only well-supported concepts. Low = include inferred concepts.
        </p>
      </Field>

      <Field label="Options">
        <Toggle label="Include evidence snippets"
          hint="Attach the transcript passage that supports each concept."
          checked={data.includeEvidence}
          onChange={() => update(id, { includeEvidence: !data.includeEvidence })} />
      </Field>

      {data.conceptCount !== undefined && (
        <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 px-3 py-2">
          <p className="text-xs font-medium text-violet-700 dark:text-violet-400">{data.conceptCount} concepts extracted</p>
        </div>
      )}

    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">{label}</span>
        {hint && <span className="text-[10px] text-stone-400 dark:text-stone-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
