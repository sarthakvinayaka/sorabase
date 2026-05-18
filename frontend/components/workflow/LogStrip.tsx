"use client";

import { useEffect, useRef } from "react";
import { useWorkflowStoreContext } from "@/lib/workflow-store-context";
import type { LogLevel } from "@/lib/workflow-types";

const LEVEL_COLOR: Record<LogLevel, string> = {
  info:    "text-stone-400 dark:text-stone-500",
  success: "text-rose-800 dark:text-rose-400",
  error:   "text-red-500 dark:text-red-400",
  warn:    "text-amber-600 dark:text-amber-400",
};

const LEVEL_DOT: Record<LogLevel, string> = {
  info:    "bg-stone-300 dark:bg-stone-600",
  success: "bg-rose-700",
  error:   "bg-red-400",
  warn:    "bg-amber-400",
};

function ts(n: number) {
  return new Date(n).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function LogStrip() {
  const logEntries = useWorkflowStoreContext((s) => s.logEntries);
  const logOpen    = useWorkflowStoreContext((s) => s.logOpen);
  const toggleLog  = useWorkflowStoreContext((s) => s.toggleLog);
  const clearLog   = useWorkflowStoreContext((s) => s.clearLog);
  const lastEntry  = logEntries[logEntries.length - 1];
  const scrollRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logEntries, logOpen]);

  return (
    <div className="flex-shrink-0 border-t border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950">

      {/* Status bar / toggle */}
      <div
        onClick={toggleLog}
        className="flex items-center justify-between px-4 h-8 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="section-label">Log</span>
          {lastEntry && !logOpen && (
            <>
              <div className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT[lastEntry.level]}`} />
              <span className={`text-2xs truncate max-w-xs ${LEVEL_COLOR[lastEntry.level]}`}>
                {lastEntry.message}
              </span>
            </>
          )}
          {logEntries.length === 0 && !logOpen && (
            <span className="text-2xs text-stone-400 dark:text-stone-600">No runs yet</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {logEntries.length > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearLog(); }}
              className="text-2xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              Clear
            </button>
          )}
          <svg
            className={`w-3 h-3 text-stone-400 dark:text-stone-500 transition-transform ${logOpen ? "" : "rotate-180"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </div>

      {/* Expanded log */}
      {logOpen && (
        <div
          ref={scrollRef}
          className="h-36 overflow-y-auto px-4 py-2 space-y-px font-mono"
        >
          {logEntries.length === 0 ? (
            <p className="text-2xs text-stone-400 dark:text-stone-600 py-4 text-center">
              Run the workflow to see output here.
            </p>
          ) : (
            logEntries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2.5 py-px">
                <span className="text-2xs text-stone-300 dark:text-stone-700 flex-shrink-0 mt-px tabular-nums">
                  {ts(entry.ts)}
                </span>
                <div className={`w-1 h-1 rounded-full flex-shrink-0 mt-[5px] ${LEVEL_DOT[entry.level]}`} />
                <span className={`text-xs leading-tight ${LEVEL_COLOR[entry.level]}`}>
                  {entry.message}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
