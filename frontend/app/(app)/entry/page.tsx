"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getRedirectForUser } from "@/lib/auth";

export default function EntryPage() {
  const { user, isLoading, signOut, grantAccess } = useAuth();
  const router = useRouter();
  const [granting, setGranting] = useState<"recruiter" | "general" | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/signin");
      return;
    }
    // Already has definite access and completed onboarding → send to workspace
    if (user.access !== "pending" && user.onboarded) {
      router.replace(getRedirectForUser(user));
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return <LoadingShell />;
  }

  // onboarded recruiter/general users won't see this — they're redirected above.
  // Non-onboarded recruiter/general users (just granted access) stay here briefly
  // until grantAccess() resets onboarded and they go to /app/onboarding.
  if (user.access !== "pending" && user.onboarded) {
    return <LoadingShell />;
  }

  async function handleGrant(access: "recruiter" | "general") {
    setGranting(access);
    const updated = await grantAccess(access);
    if (updated) {
      // grantAccess resets onboarded → getRedirectForUser sends to /app/onboarding
      router.replace(getRedirectForUser(updated));
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 flex-shrink-0 border-b border-stone-200 dark:border-stone-800">
        <Link
          href="/"
          className="font-display italic text-[18px] text-stone-900 dark:text-stone-100 hover:opacity-70 transition-opacity"
        >
          SoraBase
        </Link>
        <button
          type="button"
          onClick={() => { signOut(); router.replace("/signin"); }}
          className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
        >
          Sign out
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center px-5 py-16">
        <div className="w-full max-w-md">

          {/* Status mark */}
          <div className="w-14 h-14 rounded-full border-2 border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 flex items-center justify-center mx-auto mb-7">
            <ClockIcon />
          </div>

          <div className="text-center mb-8">
            <h1 className="font-display italic text-stone-900 dark:text-stone-100 text-[2rem] leading-tight mb-3">
              Access pending.
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed max-w-sm mx-auto">
              Your account has been created, but workspace access hasn&apos;t been assigned yet.
              Your organization admin will approve your access mode and you&apos;ll be notified when you&apos;re ready to go.
            </p>
          </div>

          {/* User info card */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-5 py-4 mb-6">
            <p className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-[0.1em] mb-3">
              Your account
            </p>
            <div className="space-y-2.5">
              <Row label="Name"   value={user.name} />
              <Row label="Email"  value={user.email} />
              <Row label="Status" value={
                <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                  Pending assignment
                </span>
              } />
            </div>
          </div>

          {/* What to expect */}
          <div className="rounded-xl border border-stone-100 dark:border-stone-800/60 bg-stone-50 dark:bg-stone-950 px-5 py-4 mb-8">
            <p className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-[0.1em] mb-3">
              What happens next
            </p>
            <ul className="space-y-3">
              {[
                "Your admin receives a notification to assign your access mode.",
                "You'll get an email once Recruiter or General access is granted.",
                "Sign in again — you'll land directly in your workspace.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-stone-200 dark:bg-stone-700 flex-shrink-0 flex items-center justify-center text-stone-500 dark:text-stone-400 font-semibold text-[10px] mt-px">
                    {i + 1}
                  </span>
                  <span className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Mock admin panel ───────────────────────────────────────────── */}
          <div className="rounded-xl border border-dashed border-stone-300 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-900/30 px-5 py-4 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500">
                Demo — simulate access assignment
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                Dev only
              </span>
            </div>
            <p className="text-[11px] text-stone-400 dark:text-stone-500 mb-4 leading-relaxed">
              In production an admin would assign access. Click below to simulate that action and continue the demo.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={granting !== null}
                onClick={() => handleGrant("recruiter")}
                className="flex flex-col items-start gap-1.5 rounded-lg border border-aubergine-200 dark:border-aubergine-900/60 bg-white dark:bg-stone-900 px-4 py-3 hover:border-aubergine-400 dark:hover:border-aubergine-800 hover:bg-aubergine-50/40 dark:hover:bg-aubergine-950/10 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <span className="text-[11px] font-semibold text-aubergine-900 dark:text-aubergine-400 group-hover:text-aubergine-900 dark:group-hover:text-aubergine-300 transition-colors">
                  {granting === "recruiter" ? "Granting…" : "Grant Recruiter"}
                </span>
                <span className="text-[10px] text-stone-400 dark:text-stone-500 leading-tight">
                  Interview extraction pipeline
                </span>
              </button>

              <button
                type="button"
                disabled={granting !== null}
                onClick={() => handleGrant("general")}
                className="flex flex-col items-start gap-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-3 hover:border-stone-400 dark:hover:border-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-colors">
                  {granting === "general" ? "Granting…" : "Grant General"}
                </span>
                <span className="text-[10px] text-stone-400 dark:text-stone-500 leading-tight">
                  Flexible schema extraction
                </span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => { signOut(); router.replace("/signin"); }}
              className="text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              Sign out
            </button>
            <span className="h-3 w-px bg-stone-200 dark:bg-stone-700" />
            <Link
              href="/"
              className="text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              ← Homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[11px] text-stone-400 dark:text-stone-500">{label}</span>
      <span className="text-[11px] font-medium text-stone-700 dark:text-stone-300">{value}</span>
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
      <div className="flex flex-col items-center gap-4">
        <svg className="w-5 h-5 animate-spin text-aubergine-700" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <p className="text-xs text-stone-400 dark:text-stone-500">Loading…</p>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
    </svg>
  );
}
