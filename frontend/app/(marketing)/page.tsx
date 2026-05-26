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
  title: "SoraBase — Structured Data from Every Meeting",
  description:
    "SoraBase turns interviews, sales calls, and team meetings into field-by-field structured data — confidence-scored, evidence-cited, and ready to push into your ATS, CRM, or BI tools.",
  alternates: {
    canonical: "https://www.sorabase.org/",
  },
  openGraph: {
    title:       "SoraBase — Structured Data from Every Meeting",
    description: "Field-by-field extraction from any conversation. Confidence-scored outputs with evidence citations, ready to push into your systems.",
    url:         "https://www.sorabase.org/",
    type:        "website",
  },
  twitter: {
    card:        "summary",
    title:       "SoraBase — Structured Data from Every Meeting",
    description: "Field-by-field extraction from any conversation. Not summaries — structured data.",
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
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-24 items-center">

          {/* Left: copy */}
          <div className="max-w-xl">
            <p className="eyebrow mb-6">Meeting data platform</p>

            <h1
              className="font-display italic text-stone-900 dark:text-stone-100 leading-[1.04]"
              style={{ fontSize: "clamp(2.6rem, 5.5vw, 5rem)" }}
            >
              Your meetings produce data,{" "}
              <span className="text-stone-400 dark:text-stone-500">not just transcripts.</span>
            </h1>

            <p className="mt-7 text-[16px] text-stone-500 dark:text-stone-400 leading-relaxed">
              SoraBase extracts field-by-field structured data from any conversation —
              interview, sales call, or ops sync. Confidence-scored outputs with evidence
              citations, ready to push into your systems before the recap email is written.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link href="/signup" className={buttonVariants({ variant: "primary" })}>
                Get started free
              </Link>
              <Link href="#how-it-works" className={buttonVariants({ variant: "ghost" })}>
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

          {/* Right: animated product demo */}
          <div className="lg:block hidden">
            <ProductDemo />
          </div>
        </div>

        {/* Mobile demo */}
        <div className="lg:hidden mt-12">
          <ProductDemo />
        </div>
      </div>
    </section>
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
          Trusted by teams building better hiring, sales, and ops workflows
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {orgs.map((name) => (
            <span
              key={name}
              className="text-sm font-semibold text-stone-300 dark:text-stone-600 tracking-wide hover:text-stone-400 dark:hover:text-stone-500 transition-colors duration-200 cursor-default select-none"
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
   MODE COMPARISON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ModeComparison() {
  return (
    <section id="modes" className="py-24 lg:py-32 bg-stone-50 dark:bg-stone-950">
      <div className="mkt-section">
        <div className="max-w-lg mb-16 lg:mb-20">
          <p className="eyebrow mb-4">Two modes. One extraction engine.</p>
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
                Your schema.<br />Any conversation.
              </h3>
              <p className="text-sm text-stone-400 leading-relaxed">
                Define your own extraction columns for any meeting type. AI proposes a schema
                from your transcript — you edit, approve, and save as a versioned template.
                Sales calls, customer debriefs, ops syncs: one engine, different schemas.
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
                  "AI proposes columns from your transcript",
                  "Edit field names, types, and requirements",
                  "Save schemas as versioned, reusable templates",
                  "Works for sales, CS, ops, and any other meeting type",
                  "JSON, webhook, and REST API output",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-stone-600 dark:text-stone-300">
                    <CheckIcon className="text-stone-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Link href="/signup" className={buttonVariants({ variant: "ghost" })}>
                  Start with General Mode
                </Link>
              </div>
            </div>
          </div>

          {/* ── Recruiter Mode — RIGHT ── */}
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
                The schema is already<br />built. Just run it.
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                An end-to-end hiring workflow with a fixed 35-field schema. Interview ends,
                candidate profile begins — no configuration required. JD fit scoring, evidence
                citations for every field, and a built-in recruiter review queue.
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
              <div className="mt-7">
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
  return (
    <section id="integrations" className="py-24 lg:py-32 bg-stone-50 dark:bg-stone-950">
      <div className="mkt-section">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-24 items-start">

          {/* Left: copy */}
          <div>
            <p className="eyebrow mb-4">Integrations</p>
            <h2
              className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-5"
              style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.9rem)" }}
            >
              Meet your stack.<br />Deliver anywhere.
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mb-8 max-w-sm">
              SoraBase sits in the middle of your meeting workflow — ingesting from wherever
              conversations happen and routing structured data to wherever your team needs it.
              No custom glue required.
            </p>
            <Link href="/signup" className={buttonVariants({ variant: "ghost" })}>
              See all integrations
            </Link>
          </div>

          {/* Right: two-column source / output */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">

            {/* Sources */}
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-stone-400 dark:text-stone-500 mb-3">
                Sources
              </p>
              <div className="space-y-2">
                {[
                  { name: "Zoom",         note: "Live bot · Cloud recording", dot: "bg-blue-400"        },
                  { name: "Google Meet",  note: "Live bot via calendar",       dot: "bg-aubergine-400"   },
                  { name: "Audio upload", note: "MP3, MP4, M4A, WAV",          dot: "bg-stone-400"       },
                  { name: "Transcript",   note: "Paste · Bulk import",         dot: "bg-stone-400"       },
                  { name: "REST API",     note: "Programmatic ingestion",      dot: "bg-violet-400"      },
                ].map(({ name, note, dot }) => (
                  <div
                    key={name}
                    className="flex items-start gap-3 rounded-lg border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 px-3.5 py-3 hover:border-stone-200 dark:hover:border-stone-700 transition-colors duration-150"
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
                  { name: "Webhooks",    note: "Real-time event delivery",     dot: "bg-amber-400"       },
                  { name: "REST API",    note: "Pull any session's data",      dot: "bg-violet-400"      },
                ].map(({ name, note, dot }) => (
                  <div
                    key={name}
                    className="flex items-start gap-3 rounded-lg border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 px-3.5 py-3 hover:border-stone-200 dark:hover:border-stone-700 transition-colors duration-150"
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
      ctaEl:     "link" as const,
    },
    {
      name:      "Pro",
      price:     "$20",
      period:    "/ month",
      desc:      "Unlimited meetings, saved templates, webhooks, and the REST API. For regular use.",
      features:  ["Unlimited meetings", "AI schema proposals", "Saved, versioned templates", "Webhooks & REST API", "Custom workflow integration support"],
      cta:       "Start with Pro",
      href:      "/signup",
      highlight: true,
      ctaEl:     "link" as const,
    },
    {
      name:      "Custom",
      price:     "Custom",
      period:    "",
      desc:      "Team rollouts, specialized workflows, or custom integrations. Tell us what you need.",
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
            Start free with 10 meetings — no credit card. Pro at $20/month unlocks
            unlimited meetings and the full feature set. Need something custom? Let&apos;s talk.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={[
                "rounded-xl border flex flex-col p-7 transition-all duration-200 hover:-translate-y-0.5",
                plan.highlight
                  ? "border-aubergine-300 dark:border-aubergine-900 bg-white dark:bg-stone-900 ring-1 ring-aubergine-200 dark:ring-aubergine-900/50 hover:shadow-lg hover:shadow-aubergine-100/60 dark:hover:shadow-aubergine-950/60"
                  : "border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:shadow-md hover:shadow-stone-100 dark:hover:shadow-stone-950/60",
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
                <a href={plan.href} className={buttonVariants({ variant: "ghost" })}>
                  {plan.cta}
                </a>
              ) : (
                <Link
                  href={plan.href}
                  className={buttonVariants({ variant: plan.highlight ? "primary" : "ghost" })}
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
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 px-6 py-12 sm:px-10 sm:py-16 lg:px-20 lg:py-20">
          <div className="max-w-xl">
            <p className="eyebrow mb-5">Ready to start?</p>
            <h2
              className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-5"
              style={{ fontSize: "clamp(1.8rem, 3vw, 2.6rem)" }}
            >
              Your next meeting should end with structured data.
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed mb-9">
              10 meetings free — no credit card. Choose your mode at signup and your workspace
              is ready immediately. Upgrade to Pro at $20/month when you&apos;re ready for unlimited.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/signup" className={buttonVariants({ variant: "primary" })}>
                Get started free
              </Link>
              <Link href="/pricing" className={buttonVariants({ variant: "ghost" })}>
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
