// ─────────────────────────────────────────────────────────────────────────────
// auth.ts — stable public types and redirect logic.
//
// All mock implementations (MOCK_USERS, localStorage, signIn, signUp, signOut,
// grantAccess, markOnboarded) have been removed and replaced by NextAuth +
// the Prisma-backed API routes in app/api/auth/ and app/api/user/.
// ─────────────────────────────────────────────────────────────────────────────

export type AccessType = "recruiter" | "general" | "study" | "pending";
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
  if (!user.onboarded)             return "/onboarding";
  if (user.access === "recruiter") return "/workflow";
  if (user.access === "general")   return "/general";
  if (user.access === "study")     return "/study";
  return "/onboarding";
}

export function getWorkspaceForUser(user: Pick<AuthUser, "access">): string {
  if (user.access === "recruiter") return "/workflow";
  if (user.access === "study")     return "/study";
  return "/general";
}
