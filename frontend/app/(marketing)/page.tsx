import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SoraBase — Meeting Intelligence Platform",
  description:
    "SoraBase turns every call, meeting, and transcript into structured, actionable data. Reusable schemas, AI extraction, workflow outputs — for recruiting, sales, and any team.",
  alternates: {
    canonical: "https://www.sorabase.org/",
  },
  openGraph: {
    title:       "SoraBase — Meeting Intelligence Platform",
    description: "From every meeting, a structured workflow. AI-powered extraction for every call.",
    url:         "https://www.sorabase.org/",
    type:        "website",
  },
  twitter: {
    card:        "summary",
    title:       "SoraBase — Meeting Intelligence Platform",
    description: "From every meeting, a structured workflow.",
  },
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HERO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function Hero() {
  return (
    <section className="relative pt-36 pb-24 lg:pt-48 lg:pb-36 overflow-hidden bg-stone-50 dark:bg-stone-950">
      <div
        aria-hidden
        className="dark:hidden pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, #D4D1CB 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          opacity: 0.45,
        }}
      />
      <div
        aria-hidden
        className="hidden dark:block pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, #3C3A36 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          opacity: 0.55,
        }}
      />

      <div className="relative mkt-section">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* Left: copy */}
          <div className="max-w-xl">
            <p className="eyebrow mb-6">Meeting workflow platform</p>

            <h1
              className="font-display italic text-stone-900 dark:text-stone-100 leading-[1.04]"
              style={{ fontSize: "clamp(2.6rem, 5.5vw, 5rem)" }}
            >
              From any meeting,{" "}
              <span className="text-stone-400 dark:text-stone-500">a structured workflow.</span>
            </h1>

            <p className="mt-7 text-[16px] text-stone-500 dark:text-stone-400 leading-relaxed">
              SoraBase extracts structured, confidence-scored data from any conversation —
              interview, sales call, or team sync. Schema-driven, AI-powered, and ready to
              act on before the recap email is written.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn-mkt-primary">
                Get started free
              </Link>
              <Link href="#how-it-works" className="btn-mkt-ghost">
                How it works
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
                <span className="w-1.5 h-1.5 rounded-full bg-aubergine-700" />
                Recruiter Mode — prebuilt
              </span>
              <span className="w-px h-3 bg-stone-200 dark:bg-stone-700" />
              <span className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500" />
                General Mode — configurable
              </span>
            </div>
          </div>

          {/* Right: product preview */}
          <div className="lg:block hidden">
            <SessionPreview />
          </div>
        </div>

        {/* Mobile preview */}
        <div className="lg:hidden mt-12">
          <SessionPreview />
        </div>
      </div>
    </section>
  );
}

function SessionPreview() {
  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden shadow-panel">
      {/* Window chrome */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-950">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-stone-200 dark:bg-stone-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-stone-200 dark:bg-stone-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-stone-200 dark:bg-stone-700" />
        </div>
        <span className="text-xs font-mono text-stone-400 dark:text-stone-500">
          sorabase / sessions / discovery-call
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-aubergine-800 dark:text-aubergine-400">
          <span className="w-1.5 h-1.5 rounded-full bg-aubergine-700 animate-pulse" />
          Extracted
        </span>
      </div>

      {/* Session header */}
      <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Sales Discovery — Acme Corp
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
              2026-05-17 · 38 min · Zoom recording
            </p>
          </div>
          <span className="flex-shrink-0 inline-flex items-center border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-stone-500 dark:text-stone-400 rounded-xs">
            General
          </span>
        </div>
      </div>

      {/* Extracted fields */}
      {[
        { label: "Prospect",    value: "Maria Chen, VP Operations",    conf: 99 },
        { label: "Pain point",  value: "Manual data entry post-meeting", conf: 96 },
        { label: "Budget",      value: "$30k – $50k annually",         conf: 88 },
        { label: "Timeline",    value: "Q3 2026 decision",             conf: 85 },
        { label: "Current",     value: "Google Docs + Notion",         conf: 97 },
        { label: "Next steps",  value: "Demo with ops team, May 24",   conf: 91 },
      ].map(({ label, value, conf }) => (
        <div
          key={label}
          className="flex items-center gap-3 px-5 py-2.5 border-b border-stone-50 dark:border-stone-800/50 hover:bg-stone-50/70 dark:hover:bg-stone-800/30 transition-colors"
        >
          <span className="text-xs text-stone-400 dark:text-stone-500 w-24 flex-shrink-0">{label}</span>
          <span className="flex-1 text-sm text-stone-800 dark:text-stone-200 truncate">{value}</span>
          <span className="text-xs font-mono text-aubergine-700 dark:text-aubergine-400 flex-shrink-0">{conf}%</span>
        </div>
      ))}

      {/* Footer */}
      <div className="px-5 py-3 bg-stone-50/60 dark:bg-stone-950/60 flex items-center justify-between">
        <span className="text-xs text-stone-400 dark:text-stone-500">6 of 12 fields shown</span>
        <span className="text-xs font-medium text-aubergine-800 dark:text-aubergine-400">93% avg confidence</span>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LOGOS BAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function LogosBar() {
  const orgs = [
    "Acme Ventures", "Meridian Staffing", "Goldcrest Capital",
    "Vantage Partners", "NorthBridge Talent", "Summit Search",
  ];
  return (
    <div className="border-y border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 py-10">
      <div className="mkt-section">
        <p className="text-center text-[10px] font-semibold tracking-[0.15em] uppercase text-stone-300 dark:text-stone-600 mb-7">
          Trusted by teams at
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {orgs.map((name) => (
            <span
              key={name}
              className="text-sm font-semibold text-stone-300 dark:text-stone-600 tracking-wide"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PLATFORM FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function PlatformFlow() {
  const steps = [
    {
      n:     "01",
      title: "Bring any source",
      body:  "Connect a live Zoom or Google Meet bot, upload an audio or video recording, or paste a transcript directly. SoraBase handles every source format without configuration.",
      tags:  ["Zoom", "Google Meet", "Audio upload", "Transcript paste"],
    },
    {
      n:     "02",
      title: "Automatic transcript",
      body:  "Speech is converted to a clean, speaker-labeled transcript with timestamps. Diarization separates speakers automatically — no manual tagging required.",
      tags:  ["Speaker labels", "Timestamps", "Diarization"],
    },
    {
      n:     "03",
      title: "Schema-driven extraction",
      body:  "AI proposes columns from your conversation, or you load a saved template. Edit, approve, and run structured extraction against the full transcript.",
      tags:  ["Recruiter schema", "Custom columns", "AI proposals"],
    },
    {
      n:     "04",
      title: "Structured output, anywhere",
      body:  "Every run produces a complete structured record with confidence scores and evidence citations. Review in the dashboard, export JSON, fire a webhook, or call the REST API.",
      tags:  ["Dashboard", "JSON", "Webhooks", "REST API"],
    },
  ];

  return (
    <section id="how-it-works" className="py-24 lg:py-32 bg-stone-50 dark:bg-stone-950">
      <div className="mkt-section">
        <div className="max-w-lg mb-16 lg:mb-20">
          <p className="eyebrow mb-4">How it works</p>
          <h2
            className="font-display italic text-stone-900 dark:text-stone-100 leading-tight"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)" }}
          >
            Four steps.<br />One structured record.
          </h2>
        </div>

        <div className="grid lg:grid-cols-4 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-stone-200 dark:divide-stone-800">
          {steps.map((step, i) => (
            <div
              key={step.n}
              className={[
                "relative p-8 lg:px-8",
                i === 0 ? "lg:pl-0" : "",
                i === 3 ? "lg:pr-0" : "",
              ].join(" ")}
            >
              <span
                className="block font-display italic text-stone-200 dark:text-stone-800 leading-none mb-5 select-none"
                style={{ fontSize: "3.25rem" }}
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
                {step.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex rounded-xs border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 py-0.5 text-[10px] font-medium text-stone-500 dark:text-stone-400"
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   WORKFLOW CANVAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const WORKFLOW_NODES = [
  { id: "input",      label: "Input",        sub: "Source",       active: false },
  { id: "transcript", label: "Transcript",    sub: "Audio → text", active: false },
  { id: "summary",    label: "Summary",       sub: "Key points",   active: false },
  { id: "schema",     label: "Schema",        sub: "AI proposal",  active: false },
  { id: "columns",    label: "Column Config", sub: "Configure",    active: true  },
  { id: "extraction", label: "Extraction",    sub: "Run model",    active: false },
  { id: "output",     label: "Output",        sub: "JSON / API",   active: false },
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

function WorkflowCanvas() {
  return (
    <section id="workflow" className="py-24 lg:py-32 bg-white dark:bg-stone-900">
      <div className="mkt-section">
        <div className="max-w-2xl mb-12">
          <p className="eyebrow mb-4">Visual workflow canvas</p>
          <h2
            className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-5"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)" }}
          >
            Your extraction pipeline,<br />node by node.
          </h2>
          <p className="text-[15px] text-stone-500 dark:text-stone-400 leading-relaxed">
            General Mode gives you a full seven-node visual canvas — from source to structured
            output. Click any node to configure it. The Column Config node is where your
            schema lives: field names, types, and whether AI proposed them or you wrote them.
          </p>
        </div>

        {/* Canvas container */}
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600" />
              Sales Discovery Call
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] font-mono text-stone-400 dark:text-stone-500">7 nodes</span>
              <span className="h-3 w-px bg-stone-200 dark:bg-stone-700" />
              <span className="text-[10px] font-semibold text-aubergine-800 dark:text-aubergine-400">Ready to run</span>
            </div>
          </div>

          {/* Node canvas area */}
          <div className="relative overflow-x-auto">
            {/* Dot grid — light */}
            <div
              aria-hidden
              className="dark:hidden absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle, #D4D1CB 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                opacity: 0.5,
              }}
            />
            {/* Dot grid — dark */}
            <div
              aria-hidden
              className="hidden dark:block absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle, #2E2C29 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            <div className="relative bg-stone-50/80 dark:bg-stone-950/80 px-8 py-10">
              <div className="flex items-center gap-0 min-w-max mx-auto w-fit">
                {WORKFLOW_NODES.map((node, i) => (
                  <div key={node.id} className="flex items-center">
                    {/* Node box */}
                    <div
                      className={[
                        "relative flex flex-col items-center gap-1 px-3 py-3 rounded-lg border text-center w-[96px]",
                        node.active
                          ? "border-aubergine-300 dark:border-aubergine-900 bg-white dark:bg-stone-900 shadow-sm ring-2 ring-aubergine-200/60 dark:ring-aubergine-900/40"
                          : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900",
                      ].join(" ")}
                    >
                      <WorkflowNodeIcon id={node.id} active={node.active} />
                      <span
                        className={[
                          "text-[11px] font-semibold leading-tight",
                          node.active
                            ? "text-aubergine-900 dark:text-aubergine-300"
                            : "text-stone-700 dark:text-stone-300",
                        ].join(" ")}
                      >
                        {node.label}
                      </span>
                      <span className="text-[9px] text-stone-400 dark:text-stone-500 leading-none">
                        {node.sub}
                      </span>
                      {node.active && (
                        <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-aubergine-700 flex items-center justify-center shadow-sm">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </div>

                    {/* Connector line + arrow */}
                    {i < WORKFLOW_NODES.length - 1 && (
                      <div className="flex items-center w-7 flex-shrink-0">
                        <div className="h-px flex-1 bg-stone-300 dark:bg-stone-700" />
                        <svg
                          className="w-2.5 h-2.5 text-stone-300 dark:text-stone-600 flex-shrink-0 -ml-px"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column Config panel — open state */}
          <div className="border-t-2 border-aubergine-200 dark:border-aubergine-900">

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100 dark:border-stone-800 bg-aubergine-50/40 dark:bg-aubergine-950/20">
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

            {/* Column headers */}
            <div className="grid gap-3 items-center px-5 py-2 bg-stone-50 dark:bg-stone-950 border-b border-stone-100 dark:border-stone-800"
              style={{ gridTemplateColumns: "1.5rem 1fr 5rem 4rem 3.5rem" }}>
              <span />
              <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500">Field name</span>
              <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500">Type</span>
              <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500">Required</span>
              <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500 text-right">Conf.</span>
            </div>

            {/* Field rows */}
            {COLUMN_FIELDS.map(({ name, type, req, checked, conf }) => (
              <div
                key={name}
                className={[
                  "grid gap-3 items-center px-5 py-2.5 border-b border-stone-50 dark:border-stone-800/60 last:border-0 transition-colors",
                  checked ? "hover:bg-stone-50/70 dark:hover:bg-stone-800/20" : "opacity-40",
                ].join(" ")}
                style={{ gridTemplateColumns: "1.5rem 1fr 5rem 4rem 3.5rem" }}
              >
                {/* Checkbox */}
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
                {/* Field name */}
                <span className="text-xs font-mono text-stone-600 dark:text-stone-300 truncate">{name}</span>
                {/* Type pill */}
                <span className="inline-flex items-center rounded-xs px-1.5 py-0.5 text-[10px] font-medium font-mono bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/40 w-fit">
                  {type}
                </span>
                {/* Required */}
                <span className={["text-xs font-medium", req ? "text-aubergine-800 dark:text-aubergine-400" : "text-stone-300 dark:text-stone-600"].join(" ")}>
                  {req ? "yes" : "—"}
                </span>
                {/* Confidence */}
                <span className="text-[11px] font-mono text-aubergine-700 dark:text-aubergine-400 text-right">{conf}%</span>
              </div>
            ))}

            {/* Panel footer */}
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

function WorkflowNodeIcon({ id, active }: { id: string; active: boolean }) {
  const cls = [
    "w-4 h-4 mb-0.5 flex-shrink-0",
    active ? "text-aubergine-800 dark:text-aubergine-400" : "text-stone-400 dark:text-stone-500",
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MODE COMPARISON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ModeComparison() {
  return (
    <section id="modes" className="py-24 lg:py-32 bg-stone-50 dark:bg-stone-950">
      <div className="mkt-section">
        <div className="max-w-lg mb-16 lg:mb-20">
          <p className="eyebrow mb-4">Two modes. One workflow engine.</p>
          <h2
            className="font-display italic text-stone-900 dark:text-stone-100 leading-tight"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)" }}
          >
            Prebuilt for recruiting.<br />Configurable for everything else.
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">

          {/* ── General Mode — LEFT, dark editorial header ── */}
          <div className="rounded-xl border border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
            <div className="border-b border-stone-700 bg-stone-950 px-8 py-6">
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] uppercase text-stone-400 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                General Mode
              </span>
              <h3
                className="font-display italic text-stone-100 leading-snug mb-3"
                style={{ fontSize: "clamp(1.3rem, 2vw, 1.65rem)" }}
              >
                Your schema.<br />Your structure. Any meeting.
              </h3>
              <p className="text-sm text-stone-400 leading-relaxed">
                A configurable extraction platform for any conversation type. AI proposes
                columns from your transcript — you edit, approve, and save as a template.
                Sales calls, ops syncs, customer debriefs: same engine, different schemas.
              </p>
            </div>

            {/* 7-node pipeline */}
            <div className="px-8 py-5 border-b border-stone-100 dark:border-stone-800">
              <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500 mb-3">
                7-node configurable pipeline
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                {["Input", "Transcript", "Summary", "Schema", "Col. Config", "Extraction", "Output"].map((node, i, arr) => (
                  <div key={node} className="flex items-center gap-1">
                    <span
                      className={[
                        "inline-flex items-center rounded-xs px-2 py-1 text-[10px] font-medium",
                        node === "Col. Config"
                          ? "border border-aubergine-300 dark:border-aubergine-900 bg-aubergine-50 dark:bg-aubergine-950/50 text-aubergine-900 dark:text-aubergine-300"
                          : "border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400",
                      ].join(" ")}
                    >
                      {node}
                    </span>
                    {i < arr.length - 1 && (
                      <svg className="w-2.5 h-2.5 text-stone-300 dark:text-stone-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Feature list */}
            <div className="px-8 py-6">
              <ul className="space-y-3">
                {[
                  "AI proposes a schema from your transcript content",
                  "Edit columns: name, type, required, description",
                  "Save schemas as reusable, versioned templates",
                  "Run on sales calls, customer meetings, ops syncs",
                  "JSON, webhook, or REST API output",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-stone-600 dark:text-stone-300">
                    <CheckIcon className="text-stone-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Link href="/signup" className="btn-mkt-ghost">
                  Start with General Mode
                </Link>
              </div>
            </div>
          </div>

          {/* ── Recruiter Mode — RIGHT, teal header ── */}
          <div className="rounded-xl border border-aubergine-200 dark:border-aubergine-950 bg-white dark:bg-stone-900 overflow-hidden">
            <div className="border-b border-aubergine-100 dark:border-aubergine-950/60 bg-aubergine-50/50 dark:bg-aubergine-950/30 px-8 py-6">
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] uppercase text-aubergine-900 dark:text-aubergine-400 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-aubergine-700" />
                Recruiter Mode
              </span>
              <h3
                className="font-display italic text-stone-900 dark:text-stone-100 leading-snug mb-3"
                style={{ fontSize: "clamp(1.3rem, 2vw, 1.65rem)" }}
              >
                The workflow is already built.<br />Just run it.
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                An opinionated, end-to-end hiring pipeline. Interview ends — candidate profile
                begins. No schema design. No configuration. You show up; the structure is already there.
              </p>
            </div>

            {/* Fixed 6-node pipeline */}
            <div className="px-8 py-5 border-b border-stone-100 dark:border-stone-800">
              <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500 mb-3">
                Fixed pipeline
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                {["Source", "Transcript", "Extraction", "JD Analysis", "Profile", "Review"].map((node, i, arr) => (
                  <div key={node} className="flex items-center gap-1">
                    <span className="inline-flex items-center rounded-xs border border-aubergine-200 dark:border-aubergine-900 bg-aubergine-50 dark:bg-aubergine-950/50 px-2.5 py-1 text-[10px] font-medium text-aubergine-900 dark:text-aubergine-400">
                      {node}
                    </span>
                    {i < arr.length - 1 && (
                      <svg className="w-2.5 h-2.5 text-stone-300 dark:text-stone-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Feature list */}
            <div className="px-8 py-6">
              <ul className="space-y-3">
                {[
                  "35+ structured fields extracted per interview",
                  "JD fit scoring with Tier A / B / C classification",
                  "Evidence citations for every extracted field",
                  "Recruiter review dashboard with approval queue",
                  "JSON export or direct ATS push",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-stone-600 dark:text-stone-300">
                    <CheckIcon className="text-aubergine-700" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Link href="/signup" className="btn-mkt-primary">
                  Start with Recruiter Mode
                </Link>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs text-stone-400 dark:text-stone-500 text-center">
          Access mode is assigned per account. Choose yours at signup — your workspace is pre-configured from day one.
        </p>
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STRUCTURED DATA / WORKFLOW VALUE PROPOSITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function StructuredDataSection() {
  return (
    <section className="py-24 lg:py-32 bg-white dark:bg-stone-900">
      <div className="mkt-section">

        {/* Section header */}
        <div className="max-w-2xl mb-16 lg:mb-20">
          <p className="eyebrow mb-4">What extraction means</p>
          <h2
            className="font-display italic text-stone-900 dark:text-stone-100 leading-tight"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)" }}
          >
            A transcript is a record of words.<br />Extraction is a record of meaning.
          </h2>
          <p className="mt-5 text-[15px] text-stone-500 dark:text-stone-400 leading-relaxed max-w-xl">
            Transcription tools stop at the spoken word. SoraBase continues —
            pulling out the structured data embedded inside the conversation.
          </p>
        </div>

        {/* Before / after comparison */}
        <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-8 items-start mb-20">

          {/* Before: raw transcript */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-stone-400 dark:text-stone-500 mb-3">
              Before — raw transcript
            </p>
            <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 p-5 font-mono text-xs text-stone-400 dark:text-stone-500 leading-relaxed overflow-hidden">
              <p><span className="text-stone-300 dark:text-stone-600">[00:02:11]</span> Rep: What does the current process look like for capturing notes after a customer call?</p>
              <p className="mt-2"><span className="text-stone-300 dark:text-stone-600">[00:02:18]</span> Maria: Honestly it&apos;s a mess — we&apos;re in Google Docs and Notion, different people have different templates. It takes us probably thirty minutes per call just to write up what happened...</p>
              <p className="mt-2"><span className="text-stone-300 dark:text-stone-600">[00:09:42]</span> Rep: What kind of budget are you working with for a solution like this?</p>
              <p className="mt-2"><span className="text-stone-300 dark:text-stone-600">[00:09:51]</span> Maria: We&apos;re probably looking at thirty to fifty thousand annually depending on the feature set...</p>
              <p className="mt-3 text-stone-300 dark:text-stone-600 select-none">· · · · · 36 more minutes · · · · ·</p>
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

          {/* After: structured fields */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-stone-400 dark:text-stone-500 mb-3">
              After — structured extraction
            </p>
            <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
              {[
                { field: "prospect_name",     value: "Maria Chen, VP Operations",    conf: 99, type: "text"   },
                { field: "pain_points",        value: "Manual notes, no standard fmt", conf: 96, type: "text[]" },
                { field: "budget_range",       value: "$30k – $50k annually",         conf: 88, type: "range"  },
                { field: "decision_timeline",  value: "Q3 2026",                      conf: 85, type: "date"   },
                { field: "current_solution",   value: "Google Docs + Notion",         conf: 97, type: "text"   },
                { field: "next_steps",         value: "Demo with ops team, May 24",   conf: 91, type: "text"   },
              ].map(({ field, value, conf, type }) => (
                <div
                  key={field}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-50 dark:border-stone-800/60 last:border-0"
                >
                  <span className="text-xs font-mono text-stone-300 dark:text-stone-600 w-32 flex-shrink-0">{field}</span>
                  <span className="flex-1 text-sm text-stone-800 dark:text-stone-200 truncate">{value}</span>
                  <span className="text-[10px] font-mono text-stone-300 dark:text-stone-600 flex-shrink-0 mr-1">{type}</span>
                  <span className="text-[11px] font-semibold font-mono text-aubergine-700 dark:text-aubergine-400 flex-shrink-0 w-8 text-right">{conf}%</span>
                </div>
              ))}
              <div className="px-4 py-2.5 bg-stone-50 dark:bg-stone-950 flex items-center justify-between">
                <span className="text-xs text-stone-400 dark:text-stone-500">6 of 12 fields</span>
                <span className="text-xs font-medium text-aubergine-800 dark:text-aubergine-400">93% avg confidence</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 numbered callouts */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-stone-100 dark:divide-stone-800 border border-stone-100 dark:border-stone-800 rounded-xl overflow-hidden">
          {[
            {
              n:     "01",
              title: "Field-by-field",
              body:  "Every piece of data lands in its own named field — not buried in a paragraph summary you have to re-read.",
            },
            {
              n:     "02",
              title: "Confidence-scored",
              body:  "Each extracted value carries a confidence score. Low-confidence fields are flagged for human review — never silently wrong.",
            },
            {
              n:     "03",
              title: "Evidence-cited",
              body:  "Click any field to see the exact transcript passage that produced it. Extraction you can audit, not just trust.",
            },
            {
              n:     "04",
              title: "Schema-versioned",
              body:  "Define your extraction schema once. Save it. Every future session runs against the same structure — consistent and comparable.",
            },
          ].map((item) => (
            <div key={item.n} className="px-7 py-7 bg-white dark:bg-stone-900">
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   INTEGRATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function Integrations() {
  return (
    <section id="integrations" className="py-24 lg:py-32 bg-stone-50 dark:bg-stone-950">
      <div className="mkt-section">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">

          {/* Left: copy */}
          <div>
            <p className="eyebrow mb-4">Integrations</p>
            <h2
              className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-5"
              style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)" }}
            >
              Connect any source.<br />Deliver anywhere.
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mb-8 max-w-sm">
              SoraBase sits in the middle of your meeting workflow — ingesting from wherever
              conversations happen, and routing structured data to wherever your team needs it.
            </p>
            <Link href="/signup" className="btn-mkt-ghost inline-flex">
              See all integrations
            </Link>
          </div>

          {/* Right: two-column source / output */}
          <div className="grid grid-cols-2 gap-4">

            {/* Sources */}
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-stone-400 dark:text-stone-500 mb-3">
                Sources
              </p>
              <div className="space-y-2">
                {[
                  { name: "Zoom",         note: "Live bot · Cloud recording", dot: "bg-blue-400"   },
                  { name: "Google Meet",  note: "Live bot via calendar",       dot: "bg-aubergine-400"  },
                  { name: "Audio upload", note: "MP3, MP4, M4A, WAV",          dot: "bg-stone-400"  },
                  { name: "Transcript",   note: "Paste · Bulk import",         dot: "bg-stone-400"  },
                  { name: "REST API",     note: "Programmatic ingestion",      dot: "bg-violet-400" },
                ].map(({ name, note, dot }) => (
                  <div
                    key={name}
                    className="flex items-start gap-3 rounded-lg border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 px-3.5 py-3"
                  >
                    <span className={["w-2 h-2 rounded-full flex-shrink-0 mt-1", dot].join(" ")} />
                    <div>
                      <p className="text-[13px] font-semibold text-stone-800 dark:text-stone-200">{name}</p>
                      <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">{note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Outputs */}
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-stone-400 dark:text-stone-500 mb-3">
                Outputs
              </p>
              <div className="space-y-2">
                {[
                  { name: "Dashboard",   note: "Built-in review UI",          dot: "bg-aubergine-400"   },
                  { name: "JSON export", note: "Full structured record",       dot: "bg-aubergine-400"   },
                  { name: "CSV export",  note: "Flat file for spreadsheets",  dot: "bg-aubergine-400"   },
                  { name: "Webhooks",    note: "Real-time event delivery",     dot: "bg-amber-400"  },
                  { name: "REST API",    note: "Pull any session's data",      dot: "bg-violet-400" },
                ].map(({ name, note, dot }) => (
                  <div
                    key={name}
                    className="flex items-start gap-3 rounded-lg border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 px-3.5 py-3"
                  >
                    <span className={["w-2 h-2 rounded-full flex-shrink-0 mt-1", dot].join(" ")} />
                    <div>
                      <p className="text-[13px] font-semibold text-stone-800 dark:text-stone-200">{name}</p>
                      <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">{note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SCHEMA TEMPLATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function Templates() {
  const templates = [
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

  return (
    <section className="py-24 lg:py-32 bg-white dark:bg-stone-900">
      <div className="mkt-section">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-16 items-start">

          {/* Left: copy */}
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow mb-4">Schema templates</p>
            <h2
              className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-5"
              style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)" }}
            >
              Define once.<br />Run every time.
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mb-6">
              Save any extraction schema as a reusable template. Every future session
              of the same type runs the same structure — versioned, consistent, and
              ready to compare across runs.
            </p>
            <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
              AI can propose a schema from your first session. Approve the columns,
              save the template. From there, extraction is one click.
            </p>
          </div>

          {/* Right: template cards */}
          <div className="space-y-4">
            {templates.map((tmpl) => (
              <div
                key={tmpl.name}
                className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden"
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
                  {tmpl.fields.map(({ name, note }) => (
                    <div key={name} className="flex items-center gap-4 px-6 py-2.5">
                      <span className="text-xs font-mono text-stone-500 dark:text-stone-400 w-40 flex-shrink-0">{name}</span>
                      <span className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed">{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TESTIMONIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function Testimonials() {
  return (
    <section className="py-24 lg:py-32 bg-stone-50 dark:bg-stone-950">
      <div className="mkt-section">
        <p className="eyebrow mb-12">What teams say</p>

        {/* Lead quote */}
        <div className="grid lg:grid-cols-[2fr_1fr] gap-10 lg:gap-16 items-start mb-12 pb-12 border-b border-stone-100 dark:border-stone-800">
          <div>
            <p
              className="font-display italic text-stone-700 dark:text-stone-300 leading-snug mb-7"
              style={{ fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)" }}
            >
              &ldquo;I was skeptical about another AI meeting tool. But SoraBase doesn&apos;t
              summarize — it structures. That&apos;s a different product. The confidence
              scores and evidence citations make it actually trustworthy.&rdquo;
            </p>
            <div>
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">Yuki Tanaka</p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                Director of Recruiting, Summit Search
              </p>
            </div>
          </div>

          {/* Stat callout */}
          <div className="lg:pt-2">
            <div className="rounded-xl border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 p-7 space-y-6">
              {[
                { n: "35+", label: "Fields extracted per recruiting session" },
                { n: "94%", label: "Average confidence score"                },
                { n: "40+", label: "Organizations using SoraBase"            },
              ].map(({ n, label }) => (
                <div key={label}>
                  <p className="font-display text-4xl text-stone-900 dark:text-stone-100 leading-none">{n}</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mt-1.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Secondary quotes */}
        <div className="grid lg:grid-cols-2 gap-8">
          {[
            {
              text: "We went from spending 25 minutes on post-interview notes to having a structured profile ready before the debrief starts. SoraBase changed how our whole team operates.",
              name: "Rachel Osei",
              role: "Head of Talent, Meridian Partners",
            },
            {
              text: "The schema template feature made this stick for us. We defined our sales call structure once — now every rep runs the same extraction, and the JSON goes straight into Salesforce.",
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BRAND MOMENT — typographic statement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function BrandMoment() {
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

      <div className="relative mkt-section">

        <div className="flex items-center gap-5 mb-14">
          <div className="h-px w-10 bg-aubergine-700" />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-stone-600">
            SoraBase
          </span>
          <div className="h-px flex-1 bg-stone-800" />
        </div>

        <div className="overflow-hidden mb-14">
          <h2
            className="font-display italic text-stone-100 leading-[0.96] select-none"
            style={{ fontSize: "clamp(3.2rem, 11vw, 10.5rem)" }}
          >
            <span className="block">Meetings</span>
            <span className="block text-stone-600">are temporary.</span>
          </h2>
        </div>

        <div className="overflow-hidden mb-14">
          <h2
            className="font-display italic text-aubergine-400 leading-[0.96] select-none"
            style={{ fontSize: "clamp(3.2rem, 11vw, 10.5rem)" }}
          >
            <span className="block">Structure</span>
            <span className="block text-aubergine-900/80">is permanent.</span>
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 pt-8 border-t border-stone-800/60">
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PRICING PREVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function PricingPreview() {
  const plans = [
    {
      name:      "Free",
      price:     "$0",
      period:    "forever",
      desc:      "10 meetings included. Good for trying the product — no credit card required.",
      features:  ["10 meetings", "Transcript + summary", "Basic extraction", "JSON export"],
      cta:       "Get started free",
      href:      "/signup",
      highlight: false,
      ctaEl:     "link" as const,
    },
    {
      name:      "Pro",
      price:     "$20",
      period:    "/ month",
      desc:      "Unlimited meetings and the full feature set. The plan for regular use.",
      features:  ["Unlimited meetings", "AI schema proposals", "Saved templates", "Webhooks & API"],
      cta:       "Start with Pro",
      href:      "/signup",
      highlight: true,
      ctaEl:     "link" as const,
    },
    {
      name:      "Custom",
      price:     "Custom",
      period:    "",
      desc:      "Custom workflows, team rollouts, special integrations, or unusual requirements.",
      features:  ["Everything in Pro", "Custom workflow design", "Team onboarding", "Flexible pricing"],
      cta:       "Talk to us",
      href:      "mailto:hello@sorabase.com",
      highlight: false,
      ctaEl:     "anchor" as const,
    },
  ];

  return (
    <section className="py-24 lg:py-32 bg-stone-50 dark:bg-stone-950">
      <div className="mkt-section">
        <div className="text-center max-w-lg mx-auto mb-14">
          <p className="eyebrow mb-4">Pricing</p>
          <h2
            className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-4"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)" }}
          >
            Simple, honest pricing.
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
            Start free with 10 meetings. Upgrade to Pro at $20/month for unlimited.
            Something custom? Let&apos;s talk.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={[
                "rounded-xl border flex flex-col p-7",
                plan.highlight
                  ? "border-aubergine-300 dark:border-aubergine-900 bg-white dark:bg-stone-900 ring-1 ring-aubergine-200 dark:ring-aubergine-900/50"
                  : "border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900",
              ].join(" ")}
            >
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-stone-400 dark:text-stone-500 mb-4">
                {plan.name}
              </p>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span
                  className={[
                    "font-display leading-none",
                    plan.name === "Custom"
                      ? "text-stone-400 dark:text-stone-500 text-2xl"
                      : "text-stone-900 dark:text-stone-100 text-4xl",
                  ].join(" ")}
                >
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-stone-400 dark:text-stone-500">{plan.period}</span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed mt-2 mb-6">
                {plan.desc}
              </p>

              <ul className="space-y-2.5 flex-1 mb-7">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-stone-600 dark:text-stone-300">
                    <CheckIcon className={plan.highlight ? "text-aubergine-700" : "text-stone-400"} />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.ctaEl === "anchor" ? (
                <a href={plan.href} className="btn-mkt-ghost">
                  {plan.cta}
                </a>
              ) : (
                <Link
                  href={plan.href}
                  className={plan.highlight ? "btn-mkt-primary" : "btn-mkt-ghost"}
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        <p className="text-center mt-7 text-xs text-stone-400 dark:text-stone-500">
          Free includes 10 meetings. Pro is $20/month, unlimited.{" "}
          <Link href="/pricing" className="text-aubergine-800 dark:text-aubergine-400 hover:underline underline-offset-2">
            See full feature comparison →
          </Link>
        </p>
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FINAL CTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function FinalCTA() {
  return (
    <section className="py-24 lg:py-32 bg-white dark:bg-stone-900">
      <div className="mkt-section">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 px-10 py-16 lg:px-20 lg:py-20">
          <div className="max-w-xl">
            <p className="eyebrow mb-5">Ready to start?</p>
            <h2
              className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-5"
              style={{ fontSize: "clamp(1.8rem, 3vw, 2.6rem)" }}
            >
              Turn your next meeting into a structured record.
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mb-9">
              Start free with 10 meetings — no credit card required. Choose your access mode
              at signup and your workspace is ready from day one. Upgrade to Pro at $20/month
              when you need unlimited.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn-mkt-primary">
                Get started free
              </Link>
              <Link href="/pricing" className="btn-mkt-ghost">
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BRAND SIGNATURE — cinematic homepage ending
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function BrandSignature() {
  return (
    <section
      aria-label="SoraBase"
      className="relative overflow-hidden flex flex-col justify-end"
      style={{
        minHeight: "80vh",
        // Starts from exact white so there is zero seam against FinalCTA's bg-white.
        // Atmospheric tones only build from ~14% onward — kept desaturated near the top
        // so the colour shift is imperceptible until you are well into the section.
        background:
          "linear-gradient(to bottom," +
          "  #FFFFFF    0%,"  +
          "  #F8F4F7    5%,"  +
          "  #ECE1EE   14%,"  +
          "  #D3B6D4   25%,"  +
          "  #A87CAA   37%,"  +
          "  #7A4882   49%,"  +
          "  #481C5A   62%,"  +
          "  #240E36   80%,"  +
          "  #0C0618  100%"   +
          ")",
      }}
    >
      {/* ── Light-mode white veil ───────────────────────────────────────────────
          Sits on top of the gradient and fades from pure white to transparent
          over ~44% of the section height. This guarantees that even if the
          gradient's white at 0% drifts slightly, the veil covers any trace of
          a seam and gives the section a soft, slow emergence from the page. */}
      <div
        aria-hidden
        className="dark:hidden pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: "56%",
          background:
            "linear-gradient(to bottom," +
            "  rgba(255,255,255,1.00)  0%,"  +
            "  rgba(255,255,255,0.96) 10%,"  +
            "  rgba(255,255,255,0.82) 22%,"  +
            "  rgba(255,255,255,0.54) 38%,"  +
            "  rgba(255,255,255,0.22) 56%,"  +
            "  rgba(255,255,255,0.06) 74%,"  +
            "  transparent           100%"   +
            ")",
        }}
      />

      {/* ── Dark-mode stone veil ─────────────────────────────────────────────── */}
      <div
        aria-hidden
        className="hidden dark:block pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: "48%",
          background:
            "linear-gradient(to bottom," +
            "  rgba(28,27,24,1.00)   0%,"  +
            "  rgba(28,27,24,0.90)  12%,"  +
            "  rgba(28,27,24,0.65)  28%,"  +
            "  rgba(28,27,24,0.30)  50%,"  +
            "  rgba(28,27,24,0.08)  72%,"  +
            "  transparent          100%"  +
            ")",
        }}
      />

      {/* ── Soft atmospheric cloud — blurred radial haze ─────────────────────────
          A heavily blurred elliptical gradient that adds the plum/mauve mid-tone
          without any hard edges. Positioned in the transition zone so colour
          materialises gently before the section deepens. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0"
        style={{
          top: "20%",
          height: "52%",
          background:
            "radial-gradient(ellipse 85% 70% at 50% 32%," +
            "  rgba(148, 88, 168, 0.22)  0%,"  +
            "  rgba(100, 50, 135, 0.10) 48%,"  +
            "  transparent              72%"   +
            ")",
          filter: "blur(48px)",
        }}
      />

      {/* ── Grain ─────────────────────────────────────────────────────────────── */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.055]"
        style={{ mixBlendMode: "overlay" }}
      >
        <filter id="sb-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#sb-grain)" />
      </svg>

      {/* ── SORABASE wordmark ─────────────────────────────────────────────────── */}
      <div className="relative w-full select-none" aria-hidden>
        <span
          className="font-display italic block w-full text-center"
          style={{
            fontSize: "clamp(3.5rem, 17.5vw, 24rem)",
            color: "rgba(238, 226, 248, 0.86)",
            letterSpacing: "-0.025em",
            lineHeight: 0.82,
          }}
        >
          SORABASE
        </span>
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SHARED ICONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function CheckIcon({ className = "text-aubergine-700" }: { className?: string }) {
  return (
    <svg
      className={["w-[15px] h-[15px] flex-shrink-0 mt-0.5", className].join(" ")}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PAGE EXPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function HomePage() {
  return (
    <main>
      <Hero />
      <LogosBar />
      <PlatformFlow />
      <WorkflowCanvas />
      <ModeComparison />
      <StructuredDataSection />
      <Integrations />
      <Templates />
      <Testimonials />
      <BrandMoment />
      <PricingPreview />
      <FinalCTA />
      <BrandSignature />
    </main>
  );
}
