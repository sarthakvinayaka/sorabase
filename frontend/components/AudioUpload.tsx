"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { uploadAudio } from "@/lib/api";
import { ApiError } from "@/lib/api";

type UploadState = "idle" | "uploading" | "transcribing" | "ready" | "error";

const ACCEPTED = ".mp3,.mp4,.m4a,.wav,.webm,.ogg,.flac";

export default function AudioUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setState("uploading");

    try {
      setState("transcribing");
      const result = await uploadAudio(file);
      setState("ready");

      // Auto-trigger extraction and redirect to review
      const { extractConversation } = await import("@/lib/api");
      const extraction = await extractConversation(result.conversation_id);
      router.push(`/review/${extraction.candidate_id}`);
    } catch (err) {
      setState("error");
      setError(err instanceof ApiError ? err.detail : "Upload failed. Please try again.");
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const isWorking = state === "uploading" || state === "transcribing";

  const statusLabel: Record<UploadState, string> = {
    idle: "Drop an audio file here, or click to browse",
    uploading: "Uploading…",
    transcribing: "Transcribing audio…",
    ready: "Done — redirecting to review",
    error: error ?? "Something went wrong",
  };

  return (
    <div className="mt-6">
      <p className="text-xs font-semibold tracking-widest text-stone-400 uppercase mb-3">
        Or upload an audio recording
      </p>

      <div
        role="button"
        tabIndex={0}
        onClick={() => !isWorking && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !isWorking && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-sm transition-colors",
          dragOver
            ? "border-rose-700 bg-rose-50"
            : "border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-white",
          isWorking ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          state === "error" ? "border-red-300 bg-red-50" : "",
        ].join(" ")}
      >
        {isWorking ? (
          <span className="flex items-center gap-2 text-stone-500">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            {statusLabel[state]}
          </span>
        ) : (
          <>
            <svg
              className={`h-8 w-8 ${state === "error" ? "text-red-400" : "text-stone-300"}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
            <span className={state === "error" ? "text-red-600" : "text-stone-500"}>
              {statusLabel[state]}
            </span>
            <span className="text-xs text-stone-400">MP3, M4A, WAV, WebM, OGG, FLAC · max 25 MB</span>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="sr-only"
        onChange={onInputChange}
        aria-label="Upload audio file"
      />
    </div>
  );
}
