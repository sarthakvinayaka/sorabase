"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStudyLecture, ApiError } from "@/lib/api";
import type { StudyFlashcard, StudyLectureDetail, StudyQuestion } from "@/lib/types";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long", day: "numeric", year: "numeric",
  });
}

function fmtTemplate(slug: string | null) {
  const labels: Record<string, string> = {
    standard:         "General Lecture",
    exam_prep:        "Exam Prep",
    lecture_notes:    "Lecture Notes",
    technical:        "STEM / Technical",
    business_case:    "Business & Case",
    language_learning: "Language Learning",
  };
  return slug ? (labels[slug] ?? slug) : "Standard";
}

// ─── Study action card ─────────────────────────────────────────────────────────

function ActionCard({
  href,
  icon,
  label,
  sub,
  primary,
  disabled,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  const base = "group flex items-center gap-3 rounded-lg border px-4 py-3.5 transition-all text-left w-full";
  const filled = "border-aubergine-700 bg-aubergine-800 hover:bg-aubergine-900 text-white";
  const outlined = "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800/60";
  const dim = "border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 opacity-50 cursor-not-allowed";

  const cls = [base, disabled ? dim : primary ? filled : outlined].join(" ");
  const content = (
    <>
      <div className={`flex-shrink-0 ${disabled ? "text-stone-300" : primary ? "text-aubergine-200" : "text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300"}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold leading-snug ${disabled ? "text-stone-400" : primary ? "text-white" : "text-stone-800 dark:text-stone-200"}`}>
          {label}
        </p>
        <p className={`text-2xs leading-snug mt-0.5 ${disabled ? "text-stone-300" : primary ? "text-aubergine-200" : "text-stone-400 dark:text-stone-500"}`}>
          {sub}
        </p>
      </div>
      {!disabled && (
        <svg className={`ml-auto w-3.5 h-3.5 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity ${primary ? "text-aubergine-200" : "text-stone-400"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </>
  );

  if (disabled) return <div className={cls}>{content}</div>;
  return <Link href={href} className={cls}>{content}</Link>;
}

// ─── Flashcard mini-preview ────────────────────────────────────────────────────

function FlashcardPreviewCard({ card }: { card: StudyFlashcard }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((v) => !v)}
      className="group text-left w-full bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card hover:border-stone-300 dark:hover:border-stone-600 transition-colors overflow-hidden"
    >
      <div className="px-4 pt-3.5 pb-1">
        <p className={`text-2xs uppercase tracking-label mb-1.5 ${flipped ? "text-stone-400 dark:text-stone-500" : "text-aubergine-800 dark:text-aubergine-400"}`}>
          {flipped ? "Back" : "Front"}
        </p>
        <p className="text-sm text-stone-800 dark:text-stone-200 leading-snug min-h-[3rem]">
          {flipped ? card.back : card.front}
        </p>
      </div>
      <div className="px-4 py-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
        {card.concept_tag ? (
          <span className="text-2xs text-stone-400 dark:text-stone-500 truncate">{card.concept_tag}</span>
        ) : <span />}
        <span className="text-2xs text-stone-300 dark:text-stone-600 group-hover:text-stone-400 dark:group-hover:text-stone-500 transition-colors flex-shrink-0">
          {flipped ? "tap: front" : "tap: back"}
        </span>
      </div>
    </button>
  );
}

// ─── Question preview row ─────────────────────────────────────────────────────

const DIFFICULTY_BADGE: Record<string, string> = {
  easy:   "bg-positive-light border-positive-border text-positive-text",
  medium: "bg-warning-light border-warning-border text-warning-text",
  hard:   "bg-negative-light border-negative-border text-negative-text",
};

function QuestionPreviewRow({ q, index }: { q: StudyQuestion; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-100 dark:border-stone-800 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-stone-50/60 dark:hover:bg-stone-800/20 transition-colors"
      >
        <span className="text-2xs font-semibold text-stone-400 dark:text-stone-500 tabular-nums mt-0.5 w-4 flex-shrink-0">
          {index + 1}.
        </span>
        <p className="flex-1 text-sm text-stone-800 dark:text-stone-200 leading-snug">{q.question}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          {q.difficulty && (
            <span className={`badge text-2xs ${DIFFICULTY_BADGE[q.difficulty] ?? ""}`}>
              {q.difficulty}
            </span>
          )}
          <svg
            className={`w-3.5 h-3.5 text-stone-400 dark:text-stone-500 transition-transform ${open ? "" : "rotate-180"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-5 pb-3.5 pl-12">
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">{q.answer}</p>
        </div>
      )}
    </div>
  );
}

// ─── Loading / error ──────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="page space-y-6 max-w-4xl">
      <div className="h-6 w-48 bg-stone-100 dark:bg-stone-800 rounded animate-pulse" />
      <div className="h-10 w-72 bg-stone-100 dark:bg-stone-800 rounded animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-stone-100 dark:bg-stone-800 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: string | null }) {
  return (
    <div className="page max-w-4xl">
      <p className="text-sm text-stone-400 dark:text-stone-500 mb-4">
        {error ?? "Lecture not found."}
      </p>
      <Link href="/study/dashboard" className="btn-secondary text-xs py-1.5 inline-flex">
        Back to library
      </Link>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function StudyRecordView({ lectureId }: { lectureId: string }) {
  const [detail,    setDetail]    = useState<StudyLectureDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    getStudyLecture(lectureId)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.detail : "Failed to load lecture."))
      .finally(() => setLoading(false));
  }, [lectureId]);

  if (loading) return <LoadingState />;
  if (error || !detail) return <ErrorState error={error} />;

  const { lecture, extraction, flashcards, questions, formulas } = detail;

  const previewCards    = flashcards.slice(0, 6);
  const previewQuestions = questions.slice(0, 4);
  const previewConcepts = detail.key_concepts.slice(0, 6);

  const statsRow = [
    detail.topics.length > 0            ? `${detail.topics.length} topics`     : null,
    detail.key_concepts.length > 0      ? `${detail.key_concepts.length} concepts` : null,
    flashcards.length > 0               ? `${flashcards.length} flashcards`    : null,
    questions.length > 0                ? `${questions.length} questions`       : null,
    formulas.length > 0                 ? `${formulas.length} formulas`         : null,
  ].filter(Boolean);

  return (
    <div className="page space-y-6 max-w-4xl">

      {/* ── Archive confirmation banner ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-positive-light border border-positive-border rounded-lg px-4 py-3">
        <div className="w-5 h-5 rounded-full bg-positive-DEFAULT flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-positive-text">Lecture archived</p>
          <p className="text-2xs text-positive-text opacity-75 mt-0.5">
            {fmtDate(lecture.updated_at)}
            {statsRow.length > 0 && ` · ${statsRow.join(" · ")}`}
          </p>
        </div>
        <Link
          href={`/study/review/${lectureId}`}
          className="text-xs font-medium text-positive-text hover:opacity-70 transition-opacity flex-shrink-0"
        >
          Edit review →
        </Link>
      </div>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="section-label mb-1.5">Study mode · Archived lecture</p>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            {lecture.title ?? "Untitled lecture"}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-stone-400 dark:text-stone-500">
            {lecture.course && (
              <span className="badge bg-aubergine-50 dark:bg-aubergine-950/20 border-aubergine-100 dark:border-aubergine-900 text-aubergine-800 dark:text-aubergine-300">
                {lecture.course}
              </span>
            )}
            {lecture.lecture_date && (
              <span>{new Date(lecture.lecture_date).toLocaleDateString()}</span>
            )}
            <span>{fmtTemplate(lecture.template_slug)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/study/review/${lectureId}`} className="btn-secondary text-xs py-1.5">
            Edit review
          </Link>
          <Link href="/study" className="btn-primary text-xs py-1.5">
            New lecture
          </Link>
        </div>
      </div>

      {/* ── Study actions ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ActionCard
          href={`/study/flashcards/${lectureId}`}
          primary
          label="Study flashcards"
          sub={flashcards.length > 0 ? `${flashcards.length} cards` : "No cards yet"}
          disabled={flashcards.length === 0}
          icon={
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 2H8a2 2 0 00-2 2v2h12V4a2 2 0 00-2-2z" />
            </svg>
          }
        />
        <ActionCard
          href={`/study/quiz/${lectureId}`}
          primary
          label="Practice quiz"
          sub={questions.length > 0 ? `${questions.length} questions` : "No questions yet"}
          disabled={questions.length === 0}
          icon={
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <ActionCard
          href={`/study/review/${lectureId}`}
          label="Edit review"
          sub="Modify extracted content"
          icon={
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          }
        />
        <ActionCard
          href="/study"
          label="New lecture"
          sub="Upload another recording"
          icon={
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          }
        />
      </div>

      {/* ── Summary ─────────────────────────────────────────────────────────── */}
      {detail.summary && (
        <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card px-5 py-4">
          <p className="section-label mb-2.5">Summary</p>
          <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
            {detail.summary}
          </p>
        </div>
      )}

      {/* ── Topics + Learning objectives ─────────────────────────────────────── */}
      {(detail.topics.length > 0 || detail.learning_objectives.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {detail.topics.length > 0 && (
            <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card px-5 py-4">
              <p className="section-label mb-3">Topics covered</p>
              <div className="flex flex-wrap gap-1.5">
                {detail.topics.map((t, i) => (
                  <span key={i} className="badge bg-aubergine-50 dark:bg-aubergine-950/20 border-aubergine-100 dark:border-aubergine-900 text-aubergine-800 dark:text-aubergine-300 text-xs">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
          {detail.learning_objectives.length > 0 && (
            <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card px-5 py-4">
              <p className="section-label mb-3">Learning objectives</p>
              <ol className="space-y-2">
                {detail.learning_objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="text-2xs font-semibold text-aubergine-800 dark:text-aubergine-400 tabular-nums mt-0.5 w-4 flex-shrink-0">
                      {i + 1}.
                    </span>
                    <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{obj}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* ── Key concepts ─────────────────────────────────────────────────────── */}
      {previewConcepts.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Key concepts</h2>
              <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
                {detail.key_concepts.length} extracted
              </p>
            </div>
            {detail.key_concepts.length > 6 && (
              <Link
                href={`/study/review/${lectureId}`}
                className="text-xs text-aubergine-800 dark:text-aubergine-400 hover:opacity-70 transition-opacity"
              >
                View all {detail.key_concepts.length} →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-stone-100 dark:divide-stone-800">
            {previewConcepts.map((c, i) => (
              <div
                key={i}
                className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800 last:border-b-0 sm:last:border-b sm:[&:nth-last-child(-n+2)]:border-b-0"
              >
                <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 leading-snug">{c.concept}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed line-clamp-2">{c.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Flashcard preview ────────────────────────────────────────────────── */}
      {previewCards.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Flashcards</h2>
              <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">Tap a card to flip</p>
            </div>
            <Link
              href={`/study/flashcards/${lectureId}`}
              className="text-xs font-medium text-aubergine-800 dark:text-aubergine-400 hover:opacity-70 transition-opacity flex items-center gap-1"
            >
              Start full deck · {flashcards.length} cards
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {previewCards.map((card) => (
              <FlashcardPreviewCard key={card.id} card={card} />
            ))}
          </div>
          {flashcards.length > 6 && (
            <p className="text-xs text-stone-400 dark:text-stone-500 text-center pt-1">
              Showing 6 of {flashcards.length} cards ·{" "}
              <Link href={`/study/flashcards/${lectureId}`} className="text-aubergine-800 dark:text-aubergine-400 hover:opacity-70 transition-opacity">
                Start full deck →
              </Link>
            </p>
          )}
        </div>
      )}

      {/* ── Questions preview ────────────────────────────────────────────────── */}
      {previewQuestions.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Sample questions</h2>
              <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">Click to reveal answer</p>
            </div>
            {questions.length > 4 && (
              <Link
                href={`/study/review/${lectureId}`}
                className="text-xs text-aubergine-800 dark:text-aubergine-400 hover:opacity-70 transition-opacity"
              >
                All {questions.length} →
              </Link>
            )}
          </div>
          <div>
            {previewQuestions.map((q, i) => (
              <QuestionPreviewRow key={q.id} q={q} index={i} />
            ))}
          </div>
          {questions.length > 4 && (
            <div className="px-5 py-3 border-t border-stone-100 dark:border-stone-800">
              <Link
                href={`/study/quiz/${lectureId}`}
                className="text-xs font-medium text-aubergine-800 dark:text-aubergine-400 hover:opacity-70 transition-opacity flex items-center gap-1"
              >
                Practice all {questions.length} questions
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Navigation to other areas ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {lecture.course && (
          <Link
            href={`/study/courses/${encodeURIComponent(lecture.course ?? "")}`}
            className="group flex items-center gap-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800/50 px-4 py-3 transition-all"
          >
            <svg className="w-4 h-4 text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 leading-snug truncate">
                {lecture.course}
              </p>
              <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">Course dashboard</p>
            </div>
            <svg className="w-3.5 h-3.5 text-stone-400 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
        <Link
          href="/study/dashboard"
          className="group flex items-center gap-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800/50 px-4 py-3 transition-all"
        >
          <svg className="w-4 h-4 text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 leading-snug">Dashboard</p>
            <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">All lectures & courses</p>
          </div>
          <svg className="w-3.5 h-3.5 text-stone-400 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          href="/study/dashboard?tab=library"
          className="group flex items-center gap-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800/50 px-4 py-3 transition-all"
        >
          <svg className="w-4 h-4 text-stone-400 dark:text-stone-500 group-hover:text-stone-600 dark:group-hover:text-stone-300 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 leading-snug">Library</p>
            <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">Browse archived lectures</p>
          </div>
          <svg className="w-3.5 h-3.5 text-stone-400 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* ── Source info ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
        <button
          onClick={() => setShowSource((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors text-left"
        >
          <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">Source & metadata</span>
          <svg
            className={`w-4 h-4 text-stone-400 transition-transform ${showSource ? "" : "rotate-180"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        {showSource && (
          <div className="border-t border-stone-100 dark:border-stone-800 px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-2xs text-stone-400 dark:text-stone-500">Template</p>
                <p className="text-xs font-medium text-stone-700 dark:text-stone-300 mt-0.5">
                  {fmtTemplate(lecture.template_slug)}
                </p>
              </div>
              <div>
                <p className="text-2xs text-stone-400 dark:text-stone-500">Model</p>
                <p className="text-xs font-medium text-stone-700 dark:text-stone-300 mt-0.5">
                  {extraction.model_used ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-2xs text-stone-400 dark:text-stone-500">Archived</p>
                <p className="text-xs font-medium text-stone-700 dark:text-stone-300 mt-0.5">
                  {fmtDate(lecture.updated_at)}
                </p>
              </div>
              <div>
                <p className="text-2xs text-stone-400 dark:text-stone-500">Lecture ID</p>
                <p className="text-xs font-medium text-stone-700 dark:text-stone-300 mt-0.5 font-mono">
                  {lectureId.slice(0, 8)}
                </p>
              </div>
            </div>

            {detail.transcript && (
              <div>
                <p className="section-label mb-2">Source transcript</p>
                <pre className="whitespace-pre-wrap text-xs text-stone-600 dark:text-stone-400 font-mono leading-relaxed max-h-64 overflow-y-auto bg-stone-50 dark:bg-stone-800/50 rounded-md px-3 py-2.5 border border-stone-100 dark:border-stone-800">
                  {detail.transcript}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-stone-400 dark:text-stone-500 text-right tabular-nums pb-2">
        Extracted {fmtDate(extraction.created_at)} · {extraction.model_used ?? "unknown model"}
      </p>
    </div>
  );
}
