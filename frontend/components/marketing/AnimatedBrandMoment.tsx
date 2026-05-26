"use client";

import { useInView } from "./hooks/useInView";
import Link from "next/link";

export function AnimatedBrandMoment() {
  const { ref, inView } = useInView({ threshold: 0.2 });

  return (
    <section
      aria-label="SoraBase"
      className="relative overflow-hidden bg-stone-950 py-28 lg:py-40"
    >
      <div aria-hidden className="absolute inset-0 flex pointer-events-none">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex-1 border-r border-stone-800/40" />
        ))}
      </div>
      <div aria-hidden className="absolute left-0 top-0 bottom-0 w-px bg-aubergine-700/30" />

      <div ref={ref} className="relative mkt-section">

        <div className="flex items-center gap-5 mb-14">
          <div className="h-px w-10 bg-aubergine-700" />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-stone-600">
            SoraBase
          </span>
          <div className="h-px flex-1 bg-stone-800" />
        </div>

        {/* "Meetings are temporary." — fades in first */}
        <div
          className={[
            "mb-14 transition-all duration-600 ease-out",
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
          ].join(" ")}
          style={{ transitionDelay: inView ? "0ms" : "0ms" }}
        >
          <h2
            className="font-display italic text-stone-100 leading-[1.04] select-none"
            style={{ fontSize: "clamp(3.2rem, 11vw, 10.5rem)" }}
          >
            <span className="block">Meetings</span>
            <span className="block text-stone-600">are temporary.</span>
          </h2>
        </div>

        {/* "Structure is permanent." — fades in with delay */}
        <div
          className={[
            "mb-14 transition-all duration-700 ease-out",
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
          ].join(" ")}
          style={{ transitionDelay: inView ? "220ms" : "0ms" }}
        >
          <h2
            className="font-display italic text-aubergine-400 leading-[1.04] select-none"
            style={{ fontSize: "clamp(3.2rem, 11vw, 10.5rem)" }}
          >
            <span className="block">Structure</span>
            <span className="block text-aubergine-300">is permanent.</span>
          </h2>
        </div>

        <div
          className={[
            "flex flex-col sm:flex-row sm:items-center justify-between gap-8 pt-8 border-t border-stone-800/60 transition-all duration-500 ease-out",
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
          ].join(" ")}
          style={{ transitionDelay: inView ? "420ms" : "0ms" }}
        >
          <p className="text-stone-400 text-[15px] leading-relaxed max-w-md">
            From every call: a structured record. Searchable, exportable, and
            ready to act on — long after the conversation ends.
          </p>
          <Link href="/signup" className="btn-mkt-primary flex-shrink-0">
            Get started free
          </Link>
        </div>
      </div>
    </section>
  );
}
