"use client";

import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import type { FormulaExtractorNodeData } from "@/lib/workflow-types";

interface Props { id: string; data: FormulaExtractorNodeData }

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

export default function FormulaExtractorInspector({ id, data }: Props) {
  const update = useWorkflowStoreContext((s) => s.updateNodeData);

  return (
    <div className="space-y-5">

      <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
        Extracts mathematical formulas, equations, and symbolic notation. Each formula includes its name, symbolic expression, and a plain-English explanation.
      </p>

      <Field label="Options">
        <div className="space-y-2.5">
          <Toggle label="Include units"
            hint="Add SI units and dimensional analysis where applicable."
            checked={data.includeUnits}
            onChange={() => update(id, { includeUnits: !data.includeUnits })} />
          <Toggle label="Include derivations"
            hint="Where the lecturer walks through how a formula is derived, capture the steps."
            checked={data.includeDerivations}
            onChange={() => update(id, { includeDerivations: !data.includeDerivations })} />
        </div>
      </Field>

      <div className="rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-3 py-2.5">
        <p className="text-2xs text-stone-500 dark:text-stone-400 leading-relaxed">
          Formula cards display with <span className="font-mono">code</span> formatting on the front and a plain-English explanation on the back. Connect to Flashcard Generator or Quiz Generator downstream.
        </p>
      </div>

      {data.formulaCount !== undefined && (
        <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 px-3 py-2">
          <p className="text-xs font-medium text-violet-700 dark:text-violet-400">{data.formulaCount} formulas extracted</p>
        </div>
      )}

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide block mb-1.5">{label}</span>
      {children}
    </div>
  );
}
