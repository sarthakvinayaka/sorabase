"use client";

import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import type { LecCaptureMode, LecCaptureNodeData } from "@/lib/workflow-types";

interface Props { id: string; data: LecCaptureNodeData }

const MODES: { value: LecCaptureMode; label: string; hint: string }[] = [
  { value: "paste",            label: "Paste transcript",  hint: "Copy-paste text directly into this node." },
  { value: "browser_capture", label: "Browser capture",   hint: "Use the SoraBase Capture extension to record a live lecture." },
  { value: "zoom_bot",        label: "Zoom bot",          hint: "A bot joins your Zoom lecture and transcribes it automatically." },
];

export default function LecCaptureInspector({ id, data }: Props) {
  const update = useWorkflowStoreContext((s) => s.updateNodeData);

  return (
    <div className="space-y-5">

      <Field label="Capture method">
        <div className="space-y-1.5">
          {MODES.map((m) => (
            <label key={m.value} className="flex items-start gap-2.5 cursor-pointer group">
              <input type="radio" className="sr-only" name={`captureMode-${id}`} value={m.value}
                checked={data.captureMode === m.value}
                onChange={() => update(id, { captureMode: m.value })} />
              <div className={[
                "w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors",
                data.captureMode === m.value
                  ? "border-aubergine-700 bg-aubergine-700"
                  : "border-stone-300 dark:border-stone-600 group-hover:border-stone-400",
              ].join(" ")} />
              <div>
                <span className="text-sm text-stone-700 dark:text-stone-300">{m.label}</span>
                <p className="text-2xs text-stone-400 dark:text-stone-500 leading-tight">{m.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </Field>

      {data.captureMode === "paste" && (
        <Field label="Transcript" hint={`${data.transcript.length.toLocaleString()} / 80,000 chars`}>
          <textarea
            rows={10} maxLength={80000}
            placeholder={"Speaker A: Today we'll cover...\nSpeaker B: Could you explain..."}
            value={data.transcript}
            onChange={(e) => update(id, { transcript: e.target.value, charCount: e.target.value.length })}
            className="w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400 border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700 resize-none font-mono leading-relaxed"
          />
        </Field>
      )}

      {data.captureMode === "browser_capture" && (
        <Field label="Browser capture">
          <div className="rounded-lg border border-dashed border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/20 px-4 py-4 text-center">
            <p className="text-xs font-medium text-sky-700 dark:text-sky-400">Extension required</p>
            <p className="text-2xs text-sky-600 dark:text-sky-500 mt-1 leading-relaxed">
              Open the SoraBase Capture extension on your lecture tab to start recording. Transcript will appear here automatically.
            </p>
          </div>
        </Field>
      )}

      {data.captureMode === "zoom_bot" && (
        <Field label="Zoom bot">
          <div className="rounded-lg border border-dashed border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/20 px-4 py-4 text-center">
            <p className="text-xs font-medium text-sky-700 dark:text-sky-400">Bot capture</p>
            <p className="text-2xs text-sky-600 dark:text-sky-500 mt-1 leading-relaxed">
              Configure via the Source node on the Recruiting canvas, or use the intake page to send a Zoom bot to a lecture.
            </p>
          </div>
        </Field>
      )}

      <div className="h-px bg-stone-100 dark:bg-stone-800" />

      <Field label="Lecture title">
        <input type="text" placeholder="e.g. Introduction to Neural Networks"
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

const inputCls = "w-full rounded-lg border bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400 border-stone-200 dark:border-stone-700 focus:outline-none focus:ring-1 focus:ring-aubergine-700";

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
