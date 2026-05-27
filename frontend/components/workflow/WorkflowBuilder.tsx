"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import { createConversation, createJob, extractConversation, triggerAnalysis } from "@/lib/api";
import type { AnalysisNodeData, OutputNodeData, SourceNodeData } from "@/lib/workflow-types";
import Toolbar from "./Toolbar";
import NodeLibrary from "./NodeLibrary";
import WorkflowCanvas from "./WorkflowCanvas";
import InspectorPanel from "./InspectorPanel";
import LogStrip from "./LogStrip";

export default function WorkflowBuilder() {
  const isDark         = useWorkflowStoreContext((s) => s.isDark);
  const nodes          = useWorkflowStoreContext((s) => s.nodes);
  const runState       = useWorkflowStoreContext((s) => s.runState);
  const setRunState    = useWorkflowStoreContext((s) => s.setRunState);
  const updateNodeData = useWorkflowStoreContext((s) => s.updateNodeData);
  const appendLog      = useWorkflowStoreContext((s) => s.appendLog);
  const router         = useRouter();

  // ── Run workflow ───────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (runState === "running") return;

    // Locate required nodes
    const sourceNode     = nodes.find((n) => n.type === "source");
    const extractionNode = nodes.find((n) => n.type === "extraction");
    const analysisNode   = nodes.find((n) => n.type === "analysis");
    const outputNode     = nodes.find((n) => n.type === "output");

    if (!sourceNode || !extractionNode) {
      appendLog("Workflow requires at least a Source and Extraction node.", "error");
      return;
    }

    const sourceData = sourceNode.data as unknown as SourceNodeData;

    // Validate source has content
    if (sourceData.inputMode === "zoom") {
      if (!sourceData.zoomConversationId) {
        appendLog("Select a Zoom recording in the Source node before running.", "error");
        return;
      }
    } else if (sourceData.inputMode === "browser_capture") {
      if (!sourceData.captureConversationId) {
        appendLog("Browser capture not complete. Start a recording via the Sorabase Capture extension.", "error");
        return;
      }
    } else if (!sourceData.transcript.trim()) {
      appendLog("Source node has no transcript. Paste text before running.", "error");
      return;
    }

    setRunState("running");
    appendLog("Starting workflow run…", "info");
    // Step 1 begins — only mark the source node running now.
    // Subsequent nodes are marked running immediately before their step starts
    // so the canvas always highlights exactly the node that is executing.
    updateNodeData(sourceNode.id, { status: "running" });

    try {
      // ── Step 1: resolve conversation ───────────────────────────────────────
      let conversationId: string;

      if (sourceData.inputMode === "zoom" && sourceData.zoomConversationId) {
        // Zoom: conversation already ingested via webhook — use it directly
        conversationId = sourceData.zoomConversationId;
        updateNodeData(sourceNode.id, { status: "completed", conversationId });
        appendLog(
          `Zoom source ready · ${sourceData.zoomCharCount?.toLocaleString() ?? "?"} chars`,
          "success",
        );
      } else if (sourceData.inputMode === "browser_capture" && sourceData.captureConversationId) {
        // Browser capture: audio already uploaded by extension — use conversation directly
        conversationId = sourceData.captureConversationId;
        updateNodeData(sourceNode.id, { status: "completed", conversationId });
        appendLog(
          `Browser capture ready · ${sourceData.captureLabel || "recording"} processed`,
          "success",
        );
      } else {
        // Transcript paste: create conversation now
        appendLog("Creating conversation from source…", "info");
        const conv = await createConversation({
          raw_text:      sourceData.transcript,
          job_reference: sourceData.jobReference || undefined,
        });
        conversationId = conv.id;
        updateNodeData(sourceNode.id, { status: "completed", conversationId: conv.id });
        appendLog(`Source ready · ${conv.char_count?.toLocaleString() ?? "?"} chars`, "success");
      }

      // Alias for the rest of the pipeline (replaces the old `conv.id` reference)
      const conv = { id: conversationId };

      // ── Step 2: extract ───────────────────────────────────────────────────
      updateNodeData(extractionNode.id, { status: "running" });
      appendLog("Running extraction pipeline…", "info");
      const extraction = await extractConversation(conv.id);
      updateNodeData(extractionNode.id, {
        status:          "completed",
        candidateId:     extraction.candidate_id,
        extractionRunId: extraction.extraction_id,
      });
      appendLog(`Extraction complete · candidate ${extraction.candidate_id.slice(0, 8)}`, "success");

      // ── Step 3: analysis (optional — skipped in General Mode) ─────────────
      let candidateId = extraction.candidate_id;
      if (analysisNode) {
        updateNodeData(analysisNode.id, { status: "running" });
        const analysisData = analysisNode.data as unknown as AnalysisNodeData;

        // Resolve job ID: use existing one or create from inline JD paste
        let jobId = analysisData.jobId;
        if (!jobId && analysisData.jdText.trim()) {
          appendLog("Creating job from JD…", "info");
          try {
            const job = await createJob({
              title:       analysisData.jdTitle.trim() || "Untitled Job",
              description: analysisData.jdText,
            });
            jobId = job.id;
            updateNodeData(analysisNode.id, { jobId: job.id });
            appendLog(`Job created · ${job.id.slice(0, 8)}`, "success");
          } catch {
            updateNodeData(analysisNode.id, { status: "error" });
            appendLog("Failed to create job — check JD content.", "error");
          }
        }

        if (jobId) {
          appendLog("Running AI scoring…", "info");
          try {
            const analysis = await triggerAnalysis(candidateId, jobId);
            updateNodeData(analysisNode.id, {
              status:        "completed",
              candidateId,
              analysisRunId: analysis.id,
              aiScore:       analysis.overall_score ?? undefined,
              aiTier:        analysis.overall_tier ?? undefined,
              finalScore:    analysis.overall_score ?? undefined,
              scoreStatus:   "ai_scored",
            });
            const scoreDisplay = analysis.overall_score !== null
              ? `${(analysis.overall_score / 10).toFixed(1)}/10`
              : "—";
            appendLog(
              `AI scoring complete · ${scoreDisplay} · ${analysis.overall_tier ?? ""}`,
              "success",
            );
          } catch {
            updateNodeData(analysisNode.id, { status: "error" });
            appendLog("AI scoring failed — check job configuration.", "warn");
          }
        } else {
          updateNodeData(analysisNode.id, { status: "configured" });
          appendLog("AI scoring skipped — paste a job description in the node.", "warn");
        }
      }

      // ── Step 4: output ────────────────────────────────────────────────────
      // Dashboard is always the primary destination — navigate there regardless
      // of what extra formats are configured.
      if (outputNode) {
        updateNodeData(outputNode.id, { status: "running" });
        const outputData   = outputNode.data as unknown as OutputNodeData;
        const extraFormats = (outputData.extraFormats ?? []) as string[];
        updateNodeData(outputNode.id, { status: "completed", candidateId });
        appendLog("Output ready — navigating to dashboard.", "success");

        // Optional: open JSON export in a new tab before navigating
        if (extraFormats.includes("json")) {
          window.open(`/api/candidates/${candidateId}/export`, "_blank");
          appendLog("JSON export opened.", "info");
        }

        appendLog(`Opening dashboard · /review/${candidateId}`, "info");
        setTimeout(() => router.push(`/review/${candidateId}`), 800);
      } else {
        // No output node — still navigate to dashboard
        appendLog(`Navigating to dashboard · /review/${candidateId}`, "info");
        setTimeout(() => router.push(`/review/${candidateId}`), 800);
      }

      setRunState("completed");
      appendLog("Workflow completed successfully.", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`Workflow failed: ${msg}`, "error");
      setRunState("error");
    }
  }, [nodes, runState, setRunState, updateNodeData, appendLog, router]);

  return (
    // Dark mode applied to this root div so it scopes to the workflow builder only
    <div className={`flex flex-col h-screen overflow-hidden ${isDark ? "dark" : ""}`}>
      <ReactFlowProvider>
        <Toolbar onRun={handleRun} />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <NodeLibrary />
          {/* relative+flex-1 wrapper so WorkflowCanvas can use absolute inset-0,
              bypassing the CSS-class height chain that breaks on first paint */}
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
