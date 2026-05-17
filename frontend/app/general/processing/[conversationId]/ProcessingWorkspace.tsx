"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { extractGeneralConversation, ApiError } from "@/lib/api";
import type { ProposedColumn, StoredSchema } from "@/lib/types";

type RunState = "pending" | "running" | "done" | "error";
type StepState = "waiting" | "running" | "done" | "error";

interface Step {
  label: string;
  state: StepState;
}

interface Props {
  conversationId: string;
  source: string;
}

const SOURCE_READY_LABEL: Record<string, string> = {
  transcript: "Transcript saved",
  file:       "Audio uploaded",
  meeting:    "Meeting transcript ready",
};

export default function ProcessingWorkspace({ conversationId, source }: Props) {
  const router = useRouter();
  const ranRef = useRef(false);

  const [runState, setRunState] = useState<RunState>("pending");
  const [error,    setError]    = useState<string | null>(null);

  const runExtraction = useCallback(async () => {
    setRunState("running");
    setError(null);
    try {
      const raw = localStorage.getItem(`pilot-schema-${conversationId}`);
      const parsed = raw ? JSON.parse(raw) : null;

      // Support both old format (ProposedColumn[]) and new StoredSchema format
      let columns: ProposedColumn[];
      let templateId: string | undefined;
      let templateVersion: number | undefined;
      if (Array.isArray(parsed)) {
        columns = parsed as ProposedColumn[];
      } else if (parsed && Array.isArray((parsed as StoredSchema).columns)) {
        const stored = parsed as StoredSchema;
        columns         = stored.columns;
        templateId      = stored.templateId;
        templateVersion = stored.templateVersion;
      } else {
        columns = [];
      }

      if (columns.length === 0) {
        setError("No approved schema found. Please go back and complete the schema review step.");
        setRunState("error");
        return;
      }
      const result = await extractGeneralConversation(conversationId, columns, {
        templateId,
        templateVersion,
      });
      setRunState("done");
      setTimeout(() => router.push(`/general/results/${result.candidate_id}`), 600);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Extraction failed. Please try again.");
      setRunState("error");
    }
  }, [conversationId, router]);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    runExtraction();
  }, [runExtraction]);

  const sourceLabel = SOURCE_READY_LABEL[source] ?? "Source ready";

  const steps: Step[] = [
    {
      label: sourceLabel,
      state: "done",
    },
    {
      label: runState === "error" ? "Extraction failed"
           : runState === "done"  ? "Extraction complete"
           :                        "Extracting data…",
      state: runState === "error"   ? "error"
           : runState === "done"    ? "done"
           : runState === "running" ? "running"
           :                          "waiting",
    },
    {
      label: runState === "done" ? "Redirecting to results…" : "Results ready",
      state: runState === "done" ? "running" : "waiting",
    },
  ];

  return (
    <main className="max-w-lg mx-auto px-5 py-14 space-y-8">

      {/* Header */}
      <div>
        <p className="section-label mb-1.5">General mode</p>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          Processing
        </h1>
        <p className="text-sm text-stone-400 dark:text-stone-500 mt-1.5 leading-relaxed">
          Running AI extraction against your approved schema — this takes 10–30 seconds.
        </p>
      </div>

      {/* Stepper */}
      <div className="card p-5 space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3.5">
            <StepDot state={step.state} />
            <p className={[
              "text-sm mt-0.5 leading-snug",
              step.state === "done"    ? "text-stone-700 dark:text-stone-300" :
              step.state === "running" ? "text-stone-900 dark:text-stone-100 font-medium" :
              step.state === "error"   ? "text-red-600 dark:text-red-400" :
                                         "text-stone-400 dark:text-stone-500",
            ].join(" ")}>
              {step.label}
            </p>
          </div>
        ))}
      </div>

      {/* Error banner + retry */}
      {runState === "error" && error && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-4 py-3">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          </div>
          <button
            type="button"
            onClick={runExtraction}
            className="btn-primary w-full justify-center py-3 text-sm"
          >
            Retry extraction
          </button>
        </div>
      )}

      {/* Back link */}
      <Link
        href="/general"
        className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors inline-flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to General Mode
      </Link>
    </main>
  );
}

// ─── Step indicator dot ────────────────────────────────────────────────────────

function StepDot({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (state === "running") {
    return (
      <div className="w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-3.5 h-3.5 animate-spin text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-3.5 h-3.5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }
  // waiting
  return (
    <div className="w-6 h-6 rounded-full border-2 border-stone-200 dark:border-stone-700 flex-shrink-0 mt-0.5" />
  );
}
