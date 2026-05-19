"use client";

import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import type { QuestionGenNodeData, StudyQuestionTemplate } from "@/lib/workflow-types";

interface Props { id: string; data: QuestionGenNodeData }

const inputCls = "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700";

const TEMPLATES: { value: StudyQuestionTemplate; label: string; hint: string }[] = [
  { value: "lecture_notes",  label: "Lecture notes",  hint: "Balanced mix of question types, moderate count. Good default." },
  { value: "exam_prep",      label: "Exam prep",      hint: "Emphasises exam-style, MCQ, and hard difficulty questions." },
  { value: "deep_study",     label: "Deep study",     hint: "Maximises question count across all types including applied scenarios." },
  { value: "quick_review",   label: "Quick review",   hint: "Short-answer and important questions only — minimal count." },
];

type CheckboxRowProps = { label: string; hint?: string; checked: boolean; onChange: () => void };
function CheckboxRow({ label, hint, checked, onChange }: CheckboxRowProps) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer group">
      <div onClick={onChange}
        className={["w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors cursor-pointer",
          checked ? "bg-aubergine-700 border-aubergine-700" : "border-stone-300 dark:border-stone-600 group-hover:border-stone-400",
        ].join(" ")}>
        {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
      </div>
      <div>
        <span className="text-xs text-stone-700 dark:text-stone-300">{label}</span>
        {hint && <p className="text-2xs text-stone-400 dark:text-stone-500 leading-tight">{hint}</p>}
      </div>
    </label>
  );
}

export default function QuestionGenInspector({ id, data }: Props) {
  const update = useWorkflowStoreContext((s) => s.updateNodeData);

  return (
    <div className="space-y-5">

      <Field label="Question template">
        <div className="space-y-1.5">
          {TEMPLATES.map((t) => (
            <label key={t.value} className="flex items-start gap-2.5 cursor-pointer group">
              <input type="radio" className="sr-only" name={`template-${id}`} value={t.value}
                checked={data.template === t.value}
                onChange={() => update(id, { template: t.value })} />
              <div className={["w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors",
                data.template === t.value ? "border-aubergine-700 bg-aubergine-700" : "border-stone-300 dark:border-stone-600 group-hover:border-stone-400",
              ].join(" ")} />
              <div>
                <span className="text-sm text-stone-700 dark:text-stone-300">{t.label}</span>
                <p className="text-2xs text-stone-400 dark:text-stone-500 leading-tight">{t.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Max questions" hint={`currently ${data.maxQuestions}`}>
        <input type="number" min={5} max={60} value={data.maxQuestions}
          onChange={(e) => update(id, { maxQuestions: Number(e.target.value) })}
          className={inputCls} />
      </Field>

      <Field label="Question types">
        <div className="space-y-2">
          <CheckboxRow label="Short answer"
            hint="Open-ended recall questions with a concise expected answer."
            checked={data.includeShortAnswer}
            onChange={() => update(id, { includeShortAnswer: !data.includeShortAnswer })} />
          <CheckboxRow label="Exam questions"
            hint="Formal exam-style questions with structured marking-scheme answers."
            checked={data.includeExamQ}
            onChange={() => update(id, { includeExamQ: !data.includeExamQ })} />
          <CheckboxRow label="Compare / contrast"
            hint="Questions that ask the student to compare two concepts from the lecture."
            checked={data.includeCompare}
            onChange={() => update(id, { includeCompare: !data.includeCompare })} />
          <CheckboxRow label="Applied scenarios"
            hint="Real-world application questions. Requires strong source coverage."
            checked={data.includeApplied}
            onChange={() => update(id, { includeApplied: !data.includeApplied })} />
        </div>
      </Field>

      {data.questionCount !== undefined && (
        <div className="rounded-lg border border-aubergine-200 dark:border-aubergine-800 bg-aubergine-50 dark:bg-aubergine-950/20 px-3 py-2">
          <p className="text-xs font-medium text-aubergine-700 dark:text-aubergine-400">{data.questionCount} questions generated</p>
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
