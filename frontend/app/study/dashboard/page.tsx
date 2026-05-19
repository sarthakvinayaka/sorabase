"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listStudyLectures, ApiError } from "@/lib/api";
import type { StudyLecture } from "@/lib/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtTemplate(slug: string | null) {
  const labels: Record<string, string> = {
    standard:          "General Lecture",
    exam_prep:         "Exam Prep",
    lecture_notes:     "Lecture Notes",
    technical:         "STEM / Technical",
    business_case:     "Business & Case",
    language_learning: "Language Learning",
  };
  return slug ? (labels[slug] ?? slug) : "Standard";
}

export default function StudyDashboard() {
  const [lectures, setLectures] = useState<StudyLecture[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    listStudyLectures()
      .then(setLectures)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load lectures.");
      })
      .finally(() => setLoading(false));
  }, []);

  const active   = lectures.filter((l) => l.archive_status !== "archived");
  const archived = lectures.filter((l) => l.archive_status === "archived");

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display italic text-2xl text-stone-900 dark:text-stone-100">
            Study Library
          </h1>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
            Your processed lectures, notes, and flashcard sets
          </p>
        </div>
        <Link
          href="/study"
          className="rounded bg-aubergine-800 text-white text-xs font-medium px-3.5 py-2 hover:bg-aubergine-900 transition-colors"
        >
          + New lecture
        </Link>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <svg className="w-5 h-5 animate-spin text-aubergine-700" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-5 py-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : active.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {active.map((lec) => (
            <LectureRow key={lec.id} lecture={lec} />
          ))}
          {archived.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-[0.08em] pt-4 pb-1">
                Archived
              </p>
              {archived.map((lec) => (
                <LectureRow key={lec.id} lecture={lec} dim />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LectureRow({ lecture, dim }: { lecture: StudyLecture; dim?: boolean }) {
  return (
    <Link
      href={`/study/records/${lecture.id}`}
      className={[
        "flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors group",
        dim
          ? "border-stone-100 dark:border-stone-800/60 bg-stone-50 dark:bg-stone-900/30 hover:border-stone-200 dark:hover:border-stone-700"
          : "border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-700",
      ].join(" ")}
    >
      <div className="min-w-0">
        <p className={[
          "text-sm font-medium truncate",
          dim ? "text-stone-500 dark:text-stone-400" : "text-stone-900 dark:text-stone-100",
        ].join(" ")}>
          {lecture.title ?? "Untitled lecture"}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {lecture.course && (
            <>
              <span className="text-[11px] text-stone-400 dark:text-stone-500 truncate max-w-[120px]">
                {lecture.course}
              </span>
              <span className="text-stone-300 dark:text-stone-600 text-[11px]">·</span>
            </>
          )}
          <span className="text-[11px] text-stone-400 dark:text-stone-500">
            {fmtTemplate(lecture.template_slug)}
          </span>
          <span className="text-stone-300 dark:text-stone-600 text-[11px]">·</span>
          <span className="text-[11px] text-stone-400 dark:text-stone-500">
            {fmtDate(lecture.created_at)}
          </span>
        </div>
      </div>
      <svg
        className="w-4 h-4 text-stone-300 dark:text-stone-600 group-hover:text-stone-400 dark:group-hover:text-stone-500 flex-shrink-0 transition-colors"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center text-center py-20 gap-4">
      <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center">
        <svg className="w-5 h-5 text-stone-400 dark:text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300">No lectures yet</p>
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 max-w-xs">
          Paste a transcript or upload a recording to generate notes, flashcards, and practice questions.
        </p>
      </div>
      <Link
        href="/study"
        className="mt-2 rounded bg-aubergine-800 text-white text-xs font-medium px-4 py-2 hover:bg-aubergine-900 transition-colors"
      >
        Process your first lecture →
      </Link>
    </div>
  );
}
