"use client";

import { useInView } from "./hooks/useInView";

const STEPS = [
  {
    n:     "01",
    title: "Bring the conversation",
    body:  "Connect a live Zoom or Google Meet bot, upload an audio or video file, or paste a transcript directly. SoraBase handles every source format without extra configuration.",
    tags:  ["Zoom", "Google Meet", "Audio upload", "Transcript paste"],
  },
  {
    n:     "02",
    title: "Clean, speaker-labeled transcript",
    body:  "Audio is converted to a speaker-labeled transcript with timestamps. Automatic diarization separates speakers so you know who said what — no manual tagging.",
    tags:  ["Speaker labels", "Timestamps", "Diarization"],
  },
  {
    n:     "03",
    title: "Schema-driven field extraction",
    body:  "AI proposes columns based on what's in your transcript, or you load a saved template. Review and approve the schema, then run extraction against the full text.",
    tags:  ["Recruiter schema", "Custom columns", "AI proposals"],
  },
  {
    n:     "04",
    title: "Structured data, everywhere",
    body:  "Every run produces a complete structured record with confidence scores and evidence citations. Review in the dashboard, export JSON, fire a webhook, or pull via the REST API.",
    tags:  ["Dashboard", "JSON", "Webhooks", "REST API"],
  },
];

export function AnimatedPlatformFlow() {
  const { ref, inView } = useInView({ threshold: 0.1 });

  return (
    <section id="how-it-works" className="py-24 lg:py-32 bg-stone-50 dark:bg-stone-950">
      <div className="mkt-section">
        <div className="max-w-lg mb-16 lg:mb-20">
          <p className="eyebrow mb-4">How it works</p>
          <h2
            className="font-display italic text-stone-900 dark:text-stone-100 leading-tight"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)" }}
          >
            Meeting to structured record<br />in four steps.
          </h2>
        </div>

        <div
          ref={ref}
          className="grid lg:grid-cols-4 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-stone-200 dark:divide-stone-800"
        >
          {STEPS.map((step, i) => (
            <div
              key={step.n}
              className={[
                "relative p-5 sm:p-7 lg:px-8 transition-all duration-500 ease-out",
                i === 0 ? "lg:pl-0" : "",
                i === 3 ? "lg:pr-0" : "",
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
              ].join(" ")}
              style={{ transitionDelay: inView ? `${i * 110}ms` : "0ms" }}
            >
              <span
                className="block font-display italic text-stone-200 dark:text-stone-800 leading-none mb-5 select-none"
                style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)" }}
              >
                {step.n}
              </span>
              <h3 className="text-[15px] font-semibold text-stone-900 dark:text-stone-100 mb-3 leading-snug">
                {step.title}
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mb-5">
                {step.body}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {step.tags.map((t, ti) => (
                  <span
                    key={t}
                    className={[
                      "inline-flex rounded-xs border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 py-0.5 text-[10px] font-medium text-stone-500 dark:text-stone-400 transition-all duration-300",
                      inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
                    ].join(" ")}
                    style={{ transitionDelay: inView ? `${i * 110 + 200 + ti * 50}ms` : "0ms" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
