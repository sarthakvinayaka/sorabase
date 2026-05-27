import type { DefaultSession } from "next-auth";

// Augment NextAuth session and JWT with Sorabase-specific fields.
// These are populated in the jwt + session callbacks inside lib/auth-config.ts.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      access: "recruiter" | "general" | "study" | "pending";
      onboarded: boolean;
      plan: "free" | "pro" | "custom";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    access: "recruiter" | "general" | "study" | "pending";
    onboarded: boolean;
    plan: "free" | "pro" | "custom";
  }
}
