"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import { createConversation, extractStudyLecture } from "@/lib/api";
import type {
  LecCaptureNodeData,
  QuestionGenNodeData,
  StudyOutputNodeData,
} from "@/lib/workflow-types";
import Toolbar from "./Toolbar";
import NodeLibrary from "./NodeLibrary";
import WorkflowCanvas from "./WorkflowCanvas";
import InspectorPanel from "./InspectorPanel";
import LogStrip from "./LogStrip";

export default function StudyWorkflowBuilder() {
  const isDark         = useWorkflowStoreContext((s) => s.isDark);
  const nodes          = useWorkflowStoreContext((s) => s.nodes);
  const runState       = useWorkflowStoreContext((s) => s.runState);
  const setRunState    = useWorkflowStoreContext((s) => s.setRunState);
  const updateNodeData = useWorkflowStoreContext((s) => s.updateNodeData);
  const appendLog      = useWorkflowStoreContext((s) => s.appendLog);
  const router         = useRouter();
  const running        = useRef(false);

  async function handleRun() {
    if (running.current || runState === "running") return;

    // ── Find the lecture source node ──────────────────────────────────────────
    const sourceNode = nodes.find(
      (n) => n.type === "lec_capture" || n.type === "lec_upload"
    );
    if (!sourceNode) {
      appendLog("No Lecture Capture or Lecture Upload node found. Add one to start.", "error");
      return;
    }

    const srcData = sourceNode.data as unknown as LecCaptureNodeData;
    if (sourceNode.type === "lec_capture" && !srcData.transcript.trim() && !srcData.conversationId) {
      appendLog("Lecture Capture has no transcript. Paste the lecture text or capture via browser extension.", "error");
      return;
    }

    // ── Find output node for config ───────────────────────────────────────────
    const outputNode   = nodes.find((n) => n.type === "study_output");
    const questionNode = nodes.find((n) => n.type === "question_gen");
    const outputData   = outputNode?.data as unknown as StudyOutputNodeData | undefined;
    const qData        = questionNode?.data as unknown as QuestionGenNodeData | undefined;

    // Derive template_slug from question generator config
    const templateSlug = qData?.template ?? "lecture_notes";

    running.current = true;
    setRunState("running");
    appendLog("Study workflow starting…", "info");

    try {
      let conversationId = srcData.conversationId;

      // Phase 1: create conversation if we have raw transcript text
      if (!conversationId && srcData.transcript?.trim()) {
        appendLog("Creating conversation from transcript…", "info");
        const conv = await createConversation({
          raw_text:    srcData.transcript,
          source_type: "study",
        });
        conversationId = conv.id;
        updateNodeData(sourceNode.id, { conversationId, status: "completed" });
        appendLog(`Conversation created: ${conversationId.slice(0, 8)}…`, "success");
      }

      if (!conversationId) {
        throw new Error("No conversation ID available. Paste a transcript into the Lecture Capture node.");
      }

      // Phase 2: extract study lecture
      appendLog("Extracting lecture — generating concepts, questions, and flashcards…", "info");
      const resolvedConvId = conversationId as string;
      const result = await extractStudyLecture({
        conversation_id: resolvedConvId,
        template_slug:   templateSlug,
        title:           srcData.lectureTitle || undefined,
        course:          srcData.courseName   || undefined,
        lecture_date:    srcData.lectureDate  || undefined,
      });

      if (outputNode) {
        updateNodeData(outputNode.id, { lectureId: result.lecture_id, status: "completed" });
      }

      appendLog(`Lecture extraction started: ${result.lecture_id}`, "success");
      setRunState("completed");

      // Navigate to processing page — shows progress and redirects to review
      router.push(
        `/study/processing/${result.lecture_id}?source=${encodeURIComponent(conversationId)}&template=${templateSlug}&title=${encodeURIComponent(srcData.lectureTitle || "")}&course=${encodeURIComponent(srcData.courseName || "")}&date=${encodeURIComponent(srcData.lectureDate || "")}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Workflow failed.";
      appendLog(msg, "error");
      setRunState("error");
    } finally {
      running.current = false;
    }
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${isDark ? "dark" : ""}`}>
      <ReactFlowProvider>
        <Toolbar onRun={handleRun} />
        <div className="flex flex-1 overflow-hidden">
          <NodeLibrary />
          <WorkflowCanvas isDark={isDark} />
          <InspectorPanel />
        </div>
        <LogStrip />
      </ReactFlowProvider>
    </div>
  );
}
