/**
 * BaseNode — shared shell for all workflow node cards.
 * Fog & Graphite design: warm stone bg, teal selection ring, tight radius.
 */
import { useState, useEffect } from "react";
import { Handle, Position } from "@xyflow/react";
import { useWorkflowStoreContext, useWorkflowMode } from "@/lib/workflow-store-context";
import type { NodeStatus } from "@/lib/workflow-types";

interface BaseNodeProps {
  selected: boolean;
  accent: string;        // Tailwind bg-* class for left accent stripe
  icon: string;
  typeLabel: string;
  status: NodeStatus;
  children: React.ReactNode;
  hideTarget?: boolean;
  hideSource?: boolean;
  nodeId?: string;       // when provided, enables the on-card × delete chip
}

const STATUS_DOT: Record<NodeStatus, string> = {
  idle:       "bg-stone-300 dark:bg-stone-600",
  configured: "bg-aubergine-400",
  running:    "bg-amber-400 animate-pulse",
  completed:  "bg-aubergine-700",
  error:      "bg-red-400",
};

const STATUS_LABEL: Record<NodeStatus, string> = {
  idle:       "Idle",
  configured: "Ready",
  running:    "Running",
  completed:  "Done",
  error:      "Error",
};

export default function BaseNode({
  selected,
  accent,
  icon,
  typeLabel,
  status,
  children,
  hideTarget,
  hideSource,
  nodeId,
}: BaseNodeProps) {
  const removeNode              = useWorkflowStoreContext((s) => s.removeNode);
  const { coreNodeIds }         = useWorkflowMode();
  const isCore                  = nodeId ? coreNodeIds.has(nodeId) : false;
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset confirm state whenever selection changes
  useEffect(() => { setConfirmDelete(false); }, [selected]);

  // Auto-cancel confirm after 4 s to prevent accidental stale confirms
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  return (
    <div
      className={[
        "group relative w-56 rounded-md overflow-visible select-none",
        "bg-white dark:bg-stone-900 border transition-all duration-100",
        selected
          ? "border-aubergine-700 shadow-[0_0_0_2px_rgba(26,107,90,0.18)]"
          : "border-stone-200 dark:border-stone-700 shadow-card",
      ].join(" ")}
    >
      {/* Accent stripe — 2.5px left border color */}
      <div className={`absolute inset-y-0 left-0 w-[2.5px] ${accent}`} />

      {/* Delete chip — only when node is selected, nodeId is known, and not a core node */}
      {selected && nodeId && !isCore && (
        <div className="absolute -top-3 -right-3 z-20 flex items-center">
          {confirmDelete ? (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 bg-white dark:bg-stone-900 border border-red-200 dark:border-red-800 rounded-full px-2 py-[3px] shadow-md"
            >
              <span className="text-[10px] text-red-500 font-medium whitespace-nowrap leading-none">Delete?</span>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); removeNode(nodeId); }}
                className="text-[10px] font-bold text-red-600 hover:text-red-700 leading-none ml-0.5"
              >
                Yes
              </button>
              <span className="text-[10px] text-stone-300 dark:text-stone-600 leading-none">·</span>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                className="text-[10px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 leading-none"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              title="Delete node"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="w-5 h-5 rounded-full flex items-center justify-center bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-sm text-stone-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-700 transition-colors text-sm font-medium leading-none"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between pl-4 pr-3 pt-2.5 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs leading-none text-stone-400 dark:text-stone-500 font-mono">
            {icon}
          </span>
          <span className="text-2xs font-semibold tracking-label uppercase text-stone-400 dark:text-stone-500">
            {typeLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
          <span className="text-2xs font-medium text-stone-400 dark:text-stone-500 tracking-wide">
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-stone-100 dark:bg-stone-800 mx-3" />

      {/* Body */}
      <div className="pl-4 pr-3 py-2.5">{children}</div>

      {/* Handles — visible always, pulse on hover for discoverability */}
      {!hideTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className={[
            "!w-3 !h-3 !min-w-0 !min-h-0 !rounded-full !left-[-6px]",
            "!bg-white dark:!bg-stone-900 !border-2",
            "!border-stone-300 dark:!border-stone-600",
            "group-hover:!border-aubergine-400 group-hover:!bg-aubergine-50 dark:group-hover:!bg-aubergine-950/30",
            "hover:!scale-125 hover:!border-aubergine-700 hover:!bg-aubergine-50",
            "transition-all duration-150",
          ].join(" ")}
        />
      )}
      {!hideSource && (
        <Handle
          type="source"
          position={Position.Right}
          className={[
            "!w-3 !h-3 !min-w-0 !min-h-0 !rounded-full !right-[-6px]",
            "!bg-white dark:!bg-stone-900 !border-2",
            "!border-stone-300 dark:!border-stone-600",
            "group-hover:!border-aubergine-400 group-hover:!bg-aubergine-50 dark:group-hover:!bg-aubergine-950/30",
            "hover:!scale-125 hover:!border-aubergine-700 hover:!bg-aubergine-50",
            "transition-all duration-150",
          ].join(" ")}
        />
      )}
    </div>
  );
}
