"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getStudyLecture,
  updateStudyOverview,
  updateStudyFlashcard,
  updateStudyQuestion,
  archiveStudyLecture,
  ApiError,
} from "@/lib/api";
import type {
  StudyLectureDetail,
  StudyFlashcard,
  StudyQuestion,
  StudyArchiveStatus,
  MCQOption,
  QuestionDifficulty,
} from "@/lib/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "concepts" | "formulas" | "flashcards" | "questions";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function confidenceDot(confidence: number) {
  const cls =
    confidence >= 0.85 ? "bg-positive-DEFAULT"
  : confidence >= 0.60 ? "bg-warning-DEFAULT"
  :                      "bg-negative-DEFAULT";
  return (
    <div
      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cls}`}
      title={`${Math.round(confidence * 100)}% confidence`}
    />
  );
}

function EvidencePill({ snippet }: { snippet: string | null }) {
  const [open, setOpen] = useState(false);
  if (!snippet) return null;
  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-2xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 inline-flex items-center gap-1 transition-colors"
      >
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={open ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
        </svg>
        From transcript
      </button>
      {open && (
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50 rounded px-2 py-1.5 border border-stone-100 dark:border-stone-800 italic leading-relaxed">
          "{snippet}"
        </p>
      )}
    </div>
  );
}

const ARCHIVE_CONFIG: Record<StudyArchiveStatus, { label: string; dot: string; text: string }> = {
  needs_review: { label: "Needs review", dot: "bg-warning-DEFAULT",  text: "text-warning-text"  },
  archived:     { label: "Archived",     dot: "bg-positive-DEFAULT", text: "text-positive-text" },
  discarded:    { label: "Discarded",    dot: "bg-negative-DEFAULT", text: "text-negative-text" },
};

const DIFFICULTY_STYLES: Record<string, string> = {
  easy:   "bg-positive-light border-positive-border text-positive-text",
  medium: "bg-warning-light border-warning-border text-warning-text",
  hard:   "bg-negative-light border-negative-border text-negative-text",
};

// ─── Main component ────────────────────────────────────────────────────────────

export default function StudyReviewWorkspace({ lectureId }: { lectureId: string }) {
  const router = useRouter();

  const [detail,       setDetail]       = useState<StudyLectureDetail | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<Tab>("overview");
  const [archiveState, setArchiveState] = useState<"idle" | "archiving" | "error">("idle");
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [showSource,   setShowSource]   = useState(false);

  useEffect(() => {
    getStudyLecture(lectureId)
      .then((d) => {
        setDetail(d);
        if (d.lecture.archive_status === "archived") setActiveTab("overview");
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.detail : "Failed to load lecture."))
      .finally(() => setLoading(false));
  }, [lectureId]);

  async function handleArchive() {
    setArchiveState("archiving");
    setArchiveError(null);
    try {
      await archiveStudyLecture(lectureId);
      router.push(`/study/records/${lectureId}`);
    } catch (err) {
      setArchiveError(err instanceof ApiError ? err.detail : "Archive failed.");
      setArchiveState("error");
    }
  }

  if (loading) return <LoadingScreen />;
  if (loadError || !detail) return <ErrorScreen error={loadError} lectureId={lectureId} />;

  const { lecture, extraction, flashcards, questions, formulas } = detail;
  const archiveCfg = ARCHIVE_CONFIG[lecture.archive_status];
  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "overview",   label: "Overview" },
    { id: "concepts",   label: "Concepts",   count: detail.key_concepts.length + detail.definitions.length },
    ...(formulas.length > 0 ? [{ id: "formulas" as Tab, label: "Formulas", count: formulas.length }] : []),
    { id: "flashcards", label: "Flashcards", count: flashcards.length },
    { id: "questions",  label: "Questions",  count: questions.length },
  ];

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-700">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/study"
              className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 mb-1 inline-flex items-center gap-1 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Study mode
            </Link>
            <h1 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100 leading-snug truncate">
              {lecture.title ?? "Untitled lecture"}
            </h1>
            {(lecture.course || lecture.lecture_date) && (
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                {[lecture.course, lecture.lecture_date ? new Date(lecture.lecture_date).toLocaleDateString() : null]
                  .filter(Boolean)
                  .join(" · ")}
                {extraction.model_used && (
                  <span className="ml-2 opacity-60">· {extraction.model_used}</span>
                )}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${archiveCfg.dot}`} />
              <span className={`text-xs font-medium ${archiveCfg.text}`}>{archiveCfg.label}</span>
            </div>

            {lecture.archive_status === "needs_review" && (
              <button
                onClick={handleArchive}
                disabled={archiveState === "archiving"}
                className="btn-primary text-xs py-1.5 flex items-center gap-1.5"
              >
                {archiveState === "archiving" ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Archiving…
                  </>
                ) : (
                  <>
                    Archive lecture
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            )}

            {lecture.archive_status === "archived" && (
              <Link
                href={`/study/records/${lectureId}`}
                className="btn-secondary text-xs py-1.5"
              >
                View in library
              </Link>
            )}
          </div>
        </div>

        {archiveError && (
          <div className="max-w-5xl mx-auto px-5 pb-3">
            <p className="text-xs text-negative-text bg-negative-light border border-negative-border rounded px-3 py-2">
              {archiveError}
            </p>
          </div>
        )}

        {/* ── Tab bar ───────────────────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-5 flex items-center gap-0.5 border-t border-stone-100 dark:border-stone-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "px-3.5 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-aubergine-800 dark:border-aubergine-400 text-stone-900 dark:text-stone-100"
                  : "border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300",
              ].join(" ")}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 text-2xs font-normal text-stone-400 dark:text-stone-500 tabular-nums">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-5 py-6">
        {activeTab === "overview" && (
          <OverviewTab detail={detail} lectureId={lectureId} onUpdate={(d) => setDetail(d)} />
        )}
        {activeTab === "concepts" && (
          <ConceptsTab detail={detail} />
        )}
        {activeTab === "formulas" && (
          <FormulasTab detail={detail} />
        )}
        {activeTab === "flashcards" && (
          <FlashcardsTab detail={detail} lectureId={lectureId} onUpdate={(d) => setDetail(d)} />
        )}
        {activeTab === "questions" && (
          <QuestionsTab detail={detail} lectureId={lectureId} onUpdate={(d) => setDetail(d)} />
        )}
      </main>

      {/* ── Source transcript (collapsible footer) ──────────────────────────── */}
      {detail.transcript && (
        <div className="border-t border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 max-w-5xl mx-auto w-full px-5">
          <button
            onClick={() => setShowSource((v) => !v)}
            className="w-full flex items-center justify-between py-3.5 text-left hover:bg-stone-50 dark:hover:bg-stone-800/30 -mx-5 px-5 transition-colors"
          >
            <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Source transcript
              <span className="ml-2 text-xs font-normal text-stone-400 dark:text-stone-500 tabular-nums">
                {(detail.transcript.length).toLocaleString()} chars
              </span>
            </span>
            <ChevronIcon open={showSource} />
          </button>
          {showSource && (
            <pre className="whitespace-pre-wrap text-xs text-stone-600 dark:text-stone-400 font-mono leading-relaxed max-h-80 overflow-y-auto pb-5">
              {detail.transcript}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  detail,
  lectureId,
  onUpdate,
}: {
  detail: StudyLectureDetail;
  lectureId: string;
  onUpdate: (d: StudyLectureDetail) => void;
}) {
  const [summaryDraft,    setSummaryDraft]    = useState(detail.summary ?? "");
  const [editingSummary,  setEditingSummary]  = useState(false);
  const [savingState,     setSavingState]     = useState<"idle" | "saving" | "error">("idle");
  const [saveError,       setSaveError]       = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSummaryDraft(detail.summary ?? "");
  }, [detail.summary]);

  async function handleSummarySave() {
    if (summaryDraft === detail.summary) { setEditingSummary(false); return; }
    setSavingState("saving");
    try {
      await updateStudyOverview(lectureId, { summary: summaryDraft });
      onUpdate({ ...detail, summary: summaryDraft });
      setEditingSummary(false);
      setSavingState("idle");
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.detail : "Save failed.");
      setSavingState("error");
    }
  }

  return (
    <div className="space-y-5">

      {/* Summary */}
      <section className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Summary</h2>
          {!editingSummary && (
            <button
              onClick={() => { setEditingSummary(true); setTimeout(() => textareaRef.current?.focus(), 50); }}
              className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
        <div className="px-5 py-4">
          {editingSummary ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={summaryDraft}
                onChange={(e) => setSummaryDraft(e.target.value)}
                onBlur={handleSummarySave}
                rows={6}
                className="w-full text-sm text-stone-700 dark:text-stone-300 leading-relaxed bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-aubergine-800/30"
                placeholder="Lecture summary…"
              />
              {savingState === "error" && (
                <p className="text-xs text-negative-text">{saveError}</p>
              )}
              <div className="flex items-center gap-2">
                <button onClick={handleSummarySave} disabled={savingState === "saving"} className="btn-primary text-xs py-1">
                  {savingState === "saving" ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => { setSummaryDraft(detail.summary ?? ""); setEditingSummary(false); }}
                  className="btn-secondary text-xs py-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : detail.summary ? (
            <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
              {detail.summary}
            </p>
          ) : (
            <p className="text-sm text-stone-400 dark:text-stone-500 italic">No summary extracted.</p>
          )}
        </div>
      </section>

      {/* Topics */}
      {detail.topics.length > 0 && (
        <section className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Topics covered</h2>
          </div>
          <div className="px-5 py-4 flex flex-wrap gap-2">
            {detail.topics.map((topic, i) => (
              <span
                key={i}
                className="badge bg-aubergine-50 dark:bg-aubergine-950/20 border-aubergine-100 dark:border-aubergine-900 text-aubergine-800 dark:text-aubergine-300"
              >
                {topic}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Learning objectives */}
      {detail.learning_objectives.length > 0 && (
        <section className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Learning objectives</h2>
          </div>
          <ol className="px-5 py-4 space-y-2.5">
            {detail.learning_objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-2xs font-semibold text-aubergine-800 dark:text-aubergine-400 tabular-nums mt-0.5 w-4 flex-shrink-0">
                  {i + 1}.
                </span>
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-snug">{obj}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

// ─── Concepts tab ──────────────────────────────────────────────────────────────

function ConceptsTab({ detail }: { detail: StudyLectureDetail }) {
  return (
    <div className="space-y-5">

      {/* Key concepts */}
      {detail.key_concepts.length > 0 && (
        <section className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Key concepts</h2>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{detail.key_concepts.length} extracted</p>
            </div>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {detail.key_concepts.map((c, i) => (
              <div key={i} className="px-5 py-3.5">
                <div className="flex items-start gap-2">
                  {confidenceDot(c.confidence)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{c.concept}</p>
                    <p className="text-sm text-stone-600 dark:text-stone-400 mt-0.5 leading-relaxed">{c.explanation}</p>
                    <EvidencePill snippet={c.evidence_snippet} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Definitions */}
      {detail.definitions.length > 0 && (
        <section className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Definitions</h2>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{detail.definitions.length} terms</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50 dark:bg-stone-800/60 border-b border-stone-100 dark:border-stone-800">
                  <th className="py-2.5 pl-5 pr-4 section-label w-48">Term</th>
                  <th className="py-2.5 pr-5 section-label">Definition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {detail.definitions.map((d, i) => (
                  <tr key={i} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/20 transition-colors">
                    <td className="py-3 pl-5 pr-4 align-top">
                      <div className="flex items-start gap-2">
                        {confidenceDot(d.confidence)}
                        <span className="text-sm font-medium text-stone-900 dark:text-stone-100">{d.term}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-5 align-top">
                      <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">{d.definition}</p>
                      <EvidencePill snippet={d.evidence_snippet} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {detail.key_concepts.length === 0 && detail.definitions.length === 0 && (
        <p className="text-sm text-stone-400 dark:text-stone-500 italic py-8 text-center">
          No concepts or definitions extracted.
        </p>
      )}
    </div>
  );
}

// ─── Formulas tab ─────────────────────────────────────────────────────────────

function FormulasTab({ detail }: { detail: StudyLectureDetail }) {
  if (detail.formulas.length === 0) {
    return (
      <p className="text-sm text-stone-400 dark:text-stone-500 italic py-8 text-center">
        No formulas extracted.
      </p>
    );
  }
  return (
    <section className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800">
        <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Formulas</h2>
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{detail.formulas.length} extracted</p>
      </div>
      <div className="divide-y divide-stone-100 dark:divide-stone-800">
        {detail.formulas.map((f, i) => (
          <div key={i} className="px-5 py-4">
            <div className="flex items-start gap-2">
              {confidenceDot(f.confidence)}
              <div className="min-w-0 flex-1">
                <code className="text-sm font-mono text-aubergine-900 dark:text-aubergine-300 bg-aubergine-50 dark:bg-aubergine-950/20 px-2 py-0.5 rounded">
                  {f.notation}
                </code>
                <p className="text-sm text-stone-700 dark:text-stone-300 mt-1.5 leading-relaxed">{f.description}</p>
                {f.example && (
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 italic">
                    Example: {f.example}
                  </p>
                )}
                <EvidencePill snippet={f.evidence_snippet} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Flashcards tab ───────────────────────────────────────────────────────────

function FlashcardsTab({
  detail,
  lectureId,
  onUpdate,
}: {
  detail: StudyLectureDetail;
  lectureId: string;
  onUpdate: (d: StudyLectureDetail) => void;
}) {
  const [flipped,  setFlipped]  = useState<Set<string>>(new Set());
  const [editing,  setEditing]  = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack,  setEditBack]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState<string | null>(null);

  function startEdit(card: StudyFlashcard) {
    setEditing(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
    setSaveErr(null);
  }

  async function saveEdit(cardId: string) {
    setSaving(true);
    try {
      const updated = await updateStudyFlashcard(lectureId, cardId, {
        front: editFront,
        back:  editBack,
      });
      onUpdate({
        ...detail,
        flashcards: detail.flashcards.map((c) => (c.id === cardId ? updated : c)),
      });
      setEditing(null);
    } catch (err) {
      setSaveErr(err instanceof ApiError ? err.detail : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (detail.flashcards.length === 0) {
    return (
      <p className="text-sm text-stone-400 dark:text-stone-500 italic py-8 text-center">
        No flashcards generated.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-400 dark:text-stone-500">
        {detail.flashcards.length} cards · Click a card to flip · Edit to modify front/back
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {detail.flashcards.map((card) => {
          const isFlipped  = flipped.has(card.id);
          const isEditing  = editing === card.id;

          return (
            <div
              key={card.id}
              className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden"
            >
              {isEditing ? (
                <div className="p-4 space-y-3">
                  <div>
                    <label className="section-label block mb-1">Front</label>
                    <textarea
                      value={editFront}
                      onChange={(e) => setEditFront(e.target.value)}
                      rows={2}
                      className="w-full text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-aubergine-800/30 text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="section-label block mb-1">Back</label>
                    <textarea
                      value={editBack}
                      onChange={(e) => setEditBack(e.target.value)}
                      rows={3}
                      className="w-full text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-aubergine-800/30 text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  {saveErr && <p className="text-xs text-negative-text">{saveErr}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(card.id)}
                      disabled={saving}
                      className="btn-primary text-xs py-1 flex-1 justify-center"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditing(null); setSaveErr(null); }}
                      className="btn-secondary text-xs py-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="p-4 min-h-[100px] cursor-pointer hover:bg-stone-50/60 dark:hover:bg-stone-800/30 transition-colors flex items-center"
                    onClick={() => setFlipped((s) => {
                      const n = new Set(s);
                      n.has(card.id) ? n.delete(card.id) : n.add(card.id);
                      return n;
                    })}
                  >
                    <div>
                      {!isFlipped && (
                        <p className="text-xs uppercase tracking-label text-aubergine-800 dark:text-aubergine-400 mb-1.5">Front</p>
                      )}
                      {isFlipped && (
                        <p className="text-xs uppercase tracking-label text-stone-400 dark:text-stone-500 mb-1.5">Back</p>
                      )}
                      <p className="text-sm text-stone-800 dark:text-stone-200 leading-relaxed">
                        {isFlipped ? card.back : card.front}
                      </p>
                      {isFlipped && card.evidence_snippet && (
                        <p className="text-2xs text-stone-400 dark:text-stone-500 italic mt-2 leading-relaxed">
                          "{card.evidence_snippet}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-4 py-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {confidenceDot(card.confidence)}
                      {card.concept_tag && (
                        <span className="text-2xs text-stone-400 dark:text-stone-500">{card.concept_tag}</span>
                      )}
                      {card.edited && (
                        <span className="text-2xs text-aubergine-800 dark:text-aubergine-400">· edited</span>
                      )}
                    </div>
                    <button
                      onClick={() => startEdit(card)}
                      className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Questions tab ────────────────────────────────────────────────────────────

type AnswerLength = "short" | "exam" | "detailed";

function resolveAnswer(q: StudyQuestion, length: AnswerLength): string {
  if (length === "short")    return q.answer_short    ?? q.answer_exam;
  if (length === "detailed") return q.answer_detailed ?? q.answer_exam;
  return q.answer_exam;
}

const QTYPE_LABELS: Record<string, string> = {
  important:           "Important",
  exam:                "Exam",
  short_answer:        "Short answer",
  multiple_choice:     "MCQ",
  concept_explanation: "Concept",
  compare_contrast:    "Compare",
  applied_scenario:    "Applied",
};

function McqDisplay({ options }: { options: MCQOption[] }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((opt) => {
          const showCorrect = revealed && opt.is_correct;
          const showWrong   = revealed && !opt.is_correct;
          return (
            <button
              key={opt.label}
              onClick={() => setRevealed(true)}
              className={[
                "text-left px-3 py-2 rounded border text-sm transition-colors",
                showCorrect
                  ? "bg-positive-light border-positive-border text-positive-text"
                  : showWrong
                  ? "bg-stone-50 border-stone-200 text-stone-400 dark:bg-stone-800/30 dark:border-stone-700 dark:text-stone-500 line-through"
                  : "bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-aubergine-800/40",
              ].join(" ")}
            >
              <span className="font-semibold mr-1.5">{opt.label}.</span>
              {opt.text}
            </button>
          );
        })}
      </div>
      {!revealed && (
        <p className="text-2xs text-stone-400 dark:text-stone-500">Click any option to reveal answer</p>
      )}
      {revealed && (
        <button
          onClick={() => setRevealed(false)}
          className="text-2xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}

function McqEditForm({
  options,
  onChange,
}: {
  options: MCQOption[];
  onChange: (opts: MCQOption[]) => void;
}) {
  function updateText(label: string, text: string) {
    onChange(options.map((o) => o.label === label ? { ...o, text } : o));
  }
  function setCorrect(label: string) {
    onChange(options.map((o) => ({ ...o, is_correct: o.label === label })));
  }
  return (
    <div className="space-y-2">
      <label className="section-label block mb-1">Options</label>
      {options.map((opt) => (
        <div key={opt.label} className="flex items-start gap-2">
          <div className="flex items-center gap-1.5 pt-2 flex-shrink-0">
            <input
              type="radio"
              name="mcq-correct"
              checked={opt.is_correct}
              onChange={() => setCorrect(opt.label)}
              className="accent-aubergine-800"
              title="Mark as correct"
            />
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 w-4">{opt.label}.</span>
          </div>
          <textarea
            value={opt.text}
            onChange={(e) => updateText(opt.label, e.target.value)}
            rows={2}
            className="flex-1 text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-aubergine-800/30 text-stone-900 dark:text-stone-100"
          />
        </div>
      ))}
      <p className="text-2xs text-stone-400 dark:text-stone-500">Select the radio button next to the correct option</p>
    </div>
  );
}

function QuestionsTab({
  detail,
  lectureId,
  onUpdate,
}: {
  detail: StudyLectureDetail;
  lectureId: string;
  onUpdate: (d: StudyLectureDetail) => void;
}) {
  const [answerLength, setAnswerLength] = useState<AnswerLength>("exam");
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());
  const [editing,      setEditing]      = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [saveErr,      setSaveErr]      = useState<string | null>(null);
  const [hidingSaving, setHidingSaving] = useState<string | null>(null);

  // Per-question edit state
  const [editQ,          setEditQ]          = useState("");
  const [editShort,      setEditShort]      = useState("");
  const [editExam,       setEditExam]       = useState("");
  const [editDetailed,   setEditDetailed]   = useState("");
  const [editDifficulty, setEditDifficulty] = useState<QuestionDifficulty | null>(null);
  const [editOptions,    setEditOptions]    = useState<MCQOption[]>([]);

  function startEdit(q: StudyQuestion) {
    setEditing(q.id);
    setEditQ(q.question);
    setEditShort(q.answer_short    ?? "");
    setEditExam(q.answer_exam);
    setEditDetailed(q.answer_detailed ?? "");
    setEditDifficulty(q.difficulty);
    setEditOptions(q.options ? [...q.options] : []);
    setSaveErr(null);
    setExpanded((s) => { const n = new Set(s); n.add(q.id); return n; });
  }

  async function saveEdit(q: StudyQuestion) {
    setSaving(true);
    try {
      const payload: Parameters<typeof updateStudyQuestion>[2] = {
        question:   editQ,
        answer_exam: editExam,
        difficulty: editDifficulty ?? undefined,
      };
      if (editShort.trim())    payload.answer_short    = editShort;
      if (editDetailed.trim()) payload.answer_detailed = editDetailed;
      if (q.question_type === "multiple_choice") payload.options = editOptions;

      const updated = await updateStudyQuestion(lectureId, q.id, payload);
      onUpdate({
        ...detail,
        questions: detail.questions.map((x) => (x.id === q.id ? updated : x)),
      });
      setEditing(null);
    } catch (err) {
      setSaveErr(err instanceof ApiError ? err.detail : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function showHidden(q: StudyQuestion) {
    setHidingSaving(q.id);
    try {
      const updated = await updateStudyQuestion(lectureId, q.id, { is_hidden: false });
      onUpdate({
        ...detail,
        questions: detail.questions.map((x) => (x.id === q.id ? updated : x)),
      });
    } catch {
      // silently fail — user can retry
    } finally {
      setHidingSaving(null);
    }
  }

  if (detail.questions.length === 0) {
    return (
      <p className="text-sm text-stone-400 dark:text-stone-500 italic py-8 text-center">
        No questions generated.
      </p>
    );
  }

  const isMcq = (q: StudyQuestion) => q.question_type === "multiple_choice";

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-400 dark:text-stone-500">
          {detail.questions.filter((q) => !q.is_hidden).length} questions
          {detail.questions.some((q) => q.is_hidden) && (
            <span className="ml-1 text-stone-300 dark:text-stone-600">
              · {detail.questions.filter((q) => q.is_hidden).length} hidden
            </span>
          )}
        </p>
        {/* Answer length toggle — only meaningful for non-MCQ */}
        <div className="flex items-center gap-0.5 bg-stone-100 dark:bg-stone-800 rounded p-0.5">
          {(["short", "exam", "detailed"] as AnswerLength[]).map((len) => (
            <button
              key={len}
              onClick={() => setAnswerLength(len)}
              className={[
                "text-2xs px-2 py-0.5 rounded transition-colors capitalize",
                answerLength === len
                  ? "bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 shadow-sm font-medium"
                  : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300",
              ].join(" ")}
            >
              {len}
            </button>
          ))}
        </div>
      </div>

      {detail.questions.map((q, i) => {
        const isExpanded = expanded.has(q.id);
        const isEditing  = editing === q.id;

        return (
          <div
            key={q.id}
            className={[
              "bg-white dark:bg-stone-900 rounded-lg border shadow-card overflow-hidden",
              q.is_hidden
                ? "border-warning-border opacity-70"
                : "border-stone-200 dark:border-stone-700",
            ].join(" ")}
          >
            {/* Hidden banner */}
            {q.is_hidden && (
              <div className="px-5 py-2 bg-warning-light border-b border-warning-border flex items-center justify-between gap-3">
                <p className="text-2xs text-warning-text">
                  Auto-hidden — low transcript coverage
                </p>
                <button
                  onClick={() => showHidden(q)}
                  disabled={hidingSaving === q.id}
                  className="text-2xs font-medium text-warning-text underline hover:no-underline disabled:opacity-50"
                >
                  {hidingSaving === q.id ? "Showing…" : "Show"}
                </button>
              </div>
            )}

            {/* Question header */}
            <div
              className="px-5 py-3.5 flex items-start gap-3 cursor-pointer hover:bg-stone-50/60 dark:hover:bg-stone-800/30 transition-colors"
              onClick={() => !isEditing && setExpanded((s) => {
                const n = new Set(s);
                n.has(q.id) ? n.delete(q.id) : n.add(q.id);
                return n;
              })}
            >
              <div className="flex items-center gap-1.5 mt-0.5 flex-shrink-0">
                {confidenceDot(q.confidence)}
                <span className="text-2xs font-semibold text-stone-400 dark:text-stone-500 tabular-nums w-5">
                  {i + 1}.
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-stone-900 dark:text-stone-100 leading-snug">
                    {q.question}
                  </p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Question type badge */}
                    <span className="badge text-2xs bg-aubergine-50 border-aubergine-200 text-aubergine-800 dark:bg-aubergine-950/30 dark:border-aubergine-900 dark:text-aubergine-400">
                      {QTYPE_LABELS[q.question_type] ?? q.question_type}
                    </span>
                    {q.difficulty && (
                      <span className={`badge text-2xs ${DIFFICULTY_STYLES[q.difficulty] ?? ""}`}>
                        {q.difficulty}
                      </span>
                    )}
                    {q.source_coverage !== null && q.source_coverage < 0.70 && (
                      <span className="badge text-2xs bg-warning-light border-warning-border text-warning-text">
                        Low coverage
                      </span>
                    )}
                    <ChevronIcon open={isExpanded} />
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded content */}
            {(isExpanded || isEditing) && (
              <div className="border-t border-stone-100 dark:border-stone-800 px-5 py-3.5">
                {isEditing ? (
                  <div className="space-y-3">
                    {/* Question text */}
                    <div>
                      <label className="section-label block mb-1">Question</label>
                      <textarea
                        value={editQ}
                        onChange={(e) => setEditQ(e.target.value)}
                        rows={2}
                        className="w-full text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-aubergine-800/30 text-stone-900 dark:text-stone-100"
                      />
                    </div>

                    {/* Difficulty */}
                    <div>
                      <label className="section-label block mb-1">Difficulty</label>
                      <div className="flex gap-1.5">
                        {(["easy", "medium", "hard"] as QuestionDifficulty[]).map((d) => (
                          <button
                            key={d}
                            onClick={() => setEditDifficulty(editDifficulty === d ? null : d)}
                            className={[
                              "badge text-2xs capitalize",
                              editDifficulty === d
                                ? DIFFICULTY_STYLES[d]
                                : "bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-400 dark:text-stone-500",
                            ].join(" ")}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* MCQ options or multi-length answers */}
                    {isMcq(q) ? (
                      <McqEditForm options={editOptions} onChange={setEditOptions} />
                    ) : (
                      <div className="space-y-2">
                        <label className="section-label block">Answers</label>
                        <div>
                          <p className="text-2xs text-stone-400 dark:text-stone-500 mb-0.5">Short (15–25 words)</p>
                          <textarea
                            value={editShort}
                            onChange={(e) => setEditShort(e.target.value)}
                            rows={2}
                            placeholder="Leave blank to inherit exam answer"
                            className="w-full text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-aubergine-800/30 text-stone-900 dark:text-stone-100 placeholder:text-stone-300 dark:placeholder:text-stone-600"
                          />
                        </div>
                        <div>
                          <p className="text-2xs text-stone-400 dark:text-stone-500 mb-0.5">Exam (50–150 words) — default</p>
                          <textarea
                            value={editExam}
                            onChange={(e) => setEditExam(e.target.value)}
                            rows={4}
                            className="w-full text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-aubergine-800/30 text-stone-900 dark:text-stone-100"
                          />
                        </div>
                        <div>
                          <p className="text-2xs text-stone-400 dark:text-stone-500 mb-0.5">Detailed (200–500 words)</p>
                          <textarea
                            value={editDetailed}
                            onChange={(e) => setEditDetailed(e.target.value)}
                            rows={5}
                            placeholder="Leave blank to inherit exam answer"
                            className="w-full text-sm bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-aubergine-800/30 text-stone-900 dark:text-stone-100 placeholder:text-stone-300 dark:placeholder:text-stone-600"
                          />
                        </div>
                      </div>
                    )}

                    {saveErr && <p className="text-xs text-negative-text">{saveErr}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(q)}
                        disabled={saving}
                        className="btn-primary text-xs py-1 flex-1 justify-center"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => { setEditing(null); setSaveErr(null); }}
                        className="btn-secondary text-xs py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Answer display */}
                    {isMcq(q) && q.options ? (
                      <McqDisplay options={q.options} />
                    ) : (
                      <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                        {resolveAnswer(q, answerLength)}
                      </p>
                    )}

                    {q.evidence_snippet && (
                      <EvidencePill snippet={q.evidence_snippet} />
                    )}

                    {/* Footer row */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {q.topic_tags.length > 0 && (
                          <span className="text-2xs text-stone-300 dark:text-stone-600">
                            {q.topic_tags.slice(0, 2).join(" · ")}
                          </span>
                        )}
                        {q.edited && (
                          <span className="text-2xs text-aubergine-800 dark:text-aubergine-400">edited</span>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(q); }}
                        className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors flex-shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Loading / error screens ──────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
      <div className="text-center space-y-3">
        <svg className="w-6 h-6 animate-spin text-aubergine-800 dark:text-aubergine-400 mx-auto" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <p className="text-sm text-stone-400 dark:text-stone-500">Loading lecture…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ error, lectureId }: { error: string | null; lectureId: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
      <div className="max-w-sm text-center space-y-4">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {error ?? "Lecture not found."}
        </p>
        <Link href="/study" className="btn-secondary text-xs py-1.5 inline-flex">
          Back to Study Mode
        </Link>
      </div>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-stone-400 dark:text-stone-500 transition-transform flex-shrink-0 ${open ? "" : "rotate-180"}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}
