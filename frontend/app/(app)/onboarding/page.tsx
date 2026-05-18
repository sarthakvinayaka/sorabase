"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getRedirectForUser } from "@/lib/auth";
import type { AccessType } from "@/lib/auth";

type Step = "choose" | "welcome" | "tour" | "done";

export default function OnboardingPage() {
  const { user, isLoading, markOnboarded, grantAccess } = useAuth();
  const [step, setStep]           = useState<Step>("welcome");
  const [chosenAccess, setChosen] = useState<Exclude<AccessType, "pending">>("general");
  const [granting, setGranting]   = useState(false);
  const router                    = useRouter();
  const hasChosenRef              = useRef(false);
  const wasPendingRef             = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace("/signin"); return; }
    // Pending users need to choose their mode first
    if (user.access === "pending" && !hasChosenRef.current) {
      wasPendingRef.current = true;
      setStep("choose");
      return;
    }
    // Already onboarded → skip to workspace
    if (user.onboarded) {
      router.replace(getRedirectForUser(user));
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;
  if (user.access !== "pending" && user.onboarded) return null;

  const isRecruiter = user.access === "recruiter";
  const STEP_LIST: Step[] = wasPendingRef.current
    ? ["choose", "welcome", "tour", "done"]
    : ["welcome", "tour", "done"];

  async function handleChooseAccess() {
    setGranting(true);
    try {
      hasChosenRef.current = true;
      await grantAccess(chosenAccess);
      setStep("welcome");
    } finally {
      setGranting(false);
    }
  }

  async function handleFinish() {
    const updated = await markOnboarded();
    if (updated) {
      router.replace(getRedirectForUser(updated));
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col">
      {/* Header */}
      <header className="h-16 flex items-center px-8 border-b border-stone-200 dark:border-stone-800 flex-shrink-0">
        <span className="font-display italic text-[18px] leading-none text-stone-900 dark:text-stone-100">SoraBase</span>
        <span className="mx-3 h-3.5 w-px bg-stone-200 dark:bg-stone-700" />
        <span className="text-xs text-stone-400 dark:text-stone-500">Onboarding</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-5 py-16">
        <div className="w-full max-w-lg">

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-10 justify-center" aria-label="Onboarding progress">
            {STEP_LIST.map((s, i) => {
              const orderMap = Object.fromEntries(STEP_LIST.map((st, idx) => [st, idx])) as Record<Step, number>;
              const currentOrder = orderMap[step] ?? 0;
              const isPast    = i < currentOrder;
              const isCurrent = s === step;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div
                    aria-current={isCurrent ? "step" : undefined}
                    className={[
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                      isCurrent
                        ? "bg-aubergine-800 text-white"
                        : isPast
                        ? "bg-aubergine-100 dark:bg-aubergine-950/30 text-aubergine-800 dark:text-aubergine-400"
                        : "bg-stone-200 dark:bg-stone-700 text-stone-400 dark:text-stone-500",
                    ].join(" ")}
                  >
                    {isPast ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : i + 1}
                  </div>
                  {i < STEP_LIST.length - 1 && (
                    <div className={["w-8 h-px transition-colors", isPast ? "bg-aubergine-200 dark:bg-aubergine-900" : "bg-stone-200 dark:bg-stone-700"].join(" ")} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step: Choose access mode (Google OAuth users) */}
          {step === "choose" && (
            <div>
              <h1 className="font-display italic text-stone-900 dark:text-stone-100 text-3xl mb-3 text-center">
                Welcome to SoraBase.
              </h1>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-8 text-center leading-relaxed max-w-sm mx-auto">
                Choose the workspace that fits your workflow.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {[
                  {
                    id:   "recruiter" as const,
                    label: "Recruiter Mode",
                    body:  "Structured candidate profiles from every interview. JD fit scoring, 35+ fields, candidate dashboard.",
                  },
                  {
                    id:   "general" as const,
                    label: "General Mode",
                    body:  "Custom schemas for any meeting type. AI field proposals, reusable templates, JSON/webhook output.",
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setChosen(opt.id)}
                    className={[
                      "text-left rounded-xl border px-4 py-4 transition-colors",
                      chosenAccess === opt.id
                        ? "border-aubergine-300 dark:border-aubergine-800 bg-aubergine-50 dark:bg-aubergine-950/30"
                        : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600",
                    ].join(" ")}
                    aria-pressed={chosenAccess === opt.id}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className={[
                        "text-sm font-semibold",
                        chosenAccess === opt.id
                          ? "text-aubergine-900 dark:text-aubergine-300"
                          : "text-stone-800 dark:text-stone-200",
                      ].join(" ")}>
                        {opt.label}
                      </p>
                      <span
                        className={[
                          "mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                          chosenAccess === opt.id
                            ? "border-aubergine-700 bg-aubergine-700"
                            : "border-stone-300 dark:border-stone-600",
                        ].join(" ")}
                        aria-hidden
                      >
                        {chosenAccess === opt.id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">{opt.body}</p>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleChooseAccess}
                disabled={granting}
                className="w-full btn-mkt-primary justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {granting
                  ? "Setting up…"
                  : `Continue with ${chosenAccess === "recruiter" ? "Recruiter Mode" : "General Mode"} →`}
              </button>
            </div>
          )}

          {/* Step: Welcome */}
          {step === "welcome" && (
            <div className="text-center">
              <div className={[
                "w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6",
                isRecruiter
                  ? "bg-aubergine-50 dark:bg-aubergine-950/20 border border-aubergine-100 dark:border-aubergine-900"
                  : "bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700",
              ].join(" ")}>
                {isRecruiter ? <BriefcaseIcon /> : <GridIcon />}
              </div>
              <h1 className="font-display italic text-stone-900 dark:text-stone-100 text-3xl mb-3">
                Welcome to SoraBase, {user.name.split(" ")[0]}.
              </h1>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-2 leading-relaxed">
                You&apos;re in{" "}
                <strong className="text-stone-700 dark:text-stone-300">
                  {isRecruiter ? "Recruiter Mode" : "General Mode"}
                </strong>.
              </p>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-8 leading-relaxed max-w-md mx-auto">
                {isRecruiter
                  ? "Your workspace turns every interview into a structured candidate profile — automatically extracted, scored, and ready to review."
                  : "Your workspace lets you extract structured data from any meeting type using AI-proposed schemas and reusable templates."}
              </p>
              <button
                type="button"
                onClick={() => setStep("tour")}
                className="btn-mkt-primary"
              >
                Show me around
              </button>
            </div>
          )}

          {/* Step: Tour */}
          {step === "tour" && (
            <div>
              <h2 className="font-display italic text-stone-900 dark:text-stone-100 text-2xl mb-8 text-center">
                Here&apos;s how your workspace works.
              </h2>

              <div className="space-y-4">
                {(isRecruiter ? RECRUITER_TOUR : GENERAL_TOUR).map((item, i) => (
                  <div key={i} className="flex gap-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-5 py-4">
                    <div className="w-9 h-9 flex-shrink-0 rounded-md bg-aubergine-50 dark:bg-aubergine-950/20 border border-aubergine-100 dark:border-aubergine-900 flex items-center justify-center text-aubergine-800 dark:text-aubergine-400">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-0.5">{item.title}</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep("welcome")}
                  className="text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep("done")}
                  className="btn-mkt-primary"
                >
                  Got it →
                </button>
              </div>
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-aubergine-50 dark:bg-aubergine-950/20 border border-aubergine-100 dark:border-aubergine-900 flex items-center justify-center mx-auto mb-6">
                <CheckCircleIcon />
              </div>
              <h2 className="font-display italic text-stone-900 dark:text-stone-100 text-3xl mb-3">
                You&apos;re all set.
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-10 max-w-sm mx-auto leading-relaxed">
                Your workspace is ready. Head in and run your first session — paste a transcript,
                upload a recording, or connect a live meeting.
              </p>
              <button type="button" onClick={handleFinish} className="btn-mkt-primary">
                Open my workspace →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const RECRUITER_TOUR = [
  {
    icon: <NodeIcon />,
    title: "Visual workflow canvas",
    body:  "Your workspace is a node canvas — Source → Extraction → Analysis → Output. Configure each node, then run.",
  },
  {
    icon: <ExtractIcon />,
    title: "35+ structured fields per interview",
    body:  "After each call, SoraBase extracts candidate name, role, experience, skills, compensation, and 30+ more fields automatically.",
  },
  {
    icon: <ScoreIcon />,
    title: "JD fit scoring",
    body:  "Paste a job description in the Analysis node. AI scores the candidate against the role and assigns a tier.",
  },
  {
    icon: <DashboardIcon />,
    title: "Candidate review dashboard",
    body:  "Every run produces a structured profile with evidence citations. Review, approve, or push to your ATS.",
  },
];

const GENERAL_TOUR = [
  {
    icon: <NodeIcon />,
    title: "Visual workflow canvas",
    body:  "Your workspace is a 6-node canvas — Input → Transcript → Schema → Extraction → Summary → Output. Run end-to-end with one click.",
  },
  {
    icon: <SchemaIconSmall />,
    title: "AI-proposed schemas",
    body:  "After transcription, AI proposes a schema based on your conversation. Edit, approve, and run structured extraction.",
  },
  {
    icon: <TemplateIcon />,
    title: "Reusable templates",
    body:  "Save any approved schema as a template. Apply it to future meetings of the same type for consistent, versioned output.",
  },
  {
    icon: <ExportIcon />,
    title: "JSON, webhooks, API",
    body:  "Export extracted data as JSON, trigger a webhook on completion, or call the REST API to integrate with your stack.",
  },
];

function BriefcaseIcon()   { return <svg className="w-7 h-7 text-aubergine-800 dark:text-aubergine-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path strokeLinecap="round" strokeLinejoin="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>; }
function GridIcon()         { return <svg className="w-7 h-7 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>; }
function NodeIcon()         { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path strokeLinecap="round" d="M7 12h10"/></svg>; }
function ExtractIcon()      { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8M4 18h6"/></svg>; }
function ScoreIcon()        { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l-2 2M13 7h6m-6 4h4m-4 4h2"/></svg>; }
function DashboardIcon()    { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="8" height="5" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="3" y="12" width="18" height="9" rx="1"/></svg>; }
function SchemaIconSmall()  { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8"/></svg>; }
function TemplateIcon()     { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M3 9h18"/><path strokeLinecap="round" d="M9 21V9"/></svg>; }
function ExportIcon()       { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12l-4 4m4-4l4 4M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2"/></svg>; }
function CheckCircleIcon()  { return <svg className="w-7 h-7 text-aubergine-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>; }
