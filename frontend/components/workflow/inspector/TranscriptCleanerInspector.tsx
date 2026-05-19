"use client";

import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import type { CleanerPreset, TranscriptCleanerNodeData } from "@/lib/workflow-types";

interface Props { id: string; data: TranscriptCleanerNodeData }

const PRESETS: { value: CleanerPreset; label: string; hint: string }[] = [
  { value: "lecture",  label: "Lecture",   hint: "Removes filler words, fixes speaker labels, collapses repeated phrases. Recommended for recorded lectures." },
  { value: "seminar",  label: "Seminar",   hint: "Light cleaning — preserves discussion nuance and back-and-forth between participants." },
  { value: "verbatim", label: "Verbatim",  hint: "No cleaning applied. Transcript is passed through as-is." },
];

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-xs text-stone-600 dark:text-stone-400">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={onChange}
        className={["relative inline-flex w-8 h-4 rounded-full border-2 transition-colors flex-shrink-0 ml-3",
          checked ? "bg-aubergine-700 border-aubergine-700" : "bg-stone-200 dark:bg-stone-700 border-stone-200 dark:border-stone-700",
        ].join(" ")}>
        <span className={["inline-block w-3 h-3 rounded-full bg-white shadow transition-transform duration-150 mt-px",
          checked ? "translate-x-3.5" : "translate-x-0.5"].join(" ")} />
      </button>
    </label>
  );
}

export default function TranscriptCleanerInspector({ id, data }: Props) {
  const update = useWorkflowStoreContext((s) => s.updateNodeData);

  return (
    <div className="space-y-5">

      <Field label="Cleaning preset">
        <div className="space-y-1.5">
          {PRESETS.map((p) => (
            <label key={p.value} className="flex items-start gap-2.5 cursor-pointer group">
              <input type="radio" className="sr-only" name={`preset-${id}`} value={p.value}
                checked={data.preset === p.value}
                onChange={() => update(id, { preset: p.value })} />
              <div className={["w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors",
                data.preset === p.value ? "border-aubergine-700 bg-aubergine-700" : "border-stone-300 dark:border-stone-600 group-hover:border-stone-400",
              ].join(" ")} />
              <div>
                <span className="text-sm text-stone-700 dark:text-stone-300">{p.label}</span>
                <p className="text-2xs text-stone-400 dark:text-stone-500 leading-tight">{p.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </Field>

      {data.preset !== "verbatim" && (
        <Field label="Options">
          <div className="space-y-2.5">
            <Toggle label="Remove filler words (um, uh, like, you know)"
              checked={data.removeFiller}
              onChange={() => update(id, { removeFiller: !data.removeFiller })} />
            <Toggle label="Fix speaker labels (Speaker A → Prof. Smith)"
              checked={data.fixSpeakerLabels}
              onChange={() => update(id, { fixSpeakerLabels: !data.fixSpeakerLabels })} />
            <Toggle label="Collapse repeated phrases"
              checked={data.collapseRepetitions}
              onChange={() => update(id, { collapseRepetitions: !data.collapseRepetitions })} />
          </div>
        </Field>
      )}

      {data.charCount !== undefined && (
        <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/20 px-3 py-2">
          <p className="text-xs font-medium text-sky-700 dark:text-sky-400">Cleaned transcript ready</p>
          <p className="text-2xs text-sky-600 dark:text-sky-500 mt-0.5">{data.charCount.toLocaleString()} characters</p>
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
