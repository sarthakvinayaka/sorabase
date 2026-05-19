"use client";

import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import type { FlashcardGenNodeData } from "@/lib/workflow-types";

interface Props { id: string; data: FlashcardGenNodeData }

const inputCls = "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700";

type SourceRow = { key: keyof FlashcardGenNodeData; label: string; hint: string };

const SOURCES: SourceRow[] = [
  { key: "includeConcepts",    label: "Key concepts",  hint: "Concept → explanation cards." },
  { key: "includeDefinitions", label: "Definitions",   hint: "Term → definition cards." },
  { key: "includeFormulas",    label: "Formulas",      hint: "Formula name + notation → plain-English explanation." },
  { key: "includeQuestions",   label: "Q&A pairs",     hint: "Important questions with short-answer back." },
  { key: "includeTopics",      label: "Topic summaries", hint: "Top-level topic → bullet summary of key points." },
];

export default function FlashcardGenInspector({ id, data }: Props) {
  const update = useWorkflowStoreContext((s) => s.updateNodeData);

  return (
    <div className="space-y-5">

      <Field label="Card sources">
        <div className="space-y-2">
          {SOURCES.map(({ key, label, hint }) => {
            const checked = data[key] as boolean;
            return (
              <label key={key} className="flex items-start gap-2.5 cursor-pointer group">
                <div onClick={() => update(id, { [key]: !checked })}
                  className={["w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors cursor-pointer",
                    checked ? "bg-aubergine-700 border-aubergine-700" : "border-stone-300 dark:border-stone-600 group-hover:border-stone-400",
                  ].join(" ")}>
                  {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <div>
                  <span className="text-xs text-stone-700 dark:text-stone-300">{label}</span>
                  <p className="text-2xs text-stone-400 dark:text-stone-500 leading-tight">{hint}</p>
                </div>
              </label>
            );
          })}
        </div>
      </Field>

      <Field label="Max cards" hint={`currently ${data.maxCards}`}>
        <input type="number" min={5} max={200} value={data.maxCards}
          onChange={(e) => update(id, { maxCards: Number(e.target.value) })}
          className={inputCls} />
        <p className="text-2xs text-stone-400 dark:text-stone-500 mt-1">
          Cards are prioritised by source confidence. High-confidence cards are generated first.
        </p>
      </Field>

      {data.flashcardCount !== undefined && (
        <div className="rounded-lg border border-aubergine-200 dark:border-aubergine-800 bg-aubergine-50 dark:bg-aubergine-950/20 px-3 py-2">
          <p className="text-xs font-medium text-aubergine-700 dark:text-aubergine-400">{data.flashcardCount} flashcards generated</p>
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
