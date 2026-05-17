"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import SiteFooter from "@/components/marketing/SiteFooter";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const PLANS = [
  {
    name:    "Free",
    price:   "$0",
    period:  "forever",
    tagline: "Try the product with your first 10 meetings. No credit card required.",
    cta:     "Get started free",
    href:    "/signup",
    primary: false,
    features: [
      "10 meetings included",
      "Transcript + summary",
      "Basic structured extraction",
      "Manual schema editor",
      "JSON export",
      "Evidence citations",
      "Confidence scores",
    ],
  },
  {
    name:    "Pro",
    price:   "$20",
    period:  "/ month",
    tagline: "Unlimited meetings, full extraction workflows, and everything you need to run structured sessions at scale.",
    cta:     "Start with Pro",
    href:    "/signup",
    primary: true,
    features: [
      "Unlimited meetings",
      "Full extraction pipeline",
      "AI schema proposals",
      "Saved + versioned templates",
      "Dashboard & review queue",
      "JSON, CSV, webhook, REST API",
      "JD fit scoring (Recruiter Mode)",
      "Email support",
    ],
  },
  {
    name:    "Custom",
    price:   "Custom",
    period:  "",
    tagline: "Custom workflows, team rollouts, special integrations, or anything that doesn't fit a standard plan.",
    cta:     "Talk to us",
    href:    "mailto:hello@sorabase.com",
    primary: false,
    features: [
      "Everything in Pro",
      "Custom workflow design",
      "Team onboarding & training",
      "Special integrations",
      "Advanced support",
      "Flexible seat counts",
      "Negotiated pricing",
    ],
  },
] as const;

type CellValue = boolean | string;
interface CompRow      { feature: string; free: CellValue; pro: CellValue; custom: CellValue; }
interface CompCategory { category: string; rows: CompRow[]; }

const COMPARISON: CompCategory[] = [
  {
    category: "Usage",
    rows: [
      { feature: "Meetings included",               free: "10",       pro: "Unlimited", custom: "Unlimited"  },
      { feature: "Live bot (Zoom, Google Meet)",    free: "10",       pro: "Unlimited", custom: "Unlimited"  },
      { feature: "Audio / video upload",            free: true,       pro: true,        custom: true         },
      { feature: "Transcript paste",                free: true,       pro: true,        custom: true         },
    ],
  },
  {
    category: "Extraction & AI",
    rows: [
      { feature: "Basic structured extraction",     free: true,  pro: true,  custom: true  },
      { feature: "Transcript + summary",            free: true,  pro: true,  custom: true  },
      { feature: "AI schema proposals",             free: false, pro: true,  custom: true  },
      { feature: "Evidence citations",              free: true,  pro: true,  custom: true  },
      { feature: "Confidence scores",               free: true,  pro: true,  custom: true  },
      { feature: "JD fit scoring (Recruiter Mode)", free: false, pro: true,  custom: true  },
      { feature: "Custom extraction instructions",  free: false, pro: true,  custom: true  },
    ],
  },
  {
    category: "Schema & Templates",
    rows: [
      { feature: "Manual schema editor",            free: true,  pro: true,  custom: true       },
      { feature: "AI-proposed schemas",             free: false, pro: true,  custom: true       },
      { feature: "Saved schema templates",          free: false, pro: true,  custom: true       },
      { feature: "Schema versioning",               free: false, pro: true,  custom: true       },
      { feature: "Shared team templates",           free: false, pro: false, custom: true       },
    ],
  },
  {
    category: "Outputs",
    rows: [
      { feature: "JSON export",                     free: true,  pro: true,  custom: true  },
      { feature: "CSV export",                      free: false, pro: true,  custom: true  },
      { feature: "Webhook delivery",                free: false, pro: true,  custom: true  },
      { feature: "REST API access",                 free: false, pro: true,  custom: true  },
      { feature: "ATS push (Recruiter Mode)",       free: false, pro: false, custom: true  },
    ],
  },
  {
    category: "Support",
    rows: [
      { feature: "Docs & community",                free: true,  pro: true,       custom: true              },
      { feature: "Email support",                   free: false, pro: true,       custom: true              },
      { feature: "Priority support",                free: false, pro: false,      custom: true              },
      { feature: "Dedicated onboarding",            free: false, pro: false,      custom: true              },
      { feature: "Custom SLA",                      free: false, pro: false,      custom: true              },
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: "What counts as a meeting?",
    a: "A meeting is one end-to-end workflow run — from source ingestion through structured output. This includes live bot sessions (Zoom, Google Meet), audio and video file uploads, and transcript paste runs. Partial or failed runs don't count against your limit.",
  },
  {
    q: "What happens after 10 meetings on the Free plan?",
    a: "Once you've used your 10 included meetings, new sessions are paused. You'll receive a notification before you hit the limit. Upgrading to Pro is instant and takes effect immediately — your workspace and all extracted data stay intact.",
  },
  {
    q: "What's the difference between Recruiter and General Mode?",
    a: "Recruiter Mode is an opinionated workflow built for hiring: 35+ fields per interview, JD fit scoring, candidate review dashboard, and ATS export. General Mode is a configurable platform for any meeting type — you define the schema (or let AI propose it), save templates, and extract structured data from sales calls, customer debriefs, ops syncs, and anything else. Both modes are available on all plans.",
  },
  {
    q: "Can I change my access mode after signing up?",
    a: "Access mode is chosen at signup. If you need to switch mode, contact support and we'll sort it out. On Custom plans, access mode assignment can be handled per user.",
  },
  {
    q: "What does Custom pricing cover?",
    a: "Custom is for situations that don't fit Free or Pro cleanly — team rollouts, custom workflow design, special integrations, higher-touch onboarding, unusual volume requirements, or dedicated support. Pricing is discussed based on your specific needs. There's no fixed cost. Reach out and we'll figure out what makes sense.",
  },
  {
    q: "Is API access included on all plans?",
    a: "REST API and webhook delivery are available on Pro and Custom plans. Free plan users can export JSON manually from the dashboard but don't have programmatic API access.",
  },
  {
    q: "Can a team have both Recruiter and General users?",
    a: "Yes — this is possible on Custom plans with per-user access assignment. On Free and Pro, each account is in one mode. If your team needs mixed modes, reach out and we'll discuss the right setup.",
  },
];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function PricingPage() {
  return (
    <>
    <main className="pt-28 pb-32 bg-stone-50 dark:bg-stone-950">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="mkt-section text-center mb-16">
        <p className="eyebrow mb-4">Pricing</p>
        <h1
          className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-5"
          style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)" }}
        >
          Simple, honest pricing.
        </h1>
        <p className="text-[15px] text-stone-500 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
          Start free with 10 meetings. Upgrade to Pro when you need more.
          Something unusual? Let&apos;s talk.
        </p>
      </div>

      {/* ── Plan cards ───────────────────────────────────────────────────── */}
      <div className="mkt-section mb-6">
        <div className="grid lg:grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>
        <p className="text-center mt-6 text-xs text-stone-400 dark:text-stone-500">
          Free includes 10 meetings — no credit card required.
          Pro is $20/month with no meeting limits.
        </p>
      </div>

      {/* ── Full comparison table ─────────────────────────────────────────── */}
      <div className="mkt-section mb-24">
        <ComparisonTable />
      </div>

      {/* ── Access mode explainer ─────────────────────────────────────────── */}
      <div className="mkt-section mb-24">
        <AccessModeSection />
      </div>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <div className="mkt-section mb-24">
        <FAQSection />
      </div>

      {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
      <div className="mkt-section">
        <BottomCTA />
      </div>
    </main>
    <SiteFooter />
    </>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PLAN CARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function PlanCard({ plan }: { plan: (typeof PLANS)[number] }) {
  const isCustom = plan.name === "Custom";

  return (
    <div
      className={[
        "rounded-xl border flex flex-col overflow-hidden",
        plan.primary
          ? "border-teal-300 dark:border-teal-700 bg-white dark:bg-stone-900 ring-1 ring-teal-200/60 dark:ring-teal-800/40"
          : "border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900",
      ].join(" ")}
    >
      {/* Plan header */}
      <div
        className={[
          "px-7 pt-7 pb-6 border-b",
          plan.primary
            ? "border-teal-100 dark:border-teal-900/60"
            : "border-stone-100 dark:border-stone-800",
        ].join(" ")}
      >
        <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-stone-400 dark:text-stone-500 mb-5">
          {plan.name}
        </p>

        <div className="flex items-baseline gap-1.5 mb-1">
          <span
            className={[
              "font-display leading-none",
              isCustom
                ? "text-stone-400 dark:text-stone-500 text-2xl"
                : "text-stone-900 dark:text-stone-100",
            ].join(" ")}
            style={isCustom ? undefined : { fontSize: "2.5rem" }}
          >
            {plan.price}
          </span>
          {plan.period && (
            <span className="text-sm text-stone-400 dark:text-stone-500">
              {plan.period}
            </span>
          )}
        </div>

        <p className="text-[13px] text-stone-500 dark:text-stone-400 leading-relaxed mt-3">
          {plan.tagline}
        </p>
      </div>

      {/* Feature list */}
      <div className="px-7 py-6 flex-1">
        <ul className="space-y-2.5">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[13px] text-stone-600 dark:text-stone-300">
              <CheckIcon accent={plan.primary} />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="px-7 pb-7">
        {isCustom ? (
          <a
            href={plan.href}
            className="btn-mkt-ghost w-full justify-center"
          >
            {plan.cta}
          </a>
        ) : (
          <Link
            href={plan.href}
            className={[
              "w-full justify-center",
              plan.primary ? "btn-mkt-primary" : "btn-mkt-ghost",
            ].join(" ")}
          >
            {plan.cta}
          </Link>
        )}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   COMPARISON TABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ComparisonTable() {
  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <h2
          className="font-display italic text-stone-900 dark:text-stone-100 leading-tight"
          style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)" }}
        >
          Full feature comparison
        </h2>
        <p className="text-xs text-stone-400 dark:text-stone-500 hidden sm:block pb-0.5">
          Scroll to compare all features across plans
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800">
        <table className="w-full min-w-[580px] text-sm border-collapse">
          <thead>
            <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950">
              <th className="text-left px-6 py-4 text-xs font-semibold text-stone-400 dark:text-stone-500 w-[46%]">
                Feature
              </th>
              {(["Free", "Pro", "Custom"] as const).map((name) => (
                <th
                  key={name}
                  className="text-center px-4 py-4 text-xs font-semibold tracking-[0.1em] uppercase text-stone-600 dark:text-stone-300 w-[18%]"
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map(({ category, rows }) => (
              <Fragment key={category}>
                <tr className="border-b border-stone-100 dark:border-stone-800/60 bg-stone-50/50 dark:bg-stone-950/50">
                  <td
                    colSpan={4}
                    className="px-6 py-2.5 text-[10px] font-semibold tracking-[0.12em] uppercase text-stone-400 dark:text-stone-500"
                  >
                    {category}
                  </td>
                </tr>
                {rows.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={[
                      "border-b border-stone-100 dark:border-stone-800/40 transition-colors hover:bg-stone-50/70 dark:hover:bg-stone-800/20",
                      i === rows.length - 1 ? "border-stone-200 dark:border-stone-800" : "",
                    ].join(" ")}
                  >
                    <td className="px-6 py-3 text-[13px] text-stone-600 dark:text-stone-300">
                      {row.feature}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <TableCell value={row.free} />
                    </td>
                    <td className="px-4 py-3 text-center bg-teal-50/20 dark:bg-teal-950/10">
                      <TableCell value={row.pro} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <TableCell value={row.custom} />
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableCell({ value }: { value: CellValue }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex items-center justify-center">
        <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    ) : (
      <span className="inline-block w-4 h-px bg-stone-200 dark:bg-stone-700 mx-auto" />
    );
  }
  return (
    <span className="text-[12px] font-medium text-stone-600 dark:text-stone-300">
      {value}
    </span>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ACCESS MODE SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function AccessModeSection() {
  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">

      <div className="px-8 py-7 border-b border-stone-100 dark:border-stone-800 lg:px-10">
        <p className="eyebrow mb-3">Access modes</p>
        <h2
          className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-3"
          style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)" }}
        >
          Your plan sets the budget.<br />Your access mode sets the workspace.
        </h2>
        <p className="text-[13px] text-stone-500 dark:text-stone-400 leading-relaxed max-w-2xl">
          SoraBase has two product modes. You choose which one your account enters at signup.
          Both modes are available on every plan.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-stone-100 dark:divide-stone-800">

        <div className="px-8 py-8 lg:px-10">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-teal-600 dark:text-teal-400">
              Recruiter Mode
            </span>
          </div>
          <h3 className="text-[15px] font-semibold text-stone-900 dark:text-stone-100 mb-2 leading-snug">
            Opinionated workflow for hiring teams.
          </h3>
          <p className="text-[13px] text-stone-500 dark:text-stone-400 leading-relaxed mb-5">
            The pipeline is pre-built. Interview ends → candidate profile begins.
            Every session produces 35+ structured fields, a JD fit score, and an
            evidence-cited review card — no schema configuration needed.
          </p>
          <ul className="space-y-2">
            {[
              "35+ structured fields per interview",
              "JD fit scoring with Tier A / B / C",
              "Candidate review dashboard",
              "Queue and approval pipeline",
              "JSON export or ATS push",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-[13px] text-stone-600 dark:text-stone-300">
                <span className="w-1 h-1 rounded-full bg-teal-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="px-8 py-8 lg:px-10">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-stone-400 dark:bg-stone-500 flex-shrink-0" />
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-stone-500 dark:text-stone-400">
              General Mode
            </span>
          </div>
          <h3 className="text-[15px] font-semibold text-stone-900 dark:text-stone-100 mb-2 leading-snug">
            Configurable platform for any meeting type.
          </h3>
          <p className="text-[13px] text-stone-500 dark:text-stone-400 leading-relaxed mb-5">
            Define the schema yourself — or let AI propose one from your transcript.
            Save it as a template and apply it to every future meeting of the same type.
            Sales calls, customer debriefs, ops reviews: same workflow, different schemas.
          </p>
          <ul className="space-y-2">
            {[
              "AI proposes schema from your transcript",
              "Custom columns: name, type, required",
              "Save and version schema templates",
              "Works for any conversation type",
              "JSON, webhook, REST API output",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-[13px] text-stone-600 dark:text-stone-300">
                <span className="w-1 h-1 rounded-full bg-stone-400 dark:bg-stone-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="px-8 py-4 border-t border-stone-100 dark:border-stone-800 lg:px-10 bg-stone-50/60 dark:bg-stone-950/40">
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Access mode is chosen at signup and enforced at login. If you need to switch mode, contact support.
          Custom plans can support per-user access assignment.
        </p>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FAQ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-12">
        <p className="eyebrow mb-4">FAQ</p>
        <h2
          className="font-display italic text-stone-900 dark:text-stone-100 leading-tight"
          style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)" }}
        >
          Frequently asked questions.
        </h2>
      </div>

      <div className="divide-y divide-stone-100 dark:divide-stone-800 border-t border-stone-100 dark:border-stone-800">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen  = open === i;
          const panelId = `faq-panel-${i}`;
          const btnId   = `faq-btn-${i}`;
          return (
            <div key={item.q}>
              <button
                id={btnId}
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full text-left flex items-start justify-between gap-6 py-5 group"
                aria-expanded={isOpen}
                aria-controls={panelId}
              >
                <span className="text-[14px] font-semibold text-stone-800 dark:text-stone-200 group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-colors leading-snug">
                  {item.q}
                </span>
                <span
                  className={[
                    "mt-0.5 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-stone-400 dark:text-stone-500 transition-transform duration-150",
                    isOpen ? "rotate-45" : "",
                  ].join(" ")}
                  aria-hidden
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </button>
              <div
                id={panelId}
                role="region"
                aria-labelledby={btnId}
                hidden={!isOpen}
                className="pb-5 pr-10"
              >
                <p className="text-[13px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  {item.a}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center mt-10 text-xs text-stone-400 dark:text-stone-500">
        More questions?{" "}
        <a href="mailto:hello@sorabase.com" className="text-teal-600 dark:text-teal-400 hover:underline underline-offset-2">
          hello@sorabase.com
        </a>
      </p>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BOTTOM CTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function BottomCTA() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-stone-950 border border-stone-800">
      <div aria-hidden className="absolute inset-0 flex pointer-events-none">
        {[0,1,2,3,4,5].map((i) => (
          <div key={i} className="flex-1 border-r border-stone-800/50 last:border-0" />
        ))}
      </div>
      <div aria-hidden className="absolute left-0 top-0 bottom-0 w-px bg-teal-700/40" />

      <div className="relative px-10 py-16 lg:px-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-stone-600 mb-6">
              Get started
            </p>
            <h2
              className="font-display italic text-stone-100 leading-tight mb-4"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)" }}
            >
              10 free meetings.<br />No credit card.
            </h2>
            <p className="text-[13px] text-stone-400 leading-relaxed max-w-sm">
              Choose your access mode at signup. Your workspace is
              ready from day one — no setup required. Upgrade to Pro
              at $20/month when you need unlimited.
            </p>
          </div>

          <div className="flex flex-col gap-4 lg:items-end">
            <Link href="/signup" className="btn-mkt-primary self-start lg:self-auto">
              Get started free
            </Link>
            <a
              href="mailto:hello@sorabase.com"
              className="text-[13px] font-medium text-stone-500 hover:text-stone-300 transition-colors self-start lg:self-auto"
            >
              Talk to us about Custom →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SHARED ATOMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function CheckIcon({ accent = false }: { accent?: boolean }) {
  return (
    <svg
      className={["w-[14px] h-[14px] flex-shrink-0 mt-0.5", accent ? "text-teal-500" : "text-stone-400"].join(" ")}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
