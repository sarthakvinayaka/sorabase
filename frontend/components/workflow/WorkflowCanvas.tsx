"use client";

import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type Connection,
  type Edge,
  type IsValidConnection,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { useWorkflowStoreContext, useWorkflowMode } from "@/lib/workflow-store-context";
import { nodeTypes } from "./nodes";
import { VALID_CONNECTIONS, type WorkflowNodeType } from "@/lib/workflow-types";

const EDGE_STYLE      = { strokeWidth: 2, stroke: "#a8a29e" };  // stone-400 — readable on white
const EDGE_STYLE_DARK = { strokeWidth: 2, stroke: "#78716c" };  // stone-500

interface Props { isDark: boolean }

export default function WorkflowCanvas({ isDark }: Props) {
  const { screenToFlowPosition } = useReactFlow();
  const { coreNodeIds }          = useWorkflowMode();

  const nodes           = useWorkflowStoreContext((s) => s.nodes);
  const edges           = useWorkflowStoreContext((s) => s.edges);
  const onNodesChange   = useWorkflowStoreContext((s) => s.onNodesChange);
  const onEdgesChange   = useWorkflowStoreContext((s) => s.onEdgesChange);
  const onConnect       = useWorkflowStoreContext((s) => s.onConnect);
  const addNode         = useWorkflowStoreContext((s) => s.addNode);
  const setSelectedNode = useWorkflowStoreContext((s) => s.setSelectedNode);
  const removeNode      = useWorkflowStoreContext((s) => s.removeNode);
  const selectedNodeId  = useWorkflowStoreContext((s) => s.selectedNodeId);

  // ── Keyboard deletion ─────────────────────────────────────────────────────
  // Delete / Backspace removes the selected node + its edges. Guard prevents
  // firing while the user is typing inside any input or textarea.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) return;
      if (!selectedNodeId) return;
      if (coreNodeIds.has(selectedNodeId)) return;  // core node — protected
      e.preventDefault();
      removeNode(selectedNodeId);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNodeId, removeNode, coreNodeIds]);

  // ── Connection validation ──────────────────────────────────────────────────
  const isValidConnection: IsValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const srcNode = nodes.find((n) => n.id === connection.source);
      const tgtNode = nodes.find((n) => n.id === connection.target);
      if (!srcNode || !tgtNode) return false;
      if (srcNode.id === tgtNode.id) return false;
      const allowed = VALID_CONNECTIONS[srcNode.type as WorkflowNodeType] ?? [];
      return allowed.includes(tgtNode.type as WorkflowNodeType);
    },
    [nodes],
  );

  // ── Drag-and-drop from node library ───────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow") as WorkflowNodeType;
      if (!type) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(type, position);
    },
    [screenToFlowPosition, addNode],
  );

  // ── Node selection ─────────────────────────────────────────────────────────
  // onSelectionChange is the single source of truth for selection — it fires
  // for node clicks, pane clicks, ESC, and keyboard navigation alike, keeping
  // the store's selectedNodeId and React Flow's internal state in sync.
  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      setSelectedNode(selected.length === 1 ? selected[0].id : null);
    },
    [setSelectedNode],
  );

  const edgeStyle = isDark ? EDGE_STYLE_DARK : EDGE_STYLE;

  // Inject current theme style into every edge so persisted edges re-apply the right color
  const styledEdges = edges.map((e) => ({ ...e, style: edgeStyle, type: e.type ?? "smoothstep" }));

  return (
    <div className="flex-1 h-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        isValidConnection={isValidConnection}
        defaultEdgeOptions={{ type: "smoothstep", style: edgeStyle }}
        deleteKeyCode={null}
        nodeDragThreshold={8}
        multiSelectionKeyCode={null}
        selectionKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color={isDark ? "#3f3f46" : "#d4d4d8"}
        />
        <Controls
          className="!shadow-none !border !border-stone-200 dark:!border-stone-700 !rounded-lg overflow-hidden"
          showInteractive={false}
        />
        <MiniMap
          style={{ width: 110, height: 70, border: "1px solid", borderColor: isDark ? "#3f3f46" : "#e4e4e7" }}
          nodeStrokeWidth={0}
          nodeColor={isDark ? "#52525b" : "#e4e4e7"}
          maskColor={isDark ? "rgba(9,9,11,0.7)" : "rgba(250,250,250,0.7)"}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
}
