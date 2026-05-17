"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getRedirectForUser } from "@/lib/auth";
import type { AccessType } from "@/lib/auth";

interface Props {
  required: Exclude<AccessType, "pending">;
  children: React.ReactNode;
}

/**
 * Wraps a workspace page and enforces access type.
 * - Not logged in → /signin
 * - Wrong access type or pending → getRedirectForUser (their correct destination)
 * - Correct access → renders children
 */
export default function AuthGuard({ required, children }: Props) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const wrongMode = !isLoading && !!user && user.access !== required;

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/signin");
      return;
    }
    if (user.access !== required) {
      router.replace(getRedirectForUser(user));
    }
  }, [user, isLoading, required, router]);

  if (isLoading || !user) {
    return <LoadingShell message="Loading workspace…" />;
  }

  if (wrongMode) {
    return <LoadingShell message="This workspace isn't available for your account. Redirecting…" />;
  }

  return <>{children}</>;
}

function LoadingShell({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 px-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-xs">
        <svg className="w-5 h-5 animate-spin text-teal-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <p className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
