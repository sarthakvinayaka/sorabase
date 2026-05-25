"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import {
  createConversation,
  proposeSchema,
  extractGeneralConversation,
} from "@/lib/api";
import type {
  SchemaNodeData,
  SourceNodeData,
  TranscriptNodeData,
} from "@/lib/workflow-types";
import Toolbar from "./Toolbar";
import NodeLibrary from "./NodeLibrary";
import WorkflowCanvas from "./WorkflowCanvas";
import InspectorPanel from "./InspectorPanel";
import LogStrip from "./LogStrip";

export default function GeneralWorkflowBuilder() {
  const isDark         = useWorkflowStoreContext((s) => s.isDark);
  const nodes          = useWorkflowStoreContext((s) => s.nodes);
  const runState       = useWorkflowStoreContext((s) => s.runState);
  const setRunState    = useWorkflowStoreContext((s) => s.setRunState);
  const updateNodeData = useWorkflowStoreContext((s) => s.updateNodeData);
  const appendLog      = useWorkflowStoreContext((s) => s.appendLog);
  const router         = useRouter();

  // Track which conversationId Phase 2 should use
  const pendingConvId = useRef<string | null>(null);

  // ── Phase 2 trigger: watches for schema approval while paused ──────────────
  useEffect(() => {
    if (runState !== "paused") return;
    const schemaNode = nodes.find((n) => n.type === "schema");
    if (!schemaNode) return;
    const schemaData = schemaNode.data as unknown as SchemaNodeData;
    if (schemaData.schemaStatus !== "approved") return;
    if (!pendingConvId.current) return;

    const convId   = pendingConvId.current;
    const columns  = schemaData.columns;
    const opts     = {
      templateId:      schemaData.templateId,
      templateVersion: schemaData.templateVersion,
    };

    runPhase2(convId, columns, opts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runState, nodes]);

  async function runPhase2(
    conversationId: string,
    columns: SchemaNodeData["columns"],
    opts: { templateId?: string; templateVersion?: number },
  ) {
    const extractionNode = nodes.find((n) => n.type === "extraction");
    const summaryNode    = nodes.find((n) => n.type === "summary");
    const outputNode     = nodes.find((n) => n.type === "output");

    setRunState("running");
    appendLog("Schema approved — starting extraction…", "info");

    if (extractionNode) updateNodeData(extractionNode.id, { status: "running" });
    if (summaryNode)    updateNodeData(summaryNode.id,    { status: "running" });
    if (outputNode)     updateNodeData(outputNode.id,     { status: "running" });

    try {
      const result = await extractGeneralConversation(conversationId, columns, opts);
      const candidateId = result.candidate_id;

      if (extractionNode) {
        updateNodeData(extractionNode.id, {
          status:          "completed",
          candidateId,
          extractionRunId: result.extraction_id,
          extractedCount:  columns.length,
        });
      }
      if (summaryNode) {
        updateNodeData(summaryNode.id, {
          status:          "completed",
          extractionRunId: result.extraction_id,
        });
      }
      if (outputNode) {
        updateNodeData(outputNode.id, { status: "completed", candidateId });
      }

      appendLog(`Extraction complete · candidate ${candidateId.slice(0, 8)}`, "success");
      setRunState("completed");
      appendLog("Navigating to results dashboard…", "info");
      setTimeout(() => router.push(`/general/results/${candidateId}`), 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`Extraction failed: ${msg}`, "error");
      setRunState("error");
    }
  }

  // ── Phase 1: validate source → transcribe → propose schema ────────────────
  const handleRun = useCallback(async () => {
    if (runState === "running" || runState === "paused") return;

    const sourceNode = nodes.find((n) => n.type === "source");
    const transcriptNode = nodes.find((n) => n.type === "transcript");
    const schemaNode     = nodes.find((n) => n.type === "schema");

    if (!sourceNode) {
      appendLog("Workflow requires a Source node.", "error");
      return;
    }

    const sourceData = sourceNode.data as unknown as SourceNodeData;

    if (sourceData.inputMode === "zoom" && !sourceData.zoomConversationId) {
      appendLog("Select a Zoom recording in the Source node before running.", "error");
      return;
    }
    if (sourceData.inputMode !== "zoom" && sourceData.inputMode !== "zoom_bot" && !sourceData.transcript.trim()) {
      appendLog("Paste a transcript in the Source node before running.", "error");
      return;
    }

    setRunState("running");
    appendLog("Starting General Mode run…", "info");

    updateNodeData(sourceNode.id, { status: "running" });
    if (transcriptNode) updateNodeData(transcriptNode.id, { status: "running" });
    if (schemaNode)     updateNodeData(schemaNode.id,     { status: "running" });

    try {
      // Step 1: resolve/create conversation
      let conversationId: string;
      let charCount: number | undefined;

      if (sourceData.inputMode === "zoom" && sourceData.zoomConversationId) {
        conversationId = sourceData.zoomConversationId;
        charCount      = sourceData.zoomCharCount;
        updateNodeData(sourceNode.id, { status: "completed", conversationId });
        appendLog(`Zoom source ready · ${charCount?.toLocaleString() ?? "?"} chars`, "success");
      } else {
        appendLog("Creating conversation from source…", "info");
        const conv = await createConversation({
          raw_text:      sourceData.transcript,
          job_reference: sourceData.jobReference || undefined,
        });
        conversationId = conv.id;
        charCount      = conv.char_count ?? undefined;
        updateNodeData(sourceNode.id, { status: "completed", conversationId });
        appendLog(`Source ready · ${conv.char_count?.toLocaleString() ?? "?"} chars`, "success");
      }

      // Step 2: mark transcript node
      if (transcriptNode) {
        updateNodeData(transcriptNode.id, {
          status:         "completed",
          conversationId,
          charCount,
          preview:        sourceData.transcript?.slice(0, 200) || undefined,
        } as Partial<TranscriptNodeData>);
      }

      // Step 3: propose schema
      appendLog("Proposing schema from transcript…", "info");
      const proposal = await proposeSchema(conversationId);

      if (schemaNode) {
        updateNodeData(schemaNode.id, {
          status:       "configured",
          schemaStatus: "proposed",
          columns:      proposal.columns,
          rationale:    proposal.rationale,
        } as Partial<SchemaNodeData>);
      }

      // Store conversationId for Phase 2 and pause
      pendingConvId.current = conversationId;
      setRunState("paused");
      appendLog(
        `Schema proposed (${proposal.columns.length} columns) — review and approve in the Schema node.`,
        "info",
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`Run failed: ${msg}`, "error");
      setRunState("error");
    }
  }, [nodes, runState, setRunState, updateNodeData, appendLog]);

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${isDark ? "dark" : ""}`}>
      <ReactFlowProvider>
        <Toolbar onRun={handleRun} />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <NodeLibrary />
          <div className="relative flex-1 min-h-0">
            <WorkflowCanvas isDark={isDark} />
          </div>
          <InspectorPanel />
        </div>
        <LogStrip />
      </ReactFlowProvider>
    </div>
  );
}
