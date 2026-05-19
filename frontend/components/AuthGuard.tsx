"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getRedirectForUser } from "@/lib/auth";
import type { AccessType } from "@/lib/auth";

interface Props {
  // Kept for documentation — marks which workspace this layout belongs to.
  // No longer restricts access: all authenticated, onboarded users can visit
  // any workspace regardless of which mode they chose at signup.
  required: Exclude<AccessType, "pending">;
  children: React.ReactNode;
}

/**
 * Wraps a workspace page.
 * - Not signed in → /signin
 * - Pending or not yet onboarded → /onboarding (or /entry)
 * - Any non-pending, onboarded user → renders children
 *
 * Cross-workspace navigation is intentionally unrestricted: a user who signed
 * up for General Mode can freely visit the Recruiter or Study workspaces.
 * The mode they chose at signup is their *home* (default landing page), not
 * a hard access gate.
 */
export default function AuthGuard({ required: _required, children }: Props) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/signin");
      return;
    }
    // Pending users and users who haven't completed onboarding go to the
    // appropriate gate page.  Everyone else may access any workspace.
    if (user.access === "pending" || !user.onboarded) {
      router.replace(getRedirectForUser(user));
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return <LoadingShell message="Loading workspace…" />;
  }

  if (user.access === "pending" || !user.onboarded) {
    return <LoadingShell message="Setting up your workspace…" />;
  }

  return <>{children}</>;
}

function LoadingShell({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 px-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-xs">
        <svg className="w-5 h-5 animate-spin text-aubergine-700 flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <p className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
