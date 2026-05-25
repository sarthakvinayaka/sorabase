"use client";

/**
 * Animated product demo for the hero section.
 * Shows the extraction story: transcript source → extracting → fields populate.
 * Loops automatically. Swap for a real video by replacing this component.
 */

import { useEffect, useState } from "react";

const FIELDS = [
  { label: "Prospect",   value: "Maria Chen, VP Operations",     conf: 99 },
  { label: "Pain point", value: "Manual data entry post-meeting", conf: 96 },
  { label: "Budget",     value: "$30k – $50k annually",          conf: 88 },
  { label: "Timeline",   value: "Q3 2026 decision",              conf: 85 },
  { label: "Solution",   value: "Google Docs + Notion",          conf: 97 },
  { label: "Next steps", value: "Demo with ops team, May 24",    conf: 91 },
] as const;

type Status = "ready" | "extracting" | "done";

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function ProductDemo() {
  const [status,  setStatus]  = useState<Status>("ready");
  const [count,   setCount]   = useState(0);

  useEffect(() => {
    let alive = true;

    async function run() {
      while (alive) {
        setStatus("ready");
        setCount(0);

        await wait(1000);
        if (!alive) return;

        setStatus("extracting");

        for (let i = 1; i <= FIELDS.length; i++) {
          await wait(380);
          if (!alive) return;
          setCount(i);
        }

        await wait(300);
        if (!alive) return;
        setStatus("done");

        await wait(4200);
      }
    }

    run();
    return () => { alive = false; };
  }, []);

  const progress = status === "done"
    ? 100
    : Math.round((count / FIELDS.length) * 100);

  return (
    <div
      className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden"
      style={{ boxShadow: "0 4px 28px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)" }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-stone-50 dark:bg-stone-950 border-b border-stone-100 dark:border-stone-800">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-stone-200 dark:bg-stone-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-stone-200 dark:bg-stone-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-stone-200 dark:bg-stone-700" />
        </div>
        <span className="text-xs font-mono text-stone-400 dark:text-stone-500 flex-1 truncate">
          sorabase / sessions / discovery-call
        </span>
        <span
          className={[
            "flex items-center gap-1.5 text-xs font-medium transition-colors duration-500 whitespace-nowrap",
            status === "done"
              ? "text-aubergine-700 dark:text-aubergine-400"
              : "text-stone-400 dark:text-stone-500",
          ].join(" ")}
        >
          <span
            className={[
              "w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-500",
              status === "done"        ? "bg-aubergine-600 dark:bg-aubergine-500"
              : status === "extracting" ? "bg-amber-400 animate-pulse"
              :                          "bg-stone-300 dark:bg-stone-600",
            ].join(" ")}
          />
          {status === "done" ? "Extracted" : status === "extracting" ? "Extracting…" : "Ready"}
        </span>
      </div>

      {/* Session header */}
      <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 leading-snug">
            Sales Discovery — Acme Corp
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
            2026-05-17 · 38 min · Zoom recording
          </p>
        </div>
        <span className="flex-shrink-0 text-[10px] font-semibold tracking-wide uppercase border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-400 dark:text-stone-500 px-2 py-0.5 rounded-sm">
          General
        </span>
      </div>

      {/* Transcript source snippet */}
      <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-950/50">
        <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500 mb-2">
          Source transcript
        </p>
        <div className="font-mono text-xs text-stone-400 dark:text-stone-500 leading-relaxed space-y-1">
          <p>
            <span className="text-stone-300 dark:text-stone-600">[00:02:18]</span>
            {" "}Maria: It&apos;s a mess — Google Docs and Notion, different templates for every rep…
          </p>
          <p>
            <span className="text-stone-300 dark:text-stone-600">[00:09:51]</span>
            {" "}Maria: Probably thirty to fifty thousand annually, depending on features…
          </p>
        </div>
        <p className="text-[10px] text-stone-300 dark:text-stone-600 mt-2 font-mono select-none">
          · · · 36 more minutes · · ·
        </p>
      </div>

      {/* Extraction progress rail */}
      <div className="px-5 py-2.5 border-b border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-[3px] bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-aubergine-600 dark:bg-aubergine-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-stone-400 dark:text-stone-500 tabular-nums whitespace-nowrap">
            {count}/{FIELDS.length} fields
          </span>
        </div>
      </div>

      {/* Extracted field rows */}
      <div>
        {FIELDS.map(({ label, value, conf }, i) => (
          <div
            key={label}
            className={[
              "flex items-center gap-3 px-5 py-2.5 border-b border-stone-50 dark:border-stone-800/50 last:border-0 transition-all duration-300",
              i < count ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none",
            ].join(" ")}
          >
            <span className="text-xs text-stone-400 dark:text-stone-500 w-[88px] flex-shrink-0">
              {label}
            </span>
            <span className="flex-1 text-sm text-stone-800 dark:text-stone-200 truncate">
              {value}
            </span>
            <span
              className={[
                "text-xs font-mono flex-shrink-0 transition-colors duration-300",
                conf >= 95 ? "text-emerald-600 dark:text-emerald-400"
                : conf >= 85 ? "text-aubergine-700 dark:text-aubergine-400"
                : "text-amber-600 dark:text-amber-400",
              ].join(" ")}
            >
              {conf}%
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-stone-50/60 dark:bg-stone-950/60 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
        <span className="text-xs text-stone-400 dark:text-stone-500">
          6 of 12 fields shown
        </span>
        <span
          className={[
            "text-xs font-medium transition-all duration-500",
            status === "done"
              ? "text-aubergine-700 dark:text-aubergine-400 opacity-100"
              : "opacity-0",
          ].join(" ")}
        >
          93% avg confidence
        </span>
      </div>
    </div>
  );
}
