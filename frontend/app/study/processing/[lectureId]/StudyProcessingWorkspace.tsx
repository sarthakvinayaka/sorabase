"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { extractStudyLecture, ApiError } from "@/lib/api";

type RunState = "pending" | "running" | "done" | "error";
type StepState = "waiting" | "running" | "done" | "error";

interface Props {
  conversationId: string;
  source: string;
  template: string;
  title: string;
  course: string;
  lectureDate: string;
}

const SOURCE_READY_LABELS: Record<string, string> = {
  transcript: "Transcript saved",
  audio:      "Recording uploaded",
  mixed:      "Audio + notes uploaded",
  live:       "Live capture saved",
};

export default function StudyProcessingWorkspace({
  conversationId,
  source,
  template,
  title,
  course,
  lectureDate,
}: Props) {
  const router  = useRouter();
  const ranRef  = useRef(false);

  const [runState,  setRunState]  = useState<RunState>("pending");
  const [stepIndex, setStepIndex] = useState(0);
  const [error,     setError]     = useState<string | null>(null);

  const runExtraction = useCallback(async () => {
    setRunState("running");
    setError(null);
    setStepIndex(1);

    try {
      const result = await extractStudyLecture({
        conversation_id: conversationId,
        template_slug:   template || "standard",
        title:           title       || undefined,
        course:          course      || undefined,
        lecture_date:    lectureDate || undefined,
      });

      setStepIndex(3);
      setRunState("done");
      setTimeout(() => router.push(`/study/review/${result.lecture_id}`), 800);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Extraction failed. Please try again.");
      setRunState("error");
    }
  }, [conversationId, template, title, course, lectureDate, router]);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    runExtraction();
  }, [runExtraction]);

  const sourceLabel = SOURCE_READY_LABELS[source] ?? "Source ready";

  const STEP_LABELS = [
    sourceLabel,
    runState === "error" ? "Extraction failed"          : "Analysing lecture…",
    runState === "done"  ? "Flashcards & questions done" : "Generating flashcards & questions…",
    runState === "done"  ? "Redirecting to review…"      : "Study materials ready",
  ];

  function stepState(i: number): StepState {
    if (runState === "error" && i === 1) return "error";
    if (i < stepIndex)                   return "done";
    if (i === stepIndex) {
      if (runState === "running") return "running";
      if (runState === "done")    return "done";
      return "waiting";
    }
    return "waiting";
  }

  return (
    <main className="max-w-lg mx-auto px-5 py-14 space-y-8">

      <div>
        <p className="section-label mb-1.5">Study mode</p>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          Processing lecture
        </h1>
        <p className="text-sm text-stone-400 dark:text-stone-500 mt-1.5 leading-relaxed">
          Extracting concepts, building flashcards, and writing quiz questions —
          this takes 15–45 seconds.
        </p>
      </div>

      {(title || course) && (
        <div className="flex items-center gap-2 flex-wrap">
          {title && (
            <span className="badge bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400">
              {title}
            </span>
          )}
          {course && (
            <span className="badge bg-aubergine-50 dark:bg-aubergine-950/20 border-aubergine-100 dark:border-aubergine-900 text-aubergine-800 dark:text-aubergine-300">
              {course}
            </span>
          )}
        </div>
      )}

      <div className="card p-5 space-y-4">
        {([0, 1, 2, 3] as const).map((i) => (
          <div key={i} className="flex items-start gap-3.5">
            <StepDot state={stepState(i)} />
            <p className={[
              "text-sm mt-0.5 leading-snug",
              stepState(i) === "done"    ? "text-stone-700 dark:text-stone-300"
            : stepState(i) === "running" ? "text-stone-900 dark:text-stone-100 font-medium"
            : stepState(i) === "error"   ? "text-red-600 dark:text-red-400"
            :                              "text-stone-400 dark:text-stone-500",
            ].join(" ")}>
              {STEP_LABELS[i]}
            </p>
          </div>
        ))}
      </div>

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
            Retry
          </button>
        </div>
      )}

      <Link
        href="/study"
        className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors inline-flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Study Mode
      </Link>
    </main>
  );
}

function StepDot({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <div className="w-6 h-6 rounded-full bg-aubergine-100 dark:bg-aubergine-950/40 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-3.5 h-3.5 text-aubergine-800 dark:text-aubergine-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (state === "running") {
    return (
      <div className="w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-3.5 h-3.5 animate-spin text-aubergine-800 dark:text-aubergine-400" fill="none" viewBox="0 0 24 24">
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
  return <div className="w-6 h-6 rounded-full border-2 border-stone-200 dark:border-stone-700 flex-shrink-0 mt-0.5" />;
}
