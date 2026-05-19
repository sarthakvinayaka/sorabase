"use client";

import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import type { LecUploadFormat, LecUploadNodeData } from "@/lib/workflow-types";

interface Props { id: string; data: LecUploadNodeData }

const FORMATS: { value: LecUploadFormat; label: string; hint: string }[] = [
  { value: "audio",    label: "Audio file",    hint: "MP3, M4A, WAV — transcribed automatically." },
  { value: "pdf",      label: "PDF / Slides",  hint: "PDF lecture notes or exported slide deck." },
  { value: "markdown", label: "Markdown",      hint: "Plain text or Markdown document." },
];

const inputCls = "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400 border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700";

export default function LecUploadInspector({ id, data }: Props) {
  const update = useWorkflowStoreContext((s) => s.updateNodeData);

  return (
    <div className="space-y-5">

      <Field label="File format">
        <div className="space-y-1.5">
          {FORMATS.map((f) => (
            <label key={f.value} className="flex items-start gap-2.5 cursor-pointer group">
              <input type="radio" className="sr-only" name={`format-${id}`} value={f.value}
                checked={data.format === f.value}
                onChange={() => update(id, { format: f.value })} />
              <div className={[
                "w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors",
                data.format === f.value
                  ? "border-aubergine-700 bg-aubergine-700"
                  : "border-stone-300 dark:border-stone-600 group-hover:border-stone-400",
              ].join(" ")} />
              <div>
                <span className="text-sm text-stone-700 dark:text-stone-300">{f.label}</span>
                <p className="text-2xs text-stone-400 dark:text-stone-500 leading-tight">{f.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Upload">
        <div className="rounded-lg border border-dashed border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-4 py-6 text-center">
          {data.fileName ? (
            <div>
              <p className="text-xs font-medium text-aubergine-700 dark:text-aubergine-400">{data.fileName}</p>
              {data.fileSizeBytes && (
                <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
                  {(data.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
                </p>
              )}
              <button
                type="button"
                onClick={() => update(id, { fileName: undefined, fileSizeBytes: undefined, conversationId: undefined, status: "idle" })}
                className="text-2xs text-stone-400 dark:text-stone-500 mt-2 hover:text-red-500 transition-colors"
              >
                Remove file
              </button>
            </div>
          ) : (
            <p className="text-xs text-stone-400 dark:text-stone-500">
              File upload available on the Study intake page.
            </p>
          )}
        </div>
      </Field>

      <div className="h-px bg-stone-100 dark:bg-stone-800" />

      <Field label="Lecture title">
        <input type="text" placeholder="e.g. Lecture 4 — Gradient Descent"
          value={data.lectureTitle}
          onChange={(e) => update(id, { lectureTitle: e.target.value })}
          className={inputCls} />
      </Field>

      <Field label="Course name" hint="optional">
        <input type="text" placeholder="e.g. CS301 — Machine Learning"
          value={data.courseName}
          onChange={(e) => update(id, { courseName: e.target.value })}
          className={inputCls} />
      </Field>

      <Field label="Lecture date" hint="optional">
        <input type="date"
          value={data.lectureDate}
          onChange={(e) => update(id, { lectureDate: e.target.value })}
          className={inputCls} />
      </Field>

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
