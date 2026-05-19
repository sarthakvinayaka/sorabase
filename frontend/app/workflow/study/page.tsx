"use client";

import { WorkflowModeContext } from "@/lib/workflow-store-context";
import {
  useStudyWorkflowStore,
  STUDY_CORE_NODE_IDS,
  STUDY_CORE_EDGE_IDS,
} from "@/lib/workflow-store";
import StudyWorkflowBuilder from "@/components/workflow/StudyWorkflowBuilder";
import type { WorkflowModeContextValue } from "@/lib/workflow-store-context";

const studyCtx: WorkflowModeContextValue = {
  useStore:    useStudyWorkflowStore as WorkflowModeContextValue["useStore"],
  mode:        "study",
  coreNodeIds: STUDY_CORE_NODE_IDS,
  coreEdgeIds: STUDY_CORE_EDGE_IDS,
};

export default function StudyWorkflowPage() {
  return (
    <WorkflowModeContext.Provider value={studyCtx}>
      <StudyWorkflowBuilder />
    </WorkflowModeContext.Provider>
  );
}
