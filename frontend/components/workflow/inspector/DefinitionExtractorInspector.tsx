"use client";

import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import type { DefinitionExtractorNodeData } from "@/lib/workflow-types";

interface Props { id: string; data: DefinitionExtractorNodeData }

const inputCls = "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700";

export default function DefinitionExtractorInspector({ id, data }: Props) {
  const update = useWorkflowStoreContext((s) => s.updateNodeData);

  return (
    <div className="space-y-5">

      <Field label="Max definitions" hint={`currently ${data.maxDefinitions}`}>
        <input type="number" min={3} max={100} value={data.maxDefinitions}
          onChange={(e) => update(id, { maxDefinitions: Number(e.target.value) })}
          className={inputCls} />
        <p className="text-2xs text-stone-400 dark:text-stone-500 mt-1">
          Extracts term → definition pairs from the transcript. Captures formal definitions, glossary terms, and explained jargon.
        </p>
      </Field>

      <Field label="Context inclusion">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-xs text-stone-600 dark:text-stone-400">Include surrounding context</span>
            <p className="text-2xs text-stone-400 dark:text-stone-500 leading-tight">
              Attach the sentence before/after the definition for richer understanding.
            </p>
          </div>
          <button type="button" role="switch" aria-checked={data.includeContext}
            onClick={() => update(id, { includeContext: !data.includeContext })}
            className={["relative inline-flex w-8 h-4 rounded-full border-2 transition-colors flex-shrink-0 ml-3",
              data.includeContext ? "bg-aubergine-700 border-aubergine-700" : "bg-stone-200 dark:bg-stone-700 border-stone-200 dark:border-stone-700",
            ].join(" ")}>
            <span className={["inline-block w-3 h-3 rounded-full bg-white shadow transition-transform duration-150 mt-px",
              data.includeContext ? "translate-x-3.5" : "translate-x-0.5"].join(" ")} />
          </button>
        </label>
      </Field>

      <div className="rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-3 py-2.5">
        <p className="text-2xs text-stone-500 dark:text-stone-400 leading-relaxed">
          Definition cards are used by the Flashcard Generator and Quiz Generator nodes. Connect those nodes downstream to make use of extracted definitions.
        </p>
      </div>

      {data.definitionCount !== undefined && (
        <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 px-3 py-2">
          <p className="text-xs font-medium text-violet-700 dark:text-violet-400">{data.definitionCount} definitions extracted</p>
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
