import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* ── Left panel: form ──────────────────────────────────────────────── */}
      <div className="flex flex-col bg-stone-50 dark:bg-stone-950">
        {/* Wordmark */}
        <header className="h-16 flex items-center px-8 lg:px-12 flex-shrink-0">
          <Link
            href="/"
            className="font-display italic text-[20px] leading-none text-stone-900 dark:text-stone-100 hover:opacity-70 transition-opacity"
          >
            SoraBase
          </Link>
        </header>

        {/* Form slot */}
        <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-12">
          {children}
        </div>

        {/* Footer */}
        <footer className="px-8 lg:px-12 py-5">
          <p className="text-xs text-stone-400 dark:text-stone-500">
            © {new Date().getFullYear()} SoraBase, Inc.
            {" · "}
            <a href="#" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
              Privacy
            </a>
            {" · "}
            <a href="#" className="hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
              Terms
            </a>
          </p>
        </footer>
      </div>

      {/* ── Right panel: brand (desktop only) ────────────────────────────── */}
      <div className="hidden lg:flex flex-col bg-stone-950 relative overflow-hidden">
        {/* Column line texture */}
        <div aria-hidden className="absolute inset-0 flex pointer-events-none">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex-1 border-r border-stone-800/40 last:border-0" />
          ))}
        </div>
        {/* Teal left accent */}
        <div aria-hidden className="absolute left-0 top-0 bottom-0 w-px bg-teal-700/30" />

        <div className="relative flex flex-col h-full px-14 py-14">

          {/* Top: brand label */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="h-px w-8 bg-teal-700" />
            <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-stone-600">
              SoraBase
            </span>
          </div>

          {/* Center: statement */}
          <div className="py-16">
            <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-stone-600 mb-8">
              Meeting intelligence
            </p>
            <h2
              className="font-display italic leading-[0.97]"
              style={{ fontSize: "clamp(2.4rem, 4vw, 3.6rem)" }}
            >
              <span className="text-stone-100">Every meeting ends.</span>
              <br />
              <span className="text-teal-400">The record</span>
              <br />
              <span className="text-teal-700/80">doesn&apos;t.</span>
            </h2>
            <p className="mt-8 text-[13px] text-stone-500 leading-relaxed max-w-xs">
              SoraBase extracts structured, confidence-scored data from every call —
              automatically, every time.
            </p>
          </div>

          {/* Bottom: mini session preview */}
          <div className="mt-auto">
            <div className="rounded-lg border border-stone-800 bg-stone-900/60 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-800">
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-teal-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                  Extracted
                </span>
                <span className="ml-auto text-[10px] font-mono text-stone-600">94% avg confidence</span>
              </div>
              {[
                { f: "candidate",    v: "Sarah Mitchell"             },
                { f: "role",         v: "Senior PM"                  },
                { f: "jd_fit_score", v: "87 / 100  ·  Tier A"       },
                { f: "comp_range",   v: "$165k – $185k"              },
              ].map(({ f, v }) => (
                <div key={f} className="flex items-center gap-3 px-4 py-2 border-b border-stone-800/60 last:border-0">
                  <span className="text-[10px] font-mono text-stone-600 w-24 flex-shrink-0">{f}</span>
                  <span className="text-[11px] text-stone-300 truncate">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-stone-700 mt-3">
              35+ structured fields · evidence-cited · ready to review
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
