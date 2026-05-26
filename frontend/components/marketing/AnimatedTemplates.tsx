"use client";

import { useEffect, useRef, useState } from "react";

const TEMPLATES = [
  {
    name: "Technical Interview",
    tag:  "Recruiting",
    fields: [
      { name: "technical_depth",   note: "How deep is the candidate's technical knowledge?" },
      { name: "system_design",     note: "Can they design at scale?"                         },
      { name: "problem_solving",   note: "Approach and process"                              },
      { name: "code_quality",      note: "Standards, practices, mentality"                   },
      { name: "culture_signal",    note: "Team fit indicators"                               },
    ],
  },
  {
    name: "Sales Discovery Call",
    tag:  "Sales",
    fields: [
      { name: "pain_points",       note: "Current problems being experienced"                },
      { name: "budget_range",      note: "Stated or implied budget signals"                  },
      { name: "decision_timeline", note: "When are they looking to move?"                    },
      { name: "key_stakeholders",  note: "Who else is in the room?"                          },
      { name: "current_solution",  note: "What do they use today?"                           },
    ],
  },
  {
    name: "Customer Debrief",
    tag:  "Customer Success",
    fields: [
      { name: "overall_sentiment", note: "Positive, neutral, at-risk signal"                 },
      { name: "action_items",      note: "Committed next steps from call"                    },
      { name: "blockers",          note: "What's preventing progress?"                       },
      { name: "feature_requests",  note: "Product feedback and gaps"                         },
      { name: "renewal_signal",    note: "Is this account healthy?"                          },
    ],
  },
];

const AUTO_INTERVAL = 3500;

export function AnimatedTemplates() {
  const [active,   setActive]   = useState(0);
  const [fading,   setFading]   = useState(false);
  const [visible,  setVisible]  = useState(0); // rows revealed in active template
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function switchTo(idx: number) {
    if (idx === active) return;
    setFading(true);
    setVisible(0);
    setTimeout(() => {
      setActive(idx);
      setFading(false);
    }, 180);
  }

  // Row reveal after template switch
  useEffect(() => {
    setVisible(0);
    let cancelled = false;
    const tmpl = TEMPLATES[active];

    async function reveal() {
      for (let i = 1; i <= tmpl.fields.length; i++) {
        await new Promise<void>((r) => setTimeout(r, 80));
        if (cancelled) return;
        setVisible(i);
      }
    }

    const t = setTimeout(() => reveal(), 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [active]);

  // Auto-rotation
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % TEMPLATES.length;
        setFading(true);
        setVisible(0);
        setTimeout(() => setFading(false), 180);
        return next;
      });
    }, AUTO_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function handleTabClick(idx: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    switchTo(idx);
    timerRef.current = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % TEMPLATES.length;
        setFading(true);
        setVisible(0);
        setTimeout(() => setFading(false), 180);
        return next;
      });
    }, AUTO_INTERVAL);
  }

  const tmpl = TEMPLATES[active];

  return (
    <section className="py-24 lg:py-32 bg-white dark:bg-stone-900">
      <div className="mkt-section">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-8 lg:gap-16 items-start">

          {/* Left: copy */}
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow mb-4">Schema templates</p>
            <h2
              className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-5"
              style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)" }}
            >
              Define once.<br />Run on every session.
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mb-6">
              Save any extraction schema as a reusable template. Every future session
              of the same type runs the same structure — versioned, consistent data
              you can compare across runs, teams, and time.
            </p>
            <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
              AI proposes a schema from your first session. Approve the columns, save
              the template. From there, extraction is one click.
            </p>

            {/* Tab pills */}
            <div className="mt-8 flex flex-wrap gap-2">
              {TEMPLATES.map((t, i) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => handleTabClick(i)}
                  className={[
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border",
                    i === active
                      ? "border-aubergine-300 dark:border-aubergine-800 bg-aubergine-50 dark:bg-aubergine-950/50 text-aubergine-900 dark:text-aubergine-300"
                      : "border-stone-200 dark:border-stone-700 text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:border-stone-300 dark:hover:border-stone-600",
                  ].join(" ")}
                >
                  {t.tag}
                </button>
              ))}
            </div>

            {/* Progress dots */}
            <div className="mt-4 flex items-center gap-1.5">
              {TEMPLATES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleTabClick(i)}
                  className={[
                    "rounded-full transition-all duration-300",
                    i === active
                      ? "w-4 h-1.5 bg-aubergine-600 dark:bg-aubergine-500"
                      : "w-1.5 h-1.5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600",
                  ].join(" ")}
                  aria-label={TEMPLATES[i].name}
                />
              ))}
            </div>
          </div>

          {/* Right: animated template card */}
          <div>
            <div
              className={[
                "rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden transition-opacity duration-180",
                fading ? "opacity-0" : "opacity-100",
              ].join(" ")}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800">
                <div>
                  <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500">
                    {tmpl.tag}
                  </span>
                  <h3 className="text-[15px] font-semibold text-stone-900 dark:text-stone-100 mt-0.5">
                    {tmpl.name}
                  </h3>
                </div>
                <span className="text-xs font-mono text-stone-300 dark:text-stone-600">
                  {tmpl.fields.length} fields
                </span>
              </div>

              <div className="divide-y divide-stone-50 dark:divide-stone-800/60">
                {tmpl.fields.map(({ name, note }, ri) => (
                  <div
                    key={name}
                    className={[
                      "flex items-center gap-4 px-6 py-2.5 transition-all duration-200",
                      ri < visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none",
                    ].join(" ")}
                  >
                    <span className="text-xs font-mono text-stone-500 dark:text-stone-400 w-28 sm:w-40 flex-shrink-0">
                      {name}
                    </span>
                    <span className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed">
                      {note}
                    </span>
                  </div>
                ))}
              </div>

              <div className="px-6 py-3 border-t border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-950/60 flex items-center justify-between">
                <span className="text-[10px] text-stone-400 dark:text-stone-500 font-mono">
                  template_v1
                </span>
                <span className="text-[10px] font-medium text-aubergine-800 dark:text-aubergine-400">
                  Use template →
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
