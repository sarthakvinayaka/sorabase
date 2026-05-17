"use client";

import { WorkflowModeContext } from "@/lib/workflow-store-context";
import {
  useWorkflowStore,
  RECRUITING_CORE_NODE_IDS,
  RECRUITING_CORE_EDGE_IDS,
} from "@/lib/workflow-store";
import WorkflowBuilder from "@/components/workflow/WorkflowBuilder";
import type { WorkflowModeContextValue } from "@/lib/workflow-store-context";

const recruitingCtx: WorkflowModeContextValue = {
  useStore:    useWorkflowStore as WorkflowModeContextValue["useStore"],
  mode:        "recruiting",
  coreNodeIds: RECRUITING_CORE_NODE_IDS,
  coreEdgeIds: RECRUITING_CORE_EDGE_IDS,
};

export default function WorkflowPage() {
  return (
    <WorkflowModeContext.Provider value={recruitingCtx}>
      <WorkflowBuilder />
    </WorkflowModeContext.Provider>
  );
}
