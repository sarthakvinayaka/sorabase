"use client";

import { useEffect, useState } from "react";
import { useInView } from "./hooks/useInView";

const WORKFLOW_NODES = [
  { id: "input",      label: "Input",        sub: "Source"       },
  { id: "transcript", label: "Transcript",    sub: "Audio → text" },
  { id: "summary",    label: "Summary",       sub: "Key points"   },
  { id: "schema",     label: "Schema",        sub: "AI proposal"  },
  { id: "columns",    label: "Column Config", sub: "Configure"    },
  { id: "extraction", label: "Extraction",    sub: "Run model"    },
  { id: "output",     label: "Output",        sub: "JSON / API"   },
] as const;

const COLUMN_FIELDS = [
  { name: "prospect_name",     type: "text",   req: true,  checked: true,  conf: 99 },
  { name: "pain_points",       type: "text[]", req: true,  checked: true,  conf: 96 },
  { name: "budget_range",      type: "range",  req: true,  checked: true,  conf: 88 },
  { name: "decision_timeline", type: "date",   req: false, checked: true,  conf: 85 },
  { name: "current_solution",  type: "text",   req: false, checked: true,  conf: 97 },
  { name: "stakeholders",      type: "text[]", req: false, checked: false, conf: 72 },
  { name: "next_steps",        type: "text",   req: true,  checked: true,  conf: 91 },
];

const COLUMNS_NODE_IDX = 4;

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export function AnimatedWorkflowCanvas() {
  const { ref: canvasRef, inView } = useInView({ threshold: 0.15 });
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const [visibleRows, setVisibleRows] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const skipAnim = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (skipAnim) {
      setActiveIdx(WORKFLOW_NODES.length - 1);
      setVisibleRows(COLUMN_FIELDS.length);
      return;
    }

    let cancelled = false;

    async function run() {
      await delay(350);
      for (let i = 0; i < WORKFLOW_NODES.length; i++) {
        if (cancelled) return;
        setActiveIdx(i);

        if (i === COLUMNS_NODE_IDX) {
          await delay(120);
          for (let j = 1; j <= COLUMN_FIELDS.length; j++) {
            if (cancelled) return;
            await delay(130);
            setVisibleRows(j);
          }
          await delay(500);
        } else {
          await delay(i === 0 ? 300 : 260);
        }
      }
    }

    run();
    return () => { cancelled = true; };
  }, [inView]);

  const isRunning = activeIdx >= 0 && activeIdx < WORKFLOW_NODES.length - 1;
  const isDone    = activeIdx === WORKFLOW_NODES.length - 1;

  return (
    <section id="workflow" className="py-24 lg:py-32 bg-white dark:bg-stone-900">
      <div className="mkt-section">
        <div className="max-w-2xl mb-12">
          <p className="eyebrow mb-4">Visual workflow canvas</p>
          <h2
            className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-5"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)" }}
          >
            Build your extraction pipeline,<br />node by node.
          </h2>
          <p className="text-[15px] text-stone-500 dark:text-stone-400 leading-relaxed">
            General Mode gives you a configurable seven-node canvas — from source to structured
            output. The Column Config node is where your schema lives: define field names, types,
            and requirements. AI proposes the schema from your transcript; you edit and approve.
          </p>
        </div>

        <div ref={canvasRef} className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500">
              <span
                className={[
                  "w-1.5 h-1.5 rounded-full transition-colors duration-300",
                  isRunning ? "bg-amber-400 animate-pulse"
                  : isDone  ? "bg-emerald-400"
                  :           "bg-stone-300 dark:bg-stone-600",
                ].join(" ")}
              />
              Sales Discovery Call
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] font-mono text-stone-400 dark:text-stone-500">7 nodes</span>
              <span className="h-3 w-px bg-stone-200 dark:bg-stone-700" />
              <span
                className={[
                  "text-[10px] font-semibold transition-colors duration-300",
                  isDone    ? "text-emerald-600 dark:text-emerald-400"
                  : isRunning ? "text-amber-600 dark:text-amber-400"
                  :             "text-aubergine-800 dark:text-aubergine-400",
                ].join(" ")}
              >
                {isDone ? "Complete" : isRunning ? "Running…" : "Ready to run"}
              </span>
            </div>
          </div>

          {/* Node row */}
          <div className="relative overflow-x-auto">
            <div
              aria-hidden
              className="dark:hidden absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle, #D4D1CB 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                opacity: 0.5,
              }}
            />
            <div
              aria-hidden
              className="hidden dark:block absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle, #2E2C29 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            <div className="relative bg-stone-50/80 dark:bg-stone-950/80 px-4 sm:px-8 py-8 sm:py-10 overflow-x-auto">
              <div className="flex items-center gap-0 min-w-max mx-auto w-fit">
                {WORKFLOW_NODES.map((node, i) => {
                  const isActive    = activeIdx === i;
                  const isCompleted = activeIdx > i;
                  const isDimmed    = isRunning && !isActive && !isCompleted;

                  return (
                    <div key={node.id} className="flex items-center">
                      <div
                        className={[
                          "relative flex flex-col items-center gap-1 px-3 py-3 rounded-lg border text-center w-[96px] transition-all duration-300",
                          isActive
                            ? "border-aubergine-300 dark:border-aubergine-900 bg-white dark:bg-stone-900 shadow-sm ring-2 ring-aubergine-200/60 dark:ring-aubergine-900/40"
                            : isCompleted
                            ? "border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-stone-900"
                            : isDimmed
                            ? "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 opacity-30"
                            : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900",
                        ].join(" ")}
                      >
                        <WorkflowNodeIcon id={node.id} active={isActive} completed={isCompleted} />
                        <span
                          className={[
                            "text-[11px] font-semibold leading-tight transition-colors duration-300",
                            isActive
                              ? "text-aubergine-900 dark:text-aubergine-300"
                              : isCompleted
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-stone-700 dark:text-stone-300",
                          ].join(" ")}
                        >
                          {node.label}
                        </span>
                        <span className="text-[9px] text-stone-400 dark:text-stone-500 leading-none">
                          {node.sub}
                        </span>

                        {isCompleted && (
                          <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center shadow-sm">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                        {isActive && (
                          <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-aubergine-700 flex items-center justify-center shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          </span>
                        )}
                      </div>

                      {i < WORKFLOW_NODES.length - 1 && (
                        <div className="flex items-center w-7 flex-shrink-0">
                          <div
                            className={[
                              "h-px flex-1 transition-colors duration-400",
                              isCompleted
                                ? "bg-emerald-300 dark:bg-emerald-800"
                                : "bg-stone-300 dark:bg-stone-700",
                            ].join(" ")}
                          />
                          <svg
                            className={[
                              "w-2.5 h-2.5 flex-shrink-0 -ml-px transition-colors duration-400",
                              isCompleted
                                ? "text-emerald-300 dark:text-emerald-800"
                                : "text-stone-300 dark:text-stone-600",
                            ].join(" ")}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Column Config panel */}
          <div
            className={[
              "border-t-2 transition-colors duration-400",
              activeIdx >= COLUMNS_NODE_IDX
                ? "border-aubergine-200 dark:border-aubergine-900"
                : "border-stone-200 dark:border-stone-800",
            ].join(" ")}
          >
            <div
              className={[
                "flex items-center justify-between px-5 py-3 border-b border-stone-100 dark:border-stone-800 transition-colors duration-400",
                activeIdx >= COLUMNS_NODE_IDX
                  ? "bg-aubergine-50/40 dark:bg-aubergine-950/20"
                  : "bg-stone-50 dark:bg-stone-950",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-xs border border-aubergine-200 dark:border-aubergine-900 bg-aubergine-50 dark:bg-aubergine-950 flex items-center justify-center">
                  <svg className="w-3 h-3 text-aubergine-800 dark:text-aubergine-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8" />
                  </svg>
                </div>
                <span className="text-[12px] font-semibold text-stone-700 dark:text-stone-300">Column Config</span>
                <span className="text-[10px] text-stone-400 dark:text-stone-500">
                  · Sales Discovery Call · AI proposed {COLUMN_FIELDS.length} fields
                </span>
              </div>
              <span className="text-[10px] font-mono text-stone-400 dark:text-stone-500">schema_v1</span>
            </div>

            <div
              className="grid gap-3 items-center px-5 py-2 bg-stone-50 dark:bg-stone-950 border-b border-stone-100 dark:border-stone-800"
              style={{ gridTemplateColumns: "1.5rem 1fr 5rem 4rem 3.5rem" }}
            >
              <span />
              <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500">Field name</span>
              <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500">Type</span>
              <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500">Required</span>
              <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500 text-right">Conf.</span>
            </div>

            {COLUMN_FIELDS.map(({ name, type, req, checked, conf }, rowIdx) => (
              <div
                key={name}
                className={[
                  "grid gap-3 items-center px-5 py-2.5 border-b border-stone-50 dark:border-stone-800/60 last:border-0 transition-all duration-250",
                  checked ? "hover:bg-stone-50/70 dark:hover:bg-stone-800/20" : "",
                  activeIdx >= COLUMNS_NODE_IDX
                    ? rowIdx < visibleRows
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-1 pointer-events-none"
                    : checked
                    ? "opacity-100"
                    : "opacity-40",
                ].join(" ")}
                style={{ gridTemplateColumns: "1.5rem 1fr 5rem 4rem 3.5rem" }}
              >
                <div
                  className={[
                    "w-3.5 h-3.5 rounded-xs border flex items-center justify-center flex-shrink-0",
                    checked
                      ? "border-aubergine-400 dark:border-aubergine-800 bg-aubergine-50 dark:bg-aubergine-950"
                      : "border-stone-300 dark:border-stone-600",
                  ].join(" ")}
                >
                  {checked && (
                    <svg className="w-2.5 h-2.5 text-aubergine-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-xs font-mono text-stone-600 dark:text-stone-300 truncate">{name}</span>
                <span className="inline-flex items-center rounded-xs px-1.5 py-0.5 text-[10px] font-medium font-mono bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/40 w-fit">
                  {type}
                </span>
                <span className={["text-xs font-medium", req ? "text-aubergine-800 dark:text-aubergine-400" : "text-stone-300 dark:text-stone-600"].join(" ")}>
                  {req ? "yes" : "—"}
                </span>
                <span className="text-[11px] font-mono text-aubergine-700 dark:text-aubergine-400 text-right">{conf}%</span>
              </div>
            ))}

            <div className="flex items-center justify-between px-5 py-3 bg-stone-50 dark:bg-stone-950 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                className="text-[12px] font-medium text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 flex items-center gap-1.5 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add field
              </button>
              <button
                type="button"
                className="text-[12px] font-semibold text-aubergine-800 dark:text-aubergine-400 hover:text-aubergine-900 dark:hover:text-aubergine-300 flex items-center gap-1 transition-colors"
              >
                Save as template →
              </button>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-stone-400 dark:text-stone-500 text-center">
          General Mode workspace — click any node to configure. Column Config defines your extraction schema.
        </p>
      </div>
    </section>
  );
}

function WorkflowNodeIcon({
  id,
  active,
  completed,
}: {
  id: string;
  active: boolean;
  completed: boolean;
}) {
  const cls = [
    "w-4 h-4 mb-0.5 flex-shrink-0 transition-colors duration-300",
    active
      ? "text-aubergine-800 dark:text-aubergine-400"
      : completed
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-stone-400 dark:text-stone-500",
  ].join(" ");

  switch (id) {
    case "input":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      );
    case "transcript":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      );
    case "summary":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
        </svg>
      );
    case "schema":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
      );
    case "columns":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
        </svg>
      );
    case "extraction":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
        </svg>
      );
    case "output":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}
