"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn as nextAuthSignIn } from "next-auth/react";
import { useAuth } from "@/lib/auth-context";
import { getRedirectForUser } from "@/lib/auth";

type FormState = "idle" | "loading" | "success";
type AccessIntent = "recruiter" | "general";

const ACCESS_OPTIONS: {
  id:      AccessIntent;
  label:   string;
  tagline: string;
  bullets: string[];
}[] = [
  {
    id:      "recruiter",
    label:   "Recruiter Mode",
    tagline: "Opinionated hiring workflow",
    bullets: ["35+ fields per interview", "JD fit scoring", "Candidate dashboard"],
  },
  {
    id:      "general",
    label:   "General Mode",
    tagline: "Configurable for any meeting",
    bullets: ["Custom schemas", "AI field proposals", "JSON / webhook output"],
  },
];

export default function SignUpPage() {
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [intent,    setIntent]    = useState<AccessIntent>("general");
  const [formState, setFormState] = useState<FormState>("idle");
  const [error,     setError]     = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const justAuthed                 = useRef(false);

  const { signUp, user, isLoading } = useAuth();
  const router = useRouter();

  // Redirect after auth
  useEffect(() => {
    if (isLoading || !user) return;
    const dest = getRedirectForUser(user);
    if (justAuthed.current) {
      const t = setTimeout(() => router.replace(dest), 900);
      return () => clearTimeout(t);
    }
    router.replace(dest);
  }, [user, isLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())        { setError("Full name is required."); return; }
    if (!email.trim())       { setError("Work email is required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError("");
    setFormState("loading");
    try {
      await signUp(name, email, password, intent);
      justAuthed.current = true;
      setFormState("success");
    } catch (err: unknown) {
      setFormState("idle");
      setError(err instanceof Error ? err.message : "Account creation failed. Please try again.");
    }
  }

  function handleOAuth(provider: "google" | "microsoft") {
    setFormState("loading");
    nextAuthSignIn(provider === "google" ? "google" : "azure-ad", {
      callbackUrl: "/onboarding",
    });
  }

  const isLoaded = !isLoading;

  if (!isLoaded) return null;

  return (
    <div className="w-full max-w-[400px]">

      {/* Heading */}
      <div className="mb-8">
        <h1
          className="font-display italic text-stone-900 dark:text-stone-100 leading-tight mb-2"
          style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)" }}
        >
          Get started free.
        </h1>
        <p className="text-[13px] text-stone-500 dark:text-stone-400">
          No credit card required. 10 meetings included on the free plan.
        </p>
      </div>

      {/* ── Success state ─────────────────────────────────────────────── */}
      {formState === "success" && (
        <div className="rounded-lg border border-aubergine-200 dark:border-aubergine-900 bg-aubergine-50 dark:bg-aubergine-950/30 px-5 py-5 flex items-start gap-4">
          <div className="w-8 h-8 rounded-full border border-aubergine-200 dark:border-aubergine-900 bg-white dark:bg-aubergine-950/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-aubergine-800 dark:text-aubergine-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-semibold text-aubergine-900 dark:text-aubergine-200">Account created.</p>
            <p className="text-[12px] text-aubergine-800 dark:text-aubergine-400 mt-1 flex items-center gap-1.5">
              <SpinIcon size={12} />
              Setting up your workspace…
            </p>
          </div>
        </div>
      )}

      {/* ── Form ─────────────────────────────────────────────────────── */}
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
                or sign up with email
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Access mode selector */}
            <div>
              <p className="text-[12px] font-semibold text-stone-600 dark:text-stone-400 mb-2.5">
                Which workspace do you need?
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {ACCESS_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIntent(opt.id)}
                    className={[
                      "relative text-left rounded-lg border px-3.5 py-3 transition-colors",
                      intent === opt.id
                        ? "border-aubergine-300 dark:border-aubergine-900 bg-aubergine-50 dark:bg-aubergine-950/30"
                        : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600",
                    ].join(" ")}
                    aria-pressed={intent === opt.id}
                  >
                    {/* Selection indicator */}
                    <span
                      className={[
                        "absolute top-2.5 right-2.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors",
                        intent === opt.id
                          ? "border-aubergine-700 bg-aubergine-700"
                          : "border-stone-300 dark:border-stone-600",
                      ].join(" ")}
                      aria-hidden
                    >
                      {intent === opt.id && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </span>

                    <p className={[
                      "text-[12px] font-semibold mb-0.5 pr-4",
                      intent === opt.id
                        ? "text-aubergine-900 dark:text-aubergine-300"
                        : "text-stone-800 dark:text-stone-200",
                    ].join(" ")}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-stone-400 dark:text-stone-500 mb-2">
                      {opt.tagline}
                    </p>
                    <ul className="space-y-0.5">
                      {opt.bullets.map((b) => (
                        <li key={b} className="text-[10px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                          <span className={[
                            "w-1 h-1 rounded-full flex-shrink-0",
                            intent === opt.id
                              ? "bg-aubergine-400"
                              : "bg-stone-400 dark:bg-stone-500",
                          ].join(" ")} />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-stone-400 dark:text-stone-500 leading-relaxed">
                You can switch modes at any time from your workspace settings.
              </p>
            </div>

            {/* Name */}
            <Field label="Full name">
              <input
                type="text"
                className="input-lg"
                placeholder="Your name"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                autoComplete="name"
                autoFocus
                disabled={formState === "loading"}
                required
              />
            </Field>

            {/* Email */}
            <Field label="Work email">
              <input
                type="email"
                className="input-lg"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                autoComplete="email"
                disabled={formState === "loading"}
                required
              />
            </Field>

            {/* Password */}
            <Field label="Password">
              <div className="relative">
                <input
                  type={pwVisible ? "text" : "password"}
                  className="input-lg pr-11"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  autoComplete="new-password"
                  disabled={formState === "loading"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setPwVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                  aria-label={pwVisible ? "Hide password" : "Show password"}
                >
                  {pwVisible ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="mt-1.5 flex gap-1">
                  {[1, 2, 3].map((level) => (
                    <div
                      key={level}
                      className={[
                        "h-0.5 flex-1 rounded-full transition-colors",
                        password.length >= level * 3
                          ? password.length >= 9
                            ? "bg-aubergine-700"
                            : password.length >= 6
                            ? "bg-amber-400"
                            : "bg-red-400"
                          : "bg-stone-200 dark:bg-stone-700",
                      ].join(" ")}
                    />
                  ))}
                  <span className="text-[10px] text-stone-400 dark:text-stone-500 ml-1">
                    {password.length < 6 ? "Too short" : password.length < 9 ? "Fair" : "Strong"}
                  </span>
                </div>
              )}
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
                  Creating account…
                </>
              ) : "Create account"}
            </button>
          </form>

          {/* Legal */}
          <p className="mt-4 text-center text-[11px] text-stone-400 dark:text-stone-500 leading-relaxed">
            By creating an account you agree to our{" "}
            <a href="#" className="underline underline-offset-2 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Terms</a>
            {" "}and{" "}
            <a href="#" className="underline underline-offset-2 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">Privacy Policy</a>.
          </p>
        </>
      )}

      {/* Switch to sign in */}
      <p className="mt-6 text-center text-[13px] text-stone-500 dark:text-stone-400">
        Already have an account?{" "}
        <Link
          href="/signin"
          className="font-medium text-aubergine-800 dark:text-aubergine-400 hover:underline underline-offset-2"
        >
          Sign in
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-stone-600 dark:text-stone-400 mb-1.5">
        {label}
      </label>
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

function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
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
