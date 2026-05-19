"use client";

import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import type { StudyOutputNodeData } from "@/lib/workflow-types";

interface Props { id: string; data: StudyOutputNodeData }

const inputCls = "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400 border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700";

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

export default function StudyOutputInspector({ id, data }: Props) {
  const update = useWorkflowStoreContext((s) => s.updateNodeData);

  return (
    <div className="space-y-5">

      <Field label="Pack title" hint="optional">
        <input type="text" placeholder="e.g. Week 4 Study Pack"
          value={data.packTitle}
          onChange={(e) => update(id, { packTitle: e.target.value })}
          className={inputCls} />
        <p className="text-2xs text-stone-400 dark:text-stone-500 mt-1">
          Defaults to the lecture title if left blank.
        </p>
      </Field>

      <div className="h-px bg-stone-100 dark:bg-stone-800" />

      <Field label="Archive behaviour">
        <Toggle label="Auto-archive on run"
          hint="Archive the lecture immediately after extraction completes. Disable to review first."
          checked={data.autoArchive}
          onChange={() => update(id, { autoArchive: !data.autoArchive })} />
      </Field>

      <Field label="Export formats">
        <div className="space-y-2">
          <Toggle label="JSON export"
            hint="Full structured data including all extracted content."
            checked={data.exportJson}
            onChange={() => update(id, { exportJson: !data.exportJson })} />
          <Toggle label="CSV export"
            hint="Flashcard front/back pairs and question/answer pairs in spreadsheet format."
            checked={data.exportCsv}
            onChange={() => update(id, { exportCsv: !data.exportCsv })} />
          <Toggle label="Anki deck (.apkg)"
            hint="Import-ready Anki package with card types as deck names and topic tags as Anki tags."
            checked={data.exportAnki}
            onChange={() => update(id, { exportAnki: !data.exportAnki })} />
        </div>
      </Field>

      {data.lectureId ? (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Study pack ready</p>
          <p className="text-2xs text-emerald-600 dark:text-emerald-500 mt-0.5 font-mono">{data.lectureId}</p>
          <a href={`/study/review/${data.lectureId}`}
            className="text-2xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline mt-1 inline-block">
            Open review →
          </a>
        </div>
      ) : (
        <div className="rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-3 py-2.5">
          <p className="text-2xs text-stone-500 dark:text-stone-400 leading-relaxed">
            Running the workflow will extract all configured content and route to the Study review workspace where you can edit, archive, and export the study pack.
          </p>
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
