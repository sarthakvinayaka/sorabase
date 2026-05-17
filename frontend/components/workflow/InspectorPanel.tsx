"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkflowStoreContext, useWorkflowMode } from "@/lib/workflow-store-context";
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
} from "@/lib/workflow-types";
import SourceInspector from "./inspector/SourceInspector";
import ExtractionInspector from "./inspector/ExtractionInspector";
import AnalysisInspector from "./inspector/AnalysisInspector";
import OutputInspector from "./inspector/OutputInspector";
import TranscriptInspector from "./inspector/TranscriptInspector";
import SummaryInspector from "./inspector/SummaryInspector";
import SchemaInspector from "./inspector/SchemaInspector";

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
};

const TYPE_META: Record<WorkflowNodeType, { icon: string; accent: string }> = {
  source:     { icon: "◎", accent: "text-stone-400"    },
  extraction: { icon: "⊞", accent: "text-teal-600"     },
  analysis:   { icon: "◈", accent: "text-amber-600"    },
  output:     { icon: "↑", accent: "text-positive-text" },
  transcript: { icon: "≡", accent: "text-blue-500"     },
  summary:    { icon: "◈", accent: "text-amber-500"    },
  schema:     { icon: "⊟", accent: "text-violet-500"   },
};

export default function InspectorPanel() {
  const nodes          = useWorkflowStoreContext((s) => s.nodes);
  const selectedNodeId = useWorkflowStoreContext((s) => s.selectedNodeId);
  const selectedNode   = nodes.find((n) => n.id === selectedNodeId);

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
        className="w-px flex-shrink-0 cursor-col-resize bg-stone-200 dark:bg-stone-700 hover:bg-teal-400 dark:hover:bg-teal-600 transition-colors relative"
      >
        <div className="absolute inset-y-0 -left-2 -right-2" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedNode ? <EmptyState /> : (
          <SelectedState
            id={selectedNode.id}
            type={selectedNode.type as WorkflowNodeType}
            data={selectedNode.data as AnyNodeData}
          />
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
        Click any node on the canvas to configure it here.
      </p>
    </div>
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
        {type === "source"     && <SourceInspector     id={id} data={data as SourceNodeData}     />}
        {type === "extraction" && <ExtractionInspector id={id} data={data as ExtractionNodeData} />}
        {type === "analysis"   && <AnalysisInspector   id={id} data={data as AnalysisNodeData}   />}
        {type === "output"     && <OutputInspector     id={id} data={data as OutputNodeData}      />}
        {type === "transcript" && <TranscriptInspector id={id} data={data as TranscriptNodeData} />}
        {type === "summary"    && <SummaryInspector    id={id} data={data as SummaryNodeData}    />}
        {type === "schema"     && <SchemaInspector     id={id} data={data as SchemaNodeData}     />}
      </div>
    </>
  );
}
