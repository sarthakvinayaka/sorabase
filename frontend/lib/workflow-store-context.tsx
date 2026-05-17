"use client";

/**
 * Workflow mode context — injects whichever Zustand store the active mode's
 * page provides. Every workflow component reads state through this context so
 * the same component tree can serve both Recruiting and General modes without
 * duplication.
 *
 * Usage:
 *   // in a component
 *   const nodes     = useWorkflowStoreContext((s) => s.nodes);
 *   const { mode, coreNodeIds } = useWorkflowMode();
 */
import { createContext, useContext } from "react";
import type { WorkflowStore } from "./workflow-store";
import type { AppMode } from "./mode";

// The store is exposed as a bound selector hook (same signature as a Zustand hook).
type BoundStore = <T>(selector: (s: WorkflowStore) => T) => T;

export interface WorkflowModeContextValue {
  useStore:     BoundStore;
  mode:         AppMode;
  coreNodeIds:  Set<string>;
  coreEdgeIds:  Set<string>;
}

export const WorkflowModeContext =
  createContext<WorkflowModeContextValue | null>(null);

/** Returns the full mode context (store hook + mode metadata). */
export function useWorkflowMode(): WorkflowModeContextValue {
  const ctx = useContext(WorkflowModeContext);
  if (!ctx) {
    throw new Error(
      "useWorkflowMode must be called inside a WorkflowModeContext.Provider. " +
      "Make sure the page wraps <WorkflowBuilder> with the correct provider.",
    );
  }
  return ctx;
}

/** Reads reactive state from the active mode's store. */
export function useWorkflowStoreContext<T>(
  selector: (s: WorkflowStore) => T,
): T {
  const { useStore } = useWorkflowMode();
  return useStore(selector);
}
