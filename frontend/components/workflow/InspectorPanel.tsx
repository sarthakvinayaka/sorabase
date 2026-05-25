"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkflowStoreContext, useWorkflowMode } from "@/lib/workflow-store-context";
import type { LogEntry } from "@/lib/workflow-types";
import type {
  AnyNodeData,
  AnalysisNodeData,
  ExtractionNodeData,
  OutputNodeData,
  SourceNodeData,
  TranscriptNodeData,
  SummaryNodeData,
  SchemaNodeData,
  WorkflowNodeType,
  // Study Mode types
  LecCaptureNodeData,
  LecUploadNodeData,
  TranscriptCleanerNodeData,
  ConceptExtractorNodeData,
  DefinitionExtractorNodeData,
  FormulaExtractorNodeData,
  QuestionGenNodeData,
  FlashcardGenNodeData,
  QuizGenNodeData,
  StudyOutputNodeData,
} from "@/lib/workflow-types";
import { NODE_PALETTE, GENERAL_NODE_PALETTE, STUDY_NODE_PALETTE } from "@/lib/workflow-types";
import SourceInspector from "./inspector/SourceInspector";
import ExtractionInspector from "./inspector/ExtractionInspector";
import AnalysisInspector from "./inspector/AnalysisInspector";
import OutputInspector from "./inspector/OutputInspector";
import TranscriptInspector from "./inspector/TranscriptInspector";
import SummaryInspector from "./inspector/SummaryInspector";
import SchemaInspector from "./inspector/SchemaInspector";
// Study Mode inspectors
import LecCaptureInspector from "./inspector/LecCaptureInspector";
import LecUploadInspector from "./inspector/LecUploadInspector";
import TranscriptCleanerInspector from "./inspector/TranscriptCleanerInspector";
import ConceptExtractorInspector from "./inspector/ConceptExtractorInspector";
import DefinitionExtractorInspector from "./inspector/DefinitionExtractorInspector";
import FormulaExtractorInspector from "./inspector/FormulaExtractorInspector";
import QuestionGenInspector from "./inspector/QuestionGenInspector";
import FlashcardGenInspector from "./inspector/FlashcardGenInspector";
import QuizGenInspector from "./inspector/QuizGenInspector";
import StudyOutputInspector from "./inspector/StudyOutputInspector";

const MIN_WIDTH = 240;
const MAX_WIDTH = 580;
const DEFAULT_WIDTH = 288;

const TYPE_LABEL: Record<WorkflowNodeType, string> = {
  source:     "Source",
  extraction: "Extraction",
  analysis:   "Analysis",
  output:     "Output",
  transcript: "Transcript",
  summary:    "Summary",
  schema:     "Schema",
  // Study Mode
  lec_capture:          "Lecture Capture",
  lec_upload:           "Lecture Upload",
  transcript_cleaner:   "Transcript Cleaner",
  concept_extractor:    "Concept Extractor",
  definition_extractor: "Definition Extractor",
  formula_extractor:    "Formula Extractor",
  question_gen:         "Questions",
  flashcard_gen:        "Flashcard Generator",
  quiz_gen:             "Quiz Generator",
  study_output:         "Study Pack Output",
};

const TYPE_META: Record<WorkflowNodeType, { icon: string; accent: string }> = {
  source:     { icon: "◎", accent: "text-stone-400"    },
  extraction: { icon: "⊞", accent: "text-aubergine-800"     },
  analysis:   { icon: "◈", accent: "text-amber-600"    },
  output:     { icon: "↑", accent: "text-positive-text" },
  transcript: { icon: "≡", accent: "text-blue-500"     },
  summary:    { icon: "◈", accent: "text-amber-500"    },
  schema:     { icon: "⊟", accent: "text-violet-500"   },
  // Study Mode
  lec_capture:          { icon: "◎", accent: "text-stone-400"    },
  lec_upload:           { icon: "⇡", accent: "text-stone-500"    },
  transcript_cleaner:   { icon: "≋", accent: "text-sky-500"      },
  concept_extractor:    { icon: "◈", accent: "text-violet-500"   },
  definition_extractor: { icon: "⊟", accent: "text-violet-400"   },
  formula_extractor:    { icon: "∑", accent: "text-violet-500"   },
  question_gen:         { icon: "?", accent: "text-aubergine-600" },
  flashcard_gen:        { icon: "⊞", accent: "text-aubergine-600" },
  quiz_gen:             { icon: "✦", accent: "text-aubergine-600" },
  study_output:         { icon: "↑", accent: "text-emerald-600"  },
};

export default function InspectorPanel() {
  const nodes                  = useWorkflowStoreContext((s) => s.nodes);
  const selectedNodeId         = useWorkflowStoreContext((s) => s.selectedNodeId);
  const selectedLibraryNodeType = useWorkflowStoreContext((s) => s.selectedLibraryNodeType);
  const runState               = useWorkflowStoreContext((s) => s.runState);
  const logEntries             = useWorkflowStoreContext((s) => s.logEntries);
  const selectedNode            = nodes.find((n) => n.id === selectedNodeId);
  const { mode }               = useWorkflowMode();

  const [width, setWidth]    = useState(DEFAULT_WIDTH);
  const dragging             = useRef(false);
  const startX               = useRef(0);
  const startWidth           = useRef(DEFAULT_WIDTH);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current   = true;
    startX.current     = e.clientX;
    startWidth.current = width;
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX;
      const next  = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(next);
    }
    function onMouseUp() {
      if (!dragging.current) return;
      dragging.current               = false;
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  }, []);

  return (
    <aside
      style={{ width }}
      className="flex-shrink-0 flex flex-row bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-700 overflow-hidden"
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="w-px flex-shrink-0 cursor-col-resize bg-stone-200 dark:bg-stone-700 hover:bg-aubergine-400 dark:hover:bg-aubergine-800 transition-colors relative"
      >
        <div className="absolute inset-y-0 -left-2 -right-2" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedNode ? (
          <SelectedState
            id={selectedNode.id}
            type={selectedNode.type as WorkflowNodeType}
            data={selectedNode.data as AnyNodeData}
          />
        ) : selectedLibraryNodeType ? (
          <LibraryNodePreview type={selectedLibraryNodeType} mode={mode} />
        ) : (runState === "running" || runState === "completed" || runState === "error") ? (
          <RunProgressPanel nodes={nodes} runState={runState} logEntries={logEntries} />
        ) : (
          <EmptyState />
        )}
      </div>
    </aside>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-9 h-9 rounded-md bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-3">
        <span className="text-stone-300 dark:text-stone-600 text-base font-mono">▣</span>
      </div>
      <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
        No node selected
      </p>
      <p className="text-2xs text-stone-400 dark:text-stone-500 mt-1 leading-relaxed">
        Click a node in the left panel to preview it, or click any canvas node to configure it.
      </p>
    </div>
  );
}

// ── Run Progress Panel ─────────────────────────────────────────────────────────

const LOG_LEVEL_DOT: Record<string, string> = {
  info:    "bg-stone-300 dark:bg-stone-600",
  success: "bg-positive-DEFAULT",
  warn:    "bg-amber-400",
  error:   "bg-negative-DEFAULT",
};

interface RunProgressPanelProps {
  nodes: Array<{ id: string; type?: string; data: unknown }>;
  runState: string;
  logEntries: LogEntry[];
}

function RunProgressPanel({ nodes, runState, logEntries }: RunProgressPanelProps) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const recentLogs = logEntries.slice(-40);

  // Auto-scroll log to bottom when new entries arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logEntries.length]);

  // Compute per-node step status for the step list
  const steps = nodes.map((n) => {
    const d = n.data as { status?: string; label?: string };
    return { id: n.id, type: n.type ?? "", status: d.status ?? "idle" };
  });

  const runningStep = steps.find((s) => s.status === "running");

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 dark:border-stone-800 flex-shrink-0 min-h-[44px]">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            runState === "running"   ? "bg-aubergine-500 animate-pulse" :
            runState === "completed" ? "bg-positive-DEFAULT" :
            "bg-negative-DEFAULT"
          }`} />
          <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
            {runState === "running" ? "Running" : runState === "completed" ? "Completed" : "Failed"}
          </p>
        </div>
        {runningStep && (
          <span className="text-2xs text-stone-400 dark:text-stone-500 font-mono truncate max-w-[120px]">
            {TYPE_LABEL[runningStep.type as WorkflowNodeType] ?? runningStep.type}
          </span>
        )}
      </div>

      {/* Step list */}
      <div className="px-4 pt-3 pb-2 border-b border-stone-100 dark:border-stone-800 flex-shrink-0">
        <p className="text-2xs font-semibold tracking-label uppercase text-stone-400 dark:text-stone-500 mb-2">Steps</p>
        <div className="space-y-1.5">
          {steps.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                s.status === "running"   ? "bg-aubergine-500 animate-pulse" :
                s.status === "completed" ? "bg-positive-DEFAULT" :
                s.status === "error"     ? "bg-negative-DEFAULT" :
                s.status === "configured" ? "bg-aubergine-400" :
                "bg-stone-300 dark:bg-stone-600"
              }`} />
              <span className={`text-2xs ${
                s.status === "running" ? "text-stone-700 dark:text-stone-200 font-medium" :
                s.status === "completed" ? "text-stone-500 dark:text-stone-400" :
                "text-stone-400 dark:text-stone-600"
              }`}>
                {TYPE_LABEL[s.type as WorkflowNodeType] ?? s.type}
              </span>
              {s.status === "running" && (
                <span className="text-2xs text-aubergine-500 dark:text-aubergine-400 ml-auto">running…</span>
              )}
              {s.status === "completed" && (
                <span className="text-2xs text-positive-text dark:text-positive-DEFAULT ml-auto">done</span>
              )}
              {s.status === "error" && (
                <span className="text-2xs text-negative-text dark:text-negative-DEFAULT ml-auto">error</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Log stream */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-2xs font-semibold tracking-label uppercase text-stone-400 dark:text-stone-500 mb-2">Log</p>
        <div className="space-y-1">
          {recentLogs.map((entry) => (
            <div key={entry.id} className="flex items-start gap-1.5">
              <div className={`w-1 h-1 rounded-full flex-shrink-0 mt-[5px] ${LOG_LEVEL_DOT[entry.level] ?? LOG_LEVEL_DOT.info}`} />
              <span className={`text-2xs leading-relaxed break-words ${
                entry.level === "error" ? "text-negative-text dark:text-negative-DEFAULT" :
                entry.level === "warn"  ? "text-amber-600 dark:text-amber-400" :
                entry.level === "success" ? "text-positive-text dark:text-positive-DEFAULT" :
                "text-stone-500 dark:text-stone-400"
              }`}>
                {entry.message}
              </span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </>
  );
}

interface LibraryNodePreviewProps { type: WorkflowNodeType; mode: string }

const NODE_DESCRIPTIONS: Record<WorkflowNodeType, string[]> = {
  source:     ["Accepts transcript text, audio file, Zoom recording, or a live meeting bot.", "Connect to any downstream processing node."],
  extraction: ["Runs an AI extraction pipeline over the transcript.", "Produces a structured data record based on your schema."],
  analysis:   ["Scores the candidate against a job description.", "Returns tier (A/B/C/D) and rationale for each criterion."],
  output:     ["Packages results and delivers them to the dashboard.", "Optionally exports JSON, CSV, or calls a webhook."],
  transcript: ["Holds the cleaned conversation text.", "Feeds downstream schema and extraction nodes."],
  summary:    ["Generates an AI narrative summary of the conversation.", "Appears in the results view alongside extracted data."],
  schema:     ["Proposes structured columns based on the transcript.", "Columns can be reviewed and edited before extraction runs."],
  // Study Mode
  lec_capture:          ["Accepts a lecture transcript via paste, browser capture extension, or Zoom bot.", "Set the lecture title, course name, and date before connecting downstream nodes."],
  lec_upload:           ["Upload an audio recording, PDF lecture notes, or a Markdown document.", "The file is transcribed automatically before reaching extraction nodes."],
  transcript_cleaner:   ["Normalises the raw lecture transcript before extraction.", "Choose a preset — Lecture, Seminar, or Verbatim — and configure filler removal and speaker label fixing."],
  concept_extractor:    ["Identifies the most important concepts discussed in the lecture.", "Configure the maximum count and confidence threshold. Evidence snippets attach the supporting transcript passage."],
  definition_extractor: ["Extracts term → definition pairs: formal definitions, glossary terms, and explained jargon.", "Connect to Flashcard Generator or Quiz Generator to turn definitions into study material."],
  formula_extractor:    ["Pulls mathematical formulas and symbolic notation from the lecture.", "Optionally includes units and step-by-step derivations where the lecturer walks through the proof."],
  question_gen:         ["Generates exam-style, short-answer, compare/contrast, and applied-scenario questions.", "Choose a template (Exam prep, Lecture notes, Deep study, Quick review) and configure which question types to include."],
  flashcard_gen:        ["Builds a flashcard deck from all upstream extracted content.", "Select which sources (concepts, definitions, formulas, Q&A, topics) contribute to the deck and set the card cap."],
  quiz_gen:             ["Creates a multi-format quiz from extracted content.", "Supports MCQ, True/False, Short answer, Matching, and Fill in the blank. Configure difficulty mix and question count."],
  study_output:         ["Archives the lecture and packages all study materials.", "Optionally auto-archives on run and exports to JSON, CSV, or Anki deck format."],
};

function LibraryNodePreview({ type, mode }: LibraryNodePreviewProps) {
  const addNodeAuto            = useWorkflowStoreContext((s) => s.addNodeAuto);
  const setSelectedLibraryNode = useWorkflowStoreContext((s) => s.setSelectedLibraryNode);
  const palette = mode === "study" ? STUDY_NODE_PALETTE : mode === "general" ? GENERAL_NODE_PALETTE : NODE_PALETTE;
  const item    = palette.find((p) => p.type === type);
  const meta                   = TYPE_META[type];
  const descriptions           = NODE_DESCRIPTIONS[type];

  function handleAdd() {
    addNodeAuto(type);
    // addNodeAuto already clears selectedLibraryNodeType and sets selectedNodeId
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 dark:border-stone-800 flex-shrink-0 min-h-[44px]">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-mono leading-none ${meta.accent}`}>{meta.icon}</span>
          <div>
            <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              {item?.label ?? TYPE_LABEL[type]}
            </p>
            <p className="text-2xs text-stone-400 dark:text-stone-500">library preview</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSelectedLibraryNode(null)}
          title="Close preview"
          className="w-6 h-6 rounded flex items-center justify-center text-stone-300 dark:text-stone-600 hover:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <div className="space-y-2">
          {descriptions.map((line, i) => (
            <p key={i} className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              {line}
            </p>
          ))}
        </div>

        {item?.description && (
          <p className="text-2xs text-stone-400 dark:text-stone-500 italic leading-relaxed border-t border-stone-100 dark:border-stone-800 pt-3">
            {item.description}
          </p>
        )}

        <div className="pt-1 border-t border-stone-100 dark:border-stone-800">
          <button
            type="button"
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-medium bg-aubergine-600 hover:bg-aubergine-700 text-white transition-colors"
          >
            <span>Add to canvas</span>
            <span className="text-aubergine-300">→</span>
          </button>
          <p className="text-2xs text-stone-400 dark:text-stone-500 text-center mt-2">
            or drag from the left panel
          </p>
        </div>
      </div>
    </>
  );
}

interface SelectedStateProps { id: string; type: WorkflowNodeType; data: AnyNodeData }

function SelectedState({ id, type, data }: SelectedStateProps) {
  const meta       = TYPE_META[type];
  const removeNode = useWorkflowStoreContext((s) => s.removeNode);
  const { coreNodeIds } = useWorkflowMode();
  const isCore     = coreNodeIds.has(id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset when the selected node changes
  useEffect(() => { setConfirmDelete(false); }, [id]);

  // Auto-cancel confirm after 4 s so the UI doesn't get stuck
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 dark:border-stone-800 flex-shrink-0 min-h-[44px]">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-mono leading-none ${meta.accent}`}>{meta.icon}</span>
          <div>
            <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              {TYPE_LABEL[type]}
            </p>
            <p className="text-2xs text-stone-400 dark:text-stone-500 font-mono">{id.slice(0, 8)}</p>
          </div>
        </div>

        {isCore ? (
          // Core nodes are permanently required — show a lock instead of a delete button
          <div
            title="Core node — required by the workflow"
            className="w-6 h-6 rounded flex items-center justify-center text-stone-300 dark:text-stone-600 cursor-default"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        ) : confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-red-400 font-medium whitespace-nowrap">Delete node?</span>
            <button
              type="button"
              onClick={() => removeNode(id)}
              className="text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded transition-colors"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-[10px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 px-1 py-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            title="Delete node"
            className="w-6 h-6 rounded flex items-center justify-center text-stone-300 dark:text-stone-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {type === "source"              && <SourceInspector              id={id} data={data as SourceNodeData}              />}
        {type === "extraction"         && <ExtractionInspector         id={id} data={data as ExtractionNodeData}         />}
        {type === "analysis"           && <AnalysisInspector           id={id} data={data as AnalysisNodeData}           />}
        {type === "output"             && <OutputInspector             id={id} data={data as OutputNodeData}             />}
        {type === "transcript"         && <TranscriptInspector         id={id} data={data as TranscriptNodeData}         />}
        {type === "summary"            && <SummaryInspector            id={id} data={data as SummaryNodeData}            />}
        {type === "schema"             && <SchemaInspector             id={id} data={data as SchemaNodeData}             />}
        {/* Study Mode */}
        {type === "lec_capture"          && <LecCaptureInspector          id={id} data={data as LecCaptureNodeData}          />}
        {type === "lec_upload"           && <LecUploadInspector           id={id} data={data as LecUploadNodeData}           />}
        {type === "transcript_cleaner"   && <TranscriptCleanerInspector   id={id} data={data as TranscriptCleanerNodeData}   />}
        {type === "concept_extractor"    && <ConceptExtractorInspector    id={id} data={data as ConceptExtractorNodeData}    />}
        {type === "definition_extractor" && <DefinitionExtractorInspector id={id} data={data as DefinitionExtractorNodeData} />}
        {type === "formula_extractor"    && <FormulaExtractorInspector    id={id} data={data as FormulaExtractorNodeData}    />}
        {type === "question_gen"         && <QuestionGenInspector         id={id} data={data as QuestionGenNodeData}         />}
        {type === "flashcard_gen"        && <FlashcardGenInspector        id={id} data={data as FlashcardGenNodeData}        />}
        {type === "quiz_gen"             && <QuizGenInspector             id={id} data={data as QuizGenNodeData}             />}
        {type === "study_output"         && <StudyOutputInspector         id={id} data={data as StudyOutputNodeData}         />}
      </div>
    </>
  );
}
