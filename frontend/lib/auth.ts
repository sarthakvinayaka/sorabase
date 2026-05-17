// ─────────────────────────────────────────────────────────────────────────────
// auth.ts — stable public types and redirect logic.
//
// All mock implementations (MOCK_USERS, localStorage, signIn, signUp, signOut,
// grantAccess, markOnboarded) have been removed and replaced by NextAuth +
// the Prisma-backed API routes in app/api/auth/ and app/api/user/.
// ─────────────────────────────────────────────────────────────────────────────

export type AccessType = "recruiter" | "general" | "pending";
export type PlanType   = "free" | "pro" | "custom";

export interface AuthUser {
  id:        string;
  name:      string;
  email:     string;
  access:    AccessType;
  onboarded: boolean;
  plan?:     PlanType;
}

// ── Redirect logic ────────────────────────────────────────────────────────────
// Single source of truth: every post-auth redirect goes through here.

export function getRedirectForUser(user: AuthUser): string {
  if (user.access === "pending")   return "/app/entry";
  if (!user.onboarded)             return "/app/onboarding";
  if (user.access === "recruiter") return "/workflow";
  if (user.access === "general")   return "/general";
  return "/app/entry";
}

export function getWorkspaceForUser(user: Pick<AuthUser, "access">): string {
  return user.access === "recruiter" ? "/workflow" : "/general";
}
