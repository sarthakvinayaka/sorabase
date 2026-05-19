"use client";

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createConversation, uploadAudio, ApiError } from "@/lib/api";
import { useExtensionStatus } from "@/lib/useExtensionStatus";

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceMode = "transcript" | "audio" | "pdf" | "mixed" | "live";
type StudyTemplate = "standard" | "exam_prep" | "lecture_notes" | "technical";
type SubmitState = "idle" | "uploading" | "creating" | "error";

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_MODES: Array<{
  id: SourceMode;
  label: string;
  sub: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}> = [
  {
    id: "transcript",
    label: "Paste transcript",
    sub: "Type or paste text",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
      </svg>
    ),
  },
  {
    id: "audio",
    label: "Upload recording",
    sub: "Audio or video file",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    id: "pdf",
    label: "Upload slides",
    sub: "PDF or notes file",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    comingSoon: true,
  },
  {
    id: "mixed",
    label: "Audio + notes",
    sub: "Recording with context",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    id: "live",
    label: "Live lecture",
    sub: "Capture in real time",
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
];

const TEMPLATES: Array<{
  id: StudyTemplate;
  label: string;
  description: string;
  outputs: string[];
  symbol: string;
}> = [
  {
    id: "standard",
    label: "Standard",
    description: "All study outputs — notes, concepts, flashcards, and Q&A pairs.",
    outputs: ["Notes", "Concepts", "Flashcards", "Q&A"],
    symbol: "◈",
  },
  {
    id: "exam_prep",
    label: "Exam prep",
    description: "Maximises flashcard and Q&A generation for focused revision sessions.",
    outputs: ["Flashcards ×3", "Q&A pairs", "Key terms"],
    symbol: "⊡",
  },
  {
    id: "lecture_notes",
    label: "Lecture notes",
    description: "Clean structured prose notes with topics and learning objectives.",
    outputs: ["Notes", "Topics", "Objectives"],
    symbol: "≡",
  },
  {
    id: "technical",
    label: "Technical / STEM",
    description: "Adds formula extraction and technical definition mapping.",
    outputs: ["Formulas", "Concepts", "Definitions"],
    symbol: "∑",
  },
];

const AUDIO_EXTS = [".mp3", ".m4a", ".mp4", ".wav", ".ogg", ".webm", ".aac", ".flac", ".mov", ".mkv"];

function isAudioFile(file: File): boolean {
  return (
    file.type.startsWith("audio/") ||
    file.type.startsWith("video/") ||
    AUDIO_EXTS.some((ext) => file.name.toLowerCase().endsWith(ext))
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SourceCard({
  mode,
  active,
  onClick,
}: {
  mode: (typeof SOURCE_MODES)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aubergine-500",
        active
          ? "border-aubergine-400 bg-aubergine-50 dark:border-aubergine-700 dark:bg-aubergine-950/30"
          : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:hover:border-stone-600",
      ].join(" ")}
    >
      {mode.comingSoon && (
        <span className="absolute right-2 top-2 text-2xs font-medium text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded">
          Soon
        </span>
      )}
      <span className={active ? "text-aubergine-700 dark:text-aubergine-400" : "text-stone-400 dark:text-stone-500"}>
        {mode.icon}
      </span>
      <div>
        <p className={`text-xs font-semibold leading-tight ${active ? "text-aubergine-900 dark:text-aubergine-300" : "text-stone-700 dark:text-stone-300"}`}>
          {mode.label}
        </p>
        <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">{mode.sub}</p>
      </div>
    </button>
  );
}

function TemplateCard({
  tmpl,
  active,
  onClick,
}: {
  tmpl: (typeof TEMPLATES)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-col gap-3 rounded-lg border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aubergine-500",
        active
          ? "border-aubergine-400 bg-aubergine-50 dark:border-aubergine-700 dark:bg-aubergine-950/30"
          : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:hover:border-stone-600",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`text-xs font-semibold ${active ? "text-aubergine-900 dark:text-aubergine-300" : "text-stone-700 dark:text-stone-300"}`}>
            {tmpl.label}
          </p>
          <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5 leading-snug">{tmpl.description}</p>
        </div>
        <span className={`shrink-0 text-lg leading-none font-light ${active ? "text-aubergine-600 dark:text-aubergine-400" : "text-stone-300 dark:text-stone-600"}`}>
          {tmpl.symbol}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {tmpl.outputs.map((o) => (
          <span
            key={o}
            className={`text-2xs px-1.5 py-0.5 rounded font-medium ${
              active
                ? "bg-aubergine-100 dark:bg-aubergine-900/40 text-aubergine-800 dark:text-aubergine-300"
                : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400"
            }`}
          >
            {o}
          </span>
        ))}
      </div>
    </button>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
      <p className="text-2xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-widest">{label}</p>
      <div className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
    </div>
  );
}

// ─── Drop zone shared component ───────────────────────────────────────────────

function DropZone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  accept,
  children,
}: {
  isDragging: boolean;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onClick: () => void;
  accept: string;
  children: React.ReactNode;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      className={[
        "relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors",
        isDragging
          ? "border-aubergine-400 bg-aubergine-50 dark:border-aubergine-600 dark:bg-aubergine-950/20"
          : "border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 bg-white dark:bg-stone-900",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

// ─── Main workspace ────────────────────────────────────────────────────────────

export default function StudyIntakeWorkspace() {
  const router = useRouter();
  const ext = useExtensionStatus();

  // Source
  const [sourceMode, setSourceMode] = useState<SourceMode>("transcript");
  const [transcript, setTranscript] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isDraggingAudio, setIsDraggingAudio] = useState(false);
  const [mixedNotes, setMixedNotes] = useState("");

  // Metadata
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("");
  const [lectureDate, setLectureDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Template
  const [template, setTemplate] = useState<StudyTemplate>("standard");

  // Submit
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);

  // ── Validation ─────────────────────────────────────────────────────────────

  const isSubmittable = (() => {
    if (submitState !== "idle") return false;
    if (sourceMode === "transcript") return transcript.trim().length > 30;
    if (sourceMode === "audio")      return audioFile !== null;
    if (sourceMode === "mixed")      return audioFile !== null;
    return false; // pdf and live handled separately
  })();

  const submitLabel = (() => {
    if (submitState === "uploading") return "Uploading…";
    if (submitState === "creating")  return "Preparing…";
    return "Analyse lecture →";
  })();

  // ── Audio handlers ─────────────────────────────────────────────────────────

  const handleAudioDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingAudio(true);
  }, []);

  const handleAudioDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingAudio(false);
    const file = Array.from(e.dataTransfer.files).find(isAudioFile);
    if (file) setAudioFile(file);
  }, []);

  const handleAudioInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isAudioFile(file)) setAudioFile(file);
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!isSubmittable) return;
    setError(null);

    try {
      let conversationId: string;

      if ((sourceMode === "audio" || sourceMode === "mixed") && audioFile) {
        setSubmitState("uploading");
        const res = await uploadAudio(audioFile);
        conversationId = res.conversation_id;
      } else {
        setSubmitState("creating");
        const text = sourceMode === "mixed"
          ? [transcript.trim(), mixedNotes.trim()].filter(Boolean).join("\n\n")
          : transcript.trim();
        const conv = await createConversation({ raw_text: text, source_type: "transcript" });
        conversationId = conv.id;
      }

      const params = new URLSearchParams({ source: sourceMode, template });
      if (title.trim())    params.set("title",  title.trim());
      if (course.trim())   params.set("course", course.trim());
      if (lectureDate)     params.set("date",   lectureDate);

      router.push(`/study/processing/${conversationId}?${params}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Something went wrong. Please try again.");
      setSubmitState("idle");
    }
  }, [isSubmittable, sourceMode, audioFile, transcript, mixedNotes, title, course, lectureDate, template, router]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl mx-auto px-5 py-12 pb-24 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="section-label mb-1.5">Study mode</p>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              New lecture
            </h1>
            <p className="text-sm text-stone-400 dark:text-stone-500 mt-1.5">
              Drop in a lecture and SoraBase turns it into structured study material.
            </p>
          </div>
          <Link
            href="/study/dashboard"
            className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors mt-1"
          >
            ← Library
          </Link>
        </div>

        {/* ── Source mode selector ── */}
        <section className="space-y-3">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400">Source</p>
          <div className="grid grid-cols-5 gap-2">
            {SOURCE_MODES.map((m) => (
              <SourceCard
                key={m.id}
                mode={m}
                active={sourceMode === m.id}
                onClick={() => !m.comingSoon && setSourceMode(m.id)}
              />
            ))}
          </div>
        </section>

        {/* ── Active input area ── */}
        <section>

          {/* Transcript */}
          {sourceMode === "transcript" && (
            <div className="space-y-2">
              <div className="relative">
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Paste your lecture transcript here…&#10;&#10;You can include speaker labels, timestamps, or just raw text — SoraBase will handle it."
                  rows={12}
                  className="w-full resize-none rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-3.5 text-sm text-stone-800 dark:text-stone-200 placeholder-stone-300 dark:placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-aubergine-400 dark:focus:ring-aubergine-600 transition font-mono leading-relaxed"
                />
                <span className="absolute bottom-3 right-3 text-2xs text-stone-300 dark:text-stone-600 tabular-nums pointer-events-none">
                  {transcript.length.toLocaleString()} chars
                </span>
              </div>
              {transcript.trim().length > 0 && transcript.trim().length < 30 && (
                <p className="text-2xs text-amber-600 dark:text-amber-400">
                  Transcript is too short — paste at least a few sentences.
                </p>
              )}
            </div>
          )}

          {/* Audio upload */}
          {sourceMode === "audio" && (
            <div className="space-y-3">
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*,video/*"
                className="sr-only"
                onChange={handleAudioInput}
              />
              {audioFile ? (
                <FileChip
                  file={audioFile}
                  onRemove={() => {
                    setAudioFile(null);
                    if (audioInputRef.current) audioInputRef.current.value = "";
                  }}
                  type="audio"
                />
              ) : (
                <DropZone
                  isDragging={isDraggingAudio}
                  onDragOver={handleAudioDragOver}
                  onDragLeave={() => setIsDraggingAudio(false)}
                  onDrop={handleAudioDrop}
                  onClick={() => audioInputRef.current?.click()}
                  accept="audio/*,video/*"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDraggingAudio ? "bg-aubergine-100 dark:bg-aubergine-900/40" : "bg-stone-100 dark:bg-stone-800"}`}>
                    <svg className={`w-5 h-5 ${isDraggingAudio ? "text-aubergine-600 dark:text-aubergine-400" : "text-stone-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
                      {isDraggingAudio ? "Drop to upload" : "Drop an audio or video file"}
                    </p>
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                      MP3, M4A, MP4, WAV, WebM — up to 2 hours
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-aubergine-700 dark:text-aubergine-400 hover:text-aubergine-900 dark:hover:text-aubergine-300 transition-colors"
                    onClick={(e) => { e.stopPropagation(); audioInputRef.current?.click(); }}
                  >
                    Browse files
                  </button>
                </DropZone>
              )}
              <p className="text-2xs text-stone-400 dark:text-stone-500">
                Audio is transcribed before analysis — allow 1–2 minutes per hour of recording.
              </p>
            </div>
          )}

          {/* PDF — coming soon */}
          {sourceMode === "pdf" && (
            <div className="rounded-lg border-2 border-dashed border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-6 py-12 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto">
                <svg className="w-5 h-5 text-stone-300 dark:text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-500 dark:text-stone-400">PDF upload coming soon</p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                  In the meantime, copy text from your slides and paste it as a transcript.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSourceMode("transcript")}
                className="text-xs font-medium text-aubergine-700 dark:text-aubergine-400 hover:text-aubergine-900 dark:hover:text-aubergine-300 transition-colors"
              >
                Switch to transcript →
              </button>
            </div>
          )}

          {/* Mixed — audio + optional notes */}
          {sourceMode === "mixed" && (
            <div className="space-y-4">
              {/* Audio */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-stone-500 dark:text-stone-400">Lecture recording</p>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*,video/*"
                  className="sr-only"
                  onChange={handleAudioInput}
                />
                {audioFile ? (
                  <FileChip
                    file={audioFile}
                    onRemove={() => {
                      setAudioFile(null);
                      if (audioInputRef.current) audioInputRef.current.value = "";
                    }}
                    type="audio"
                  />
                ) : (
                  <DropZone
                    isDragging={isDraggingAudio}
                    onDragOver={handleAudioDragOver}
                    onDragLeave={() => setIsDraggingAudio(false)}
                    onDrop={handleAudioDrop}
                    onClick={() => audioInputRef.current?.click()}
                    accept="audio/*,video/*"
                  >
                    <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
                      <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <p className="text-sm text-stone-500 dark:text-stone-400">Drop recording or <span className="text-aubergine-700 dark:text-aubergine-400 font-medium">browse</span></p>
                  </DropZone>
                )}
              </div>

              {/* Supplementary notes */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                  Supplementary notes
                  <span className="ml-1.5 font-normal text-stone-400 dark:text-stone-500">(optional)</span>
                </p>
                <textarea
                  value={mixedNotes}
                  onChange={(e) => setMixedNotes(e.target.value)}
                  placeholder="Paste any handwritten notes, slide text, or additional context…"
                  rows={5}
                  className="w-full resize-none rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-3 text-sm text-stone-800 dark:text-stone-200 placeholder-stone-300 dark:placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-aubergine-400 dark:focus:ring-aubergine-600 transition leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* Live capture */}
          {sourceMode === "live" && (
            <LiveCapturePanel installed={ext.installed} recording={ext.recording} />
          )}

        </section>

        {/* ── Lecture details (collapsible) ── */}
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            className="flex items-center gap-2 text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${detailsOpen ? "rotate-90" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            Lecture details
            {!detailsOpen && (title || course) && (
              <span className="ml-1 text-aubergine-600 dark:text-aubergine-400 font-normal">
                {[title, course].filter(Boolean).join(" · ")}
              </span>
            )}
          </button>

          {detailsOpen && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
              {/* Title */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs text-stone-500 dark:text-stone-400">Lecture title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Week 4 — Cellular Respiration"
                  className="w-full rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3.5 py-2.5 text-sm text-stone-800 dark:text-stone-200 placeholder-stone-300 dark:placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-aubergine-400 dark:focus:ring-aubergine-600 transition"
                />
              </div>

              {/* Course */}
              <div className="space-y-1.5">
                <label className="text-xs text-stone-500 dark:text-stone-400">Course / subject</label>
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="e.g. Biology 101"
                  className="w-full rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3.5 py-2.5 text-sm text-stone-800 dark:text-stone-200 placeholder-stone-300 dark:placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-aubergine-400 dark:focus:ring-aubergine-600 transition"
                />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-xs text-stone-500 dark:text-stone-400">Lecture date</label>
                <input
                  type="date"
                  value={lectureDate}
                  onChange={(e) => setLectureDate(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3.5 py-2.5 text-sm text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-aubergine-400 dark:focus:ring-aubergine-600 transition"
                />
              </div>
            </div>
          )}
        </section>

        <SectionDivider label="Study template" />

        {/* ── Template selector ── */}
        <section className="space-y-3">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Choose what SoraBase focuses on when analysing your lecture.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => (
              <TemplateCard
                key={t.id}
                tmpl={t}
                active={template === t.id}
                onClick={() => setTemplate(t.id)}
              />
            ))}
          </div>
        </section>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-4 py-3">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* ── Submit ── */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-stone-400 dark:text-stone-500">
            {sourceMode === "transcript" && transcript.trim().length > 30 &&
              `${transcript.trim().length.toLocaleString()} characters ready`}
            {(sourceMode === "audio" || sourceMode === "mixed") && audioFile &&
              `${audioFile.name} · ${formatBytes(audioFile.size)}`}
          </p>
          <button
            type="button"
            disabled={!isSubmittable}
            onClick={handleSubmit}
            className={[
              "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all",
              isSubmittable
                ? "bg-aubergine-800 text-white hover:bg-aubergine-900 shadow-sm"
                : "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed",
            ].join(" ")}
          >
            {submitState !== "idle" && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {submitLabel}
          </button>
        </div>

      </div>
    </main>
  );
}

// ─── File chip — selected file state ──────────────────────────────────────────

function FileChip({
  file,
  onRemove,
  type,
}: {
  file: File;
  onRemove: () => void;
  type: "audio" | "pdf";
}) {
  const icon =
    type === "audio" ? (
      <svg className="w-4 h-4 text-aubergine-600 dark:text-aubergine-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-aubergine-600 dark:text-aubergine-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );

  return (
    <div className="flex items-center gap-3 rounded-lg border border-aubergine-200 dark:border-aubergine-800 bg-aubergine-50 dark:bg-aubergine-950/20 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-aubergine-100 dark:bg-aubergine-900/40 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{file.name}</p>
        <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">{formatBytes(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors flex-shrink-0"
        aria-label="Remove file"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Live capture panel ───────────────────────────────────────────────────────

function LiveCapturePanel({
  installed,
  recording,
}: {
  installed: boolean;
  recording: boolean;
}) {
  if (recording) {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-5 py-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-semibold text-red-700 dark:text-red-400">Recording in progress</span>
        </div>
        <p className="text-xs text-red-600 dark:text-red-400 flex-1">
          SoraBase Capture is recording your current tab. Stop the recording from the extension to begin analysis.
        </p>
      </div>
    );
  }

  if (installed) {
    return (
      <div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-5 py-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-aubergine-500" />
          <p className="text-sm font-medium text-stone-700 dark:text-stone-300">SoraBase Capture ready</p>
        </div>
        <p className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed">
          Open the SoraBase Capture extension in your browser to start recording your lecture.
          When you stop the recording it will appear here automatically for analysis.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <div className="w-6 h-6 rounded bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </div>
          <p className="text-xs text-stone-400 dark:text-stone-500">Click the extension icon in your browser toolbar to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-5 py-6 space-y-4">
      <div>
        <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">Record your lecture live</p>
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 leading-relaxed">
          Install the SoraBase Capture extension to record Google Meet, Zoom, or Teams lectures
          directly from your browser. Transcription and analysis start automatically when you stop recording.
        </p>
      </div>
      <ul className="space-y-2">
        {["Captures tab audio and microphone", "Works with Meet, Zoom, and Teams", "No manual upload needed"].map((feat) => (
          <li key={feat} className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <svg className="w-3.5 h-3.5 text-aubergine-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {feat}
          </li>
        ))}
      </ul>
      <a
        href="https://chrome.google.com/webstore/detail/sorabase-capture/EXTENSION_ID"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-aubergine-700 dark:text-aubergine-400 hover:text-aubergine-900 dark:hover:text-aubergine-300 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Install SoraBase Capture
      </a>
    </div>
  );
}
