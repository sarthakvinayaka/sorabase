"use client";

import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import type { QuizDifficultyMix, QuizGenNodeData } from "@/lib/workflow-types";

interface Props { id: string; data: QuizGenNodeData }

const inputCls = "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700";

const MIX_OPTIONS: { value: QuizDifficultyMix; label: string; hint: string }[] = [
  { value: "easy_heavy",  label: "Easy-heavy",  hint: "60/30/10 — ideal for first-pass review." },
  { value: "balanced",    label: "Balanced",    hint: "33/33/33 — general practice." },
  { value: "hard_heavy",  label: "Hard-heavy",  hint: "10/30/60 — exam preparation." },
];

type TypeRow = { key: keyof QuizGenNodeData; label: string };
const QTYPES: TypeRow[] = [
  { key: "includeMcq",         label: "Multiple choice (MCQ)" },
  { key: "includeTrueFalse",   label: "True / False" },
  { key: "includeShortAnswer", label: "Short answer" },
  { key: "includeMatching",    label: "Matching" },
  { key: "includeFillBlank",   label: "Fill in the blank" },
];

export default function QuizGenInspector({ id, data }: Props) {
  const update = useWorkflowStoreContext((s) => s.updateNodeData);

  return (
    <div className="space-y-5">

      <Field label="Difficulty mix">
        <div className="space-y-1.5">
          {MIX_OPTIONS.map((m) => (
            <label key={m.value} className="flex items-start gap-2.5 cursor-pointer group">
              <input type="radio" className="sr-only" name={`difficultyMix-${id}`} value={m.value}
                checked={data.difficultyMix === m.value}
                onChange={() => update(id, { difficultyMix: m.value })} />
              <div className={["w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors",
                data.difficultyMix === m.value ? "border-aubergine-700 bg-aubergine-700" : "border-stone-300 dark:border-stone-600 group-hover:border-stone-400",
              ].join(" ")} />
              <div>
                <span className="text-sm text-stone-700 dark:text-stone-300">{m.label}</span>
                <p className="text-2xs text-stone-400 dark:text-stone-500 leading-tight">{m.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Max questions" hint={`currently ${data.maxQuestions}`}>
        <input type="number" min={5} max={50} value={data.maxQuestions}
          onChange={(e) => update(id, { maxQuestions: Number(e.target.value) })}
          className={inputCls} />
      </Field>

      <Field label="Question types">
        <div className="space-y-2">
          {QTYPES.map(({ key, label }) => {
            const checked = data[key] as boolean;
            return (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                <div onClick={() => update(id, { [key]: !checked })}
                  className={["w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors cursor-pointer",
                    checked ? "bg-aubergine-700 border-aubergine-700" : "border-stone-300 dark:border-stone-600 group-hover:border-stone-400",
                  ].join(" ")}>
                  {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="text-xs text-stone-700 dark:text-stone-300">{label}</span>
              </label>
            );
          })}
        </div>
      </Field>

      {data.quizItemCount !== undefined && (
        <div className="rounded-lg border border-aubergine-200 dark:border-aubergine-800 bg-aubergine-50 dark:bg-aubergine-950/20 px-3 py-2">
          <p className="text-xs font-medium text-aubergine-700 dark:text-aubergine-400">{data.quizItemCount} quiz items generated</p>
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
