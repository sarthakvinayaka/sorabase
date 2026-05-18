"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createConversation, extractConversation, ApiError } from "@/lib/api";

const MAX_CHARS = 50_000;

export default function TranscriptInput() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [jobRef, setJobRef] = useState("");
  const [phase, setPhase] = useState<"idle" | "saving" | "extracting">("idle");
  const [error, setError] = useState<string | null>(null);

  const charCount = text.length;
  const overLimit = charCount > MAX_CHARS;
  const tooShort = charCount < 50;

  async function handleSubmit() {
    setError(null);
    setPhase("saving");
    try {
      const conversation = await createConversation({
        raw_text: text,
        job_reference: jobRef.trim() || undefined,
      });

      setPhase("extracting");
      const extraction = await extractConversation(conversation.id);

      router.push(`/review/${extraction.candidate_id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.detail
          : "Something went wrong. Please try again.",
      );
      setPhase("idle");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 space-y-5">
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5">
          Transcript
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the full text of the recruiter screening call here…"
          rows={18}
          className={`w-full rounded-xl border px-4 py-3 text-sm text-stone-900 placeholder-stone-400 font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-aubergine-700 ${
            overLimit
              ? "border-red-400 bg-red-50"
              : "border-stone-300 bg-white"
          }`}
        />
        <div className="flex justify-between items-center mt-1.5">
          <span
            className={`text-xs ${overLimit ? "text-red-600 font-semibold" : "text-stone-400"}`}
          >
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
          </span>
          {overLimit && (
            <span className="text-xs text-red-600">
              Transcript is too long. Trim to under {MAX_CHARS.toLocaleString()} characters.
            </span>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5">
          Job reference{" "}
          <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <input
          type="text"
          value={jobRef}
          onChange={(e) => setJobRef(e.target.value)}
          placeholder="e.g. JOB-4912 or Client Name"
          className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-aubergine-700"
        />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {phase !== "idle" && (
        <div className="rounded-xl bg-aubergine-50 border border-aubergine-50 px-4 py-3 text-sm text-aubergine-800 flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          {phase === "saving"
            ? "Saving transcript…"
            : "Extracting structured profile — this takes 10–20 seconds…"}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={tooShort || overLimit || phase !== "idle"}
        className="w-full rounded-xl bg-aubergine-800 text-white font-medium py-3 text-sm hover:bg-aubergine-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {phase === "idle" ? "Extract candidate profile →" : "Processing…"}
      </button>
    </div>
  );
}
