"use client";

import { useWorkflowStoreContext, useWorkflowMode } from "@/lib/workflow-store-context";
import { NODE_PALETTE, GENERAL_NODE_PALETTE, type WorkflowNodeType } from "@/lib/workflow-types";

const ACCENT_TEXT: Record<WorkflowNodeType, string> = {
  source:     "text-stone-400",
  analysis:   "text-amber-600",
  extraction: "text-aubergine-800",
  output:     "text-aubergine-800",
  transcript: "text-blue-500",
  summary:    "text-amber-500",
  schema:     "text-violet-500",
};

const ACCENT_BG: Record<WorkflowNodeType, string> = {
  source:     "bg-stone-100 dark:bg-stone-800",
  analysis:   "bg-amber-50 dark:bg-amber-900/20",
  extraction: "bg-aubergine-50 dark:bg-aubergine-950/20",
  output:     "bg-aubergine-50 dark:bg-aubergine-950/20",
  transcript: "bg-blue-50 dark:bg-blue-900/20",
  summary:    "bg-amber-50 dark:bg-amber-900/20",
  schema:     "bg-violet-50 dark:bg-violet-900/20",
};

export default function NodeLibrary() {
  const addNodeAuto   = useWorkflowStoreContext((s) => s.addNodeAuto);
  const resetWorkflow = useWorkflowStoreContext((s) => s.resetWorkflow);
  const { mode }      = useWorkflowMode();
  const palette       = mode === "general" ? GENERAL_NODE_PALETTE : NODE_PALETTE;

  function onDragStart(e: React.DragEvent, type: WorkflowNodeType) {
    e.dataTransfer.setData("application/reactflow", type);
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <aside className="w-48 flex-shrink-0 flex flex-col bg-stone-50 dark:bg-stone-950 border-r border-stone-200 dark:border-stone-700 overflow-y-auto">

      <div className="px-3 pt-4 pb-3">
        <p className="section-label mb-3">Add node</p>
        <div className="space-y-1">
          {palette.map((item) => (
            <div
              key={item.type}
              draggable={!item.comingSoon}
              onClick={() => !item.comingSoon && addNodeAuto(item.type)}
              onDragStart={(e) => !item.comingSoon && onDragStart(e, item.type)}
              title={item.comingSoon ? "Coming soon" : `Add ${item.label} node`}
              className={[
                "rounded border px-2.5 py-2 flex items-start gap-2 transition-colors",
                item.comingSoon
                  ? "opacity-35 cursor-not-allowed border-stone-150 dark:border-stone-800 bg-transparent"
                  : "cursor-pointer select-none border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600 hover:bg-stone-25 dark:hover:bg-stone-800 active:scale-[0.98]",
              ].join(" ")}
            >
              {/* Icon chip */}
              <div className={`w-6 h-6 rounded-xs flex items-center justify-center flex-shrink-0 mt-0.5 ${ACCENT_BG[item.type]}`}>
                <span className={`text-xs font-mono leading-none ${ACCENT_TEXT[item.type]}`}>
                  {item.icon}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-stone-700 dark:text-stone-300">
                    {item.label}
                  </span>
                  {item.comingSoon ? (
                    <span className="text-2xs font-medium text-stone-400 dark:text-stone-500 border border-stone-200 dark:border-stone-700 rounded-xs px-1">
                      soon
                    </span>
                  ) : (
                    <span className="text-stone-300 dark:text-stone-600 text-xs leading-none">+</span>
                  )}
                </div>
                <p className="text-2xs text-stone-400 dark:text-stone-500 leading-tight mt-0.5">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-3 h-px bg-stone-200 dark:bg-stone-700" />

      <div className="px-3 py-3 space-y-3">
        <p className="text-2xs text-stone-400 dark:text-stone-500 leading-relaxed">
          {mode === "general"
            ? "Click to add · or drag to canvas. Input → Transcript → Schema → Extraction → Output."
            : "Click to add · or drag to canvas. Connect nodes: Source → AI Scoring → Extraction → Output."}
        </p>
        <button
          type="button"
          onClick={resetWorkflow}
          className="w-full text-left text-2xs font-medium text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
        >
          ↺ Reset to default
        </button>
      </div>
    </aside>
  );
}
