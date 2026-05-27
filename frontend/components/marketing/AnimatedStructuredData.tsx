"use client";

import { useInView } from "./hooks/useInView";

const AFTER_FIELDS = [
  { field: "full_name",               value: "Jamie Rivera",                conf: 99, type: "text"   },
  { field: "current_title",           value: "Senior Backend Engineer",     conf: 97, type: "text"   },
  { field: "years_experience_years",  value: "7 years",                     conf: 94, type: "number" },
  { field: "work_authorization",      value: "Authorized — no sponsorship", conf: 99, type: "enum"   },
  { field: "notice_period_days",      value: "14 days",                     conf: 91, type: "number" },
  { field: "recruiter_recommendation",value: "Strong hire — Tier A",        conf: 88, type: "text"   },
];

const CALLOUTS = [
  {
    n:     "01",
    title: "Field-by-field",
    body:  "Every piece of data lands in a named field — not buried in a paragraph you have to re-read or interpret.",
  },
  {
    n:     "02",
    title: "Confidence-scored",
    body:  "Each extracted value carries a 0–100% confidence score. Low-confidence fields are flagged for human review — never silently wrong.",
  },
  {
    n:     "03",
    title: "Evidence-cited",
    body:  "Every field links back to the exact transcript line that produced it. Auditable extraction, not just trusted extraction.",
  },
  {
    n:     "04",
    title: "Schema-consistent",
    body:  "Run the same schema across every session of the same type. Outputs are comparable, structured the same way, every time.",
  },
];

export function AnimatedStructuredData() {
  const { ref: afterRef,    inView: afterInView    } = useInView({ threshold: 0.2 });
  const { ref: calloutsRef, inView: calloutsInView } = useInView({ threshold: 0.1 });

  return (
    <section className="py-24 lg:py-32 bg-white dark:bg-stone-900">
      <div className="mkt-section">

        <div className="max-w-2xl mb-16 lg:mb-20">
          <p className="eyebrow mb-4">What extraction actually means</p>
          <h2
            className="font-display italic text-stone-900 dark:text-stone-100 leading-tight"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)" }}
          >
            A transcript is a record of words.<br />Extraction is a record of meaning.
          </h2>
          <p className="mt-5 text-[15px] text-stone-500 dark:text-stone-400 leading-relaxed max-w-xl">
            AI notetakers stop at the spoken word. Sorabase continues — pulling
            structured, field-level data from the conversation and attaching evidence
            for every value it extracts.
          </p>
        </div>

        {/* Before / After */}
        <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-8 items-start mb-20">

          {/* Before */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-stone-400 dark:text-stone-500 mb-3">
              Before — raw interview transcript
            </p>
            <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 p-5 font-mono text-xs text-stone-400 dark:text-stone-500 leading-relaxed overflow-hidden">
              <p><span className="text-stone-300 dark:text-stone-600">[00:03:14]</span> Interviewer: How many years have you been working in backend engineering overall?</p>
              <p className="mt-2"><span className="text-stone-300 dark:text-stone-600">[00:03:19]</span> Jamie: About seven years now — primarily Go and distributed systems, a couple years of Python before that...</p>
              <p className="mt-2"><span className="text-stone-300 dark:text-stone-600">[00:11:22]</span> Interviewer: What&apos;s your timeline looking like? When could you realistically start a new role?</p>
              <p className="mt-2"><span className="text-stone-300 dark:text-stone-600">[00:11:31]</span> Jamie: I&apos;m on two weeks notice at my current job, so pretty quickly. I&apos;m also fully authorized to work — no sponsorship needed...</p>
              <p className="mt-3 text-stone-300 dark:text-stone-600 select-none">· · · · · 42 more minutes · · · · ·</p>
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden lg:flex items-center justify-center pt-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-px h-8 bg-stone-200 dark:bg-stone-700" />
              <div className="w-8 h-8 rounded-full border border-aubergine-200 dark:border-aubergine-900 bg-aubergine-50 dark:bg-aubergine-950 flex items-center justify-center text-aubergine-800 dark:text-aubergine-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
              <div className="w-px h-8 bg-stone-200 dark:bg-stone-700" />
            </div>
          </div>

          {/* After — fields reveal on scroll */}
          <div ref={afterRef}>
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-stone-400 dark:text-stone-500 mb-3">
              After — structured extraction
            </p>
            <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
              {AFTER_FIELDS.map(({ field, value, conf, type }, i) => (
                <div
                  key={field}
                  className={[
                    "flex items-center gap-3 px-4 py-2.5 border-b border-stone-50 dark:border-stone-800/60 last:border-0 transition-all duration-300",
                    afterInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2",
                  ].join(" ")}
                  style={{ transitionDelay: afterInView ? `${i * 80}ms` : "0ms" }}
                >
                  <span className="text-xs font-mono text-stone-300 dark:text-stone-600 w-36 flex-shrink-0">{field}</span>
                  <span className="flex-1 text-sm text-stone-800 dark:text-stone-200 truncate">{value}</span>
                  <span className="text-[10px] font-mono text-stone-300 dark:text-stone-600 flex-shrink-0 mr-1">{type}</span>
                  <span className="text-[11px] font-semibold font-mono text-aubergine-700 dark:text-aubergine-400 flex-shrink-0 w-8 text-right">{conf}%</span>
                </div>
              ))}
              <div className="px-4 py-2.5 bg-stone-50 dark:bg-stone-950 flex items-center justify-between">
                <span className="text-xs text-stone-400 dark:text-stone-500">6 of 35 fields</span>
                <span
                  className={[
                    "text-xs font-medium text-aubergine-800 dark:text-aubergine-400 transition-all duration-500",
                    afterInView ? "opacity-100" : "opacity-0",
                  ].join(" ")}
                  style={{ transitionDelay: afterInView ? "600ms" : "0ms" }}
                >
                  95% avg confidence
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 numbered callouts */}
        <div
          ref={calloutsRef}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-stone-100 dark:divide-stone-800 border border-stone-100 dark:border-stone-800 rounded-xl overflow-hidden"
        >
          {CALLOUTS.map((item, i) => (
            <div
              key={item.n}
              className={[
                "px-7 py-7 bg-white dark:bg-stone-900 transition-all duration-400",
                calloutsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
              ].join(" ")}
              style={{ transitionDelay: calloutsInView ? `${i * 90}ms` : "0ms" }}
            >
              <span
                className="block font-display italic text-stone-200 dark:text-stone-800 leading-none mb-4 select-none"
                style={{ fontSize: "2rem" }}
              >
                {item.n}
              </span>
              <h3 className="text-[13px] font-semibold text-stone-900 dark:text-stone-100 mb-2">{item.title}</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
