"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStudyCourse, ApiError } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { HorizontalBar } from "@/components/dashboard/HorizontalBar";
import type {
  CourseLectureItem,
  CourseRepeatedConcept,
  StudyCourseDetail,
  SuggestedReviewItem,
  StudyQuestion,
} from "@/lib/types";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtShortDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function confColor(c: number | null) {
  if (c === null) return "text-stone-300 dark:text-stone-600";
  if (c >= 0.85) return "text-positive-text";
  if (c >= 0.60) return "text-warning-text";
  return "text-negative-text";
}

const REVIEW_TYPE_ICONS: Record<string, React.ReactNode> = {
  concept: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  topic: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  question: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const REASON_COLORS: Record<string, string> = {
  "Low confidence":     "bg-negative-light border-negative-border text-negative-text",
  "Not reviewed":       "bg-warning-light border-warning-border text-warning-text",
  "Core topic":         "bg-aubergine-50 dark:bg-aubergine-950/20 border-aubergine-100 dark:border-aubergine-900 text-aubergine-800 dark:text-aubergine-300",
  "Appears frequently": "bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400",
};

function reasonBadge(reason: string) {
  const cls = REASON_COLORS[reason] ?? "bg-stone-50 border-stone-200 text-stone-500";
  return (
    <span className={`badge text-2xs ${cls} flex-shrink-0`}>{reason}</span>
  );
}

// ─── Lecture row ──────────────────────────────────────────────────────────────

function LectureRow({ lecture }: { lecture: CourseLectureItem }) {
  const isArchived = lecture.archive_status === "archived";
  return (
    <Link
      href={`/study/records/${lecture.lecture_id}`}
      className="group flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors border-b border-stone-100 dark:border-stone-800 last:border-0"
    >
      {/* Status */}
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isArchived ? "bg-positive-DEFAULT" : "bg-warning-DEFAULT"
        }`}
        title={isArchived ? "Archived" : "Needs review"}
      />

      {/* Title + date */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 dark:text-stone-200 leading-snug truncate group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-colors">
          {lecture.title ?? "Untitled lecture"}
        </p>
        {lecture.lecture_date && (
          <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
            {fmtShortDate(lecture.lecture_date)}
          </p>
        )}
      </div>

      {/* Stat badges */}
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
        {lecture.concept_count > 0 && (
          <span className="badge bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 text-2xs tabular-nums">
            {lecture.concept_count} concepts
          </span>
        )}
        {lecture.flashcard_count > 0 && (
          <span className="badge bg-aubergine-50 dark:bg-aubergine-950/20 border-aubergine-100 dark:border-aubergine-900 text-aubergine-800 dark:text-aubergine-300 text-2xs tabular-nums">
            {lecture.flashcard_count} cards
          </span>
        )}
        {lecture.question_count > 0 && (
          <span className="badge bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 text-2xs tabular-nums">
            {lecture.question_count} questions
          </span>
        )}
        {lecture.avg_confidence !== null && (
          <span className={`text-2xs tabular-nums ${confColor(lecture.avg_confidence)}`}>
            {Math.round(lecture.avg_confidence * 100)}%
          </span>
        )}
      </div>

      <svg className="w-3.5 h-3.5 text-stone-300 dark:text-stone-600 group-hover:text-stone-400 dark:group-hover:text-stone-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// ─── Topics section ───────────────────────────────────────────────────────────

function TopicsSection({ topics }: { topics: { topic: string; lecture_count: number }[] }) {
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 12;
  const displayed = showAll ? topics : topics.slice(0, LIMIT);
  const max = Math.max(...topics.map((t) => t.lecture_count), 1);

  if (topics.length === 0) {
    return (
      <p className="text-xs text-stone-400 dark:text-stone-500 italic py-3">
        No topics extracted yet.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {displayed.map((t) => {
        const pct   = (t.lecture_count / max) * 100;
        const isCore = t.lecture_count >= 2;
        return (
          <div key={t.topic} className="flex items-center gap-3">
            <span className="w-36 shrink-0 text-xs text-stone-600 dark:text-stone-400 text-right truncate leading-none">
              {t.topic}
            </span>
            <div className="flex-1 h-[5px] bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${isCore ? "bg-aubergine-700" : "bg-stone-300 dark:bg-stone-600"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 w-16 flex-shrink-0">
              <span className="text-xs text-stone-400 dark:text-stone-500 tabular-nums w-4 text-right">
                {t.lecture_count}
              </span>
              {isCore && (
                <span className="text-2xs font-medium text-aubergine-800 dark:text-aubergine-400 bg-aubergine-50 dark:bg-aubergine-950/20 border border-aubergine-100 dark:border-aubergine-900 px-1 py-0.5 rounded-xs">
                  core
                </span>
              )}
            </div>
          </div>
        );
      })}
      {topics.length > LIMIT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors mt-1"
        >
          {showAll ? "Show fewer" : `Show all ${topics.length} topics`}
        </button>
      )}
    </div>
  );
}

// ─── Repeated concepts ────────────────────────────────────────────────────────

function ConceptCard({ c }: { c: CourseRepeatedConcept }) {
  const confPct = Math.round(c.avg_confidence * 100);
  const dotCls  =
    c.avg_confidence >= 0.85 ? "bg-positive-DEFAULT"
  : c.avg_confidence >= 0.60 ? "bg-warning-DEFAULT"
  :                             "bg-negative-DEFAULT";

  return (
    <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card px-4 py-3.5 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 leading-snug">{c.concept}</p>
        <span className="badge bg-aubergine-50 dark:bg-aubergine-950/20 border-aubergine-100 dark:border-aubergine-900 text-aubergine-800 dark:text-aubergine-300 text-2xs flex-shrink-0 tabular-nums">
          ×{c.frequency} lectures
        </span>
      </div>
      <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed line-clamp-2">{c.explanation}</p>
      <div className="flex items-center gap-1.5 pt-0.5">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
        <span className="text-2xs text-stone-400 dark:text-stone-500 tabular-nums">{confPct}% confidence</span>
      </div>
    </div>
  );
}

// ─── Revision widget ──────────────────────────────────────────────────────────

function RevisionWidget({
  items,
  courseName,
}: {
  items: SuggestedReviewItem[];
  courseName: string;
}) {
  return (
    <div className="bg-aubergine-50/60 dark:bg-aubergine-950/10 border border-aubergine-100 dark:border-aubergine-900 rounded-lg p-4 space-y-3.5">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-aubergine-700 dark:text-aubergine-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <h3 className="text-xs font-semibold text-aubergine-900 dark:text-aubergine-300">
          What to study next
        </h3>
      </div>

      {items.length === 0 ? (
        <div className="flex items-start gap-2 py-1">
          <svg className="w-3.5 h-3.5 text-positive-text flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            No flagged items — course looks well-covered. Keep adding lectures to track progress.
          </p>
        </div>
      ) : (
        <ol className="space-y-2.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className="mt-0.5 text-aubergine-600 dark:text-aubergine-400 flex-shrink-0">
                {REVIEW_TYPE_ICONS[item.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-stone-800 dark:text-stone-200 leading-snug truncate">
                  {item.label}
                </p>
                <div className="mt-1">
                  {reasonBadge(item.reason)}
                </div>
              </div>
              {item.lecture_id && (
                <Link
                  href={`/study/records/${item.lecture_id}`}
                  className="text-2xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors flex-shrink-0 mt-0.5"
                >
                  →
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}

      <Link
        href={`/study/flashcards/course/${encodeURIComponent(courseName)}`}
        className="block w-full text-center text-xs font-medium text-aubergine-800 dark:text-aubergine-300 bg-white dark:bg-stone-900 border border-aubergine-200 dark:border-aubergine-800 rounded-md py-2 hover:bg-aubergine-50 dark:hover:bg-aubergine-950/20 transition-colors"
      >
        Study all flashcards →
      </Link>
    </div>
  );
}

// ─── Coverage gaps ────────────────────────────────────────────────────────────

function CoverageGaps({ gaps }: { gaps: string[] }) {
  if (gaps.length === 0) {
    return (
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-4 py-3.5">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-stone-400 dark:text-stone-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xs font-semibold text-stone-700 dark:text-stone-300">Coverage gaps</h3>
        </div>
        <p className="text-xs text-stone-400 dark:text-stone-500 italic">No gaps identified.</p>
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-4 py-3.5">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-warning-text flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <h3 className="text-xs font-semibold text-stone-700 dark:text-stone-300">Coverage gaps</h3>
      </div>
      <ul className="space-y-2">
        {gaps.map((gap, i) => (
          <li key={i} className="flex items-start gap-2">
            <div className="w-1 h-1 rounded-full bg-warning-DEFAULT flex-shrink-0 mt-1.5" />
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">{gap}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Questions section ────────────────────────────────────────────────────────

const DIFFICULTY_BADGE: Record<string, string> = {
  easy:   "bg-positive-light border-positive-border text-positive-text",
  medium: "bg-warning-light border-warning-border text-warning-text",
  hard:   "bg-negative-light border-negative-border text-negative-text",
};

function QuestionRow({ q, index }: { q: StudyQuestion; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-100 dark:border-stone-800 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-5 py-3 text-left hover:bg-stone-50/60 dark:hover:bg-stone-800/20 transition-colors"
      >
        <span className="text-2xs font-semibold text-stone-400 dark:text-stone-500 tabular-nums mt-0.5 w-5 flex-shrink-0">
          {index + 1}.
        </span>
        <p className="flex-1 text-sm text-stone-800 dark:text-stone-200 leading-snug">{q.question}</p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {q.difficulty && (
            <span className={`badge text-2xs ${DIFFICULTY_BADGE[q.difficulty] ?? ""}`}>{q.difficulty}</span>
          )}
          <svg
            className={`w-3.5 h-3.5 text-stone-400 transition-transform ${open ? "" : "rotate-180"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-5 pb-3.5 pl-13">
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed ml-8">{q.answer_exam}</p>
        </div>
      )}
    </div>
  );
}

// ─── Empty state (no lectures) ────────────────────────────────────────────────

function CourseEmptyState({ courseName }: { courseName: string }) {
  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-6 py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-aubergine-50 dark:bg-aubergine-950/20 border border-aubergine-100 dark:border-aubergine-900 flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-aubergine-700 dark:text-aubergine-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200 mb-1.5">
        Start building {courseName}
      </h2>
      <p className="text-xs text-stone-400 dark:text-stone-500 max-w-xs mx-auto leading-relaxed mb-6">
        Add your first lecture to see topic maps, concept summaries, flashcards, and revision suggestions for the course.
      </p>
      <Link
        href="/study"
        className="inline-flex items-center gap-1.5 rounded bg-aubergine-800 text-white text-xs font-medium px-4 py-2.5 hover:bg-aubergine-900 transition-colors"
      >
        Add first lecture
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="page space-y-6 max-w-5xl">
      <div className="space-y-2">
        <div className="h-4 w-32 bg-stone-100 dark:bg-stone-800 rounded animate-pulse" />
        <div className="h-8 w-64 bg-stone-100 dark:bg-stone-800 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-stone-100 dark:bg-stone-800 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-48 bg-stone-100 dark:bg-stone-800 rounded-lg animate-pulse" />
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function StudyCourseView({ courseName }: { courseName: string }) {
  const [detail,      setDetail]      = useState<StudyCourseDetail | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [showQuestions, setShowQuestions] = useState(false);

  useEffect(() => {
    getStudyCourse(courseName)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.detail : "Failed to load course."))
      .finally(() => setLoading(false));
  }, [courseName]);

  if (loading) return <LoadingSkeleton />;

  if (error || !detail) {
    return (
      <div className="page max-w-5xl">
        <p className="section-label mb-1">Study mode · Course</p>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100 mb-4">
          {courseName}
        </h1>
        <div className="rounded-lg border border-negative-border bg-negative-light px-4 py-3 text-sm text-negative-text mb-4">
          {error ?? "Could not load course data."}
        </div>
        <Link href="/study/dashboard" className="btn-secondary text-xs py-1.5 inline-flex">
          ← Study dashboard
        </Link>
      </div>
    );
  }

  const {
    lectures, topic_frequencies, repeated_concepts,
    coverage_gaps, suggested_review, sample_questions,
  } = detail;

  const hasLectures  = lectures.length > 0;
  const coreTopics   = topic_frequencies.filter((t) => t.lecture_count >= 2);
  const foundational = repeated_concepts.filter((c) => c.frequency >= 2).slice(0, 8);
  const avgConfPct   = detail.avg_confidence !== null
    ? `${Math.round(detail.avg_confidence * 100)}%`
    : "—";

  return (
    <div className="page space-y-6 max-w-5xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/study/dashboard"
            className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 mb-1.5 inline-flex items-center gap-1 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Study dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            {courseName}
          </h1>
          {detail.last_updated && (
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
              Last updated {fmtDate(detail.last_updated)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/study" className="btn-secondary text-xs py-1.5">
            Add lecture
          </Link>
          <Link
            href={`/study/flashcards/course/${encodeURIComponent(courseName)}`}
            className="btn-primary text-xs py-1.5"
          >
            Study all flashcards
          </Link>
        </div>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Lectures"
          value={detail.lecture_count}
          accent={detail.lecture_count > 0}
        />
        <StatCard
          label="Flashcards"
          value={detail.total_flashcards}
          sub="across all lectures"
        />
        <StatCard
          label="Questions"
          value={detail.total_questions}
          sub="generated"
        />
        <StatCard
          label="Avg confidence"
          value={avgConfPct}
          sub={detail.lecture_count > 0 ? "extraction quality" : "no data yet"}
        />
      </div>

      {/* ── Empty course ────────────────────────────────────────────────────── */}
      {!hasLectures && <CourseEmptyState courseName={courseName} />}

      {/* ── Two-column body ─────────────────────────────────────────────────── */}
      {hasLectures && (
        <div className="flex flex-col lg:flex-row gap-5">

          {/* ── Main column ─────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Lectures */}
            <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Lectures
                  </h2>
                  <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
                    {lectures.length} in {courseName}
                    {coreTopics.length > 0 && ` · ${coreTopics.length} core topics`}
                  </p>
                </div>
                <Link
                  href="/study"
                  className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </Link>
              </div>
              <div>
                {lectures.map((lec) => (
                  <LectureRow key={lec.lecture_id} lecture={lec} />
                ))}
              </div>
            </div>

            {/* Topic coverage */}
            {topic_frequencies.length > 0 && (
              <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card px-5 py-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Topics covered
                    </h2>
                    <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
                      {topic_frequencies.length} topics
                      {coreTopics.length > 0 && ` · ${coreTopics.length} appear in multiple lectures`}
                    </p>
                  </div>
                  {coreTopics.length > 0 && (
                    <div className="flex items-center gap-2 text-2xs text-stone-400 dark:text-stone-500">
                      <span className="inline-block w-2 h-1.5 rounded-sm bg-aubergine-700 opacity-80" />
                      core
                      <span className="inline-block w-2 h-1.5 rounded-sm bg-stone-300 dark:bg-stone-600" />
                      single
                    </div>
                  )}
                </div>
                <TopicsSection topics={topic_frequencies} />
              </div>
            )}

            {/* Foundational concepts */}
            {foundational.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Foundational concepts
                    </h2>
                    <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
                      Appear across multiple lectures
                    </p>
                  </div>
                  {repeated_concepts.length > 8 && (
                    <Link
                      href={`/study/review/course/${encodeURIComponent(courseName)}`}
                      className="text-xs text-aubergine-800 dark:text-aubergine-400 hover:opacity-70 transition-opacity"
                    >
                      All {repeated_concepts.length} →
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {foundational.map((c, i) => (
                    <ConceptCard key={i} c={c} />
                  ))}
                </div>
              </div>
            )}

            {/* Topic coverage — when lectures exist but no topics yet */}
            {topic_frequencies.length === 0 && lectures.length > 0 && (
              <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card px-5 py-8 text-center">
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-1">No topics extracted yet</p>
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  Topics appear after lectures are processed and archived.
                </p>
              </div>
            )}
          </div>

          {/* ── Sidebar ─────────────────────────────────────────────────────── */}
          <div className="lg:w-72 flex-shrink-0 space-y-4">
            <RevisionWidget items={suggested_review} courseName={courseName} />
            <CoverageGaps gaps={coverage_gaps} />

            {/* Quick navigation */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-4 py-3.5 space-y-2">
              <h3 className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2.5">
                Quick links
              </h3>
              {[
                { href: "/study/dashboard",           label: "Study dashboard" },
                { href: "/study/dashboard?tab=library", label: "Library" },
                { href: "/study",                     label: "New lecture" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 transition-colors group py-0.5"
                >
                  {label}
                  <svg className="w-3 h-3 text-stone-300 dark:text-stone-600 group-hover:text-stone-400 dark:group-hover:text-stone-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── All questions (collapsible, full width) ──────────────────────────── */}
      {hasLectures && sample_questions.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
          <button
            onClick={() => setShowQuestions((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors text-left"
          >
            <div>
              <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Course questions
              </span>
              <span className="ml-2 text-xs font-normal text-stone-400 dark:text-stone-500 tabular-nums">
                {sample_questions.length} total
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-stone-400 dark:text-stone-500 transition-transform ${showQuestions ? "" : "rotate-180"}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          {showQuestions && (
            <div className="border-t border-stone-100 dark:border-stone-800">
              {sample_questions.map((q, i) => (
                <QuestionRow key={q.id} q={q} index={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {hasLectures && (
        <p className="text-xs text-stone-400 dark:text-stone-500 text-right tabular-nums pb-2">
          {lectures.length} lecture{lectures.length !== 1 ? "s" : ""} ·{" "}
          {detail.total_concepts} concept{detail.total_concepts !== 1 ? "s" : ""} ·{" "}
          {detail.total_flashcards} flashcard{detail.total_flashcards !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
