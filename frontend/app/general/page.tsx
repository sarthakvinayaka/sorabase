"use client";

import { WorkflowModeContext } from "@/lib/workflow-store-context";
import type { WorkflowModeContextValue } from "@/lib/workflow-store-context";
import {
  useGeneralWorkflowStore,
  GENERAL_CORE_NODE_IDS,
  GENERAL_CORE_EDGE_IDS,
} from "@/lib/workflow-store";
import GeneralWorkflowBuilder from "@/components/workflow/GeneralWorkflowBuilder";

const generalCtx: WorkflowModeContextValue = {
  useStore:    useGeneralWorkflowStore as WorkflowModeContextValue["useStore"],
  mode:        "general",
  coreNodeIds: GENERAL_CORE_NODE_IDS,
  coreEdgeIds: GENERAL_CORE_EDGE_IDS,
};

export default function GeneralPage() {
  return (
    <WorkflowModeContext.Provider value={generalCtx}>
      <GeneralWorkflowBuilder />
    </WorkflowModeContext.Provider>
  );
}
