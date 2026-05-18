"use client";

import Link from "next/link";
import { useWorkflowStoreContext, useWorkflowMode } from "@/lib/workflow-store-context";
import type { RunState } from "@/lib/workflow-types";

interface Props {
  onRun: () => void;
}

const RUN_LABEL: Record<RunState, string> = {
  idle:      "Run",
  running:   "Running…",
  paused:    "Waiting…",
  completed: "Run again",
  error:     "Retry",
};

export default function Toolbar({ onRun }: Props) {
  const { mode }       = useWorkflowMode();
  const runState       = useWorkflowStoreContext((s) => s.runState);
  const isDark         = useWorkflowStoreContext((s) => s.isDark);
  const toggleDark     = useWorkflowStoreContext((s) => s.toggleDark);
  const newCandidate   = useWorkflowStoreContext((s) => s.newCandidate);
  const isRunning      = runState === "running";
  const isPaused       = runState === "paused";
  const isBlocked      = isRunning || isPaused;
  const isCompleted    = runState === "completed";

  const isRecruiting   = mode === "recruiting";
  const contextLabel   = isRecruiting ? "Workflow builder" : "General mode";
  const newLabel       = isRecruiting ? "New Candidate" : "New session";

  return (
    <header className="flex-shrink-0 h-11 flex items-center justify-between px-4 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">

      {/* Left: wordmark + context */}
      <div className="flex items-center gap-3">
        <Link
          href={isRecruiting ? "/candidates" : "/"}
          className="text-sm font-semibold tracking-tight text-stone-900 dark:text-stone-100 hover:opacity-60 transition-opacity"
        >
          Pilot<span className="text-aubergine-800">.</span>
        </Link>
        <div className="h-3.5 w-px bg-stone-200 dark:bg-stone-700" />
        <span className="text-xs text-stone-400 dark:text-stone-500">{contextLabel}</span>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1">
        {isRecruiting ? (
          <>
            <ToolbarLink href="/candidates">Candidates</ToolbarLink>
            <ToolbarLink href="/dashboard">Dashboard</ToolbarLink>
          </>
        ) : (
          <ToolbarLink href="/">← Home</ToolbarLink>
        )}

        <div className="h-3.5 w-px bg-stone-200 dark:bg-stone-700 mx-1" />

        {/* Dark mode toggle */}
        <button
          type="button"
          onClick={toggleDark}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="w-7 h-7 rounded flex items-center justify-center text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>

        <div className="h-3.5 w-px bg-stone-200 dark:bg-stone-700 mx-1" />

        {/* New Candidate / New session — clears run data, preserves config.
            Highlighted when the previous run is complete so the user sees it naturally. */}
        <button
          type="button"
          onClick={newCandidate}
          title="Clear this run and start fresh"
          className={[
            "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors border",
            isCompleted
              ? "border-aubergine-300 dark:border-aubergine-900 text-aubergine-900 dark:text-aubergine-400 bg-aubergine-50 dark:bg-aubergine-950/20 hover:bg-aubergine-100 dark:hover:bg-aubergine-950/40"
              : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800",
          ].join(" ")}
        >
          {isRecruiting ? <PersonPlusIcon /> : <NewSessionIcon />}
          {newLabel}
        </button>

        {/* Run button */}
        <div className="flex flex-col items-end gap-0.5">
          <button
            type="button"
            disabled={isBlocked}
            onClick={onRun}
            className={[
              "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors",
              isBlocked
                ? "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed"
                : "bg-aubergine-800 hover:bg-aubergine-900 text-white",
            ].join(" ")}
          >
            {isBlocked ? <SpinIcon /> : <PlayIcon />}
            {RUN_LABEL[runState]}
          </button>
          {isPaused && mode === "general" && (
            <span className="text-[10px] text-amber-500 font-medium whitespace-nowrap">
              Approve schema to continue
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

function ToolbarLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-2.5 py-1.5 text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors"
    >
      {children}
    </Link>
  );
}

function PlayIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function PersonPlusIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h11m3-4v6m3-3h-6" />
    </svg>
  );
}

function NewSessionIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9a9 9 0 1 1 2.6 6.4" />
    </svg>
  );
}
