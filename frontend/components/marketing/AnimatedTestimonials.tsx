"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "./hooks/useInView";

const STATS = [
  { target: 35, suffix: "+", label: "Fields extracted per recruiting session" },
  { target: 94, suffix: "%", label: "Average confidence score"                },
  { target: 40, suffix: "+", label: "Organizations using Sorabase"            },
];

function useCountUp(target: number, duration: number, started: boolean): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!started) return;

    const skipAnim = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (skipAnim) { setCount(target); return; }

    let startTime: number | null = null;

    function step(ts: number) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [started, target, duration]);

  return count;
}

function StatItem({
  target,
  suffix,
  label,
  started,
  delay,
}: {
  target: number;
  suffix: string;
  label: string;
  started: boolean;
  delay: number;
}) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setGo(true), delay);
    return () => clearTimeout(t);
  }, [started, delay]);

  const count = useCountUp(target, 1400, go);

  return (
    <div
      className={[
        "transition-all duration-500",
        go ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
      ].join(" ")}
    >
      <p className="font-display text-4xl text-stone-900 dark:text-stone-100 leading-none tabular-nums">
        {count}{suffix}
      </p>
      <p className="text-xs text-stone-400 dark:text-stone-500 mt-1.5">{label}</p>
    </div>
  );
}

export function AnimatedTestimonials() {
  const { ref: statsRef, inView } = useInView({ threshold: 0.4 });

  return (
    <section className="py-24 lg:py-32 bg-stone-50 dark:bg-stone-950">
      <div className="mkt-section">
        <p className="eyebrow mb-12">What teams say</p>

        <div className="grid lg:grid-cols-[2fr_1fr] gap-10 lg:gap-16 items-start mb-12 pb-12 border-b border-stone-100 dark:border-stone-800">
          <div>
            <p
              className="font-display italic text-stone-700 dark:text-stone-300 leading-snug mb-7"
              style={{ fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)" }}
            >
              &ldquo;I was skeptical about another AI meeting tool. But Sorabase doesn&apos;t
              summarize — it structures. The confidence scores and evidence citations mean
              you can actually trust the output, not just hope it&apos;s right.&rdquo;
            </p>
            <div>
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">Yuki Tanaka</p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                Director of Recruiting, Summit Search
              </p>
            </div>
          </div>

          <div className="lg:pt-2" ref={statsRef}>
            <div className="rounded-xl border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 p-7 space-y-6">
              {STATS.map(({ target, suffix, label }, i) => (
                <StatItem
                  key={label}
                  target={target}
                  suffix={suffix}
                  label={label}
                  started={inView}
                  delay={i * 180}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {[
            {
              text: "We went from 25 minutes of post-interview notes to a complete structured candidate profile ready before the debrief starts. The whole team uses the same fields now — no more inconsistent notes across interviewers.",
              name: "Rachel Osei",
              role: "Head of Talent, Meridian Partners",
            },
            {
              text: "We defined our sales discovery schema once. Every rep now runs the same extraction, and the JSON pushes straight into Salesforce. We haven't manually updated a CRM record after a call in three months.",
              name: "Tom Varela",
              role: "Revenue Operations Lead, Vantage Growth",
            },
          ].map((q) => (
            <div key={q.name} className="rounded-xl border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 px-7 py-6">
              <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed mb-5">
                &ldquo;{q.text}&rdquo;
              </p>
              <div>
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">{q.name}</p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{q.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
