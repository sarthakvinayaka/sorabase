"use client";

import { createContext, useContext, useCallback } from "react";
import { SessionProvider, useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";
import type { AuthUser, AccessType } from "./auth";

// ── Context surface — identical to the previous mock interface ────────────────
// All existing consumers (AuthGuard, entry, onboarding, ConditionalNav, etc.)
// continue to work unchanged. markOnboarded + grantAccess are now async to
// accommodate the DB round-trip; the two call sites are updated accordingly.

interface AuthContextValue {
  user:           AuthUser | null;
  isLoading:      boolean;
  signIn:         (email: string, password: string) => Promise<void>;
  signUp:         (name: string, email: string, password: string, intent?: "recruiter" | "general" | "study") => Promise<void>;
  signOut:        () => void;
  markOnboarded:  () => Promise<AuthUser | null>;
  grantAccess:    (access: Exclude<AccessType, "pending">) => Promise<AuthUser | null>;
  /** Change the user's home workspace without re-triggering onboarding. */
  switchHomeMode: (mode: Exclude<AccessType, "pending">) => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Inner provider — has access to NextAuth's SessionProvider context ─────────

function AuthContextInner({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession();

  const isLoading = status === "loading";

  const user: AuthUser | null = session?.user
    ? {
        id:        session.user.id,
        name:      session.user.name  ?? "",
        email:     session.user.email ?? "",
        access:    session.user.access,
        onboarded: session.user.onboarded,
        plan:      session.user.plan,
      }
    : null;

  // ── Sign in with email + password ─────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    const result = await nextAuthSignIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      throw new Error("Invalid email or password. Please try again.");
    }
  }, []);

  // ── Sign up then immediately sign in ──────────────────────────────────────
  const signUp = useCallback(async (name: string, email: string, password: string, intent?: "recruiter" | "general" | "study") => {
    const res = await fetch("/api/auth/register", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, email, password, intent }),
    });

    if (!res.ok) {
      const data = await res.json() as { error?: string };
      throw new Error(data.error ?? "Registration failed. Please try again.");
    }

    // Sign in immediately after successful registration
    const result = await nextAuthSignIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      throw new Error("Account created but sign-in failed. Please sign in manually.");
    }
  }, []);

  // ── Sign out ──────────────────────────────────────────────────────────────
  const signOut = useCallback(() => {
    nextAuthSignOut({ callbackUrl: "/signin" });
  }, []);

  // ── Mark onboarding complete ──────────────────────────────────────────────
  const markOnboarded = useCallback(async (): Promise<AuthUser | null> => {
    if (!user) return null;

    await fetch("/api/user/profile", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ onboarded: true }),
    });

    // Trigger JWT refresh — jwt callback re-reads the DB on trigger: "update"
    await update();

    return { ...user, onboarded: true };
  }, [user, update]);

  // ── Grant workspace access (dev/admin simulation) ─────────────────────────
  const grantAccess = useCallback(async (
    access: Exclude<AccessType, "pending">,
  ): Promise<AuthUser | null> => {
    if (!user) return null;

    await fetch("/api/user/profile", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ accessType: access }),
    });

    await update();

    // accessType change resets onboarded in the API route
    return { ...user, access, onboarded: false };
  }, [user, update]);

  // ── Switch home workspace (already-onboarded user) ───────────────────────
  const switchHomeMode = useCallback(async (
    mode: Exclude<AccessType, "pending">,
  ): Promise<AuthUser | null> => {
    if (!user) return null;

    await fetch("/api/user/profile", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ accessType: mode, keepOnboarded: true }),
    });

    await update();

    return { ...user, access: mode };
  }, [user, update]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, markOnboarded, grantAccess, switchHomeMode }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Public provider — wraps NextAuth SessionProvider ─────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthContextInner>{children}</AuthContextInner>
    </SessionProvider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
