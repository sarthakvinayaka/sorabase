"use client";

import { useEffect, useRef, useState } from "react";
import { editDraft, generateSummaryDraft, listDrafts } from "@/lib/api";
import type { CandidateDraft } from "@/lib/types";

type PanelState = "idle" | "has_draft" | "editing" | "saving" | "generating";

interface Props {
  candidateId: string;
}

export function SummaryDraftPanel({ candidateId }: Props) {
  const [draft, setDraft] = useState<CandidateDraft | null>(null);
  const [state, setState] = useState<PanelState>("idle");
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listDrafts(candidateId)
      .then((all) => {
        const summaries = all.filter((d) => d.draft_type === "candidate_summary");
        if (summaries.length > 0) {
          setDraft(summaries[0]);
          setState("has_draft");
        }
      })
      .catch(() => {});
  }, [candidateId]);

  // Auto-resize textarea.
  useEffect(() => {
    if (state === "editing" && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [state, editContent]);

  async function handleGenerate() {
    setState("generating");
    setError(null);
    try {
      const created = await generateSummaryDraft(candidateId);
      setDraft(created);
      setState("has_draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
      setState(draft ? "has_draft" : "idle");
    }
  }

  function handleStartEdit() {
    if (!draft) return;
    setEditContent(draft.content);
    setState("editing");
  }

  function handleCancelEdit() {
    setState("has_draft");
    setError(null);
  }

  async function handleSave() {
    if (!draft) return;
    setState("saving");
    setError(null);
    try {
      const updated = await editDraft(candidateId, draft.id, editContent);
      setDraft(updated);
      setState("has_draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setState("editing");
    }
  }

  const isGenerating = state === "generating";
  const isSaving = state === "saving";
  const isEditing = state === "editing" || state === "saving";
  const wordCount = draft
    ? (isEditing ? editContent : draft.content).split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {draft && (
            <span className="text-xs text-stone-400">
              {wordCount} words
              {draft.edited && (
                <span className="ml-2 text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  Edited
                </span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="text-xs px-3 py-1.5 border border-stone-200 rounded text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || editContent.trim().length === 0}
                className="text-xs px-3 py-1.5 bg-aubergine-800 text-white rounded hover:bg-aubergine-900 disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <>
              {draft && (
                <button
                  onClick={handleStartEdit}
                  disabled={isGenerating}
                  className="text-xs px-3 py-1.5 border border-stone-200 rounded text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                >
                  Edit
                </button>
              )}
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isGenerating
                  ? "Generating…"
                  : draft
                  ? "Regenerate"
                  : "Generate Summary"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Content */}
      {isGenerating && (
        <div className="h-32 bg-stone-50 rounded border border-stone-200 flex items-center justify-center">
          <span className="text-sm text-stone-400 animate-pulse">Generating…</span>
        </div>
      )}

      {!isGenerating && draft && !isEditing && (
        <div className="rounded border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
            {draft.content}
          </p>
          <p className="text-xs text-stone-400 mt-3">
            Generated {new Date(draft.created_at).toLocaleString()}
            {draft.edited && ` · Last edited ${new Date(draft.updated_at).toLocaleString()}`}
          </p>
        </div>
      )}

      {!isGenerating && isEditing && (
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          disabled={isSaving}
          className="w-full min-h-[140px] rounded border border-aubergine-300 bg-white px-4 py-3 text-sm text-stone-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-aubergine-400 disabled:opacity-50"
          placeholder="Write the candidate summary…"
        />
      )}

      {!draft && !isGenerating && (
        <p className="text-sm text-stone-400">
          No summary yet. Click Generate Summary to create a recruiter-ready candidate profile from
          the reviewed record.
        </p>
      )}
    </div>
  );
}
