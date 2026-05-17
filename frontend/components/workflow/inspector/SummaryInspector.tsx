"use client";

import Link from "next/link";
import type { SummaryNodeData } from "@/lib/workflow-types";

interface Props { id: string; data: SummaryNodeData }

export default function SummaryInspector({ data }: Props) {
  return (
    <div className="space-y-5">

      <Field label="Status">
        <div className={[
          "rounded-lg border px-3 py-2.5",
          data.status === "completed"
            ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
            : "border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800",
        ].join(" ")}>
          <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
            {data.status === "completed" ? "Summary ready" : "Populated after extraction"}
          </p>
        </div>
        <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1.5">
          AI summary generated as part of the extraction run.
        </p>
      </Field>

      {data.text && (
        <Field label="Summary">
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5">
            <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
              {data.text}
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
