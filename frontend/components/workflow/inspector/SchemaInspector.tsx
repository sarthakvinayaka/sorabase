"use client";

import { useState } from "react";
import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import { proposeSchema, listTemplates, createTemplate, updateTemplate } from "@/lib/api";
import type { SchemaNodeData, TranscriptNodeData } from "@/lib/workflow-types";
import type { ColumnType, ProposedColumn, SchemaTemplate } from "@/lib/types";

interface Props { id: string; data: SchemaNodeData }

const TYPE_OPTIONS: { value: ColumnType; label: string }[] = [
  { value: "text",    label: "Text"    },
  { value: "number",  label: "Number"  },
  { value: "boolean", label: "Boolean" },
  { value: "list",    label: "List"    },
  { value: "date",    label: "Date"    },
];

export default function SchemaInspector({ id, data }: Props) {
  const update    = useWorkflowStoreContext((s) => s.updateNodeData);
  const nodes     = useWorkflowStoreContext((s) => s.nodes);

  // Working columns — editable copy before user approves
  const [columns, setColumns] = useState<ProposedColumn[]>(data.columns);

  // Keep local columns in sync when node data changes externally (e.g. after AI proposal)
  const dataColsJson = JSON.stringify(data.columns);
  const [lastSyncJson, setLastSyncJson] = useState(dataColsJson);
  if (dataColsJson !== lastSyncJson) {
    setColumns(data.columns);
    setLastSyncJson(dataColsJson);
  }

  const [proposing,     setProposing]     = useState(false);
  const [proposeError,  setProposeError]  = useState("");
  const [templates,     setTemplates]     = useState<SchemaTemplate[]>([]);
  const [loadingTmpl,   setLoadingTmpl]   = useState(false);
  const [templateOpen,  setTemplateOpen]  = useState(false);
  const [saveName,      setSaveName]      = useState("");
  const [saving,        setSaving]        = useState(false);
  const [saveMsg,       setSaveMsg]       = useState("");

  // Find conversation ID from the transcript or source node for AI proposal
  const transcriptNode = nodes.find((n) => n.type === "transcript");
  const transcriptData = transcriptNode?.data as unknown as TranscriptNodeData | undefined;
  const conversationId = transcriptData?.conversationId
    ?? (nodes.find((n) => n.type === "source")?.data as Record<string, unknown> | undefined)?.conversationId as string | undefined
    ?? (nodes.find((n) => n.type === "source")?.data as Record<string, unknown> | undefined)?.zoomConversationId as string | undefined;

  // ── AI Proposal ─────────────────────────────────────────────────────────────

  async function handlePropose() {
    if (!conversationId) {
      setProposeError("Run the workflow first to create a transcript, then propose schema.");
      return;
    }
    setProposeError("");
    setProposing(true);
    try {
      const proposal = await proposeSchema(conversationId);
      setColumns(proposal.columns);
      update(id, {
        columns:      proposal.columns,
        rationale:    proposal.rationale,
        schemaStatus: "proposed",
        status:       "idle",
      });
    } catch {
      setProposeError("Failed to propose schema. Try again or configure manually.");
    } finally {
      setProposing(false);
    }
  }

  // ── Template load / save ────────────────────────────────────────────────────

  async function handleOpenTemplates() {
    setTemplateOpen(true);
    setLoadingTmpl(true);
    try {
      const list = await listTemplates();
      setTemplates(list);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTmpl(false);
    }
  }

  function handleLoadTemplate(tmpl: SchemaTemplate) {
    setColumns(tmpl.columns);
    update(id, {
      columns:         tmpl.columns,
      templateId:      tmpl.id,
      templateVersion: tmpl.version,
      schemaStatus:    "approved",
      status:          "configured",
    });
    setTemplateOpen(false);
  }

  async function handleSaveTemplate() {
    if (!saveName.trim() || columns.length === 0) return;
    setSaving(true);
    setSaveMsg("");
    try {
      if (data.templateId) {
        await updateTemplate(data.templateId, { name: saveName.trim(), columns });
        setSaveMsg("Template updated.");
      } else {
        const tmpl = await createTemplate({ name: saveName.trim(), description: null, visibility: "private", columns });
        update(id, { templateId: tmpl.id, templateVersion: tmpl.version });
        setSaveMsg("Template saved.");
      }
      setSaveName("");
    } catch {
      setSaveMsg("Failed to save template.");
    } finally {
      setSaving(false);
    }
  }

  // ── Column editing ──────────────────────────────────────────────────────────

  function updateColumn(i: number, patch: Partial<ProposedColumn>) {
    setColumns((prev) => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }

  function removeColumn(i: number) {
    setColumns((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addColumn() {
    setColumns((prev) => [
      ...prev,
      { name: `field_${prev.length + 1}`, description: "", type: "text", required: false },
    ]);
  }

  // ── Approve ─────────────────────────────────────────────────────────────────

  function handleApprove() {
    update(id, {
      columns:      columns,
      schemaStatus: "approved",
      status:       "configured",
    });
  }

  const canApprove = columns.length >= 1 && columns.every((c) => c.name.trim().length > 0);
  const isApproved = data.schemaStatus === "approved";

  return (
    <div className="space-y-5">

      {/* ── AI Proposal ──────────────────────────────────────────────────── */}
      <Field label="AI schema proposal">
        <button
          type="button"
          onClick={handlePropose}
          disabled={proposing || !conversationId}
          className={[
            "w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            proposing || !conversationId
              ? "opacity-40 cursor-not-allowed border-stone-200 dark:border-stone-700 text-stone-400"
              : "border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 hover:bg-violet-100 dark:hover:bg-violet-950/40",
          ].join(" ")}
        >
          {proposing ? "Proposing…" : "Propose with AI"}
        </button>
        {proposeError && (
          <p className="text-[10px] text-red-500 mt-1">{proposeError}</p>
        )}
        {!conversationId && (
          <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">
            Run the workflow first to generate a transcript, then propose a schema.
          </p>
        )}
        {data.rationale && (
          <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1.5 leading-relaxed">
            {data.rationale}
          </p>
        )}
      </Field>

      {/* ── Load template ────────────────────────────────────────────────── */}
      <Field label="Load template">
        {!templateOpen ? (
          <button
            type="button"
            onClick={handleOpenTemplates}
            className="w-full rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs font-medium text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600 transition-colors text-left"
          >
            Browse saved templates…
          </button>
        ) : (
          <div className="space-y-1.5">
            {loadingTmpl && (
              <p className="text-[10px] text-stone-400 dark:text-stone-500">Loading…</p>
            )}
            {!loadingTmpl && templates.length === 0 && (
              <p className="text-[10px] text-stone-400 dark:text-stone-500">No templates saved yet.</p>
            )}
            {templates.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleLoadTemplate(tmpl)}
                className="w-full text-left rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 hover:border-aubergine-400 dark:hover:border-aubergine-800 transition-colors"
              >
                <p className="text-xs font-medium text-stone-700 dark:text-stone-300">{tmpl.name}</p>
                <p className="text-[10px] text-stone-400 dark:text-stone-500">
                  {tmpl.columns.length} columns · v{tmpl.version}
                </p>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTemplateOpen(false)}
              className="text-[10px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              ← Back
            </button>
          </div>
        )}
      </Field>

      {/* ── Column editor ────────────────────────────────────────────────── */}
      <Field
        label="Columns"
        hint={`${columns.length} column${columns.length !== 1 ? "s" : ""}`}
      >
        {columns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-4 py-5 text-center">
            <p className="text-xs text-stone-400 dark:text-stone-500">
              No columns yet. Propose with AI or add manually.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {columns.map((col, i) => (
              <div
                key={i}
                className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2.5 space-y-2"
              >
                {/* Name */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 min-w-0 rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 py-1 text-xs font-mono text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-violet-400"
                    placeholder="field_name"
                    value={col.name}
                    onChange={(e) => updateColumn(i, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeColumn(i)}
                    title="Remove column"
                    className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-stone-300 dark:text-stone-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    ×
                  </button>
                </div>

                {/* Description */}
                <input
                  type="text"
                  className="w-full rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 py-1 text-xs text-stone-600 dark:text-stone-400 focus:outline-none focus:ring-1 focus:ring-violet-400 placeholder:text-stone-300"
                  placeholder="Description…"
                  value={col.description}
                  onChange={(e) => updateColumn(i, { description: e.target.value })}
                />

                {/* Type + Required */}
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 py-1 text-xs text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-violet-400"
                    value={col.type}
                    onChange={(e) => updateColumn(i, { type: e.target.value as ColumnType })}
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={col.required}
                      onChange={(e) => updateColumn(i, { required: e.target.checked })}
                    />
                    <div className={[
                      "w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors",
                      col.required
                        ? "border-violet-500 bg-violet-500"
                        : "border-stone-300 dark:border-stone-600",
                    ].join(" ")}>
                      {col.required && (
                        <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="2">
                          <path d="M2 5l2.5 2.5 3.5-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400">Required</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addColumn}
          className="mt-2 w-full rounded-lg border border-dashed border-stone-200 dark:border-stone-700 px-3 py-1.5 text-xs text-stone-400 dark:text-stone-500 hover:border-violet-300 dark:hover:border-violet-700 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
        >
          + Add column
        </button>
      </Field>

      {/* ── Save template ────────────────────────────────────────────────── */}
      {columns.length > 0 && (
        <Field label="Save as template" hint="optional">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 min-w-0 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-1.5 text-xs text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-aubergine-700"
              placeholder="Template name…"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={saving || !saveName.trim()}
              className="rounded-lg border border-aubergine-300 dark:border-aubergine-900 bg-aubergine-50 dark:bg-aubergine-950/20 px-3 py-1.5 text-xs font-medium text-aubergine-900 dark:text-aubergine-400 hover:bg-aubergine-100 dark:hover:bg-aubergine-950/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          {saveMsg && (
            <p className="text-[10px] text-aubergine-800 dark:text-aubergine-400 mt-1">{saveMsg}</p>
          )}
        </Field>
      )}

      {/* ── Approve ──────────────────────────────────────────────────────── */}
      <div className="pt-1">
        {isApproved ? (
          <div className="rounded-lg border border-aubergine-200 dark:border-aubergine-900 bg-aubergine-50 dark:bg-aubergine-950/20 px-3 py-2.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-aubergine-900 dark:text-aubergine-400">
                Schema approved
              </p>
              <p className="text-[10px] text-aubergine-800/70 dark:text-aubergine-700/70 mt-0.5">
                {columns.length} columns · ready for extraction
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setColumns(data.columns);
                update(id, { schemaStatus: "proposed", status: "idle" });
              }}
              className="text-[10px] text-aubergine-700 hover:text-aubergine-900 dark:hover:text-aubergine-300 font-medium transition-colors flex-shrink-0 ml-3"
            >
              Edit
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleApprove}
            disabled={!canApprove}
            className={[
              "w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
              canApprove
                ? "bg-aubergine-800 hover:bg-aubergine-900 text-white"
                : "bg-stone-100 dark:bg-stone-800 text-stone-300 dark:text-stone-600 cursor-not-allowed",
            ].join(" ")}
          >
            ▶ Approve Schema
          </button>
        )}
        {!canApprove && columns.length === 0 && (
          <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1.5 text-center">
            Add at least one column to approve.
          </p>
        )}
      </div>

    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
          {label}
        </span>
        {hint && <span className="text-[10px] text-stone-400 dark:text-stone-500 tabular-nums">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
