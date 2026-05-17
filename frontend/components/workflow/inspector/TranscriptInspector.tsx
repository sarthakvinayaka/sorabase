"use client";

import type { TranscriptNodeData } from "@/lib/workflow-types";

interface Props { id: string; data: TranscriptNodeData }

export default function TranscriptInspector({ data }: Props) {
  return (
    <div className="space-y-5">

      <Field label="Status">
        <div className={[
          "rounded-lg border px-3 py-2.5",
          data.status === "completed"
            ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20"
            : "border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800",
        ].join(" ")}>
          <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
            {data.status === "completed" ? "Transcript ready" : "Waiting for source"}
          </p>
          {data.charCount !== undefined && (
            <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
              {data.charCount.toLocaleString()} characters
            </p>
          )}
        </div>
        <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1.5">
          Populated automatically when the workflow runs.
        </p>
      </Field>

      {data.preview && (
        <Field label="Preview">
          <div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2.5">
            <p className="text-[10px] font-mono text-stone-600 dark:text-stone-400 leading-relaxed whitespace-pre-wrap break-words">
              {data.preview}…
            </p>
          </div>
        </Field>
      )}

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide block mb-1.5">
        {label}
      </span>
      {children}
    </div>
  );
}
