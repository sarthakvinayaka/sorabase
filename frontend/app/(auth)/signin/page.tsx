"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn as nextAuthSignIn } from "next-auth/react";
import { useAuth } from "@/lib/auth-context";
import { getRedirectForUser } from "@/lib/auth";

type FormState = "idle" | "loading" | "success";

export default function SignInPage() {
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [error,     setError]     = useState("");
  const justAuthed                 = useRef(false);

  const { signIn, user, isLoading } = useAuth();
  const router = useRouter();

  // Redirect already-logged-in users immediately; redirect post-auth after brief success state
  useEffect(() => {
    if (isLoading || !user) return;
    const dest = getRedirectForUser(user);
    if (justAuthed.current) {
      const t = setTimeout(() => router.replace(dest), 800);
      return () => clearTimeout(t);
    }
    router.replace(dest);
  }, [user, isLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Email address is required."); return; }
    setError("");
    setFormState("loading");
    try {
      await signIn(email, password);
      justAuthed.current = true;
      setFormState("success");
    } catch (err: unknown) {
      setFormState("idle");
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    }
  }

  function handleOAuth(provider: "google" | "microsoft") {
    setFormState("loading");
    // Redirect to OAuth provider; NextAuth handles the callback and session creation
    nextAuthSignIn(provider === "google" ? "google" : "azure-ad", {
      callbackUrl: "/app/onboarding",
    });
  }

  if (isLoading) return null;

  return (
    <div className="w-full max-w-[380px]">

      {/* Heading */}
      <div className="mb-8">
        <h1
          className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-2"
          style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)" }}
        >
          Welcome back.
        </h1>
        <p className="text-[13px] text-stone-500 dark:text-stone-400">
          Sign in to your SoraBase workspace.
        </p>
      </div>

      {/* ── Success state ─────────────────────────────────────────────── */}
      {formState === "success" && (
        <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 px-5 py-5 flex items-start gap-4">
          <div className="w-8 h-8 rounded-full border border-teal-200 dark:border-teal-800 bg-white dark:bg-teal-900/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-semibold text-teal-800 dark:text-teal-200">Signed in.</p>
            <p className="text-[12px] text-teal-600 dark:text-teal-400 mt-1 flex items-center gap-1.5">
              <SpinIcon size={12} />
              Redirecting to your workspace…
            </p>
          </div>
        </div>
      )}

      {/* ── Form (hidden on success) ──────────────────────────────────── */}
      {formState !== "success" && (
        <>
          {/* OAuth buttons */}
          <div className="space-y-2.5 mb-5">
            <OAuthButton provider="google"    onClick={() => handleOAuth("google")} />
            <OAuthButton provider="microsoft" onClick={() => handleOAuth("microsoft")} />
          </div>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-stone-200 dark:border-stone-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-stone-50 dark:bg-stone-950 px-3 text-[11px] text-stone-400 dark:text-stone-500">
                or continue with email
              </span>
            </div>
          </div>

          {/* Demo credentials hint */}
          <div className="mb-6 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-stone-100 dark:border-stone-800">
              <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-stone-400 dark:text-stone-500">
                Demo — click to fill credentials
              </p>
            </div>
            {[
              { email: "recruiter@sorabase.com", label: "Recruiter workspace", dot: "bg-teal-500",  color: "text-teal-600 dark:text-teal-400"  },
              { email: "general@sorabase.com",   label: "General workspace",   dot: "bg-stone-400", color: "text-stone-500 dark:text-stone-300" },
              { email: "demo@sorabase.com",       label: "Pending access",      dot: "bg-amber-400", color: "text-amber-600 dark:text-amber-400" },
            ].map(({ email: demoEmail, label, dot, color }) => (
              <button
                key={demoEmail}
                type="button"
                onClick={() => { setEmail(demoEmail); setPassword("demo"); setError(""); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-stone-50 dark:border-stone-800/60 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors text-left group"
              >
                <span className={["w-1.5 h-1.5 rounded-full flex-shrink-0", dot].join(" ")} />
                <span className="flex-1 text-[11px] font-mono text-stone-500 dark:text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200 transition-colors">
                  {demoEmail}
                </span>
                <span className={["text-[10px] font-medium flex-shrink-0", color].join(" ")}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Field label="Email address">
              <input
                type="email"
                className="input-lg"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                autoComplete="email"
                autoFocus
                disabled={formState === "loading"}
                required
              />
            </Field>

            <Field
              label="Password"
              aside={
                <a href="#" className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline underline-offset-2">
                  Forgot password?
                </a>
              }
            >
              <input
                type="password"
                className="input-lg"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                autoComplete="current-password"
                disabled={formState === "loading"}
              />
            </Field>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-[12px] text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={formState === "loading"}
              className="w-full btn-mkt-primary justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {formState === "loading" ? (
                <>
                  <SpinIcon size={14} />
                  Signing in…
                </>
              ) : "Sign in"}
            </button>
          </form>
        </>
      )}

      {/* Footer link */}
      <p className="mt-7 text-center text-[13px] text-stone-500 dark:text-stone-400">
        No account?{" "}
        <Link
          href="/signup"
          className="font-medium text-teal-600 dark:text-teal-400 hover:underline underline-offset-2"
        >
          Get started free
        </Link>
      </p>
    </div>
  );
}

/* ── OAuth button ─────────────────────────────────────────────────────────── */

function OAuthButton({
  provider,
  onClick,
}: {
  provider: "google" | "microsoft";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center gap-3 rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-2.5 text-[13px] font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 hover:border-stone-300 dark:hover:border-stone-600 transition-colors"
    >
      {provider === "google" ? <GoogleIcon /> : <MicrosoftIcon />}
      Continue with {provider === "google" ? "Google" : "Microsoft"}
    </button>
  );
}

/* ── Field wrapper ────────────────────────────────────────────────────────── */

function Field({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[12px] font-semibold text-stone-600 dark:text-stone-400">
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}

/* ── Icons ────────────────────────────────────────────────────────────────── */

function SpinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      style={{ width: size, height: size }}
      className="animate-spin flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
      <path fill="#F25022" d="M1 1h10.5v10.5H1z"/>
      <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z"/>
      <path fill="#00A4EF" d="M1 12.5h10.5V23H1z"/>
      <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z"/>
    </svg>
  );
}
