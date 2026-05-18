"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { proposeSchema, listTemplates, createTemplate, ApiError } from "@/lib/api";
import type { ColumnType, ProposedColumn, SchemaTemplate, StoredSchema } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMN_TYPES: ColumnType[] = ["text", "number", "boolean", "list", "date"];

const TYPE_META: Record<ColumnType, { label: string; style: string }> = {
  text:    { label: "Text",   style: "bg-sky-50  dark:bg-sky-950/30  text-sky-700  dark:text-sky-400  border-sky-200  dark:border-sky-800"  },
  number:  { label: "Number", style: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800" },
  boolean: { label: "Yes/No", style: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  list:    { label: "List",   style: "bg-aubergine-50 dark:bg-aubergine-950/30 text-aubergine-900 dark:text-aubergine-400 border-aubergine-200 dark:border-aubergine-900" },
  date:    { label: "Date",   style: "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditableColumn {
  id:          string;
  name:        string;      // snake_case key — sent to backend
  description: string;
  type:        ColumnType;
  required:    boolean;
  selected:    boolean;     // included in the approved schema
  isCustom:    boolean;     // added by user, not AI-proposed
}

type LoadState = "loading" | "ready" | "error";
type ValidationErrors = Record<string, string>;

interface Props {
  conversationId: string;
  source:         string;
  rawText:        string;
  charCount:      number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSnakeCase(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fromProposed(cols: ProposedColumn[]): EditableColumn[] {
  return cols.map((c, i) => ({
    id:          `ai-${i}-${c.name}`,
    name:        c.name,
    description: c.description,
    type:        c.type,
    required:    c.required,
    selected:    true,
    isCustom:    false,
  }));
}

function makeCustomColumn(): EditableColumn {
  return {
    id:          `custom-${Date.now()}`,
    name:        "",
    description: "",
    type:        "text",
    required:    false,
    selected:    true,
    isCustom:    true,
  };
}

function validate(columns: EditableColumn[]): ValidationErrors {
  const errors: ValidationErrors = {};
  const active = columns.filter((c) => c.selected);

  if (active.length === 0) {
    errors["__global"] = "Select at least one column to continue.";
    return errors;
  }

  const seen = new Map<string, string>(); // name → id
  for (const col of active) {
    const slug = toSnakeCase(col.name);
    if (!slug) {
      errors[col.id] = "Column name is required.";
      continue;
    }
    if (!/^[a-z]/.test(slug)) {
      errors[col.id] = "Name must start with a letter.";
      continue;
    }
    if (seen.has(slug)) {
      errors[col.id]          = `Duplicate name "${slug}".`;
      errors[seen.get(slug)!] = `Duplicate name "${slug}".`;
    } else {
      seen.set(slug, col.id);
    }
  }

  return errors;
}

// ─── localStorage hook ────────────────────────────────────────────────────────

function useApprovedSchema(conversationId: string) {
  const key = `sorabase-schema-${conversationId}`;

  const save = useCallback((
    columns: EditableColumn[],
    templateMeta?: { templateId: string; templateVersion: number },
  ) => {
    try {
      const stored: StoredSchema = {
        columns: columns
          .filter((c) => c.selected && c.name)
          .map(({ name, description, type, required }) => ({ name, description, type, required })),
        templateId:      templateMeta?.templateId,
        templateVersion: templateMeta?.templateVersion,
      };
      localStorage.setItem(key, JSON.stringify(stored));
    } catch {}
  }, [key]);

  const load = useCallback((): EditableColumn[] | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Support old format (plain array) and new StoredSchema format
      const cols: ProposedColumn[] = Array.isArray(parsed)
        ? parsed
        : (parsed as StoredSchema).columns ?? [];
      return cols.map((c, i) => ({
        id:          `cached-${i}-${c.name}`,
        name:        c.name,
        description: c.description,
        type:        c.type,
        required:    c.required,
        selected:    true,
        isCustom:    false,
      }));
    } catch { return null; }
  }, [key]);

  return { save, load };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SchemaReviewWorkspace({
  conversationId,
  source,
  rawText,
  charCount,
}: Props) {
  const router = useRouter();
  const ranRef = useRef(false);
  const { save, load } = useApprovedSchema(conversationId);

  const [loadState,       setLoadState]       = useState<LoadState>("loading");
  const [fetchError,      setFetchError]      = useState<string | null>(null);
  const [proposedCols,    setProposedCols]    = useState<ProposedColumn[]>([]);
  const [rationale,       setRationale]       = useState("");
  const [modelUsed,       setModelUsed]       = useState("");
  const [columns,         setColumns]         = useState<EditableColumn[]>([]);
  const [errors,          setErrors]          = useState<ValidationErrors>({});
  const [showTranscript,  setShowTranscript]  = useState(false);
  const [showContext,     setShowContext]      = useState(true);
  const [extracting,      setExtracting]      = useState(false);

  // Template state
  const [templatePanel,   setTemplatePanel]   = useState<"menu" | "picker" | "save" | null>(null);
  const [templates,       setTemplates]       = useState<SchemaTemplate[] | null>(null);
  const [templatesLoading,setTemplatesLoading]= useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState<{ id: string; name: string; version: number } | null>(null);
  const [saveTemplateName,setSaveTemplateName]= useState("");
  const [saveTemplateDesc,setSaveTemplateDesc]= useState("");
  const [saveTemplateVis, setSaveTemplateVis] = useState<"private" | "workspace">("private");
  const [savingTemplate,  setSavingTemplate]  = useState(false);
  const [saveTemplateErr, setSaveTemplateErr] = useState<string | null>(null);
  const [saveTemplateDone,setSaveTemplateDone]= useState<string | null>(null); // saved name

  const loadProposal = useCallback(() => {
    setLoadState("loading");
    setFetchError(null);
    proposeSchema(conversationId)
      .then((res) => {
        setProposedCols(res.columns);
        setRationale(res.rationale);
        setModelUsed(res.model_used);
        setColumns(fromProposed(res.columns));
        setLoadState("ready");
      })
      .catch((err) => {
        setFetchError(err instanceof ApiError ? err.detail : "Failed to generate schema proposal.");
        setLoadState("error");
      });
  }, [conversationId]);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const cached = load();
    if (cached && cached.length > 0) {
      setColumns(cached);
      setLoadState("ready");
      return;
    }

    loadProposal();
  }, [load, loadProposal]);

  // ── Column operations ───────────────────────────────────────────────────────

  function toggleSelected(id: string) {
    setColumns((prev) => prev.map((c) => c.id === id ? { ...c, selected: !c.selected } : c));
    clearError(id);
  }

  function updateColumn(id: string, patch: Partial<EditableColumn>) {
    setColumns((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
    clearError(id);
  }

  function addColumn() {
    setColumns((prev) => [...prev, makeCustomColumn()]);
  }

  function removeColumn(id: string) {
    setColumns((prev) => prev.filter((c) => c.id !== id));
    clearError(id);
  }

  function resetToProposal() {
    if (proposedCols.length > 0) {
      setColumns(fromProposed(proposedCols));
      setErrors({});
    } else {
      // Proposal not yet loaded (user was working from cache) — re-fetch
      ranRef.current = false;
      loadProposal();
    }
  }

  // ── Template operations ─────────────────────────────────────────────────────

  function openPicker() {
    setTemplatePanel("picker");
    setSaveTemplateDone(null);
    if (templates === null && !templatesLoading) {
      setTemplatesLoading(true);
      listTemplates()
        .then(setTemplates)
        .catch(() => setTemplates([]))
        .finally(() => setTemplatesLoading(false));
    }
  }

  function openSave() {
    setTemplatePanel("save");
    setSaveTemplateName("");
    setSaveTemplateDesc("");
    setSaveTemplateVis("private");
    setSaveTemplateErr(null);
    setSaveTemplateDone(null);
  }

  function closeTemplatePanel() {
    setTemplatePanel(null);
  }

  function applyTemplate(t: SchemaTemplate) {
    setColumns(fromProposed(t.columns));
    setAppliedTemplate({ id: t.id, name: t.name, version: t.version });
    setErrors({});
    setTemplatePanel(null);
  }

  async function handleSaveTemplate() {
    if (!saveTemplateName.trim()) {
      setSaveTemplateErr("Template name is required.");
      return;
    }
    const errs = validate(columns);
    if (Object.keys(errs).length > 0) {
      setSaveTemplateErr("Fix column errors before saving as template.");
      return;
    }
    setSavingTemplate(true);
    setSaveTemplateErr(null);
    try {
      const saved = await createTemplate({
        name:        saveTemplateName.trim(),
        description: saveTemplateDesc.trim() || null,
        visibility:  saveTemplateVis,
        columns:     columns
          .filter((c) => c.selected && c.name)
          .map(({ name, description, type, required }) => ({ name, description, type, required })),
      });
      setTemplates((prev) => (prev ? [saved, ...prev] : [saved]));
      setAppliedTemplate({ id: saved.id, name: saved.name, version: saved.version });
      setSaveTemplateDone(saved.name);
      setSavingTemplate(false);
      setTimeout(() => setTemplatePanel(null), 1400);
    } catch (err) {
      setSaveTemplateErr(err instanceof ApiError ? err.detail : "Failed to save template.");
      setSavingTemplate(false);
    }
  }

  function clearError(id: string) {
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  // ── Continue ────────────────────────────────────────────────────────────────

  function handleExtract() {
    const errs = validate(columns);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setExtracting(true);
    save(
      columns,
      appliedTemplate ? { templateId: appliedTemplate.id, templateVersion: appliedTemplate.version } : undefined,
    );
    router.push(`/general/processing/${conversationId}?source=${source}`);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const selectedCount = columns.filter((c) => c.selected).length;
  const aiCount       = columns.filter((c) => !c.isCustom).length;
  const customCount   = columns.filter((c) => c.isCustom).length;
  const globalError   = errors["__global"];

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loadState === "loading") {
    return (
      <div className="page">
        <div className="max-w-lg mx-auto mt-16">
          <div className="card p-5 flex items-center gap-3">
            <Spinner className="text-aubergine-800 dark:text-aubergine-400" />
            <div>
              <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
                Analyzing transcript
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                Proposing extraction columns — this takes a few seconds.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (loadState === "error") {
    return (
      <div className="page">
        <div className="max-w-lg mx-auto mt-16 space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-4 py-3.5">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-400 flex-1">{fetchError}</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => { ranRef.current = false; loadProposal(); }} className="btn-primary text-sm">
              Retry
            </button>
            <Link href="/general" className="text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">
              Start over
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────────────────────

  return (
    <div className="page space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/general"
            className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 mb-1.5 inline-flex items-center gap-1 transition-colors"
          >
            <BackArrowIcon />
            General mode
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Review schema
          </h1>
          <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
            <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
              {selectedCount} of {columns.length} column{columns.length !== 1 ? "s" : ""} selected
            </span>
            {aiCount > 0 && (
              <span className="badge bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400">
                {aiCount} AI suggested
              </span>
            )}
            {customCount > 0 && (
              <span className="badge bg-aubergine-50 dark:bg-aubergine-950/20 border-aubergine-200 dark:border-aubergine-900 text-aubergine-900 dark:text-aubergine-400">
                {customCount} custom
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowContext((v) => !v)}
          className="btn-ghost text-xs hidden lg:inline-flex"
        >
          {showContext ? "Hide context" : "Show context"}
        </button>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className={showContext ? "grid gap-5 lg:grid-cols-[1fr_340px] items-start" : ""}>

        {/* ── Schema editor ──────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Column table */}
          <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 shadow-card overflow-hidden">
            {/* Table header */}
            <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  Extraction columns
                </h2>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                  Check to include · click name to rename · select type · add your own.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Templates dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTemplatePanel((p) => p ? null : "menu")}
                    className="btn-ghost text-xs flex items-center gap-1"
                  >
                    Templates
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {templatePanel === "menu" && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg z-10 py-1 text-xs">
                      <button
                        type="button"
                        onClick={openPicker}
                        className="w-full text-left px-3 py-2 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300"
                      >
                        Apply template…
                      </button>
                      <button
                        type="button"
                        onClick={openSave}
                        className="w-full text-left px-3 py-2 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300"
                      >
                        Save as template…
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={resetToProposal}
                  className="btn-ghost text-xs"
                  title="Discard all edits and restore the AI suggestion"
                >
                  Reset to AI
                </button>
                <button
                  type="button"
                  onClick={addColumn}
                  className="btn-secondary text-xs py-1.5"
                >
                  + Add column
                </button>
              </div>
            </div>

            {/* Applied template banner */}
            {appliedTemplate && templatePanel === null && (
              <div className="px-5 py-2.5 bg-aubergine-50 dark:bg-aubergine-950/20 border-b border-aubergine-100 dark:border-aubergine-900 flex items-center justify-between gap-2">
                <p className="text-xs text-aubergine-900 dark:text-aubergine-400">
                  Template: <span className="font-semibold">{appliedTemplate.name}</span>
                  <span className="ml-1.5 text-aubergine-700 dark:text-aubergine-800">v{appliedTemplate.version}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setAppliedTemplate(null)}
                  className="text-2xs text-aubergine-700 dark:text-aubergine-800 hover:text-aubergine-900 dark:hover:text-aubergine-400"
                >
                  clear
                </button>
              </div>
            )}

            {/* Template picker panel */}
            {templatePanel === "picker" && (
              <div className="border-b border-stone-100 dark:border-stone-800 p-4 space-y-3 bg-stone-50 dark:bg-stone-800/40">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">Apply a template</p>
                  <button type="button" onClick={closeTemplatePanel} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                {templatesLoading && (
                  <p className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-2">
                    <Spinner className="text-aubergine-700" /> Loading templates…
                  </p>
                )}
                {!templatesLoading && templates && templates.length === 0 && (
                  <p className="text-xs text-stone-400 dark:text-stone-500 italic py-1">
                    No saved templates yet. Use "Save as template…" after reviewing a schema.
                  </p>
                )}
                {!templatesLoading && templates && templates.length > 0 && (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {templates.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-start justify-between gap-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-stone-800 dark:text-stone-200 truncate">{t.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-2xs text-stone-400 dark:text-stone-500 tabular-nums">
                              {t.columns.length} columns · v{t.version}
                            </span>
                            <span className={`text-2xs px-1 py-px rounded border ${
                              t.visibility === "workspace"
                                ? "bg-aubergine-50 dark:bg-aubergine-950/20 border-aubergine-200 dark:border-aubergine-900 text-aubergine-900 dark:text-aubergine-400"
                                : "bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-400 dark:text-stone-500"
                            }`}>
                              {t.visibility}
                            </span>
                          </div>
                          {t.description && (
                            <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5 truncate">{t.description}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => applyTemplate(t)}
                          className="btn-secondary text-xs py-1 flex-shrink-0"
                        >
                          Apply
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Save-as-template panel */}
            {templatePanel === "save" && (
              <div className="border-b border-stone-100 dark:border-stone-800 p-4 space-y-3 bg-stone-50 dark:bg-stone-800/40">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">Save as template</p>
                  <button type="button" onClick={closeTemplatePanel} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {saveTemplateDone ? (
                  <p className="text-xs text-aubergine-800 dark:text-aubergine-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Saved as "{saveTemplateDone}"
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Template name"
                        value={saveTemplateName}
                        onChange={(e) => setSaveTemplateName(e.target.value)}
                        className="input text-xs w-full"
                      />
                      <textarea
                        placeholder="Description (optional)"
                        value={saveTemplateDesc}
                        onChange={(e) => setSaveTemplateDesc(e.target.value)}
                        rows={2}
                        className="textarea text-xs w-full"
                      />
                      <div className="flex items-center gap-4 text-xs text-stone-600 dark:text-stone-400">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="visibility"
                            value="private"
                            checked={saveTemplateVis === "private"}
                            onChange={() => setSaveTemplateVis("private")}
                            className="h-3 w-3 text-aubergine-800"
                          />
                          Private
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="visibility"
                            value="workspace"
                            checked={saveTemplateVis === "workspace"}
                            onChange={() => setSaveTemplateVis("workspace")}
                            className="h-3 w-3 text-aubergine-800"
                          />
                          Workspace
                        </label>
                      </div>
                    </div>
                    {saveTemplateErr && (
                      <p className="text-2xs text-red-500 dark:text-red-400">{saveTemplateErr}</p>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      disabled={savingTemplate}
                      className="btn-primary text-xs py-1.5 flex items-center gap-1.5"
                    >
                      {savingTemplate && <Spinner className="text-white/80" />}
                      Save template
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Column rows */}
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {columns.length === 0 ? (
                <p className="text-sm text-stone-400 dark:text-stone-500 italic py-10 text-center">
                  No columns yet.{" "}
                  <button type="button" onClick={addColumn} className="underline hover:text-stone-600 dark:hover:text-stone-300">
                    Add one
                  </button>
                  {" "}or reset to AI suggestion.
                </p>
              ) : (
                columns.map((col) => (
                  <ColumnRow
                    key={col.id}
                    column={col}
                    error={errors[col.id]}
                    onToggle={() => toggleSelected(col.id)}
                    onUpdate={(patch) => updateColumn(col.id, patch)}
                    onRemove={() => removeColumn(col.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Global validation message */}
          {globalError && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
              </svg>
              {globalError}
            </p>
          )}

          {/* Footer action bar */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <Link
              href="/general"
              className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors inline-flex items-center gap-1"
            >
              <BackArrowIcon />
              Start over
            </Link>
            <button
              type="button"
              onClick={handleExtract}
              disabled={extracting || selectedCount === 0}
              className="btn-primary py-2.5 px-5 text-sm"
            >
              {extracting && <Spinner className="text-white/80" />}
              Extract{selectedCount > 0 ? ` ${selectedCount} columns` : ""} →
            </button>
          </div>
        </div>

        {/* ── Context panel ──────────────────────────────────────────────── */}
        {showContext && (
          <aside className="space-y-4">

            {/* AI rationale */}
            {rationale && (
              <div className="card p-4 space-y-2">
                <p className="section-label">Why these columns</p>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  {rationale}
                </p>
                {modelUsed && (
                  <p className="text-2xs text-stone-400 dark:text-stone-500 tabular-nums pt-1 border-t border-stone-100 dark:border-stone-800 mt-2">
                    Generated by {modelUsed}
                  </p>
                )}
              </div>
            )}

            {/* Transcript viewer */}
            <div className="card overflow-hidden">
              <button
                onClick={() => setShowTranscript((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors text-left"
              >
                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Source transcript
                  <span className="ml-2 font-normal text-stone-400 dark:text-stone-500 tabular-nums">
                    {charCount.toLocaleString()} chars
                  </span>
                </span>
                <ChevronIcon open={showTranscript} />
              </button>
              {showTranscript && (
                <div className="border-t border-stone-100 dark:border-stone-700 px-4 py-3">
                  {rawText ? (
                    <pre className="whitespace-pre-wrap text-xs text-stone-600 dark:text-stone-400 font-mono leading-relaxed max-h-80 overflow-y-auto">
                      {rawText}
                    </pre>
                  ) : (
                    <p className="text-xs text-stone-400 dark:text-stone-500 italic py-3 text-center">
                      Transcript not available.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Column type legend */}
            <div className="card p-4 space-y-2.5">
              <p className="section-label">Column types</p>
              <div className="space-y-1.5">
                {COLUMN_TYPES.map((t) => (
                  <div key={t} className="flex items-start gap-2.5">
                    <span className={`badge border mt-0.5 flex-shrink-0 ${TYPE_META[t].style}`}>
                      {TYPE_META[t].label}
                    </span>
                    <p className="text-2xs text-stone-500 dark:text-stone-400 leading-snug">
                      {TYPE_HINT[t]}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </aside>
        )}
      </div>

      {/* Mobile context toggle */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setShowContext((v) => !v)}
          className="btn-ghost text-xs w-full justify-center"
        >
          {showContext ? "Hide transcript & context" : "Show transcript & context"}
        </button>
      </div>

    </div>
  );
}

const TYPE_HINT: Record<ColumnType, string> = {
  text:    "A single string — names, quotes, descriptions, titles.",
  number:  "A numeric value — amounts, counts, durations, scores.",
  boolean: "A yes/no fact — whether something happened or was agreed.",
  list:    "Multiple values — people, topics, tasks, tags.",
  date:    "A date, time, or date-time value.",
};

// ─── Column row ───────────────────────────────────────────────────────────────

interface RowProps {
  column:   EditableColumn;
  error?:   string;
  onToggle: () => void;
  onUpdate: (patch: Partial<EditableColumn>) => void;
  onRemove: () => void;
}

function ColumnRow({ column, error, onToggle, onUpdate, onRemove }: RowProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState(column.name);
  const [showDesc,    setShowDesc]    = useState(column.isCustom && !column.name);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) nameRef.current?.select();
  }, [editingName]);

  function startEditName() {
    if (!column.selected) return;
    setNameInput(column.name);
    setEditingName(true);
  }

  function commitName() {
    const slug = toSnakeCase(nameInput);
    onUpdate({ name: slug || nameInput.trim() });
    setEditingName(false);
  }

  function cancelEdit() {
    setNameInput(column.name);
    setEditingName(false);
  }

  const dim = !column.selected;

  return (
    <div className={dim ? "opacity-50" : ""}>
      {/* Main row */}
      <div className="flex items-start gap-3 px-5 py-3">

        {/* Checkbox */}
        <div className="flex-shrink-0 pt-0.5">
          <input
            type="checkbox"
            checked={column.selected}
            onChange={onToggle}
            className="h-3.5 w-3.5 rounded border-stone-300 dark:border-stone-600 text-aubergine-800 focus:ring-aubergine-700 cursor-pointer"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">

          {/* Name + type + required */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Name — inline edit */}
            {editingName ? (
              <input
                ref={nameRef}
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  { e.preventDefault(); commitName(); }
                  if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                }}
                placeholder="column_name"
                className={[
                  "input text-sm py-0.5 px-1.5 h-auto w-44",
                  error ? "border-red-400 dark:border-red-600 focus:border-red-400" : "",
                ].join(" ")}
              />
            ) : (
              <button
                type="button"
                onClick={startEditName}
                title={column.selected ? "Click to rename" : undefined}
                className={[
                  "text-sm font-medium text-left leading-snug",
                  column.selected
                    ? "text-stone-900 dark:text-stone-100 hover:text-aubergine-900 dark:hover:text-aubergine-400 cursor-text"
                    : "text-stone-500 dark:text-stone-500 cursor-default",
                  !column.name ? "italic text-stone-400 dark:text-stone-600" : "",
                ].join(" ")}
              >
                {column.name || "unnamed"}
              </button>
            )}

            {/* Type select */}
            <TypeSelect
              value={column.type}
              disabled={!column.selected}
              onChange={(t) => onUpdate({ type: t })}
            />

            {/* Required toggle */}
            <button
              type="button"
              disabled={!column.selected}
              onClick={() => onUpdate({ required: !column.required })}
              title="Toggle required / optional"
              className={[
                "text-2xs font-semibold px-1.5 py-0.5 rounded border transition-colors",
                column.required
                  ? "bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300"
                  : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-400 dark:text-stone-600",
                column.selected ? "hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer" : "cursor-default",
              ].join(" ")}
            >
              {column.required ? "required" : "optional"}
            </button>

            {/* Custom badge */}
            {column.isCustom && (
              <span className="badge bg-aubergine-50 dark:bg-aubergine-950/20 border-aubergine-200 dark:border-aubergine-900 text-aubergine-900 dark:text-aubergine-400">
                custom
              </span>
            )}
          </div>

          {/* Validation error */}
          {error && (
            <p className="text-2xs text-red-500 dark:text-red-400">{error}</p>
          )}

          {/* Description */}
          {showDesc ? (
            <textarea
              value={column.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              disabled={!column.selected}
              placeholder="Describe what this column captures…"
              rows={2}
              className="textarea text-xs w-full min-h-[44px]"
            />
          ) : (
            column.description && (
              <p
                className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed cursor-pointer hover:text-stone-600 dark:hover:text-stone-300 truncate"
                onClick={() => column.selected && setShowDesc(true)}
                title={column.selected ? "Click to edit description" : undefined}
              >
                {column.description}
              </p>
            )
          )}
        </div>

        {/* Row action buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0 pt-0.5">
          <button
            type="button"
            onClick={() => setShowDesc((v) => !v)}
            title={showDesc ? "Collapse description" : "Edit description"}
            className="w-7 h-7 rounded flex items-center justify-center text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Remove column"
            className="w-7 h-7 rounded flex items-center justify-center text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Type select ──────────────────────────────────────────────────────────────

function TypeSelect({
  value,
  disabled,
  onChange,
}: {
  value:    ColumnType;
  disabled: boolean;
  onChange: (t: ColumnType) => void;
}) {
  return (
    <div className={`badge border relative ${TYPE_META[value].style} ${disabled ? "cursor-default" : "cursor-pointer"}`}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ColumnType)}
        className="absolute inset-0 opacity-0 w-full cursor-pointer disabled:cursor-default"
        aria-label="Column type"
      />
      <span className="pointer-events-none select-none">
        {TYPE_META[value].label}
      </span>
      {!disabled && (
        <svg className="w-2.5 h-2.5 pointer-events-none flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </div>
  );
}

// ─── Icon sub-components ──────────────────────────────────────────────────────

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`w-3.5 h-3.5 animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-stone-400 dark:text-stone-500 transition-transform ${open ? "" : "rotate-180"}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
