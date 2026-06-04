import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { ProductDemo }            from "@/components/marketing/ProductDemo";
import { AnimatedPlatformFlow }   from "@/components/marketing/AnimatedPlatformFlow";
import { AnimatedWorkflowCanvas } from "@/components/marketing/AnimatedWorkflowCanvas";
import { AnimatedTemplates }      from "@/components/marketing/AnimatedTemplates";
import { AnimatedTestimonials }   from "@/components/marketing/AnimatedTestimonials";
import { AnimatedStructuredData } from "@/components/marketing/AnimatedStructuredData";
import { AnimatedBrandMoment }    from "@/components/marketing/AnimatedBrandMoment";

export const metadata: Metadata = {
  title: "Sorabase — Structured Data from Every Meeting",
  description:
    "Sorabase turns interviews, sales calls, and team meetings into field-by-field structured data — confidence-scored, evidence-cited, and ready to push into your ATS, CRM, or BI tools.",
  alternates: { canonical: "https://www.sorabase.org/" },
  openGraph: {
    title:       "Sorabase — Structured Data from Every Meeting",
    description: "Field-by-field extraction from any conversation. Confidence-scored outputs with evidence citations, ready to push into your systems.",
    url:         "https://www.sorabase.org/",
    type:        "website",
  },
  twitter: {
    card:        "summary",
    title:       "Sorabase — Structured Data from Every Meeting",
    description: "Field-by-field extraction from any conversation. Not summaries — structured data.",
  },
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HERO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function Hero() {
  return (
    <section className="relative pt-40 pb-28 lg:pt-56 lg:pb-44 overflow-hidden bg-stone-25 dark:bg-stone-950">
      {/* Top + bottom edge rules */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-stone-200 dark:via-stone-800 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-stone-200 dark:via-stone-800 to-transparent" />

      {/* Warm radial glow — light mode only */}
      <div
        aria-hidden
        className="dark:hidden pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(74,40,56,0.055) 0%, transparent 70%)",
        }}
      />

      <div className="relative mkt-section">
        <div className="grid lg:grid-cols-[1fr_1.15fr] gap-14 lg:gap-24 items-center">

          {/* ── Copy ── */}
          <div className="max-w-[560px]">
            {/* Pill eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-aubergine-200 dark:border-aubergine-900 bg-aubergine-50 dark:bg-aubergine-950/30 px-3.5 py-1.5 mb-9">
              <span className="w-1.5 h-1.5 rounded-full bg-aubergine-700 dark:bg-aubergine-500 flex-shrink-0" />
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-aubergine-800 dark:text-aubergine-400">
                Meeting intelligence platform
              </span>
            </div>

            <h1
              className="font-display italic text-stone-900 dark:text-stone-100 leading-[1.04] mb-7"
              style={{ fontSize: "clamp(2.8rem, 5.2vw, 4.8rem)" }}
            >
              Your meetings produce{" "}
              <span className="text-stone-400 dark:text-stone-500">data, not just transcripts.</span>
            </h1>

            <p className="text-[17px] text-stone-500 dark:text-stone-400 leading-relaxed max-w-[460px] mb-10">
              Schema-driven extraction that turns any conversation into
              confidence-scored, evidence-cited structured records — before the
              recap email is written.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-9">
              <Link href="/signup" className={buttonVariants({ variant: "primary" })}>
                Get started free
              </Link>
              <Link href="#how-it-works" className={buttonVariants({ variant: "ghost" })}>
                How it works
              </Link>
            </div>

            {/* Mode pills */}
            <div className="flex flex-wrap items-center gap-4 pt-7 border-t border-stone-150 dark:border-stone-800">
              <span className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500">
                <span className="w-1.5 h-1.5 rounded-full bg-aubergine-700" />
                Recruiter Mode — prebuilt
              </span>
              <span className="w-px h-3 bg-stone-200 dark:bg-stone-800" />
              <span className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500" />
                General Mode — configurable
              </span>
            </div>
          </div>

          {/* ── Product visual ── */}
          <div className="hidden lg:block">
            <ProductDemo />
          </div>
        </div>

        {/* Mobile */}
        <div className="lg:hidden mt-14">
          <ProductDemo />
        </div>
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TRUST BAR  (replaces fake-logo bar with honest product signals)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function TrustBar() {
  const stats = [
    { value: "35+",   label: "structured fields extracted per meeting"   },
    { value: "94%",   label: "average extraction confidence score"        },
    { value: "<60 s", label: "from audio to structured record"            },
  ];

  return (
    <div className="border-y border-stone-100 dark:border-stone-800/70 bg-white dark:bg-stone-900/60">
      <div className="mkt-section py-10">
        <div className="grid sm:grid-cols-3 gap-8 sm:gap-0 sm:divide-x divide-stone-100 dark:divide-stone-800">
          {stats.map(({ value, label }) => (
            <div key={value} className="sm:px-10 first:pl-0 last:pr-0 flex flex-col gap-1">
              <span className="font-display italic text-stone-900 dark:text-stone-100 text-3xl leading-none tracking-tight">
                {value}
              </span>
              <span className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MODE COMPARISON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ModeComparison() {
  return (
    <section id="modes" className="py-28 lg:py-36 bg-stone-50 dark:bg-stone-950">
      <div className="mkt-section">

        <div className="max-w-lg mb-16 lg:mb-20">
          <p className="eyebrow mb-4">Two modes. One extraction engine.</p>
          <h2
            className="font-display italic text-stone-900 dark:text-stone-100 leading-tight"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)" }}
          >
            Prebuilt for recruiting.<br />
            Configurable for everything else.
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">

          {/* ── General Mode ── */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
            {/* Header */}
            <div className="border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 px-8 py-7">
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] uppercase text-stone-500 dark:text-stone-400 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500" />
                General Mode
              </span>
              <h3
                className="font-display italic text-stone-900 dark:text-stone-100 leading-snug mb-3"
                style={{ fontSize: "clamp(1.3rem, 2vw, 1.65rem)" }}
              >
                Your schema.<br />Any conversation.
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                Define your own extraction columns for any meeting type. AI proposes a
                schema from your transcript — you edit, approve, and save as a versioned
                template. Sales calls, ops syncs, customer debriefs: one engine, unlimited schemas.
              </p>
            </div>

            {/* Pipeline */}
            <div className="px-8 py-5 border-b border-stone-100 dark:border-stone-800">
              <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500 mb-3">
                7-node configurable pipeline
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                {["Input","Transcript","Summary","Schema","Col. Config","Extraction","Output"].map((node, i, arr) => (
                  <div key={node} className="flex items-center gap-1">
                    <span className={[
                      "inline-flex items-center rounded-xs px-2 py-1 text-[10px] font-medium",
                      node === "Col. Config"
                        ? "border border-aubergine-200 dark:border-aubergine-900 bg-aubergine-50 dark:bg-aubergine-950/50 text-aubergine-800 dark:text-aubergine-400"
                        : "border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400",
                    ].join(" ")}>
                      {node}
                    </span>
                    {i < arr.length - 1 && (
                      <ChevronIcon />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="px-8 py-7">
              <ul className="space-y-3">
                {[
                  "AI proposes columns from your transcript",
                  "Edit field names, types, and requirements",
                  "Save schemas as versioned, reusable templates",
                  "Works for sales, CS, ops, and any meeting type",
                  "JSON, webhook, and REST API output",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-stone-600 dark:text-stone-300">
                    <CheckIcon className="text-stone-400 dark:text-stone-500" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/signup" className={buttonVariants({ variant: "ghost" })}>
                  Start with General Mode
                </Link>
              </div>
            </div>
          </div>

          {/* ── Recruiter Mode ── */}
          <div className="rounded-2xl border border-aubergine-200 dark:border-aubergine-900/60 bg-white dark:bg-stone-900 overflow-hidden ring-1 ring-aubergine-100 dark:ring-aubergine-950/50">
            {/* Header */}
            <div className="border-b border-aubergine-100 dark:border-aubergine-950/60 bg-aubergine-50/60 dark:bg-aubergine-950/20 px-8 py-7">
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] uppercase text-aubergine-800 dark:text-aubergine-400 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-aubergine-700" />
                Recruiter Mode
              </span>
              <h3
                className="font-display italic text-stone-900 dark:text-stone-100 leading-snug mb-3"
                style={{ fontSize: "clamp(1.3rem, 2vw, 1.65rem)" }}
              >
                The schema is already<br />built. Just run it.
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                An end-to-end hiring workflow with a fixed 35-field schema. Interview ends,
                candidate profile begins — no configuration required. JD fit scoring,
                evidence citations for every field, and a built-in recruiter review queue.
              </p>
            </div>

            {/* Pipeline */}
            <div className="px-8 py-5 border-b border-stone-100 dark:border-stone-800">
              <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500 mb-3">
                Fixed pipeline
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                {["Source","Transcript","Extraction","JD Analysis","Profile","Review"].map((node, i, arr) => (
                  <div key={node} className="flex items-center gap-1">
                    <span className="inline-flex items-center rounded-xs border border-aubergine-200 dark:border-aubergine-900 bg-aubergine-50 dark:bg-aubergine-950/50 px-2.5 py-1 text-[10px] font-medium text-aubergine-800 dark:text-aubergine-400">
                      {node}
                    </span>
                    {i < arr.length - 1 && <ChevronIcon />}
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="px-8 py-7">
              <ul className="space-y-3">
                {[
                  "35+ structured fields extracted per interview",
                  "JD fit scoring — Tier A / B / C classification",
                  "Evidence citation for every extracted value",
                  "Approval queue with recruiter review dashboard",
                  "JSON export or direct ATS push",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-stone-600 dark:text-stone-300">
                    <CheckIcon className="text-aubergine-700" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/signup" className={buttonVariants({ variant: "primary" })}>
                  Start with Recruiter Mode
                </Link>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs text-stone-400 dark:text-stone-500 text-center">
          Choose your mode at signup. Your workspace is pre-configured from day one.
        </p>
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   INTEGRATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function Integrations() {
  const sources = [
    { name: "Zoom",         note: "Live bot · Cloud recording", dot: "bg-blue-400"      },
    { name: "Google Meet",  note: "Live bot via calendar",      dot: "bg-aubergine-400" },
    { name: "Desktop app",  note: "System audio, no bot",       dot: "bg-positive-DEFAULT" },
    { name: "Audio upload", note: "MP3, MP4, M4A, WAV",         dot: "bg-stone-400"     },
    { name: "REST API",     note: "Programmatic ingestion",     dot: "bg-violet-400"    },
  ];

  const outputs = [
    { name: "Dashboard",   note: "Built-in review UI",         dot: "bg-aubergine-400" },
    { name: "JSON export", note: "Full structured record",      dot: "bg-aubergine-400" },
    { name: "CSV export",  note: "Flat file for spreadsheets",  dot: "bg-aubergine-400" },
    { name: "Webhooks",    note: "Real-time event delivery",    dot: "bg-amber-400"     },
    { name: "REST API",    note: "Pull any session's data",     dot: "bg-violet-400"    },
  ];

  return (
    <section id="integrations" className="py-28 lg:py-36 bg-white dark:bg-stone-900">
      <div className="mkt-section">

        {/* Section header */}
        <div className="text-center max-w-lg mx-auto mb-16 lg:mb-20">
          <p className="eyebrow mb-4">Integrations</p>
          <h2
            className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-4"
            style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)" }}
          >
            Meet your stack.<br />Deliver anywhere.
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
            Sorabase sits between your conversations and your downstream systems —
            ingesting from wherever meetings happen and routing structured data
            wherever your team needs it.
          </p>
        </div>

        {/* Flow: Sources → Sorabase → Outputs */}
        <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-4 items-start">

          {/* Sources */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-stone-400 dark:text-stone-500 mb-3 text-center lg:text-left">
              Conversation sources
            </p>
            <div className="space-y-2">
              {sources.map(({ name, note, dot }) => (
                <IntegrationCard key={name} name={name} note={note} dot={dot} />
              ))}
            </div>
          </div>

          {/* Center: Sorabase extraction engine */}
          <div className="flex lg:flex-col items-center justify-center gap-3 py-2">
            {/* Arrow left (mobile: hidden) */}
            <div className="hidden lg:flex flex-col items-center gap-1.5">
              <div className="w-px h-8 bg-gradient-to-b from-transparent via-stone-300 dark:via-stone-700 to-transparent" />
              <ChevronDownIcon className="text-stone-300 dark:text-stone-700" />
            </div>

            {/* Engine badge */}
            <div className="flex-shrink-0 rounded-xl border border-aubergine-200 dark:border-aubergine-900 bg-aubergine-50 dark:bg-aubergine-950/30 px-5 py-4 text-center min-w-[9rem]">
              <div className="w-8 h-8 rounded-lg bg-aubergine-800 dark:bg-aubergine-700 mx-auto mb-2.5 flex items-center justify-center">
                <svg viewBox="8 17 84 50" fill="none" className="w-5 h-5" aria-hidden>
                  <path d="M14 50 C19 50 19 39 24 39 C29 39 29 61 34 61 C39 61 43 32 47 27 C50 23 52 42 56 44"
                    stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="56" y1="33" x2="86" y2="33" stroke="white" strokeWidth="6" strokeLinecap="round"/>
                  <line x1="56" y1="44" x2="86" y2="44" stroke="white" strokeWidth="6" strokeLinecap="round"/>
                  <line x1="56" y1="55" x2="86" y2="55" stroke="white" strokeWidth="6" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-[11px] font-semibold text-aubergine-800 dark:text-aubergine-300 leading-snug">
                Sorabase<br />Extraction
              </p>
            </div>

            {/* Arrow right (mobile: hidden) */}
            <div className="hidden lg:flex flex-col items-center gap-1.5">
              <ChevronDownIcon className="text-stone-300 dark:text-stone-700" />
              <div className="w-px h-8 bg-gradient-to-b from-transparent via-stone-300 dark:via-stone-700 to-transparent" />
            </div>
          </div>

          {/* Outputs */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-stone-400 dark:text-stone-500 mb-3 text-center lg:text-left">
              Structured outputs
            </p>
            <div className="space-y-2">
              {outputs.map(({ name, note, dot }) => (
                <IntegrationCard key={name} name={name} note={note} dot={dot} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link href="/signup" className={buttonVariants({ variant: "ghost" })}>
            See all integrations
          </Link>
        </div>
      </div>
    </section>
  );
}

function IntegrationCard({ name, note, dot }: { name: string; note: string; dot: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/60 px-4 py-3 hover:border-stone-200 dark:hover:border-stone-700 transition-colors duration-150">
      <span className={["w-2 h-2 rounded-full flex-shrink-0 mt-[3px]", dot].join(" ")} />
      <div>
        <p className="text-[13px] font-semibold text-stone-800 dark:text-stone-200 leading-none mb-0.5">{name}</p>
        <p className="text-[11px] text-stone-400 dark:text-stone-500">{note}</p>
      </div>
    </div>
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
      desc:      "10 meetings to try the full product — no credit card required.",
      features:  ["10 meetings", "Transcript + summary", "Full field extraction", "JSON export"],
      cta:       "Get started free",
      href:      "/signup",
      highlight: false,
      anchor:    false,
    },
    {
      name:      "Pro",
      price:     "$20",
      period:    "/ month",
      desc:      "Unlimited meetings, saved templates, webhooks, and the REST API.",
      features:  ["Unlimited meetings", "AI schema proposals", "Saved, versioned templates", "Webhooks & REST API", "Custom workflow support"],
      cta:       "Start with Pro",
      href:      "/signup",
      highlight: true,
      anchor:    false,
    },
    {
      name:      "Custom",
      price:     "Custom",
      period:    "",
      desc:      "Team rollouts, specialized workflows, or custom integrations.",
      features:  ["Everything in Pro", "Custom workflow design", "Team onboarding", "Flexible pricing"],
      cta:       "Talk to us",
      href:      "mailto:hello@sorabase.com",
      highlight: false,
      anchor:    true,
    },
  ];

  return (
    <section className="py-28 lg:py-36 bg-stone-50 dark:bg-stone-950">
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
            Start free with 10 meetings — no credit card. Pro at $20/month unlocks
            unlimited meetings and the full feature set.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={[
                "rounded-2xl border flex flex-col p-8",
                plan.highlight
                  ? "border-aubergine-200 dark:border-aubergine-900 bg-white dark:bg-stone-900 ring-1 ring-aubergine-200/80 dark:ring-aubergine-950/60 shadow-lg shadow-aubergine-100/60 dark:shadow-aubergine-950/40"
                  : "border-stone-150 dark:border-stone-800 bg-white dark:bg-stone-900",
              ].join(" ")}
            >
              {plan.highlight && (
                <div className="inline-flex mb-5">
                  <span className="text-[10px] font-semibold tracking-[0.1em] uppercase bg-aubergine-800 text-aubergine-50 rounded-full px-2.5 py-1">
                    Most popular
                  </span>
                </div>
              )}

              <p className={[
                "text-[10px] font-semibold tracking-[0.12em] uppercase mb-4",
                plan.highlight
                  ? "text-aubergine-700 dark:text-aubergine-400"
                  : "text-stone-400 dark:text-stone-500",
                plan.highlight ? "" : "mt-[26px]",
              ].join(" ")}>
                {plan.name}
              </p>

              <div className="flex items-baseline gap-1.5 mb-2">
                <span className={[
                  "font-display leading-none",
                  plan.name === "Custom"
                    ? "text-stone-400 dark:text-stone-500 text-2xl"
                    : "text-stone-900 dark:text-stone-100 text-4xl",
                ].join(" ")}>
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-stone-400 dark:text-stone-500">{plan.period}</span>
                )}
              </div>

              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed mt-2 mb-7">
                {plan.desc}
              </p>

              <ul className="space-y-2.5 flex-1 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-stone-600 dark:text-stone-300">
                    <CheckIcon className={plan.highlight ? "text-aubergine-700" : "text-stone-400"} />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.anchor ? (
                <a href={plan.href} className={buttonVariants({ variant: "ghost" })}>
                  {plan.cta}
                </a>
              ) : (
                <Link href={plan.href} className={buttonVariants({ variant: plan.highlight ? "primary" : "ghost" })}>
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
   FINAL CTA  — dark aubergine, visual impact before brand signature
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function FinalCTA() {
  return (
    <section className="py-28 lg:py-40 bg-aubergine-900 dark:bg-aubergine-950 relative overflow-hidden">
      {/* Subtle radial highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 30% 50%, rgba(255,255,255,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative mkt-section">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-aubergine-400 mb-6">
            Ready to start?
          </p>
          <h2
            className="font-display italic text-aubergine-50 leading-tight mb-6"
            style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)" }}
          >
            Your next meeting should end<br />with structured data.
          </h2>
          <p className="text-[16px] text-aubergine-300 leading-relaxed mb-10 max-w-lg">
            10 meetings free — no credit card. Choose your mode at signup and your
            workspace is ready immediately.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-white text-aubergine-900 font-semibold text-sm px-5 py-2.5 hover:bg-aubergine-50 transition-colors duration-150"
            >
              Get started free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-lg border border-aubergine-700 text-aubergine-200 font-semibold text-sm px-5 py-2.5 hover:border-aubergine-500 hover:text-aubergine-100 transition-colors duration-150"
            >
              View pricing
            </Link>
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
      aria-label="Sorabase"
      className="relative overflow-hidden flex flex-col justify-end"
      style={{
        minHeight: "80vh",
        background:
          "linear-gradient(to bottom," +
          "  #FFFFFF    0%,"  +
          "  #FAF5F1    4%,"  +
          "  #EFE4D8   12%,"  +
          "  #D4BCA8   24%,"  +
          "  #AA8082   38%,"  +
          "  #6E3C4A   50%,"  +
          "  #3D1828   63%,"  +
          "  #1E0C14   80%,"  +
          "  #090408  100%"   +
          ")",
      }}
    >
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
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0"
        style={{
          top: "20%",
          height: "52%",
          background:
            "radial-gradient(ellipse 85% 70% at 50% 32%," +
            "  rgba(138, 88, 100, 0.26)  0%,"  +
            "  rgba(88,  50,  68, 0.12) 48%,"  +
            "  transparent              72%"   +
            ")",
          filter: "blur(48px)",
        }}
      />
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

      <div className="relative w-full select-none" aria-hidden>
        <span
          className="font-display italic block w-full text-center"
          style={{
            fontSize: "clamp(3.5rem, 17.5vw, 24rem)",
            color: "rgba(240, 226, 210, 0.88)",
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
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="w-2.5 h-2.5 text-stone-300 dark:text-stone-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={["w-3 h-3", className].join(" ")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
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
      <TrustBar />
      <AnimatedPlatformFlow />
      <AnimatedWorkflowCanvas />
      <ModeComparison />
      <AnimatedStructuredData />
      <Integrations />
      <AnimatedTemplates />
      <AnimatedTestimonials />
      <AnimatedBrandMoment />
      <PricingPreview />
      <FinalCTA />
      <BrandSignature />
    </main>
  );
}
