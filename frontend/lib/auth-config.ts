import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { AccessType, PlanType } from "@prisma/client";

// ── Default limits by plan ────────────────────────────────────────────────────

const PLAN_LIMITS: Record<PlanType, number> = {
  free:   10,
  pro:    -1, // -1 = unlimited
  custom: -1,
};

// ── Helper — ensure a UserProfile exists for a user ──────────────────────────
// Called in events.createUser and in the jwt callback on first sign-in.

async function ensureProfile(userId: string): Promise<{ accessType: AccessType; planType: PlanType; onboarded: boolean }> {
  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.userProfile.create({
    data: {
      userId,
      accessType: "pending",
      planType:   "free",
      meetingLimit: PLAN_LIMITS.free,
      meetingsUsed: 0,
      onboarded:  false,
    },
  });
}

// ── Activity log helper ───────────────────────────────────────────────────────

async function logEvent(
  userId: string,
  eventType: string,
  eventName: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        eventType,
        eventName,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // Never block auth flow for logging failures
  }
}

// ── NextAuth configuration ────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  // JWT sessions: no extra DB round-trip on each request
  session: { strategy: "jwt" },

  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    AzureADProvider({
      clientId:     process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId:     process.env.AZURE_AD_TENANT_ID ?? "common",
      allowDangerousEmailAccountLinking: true,
    }),

    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: (credentials.email as string).toLowerCase().trim() },
        });

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;

        return {
          id:    user.id,
          email: user.email,
          name:  user.name,
          image: user.image,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial sign-in: user object is available
      if (user?.id) {
        token.id = user.id;
        const profile = await ensureProfile(user.id);
        token.access    = profile.accessType;
        token.onboarded = profile.onboarded;
        token.plan      = profile.planType;
      }

      // Force re-fetch from DB after a profile mutation (markOnboarded, grantAccess)
      if (trigger === "update" && token.id) {
        const profile = await prisma.userProfile.findUnique({
          where: { userId: token.id as string },
        });
        if (profile) {
          token.access    = profile.accessType;
          token.onboarded = profile.onboarded;
          token.plan      = profile.planType;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id        = token.id as string;
        session.user.access    = token.access    as "recruiter" | "general" | "pending";
        session.user.onboarded = token.onboarded as boolean;
        session.user.plan      = token.plan      as "free" | "pro" | "custom";
      }
      return session;
    },
  },

  events: {
    async createUser({ user }) {
      // Called once when a new user is created via OAuth
      await ensureProfile(user.id);
      await logEvent(user.id, "auth", "user_signed_up", {
        email: user.email,
        name:  user.name,
      });
    },

    async signIn({ user, isNewUser }) {
      if (!isNewUser) {
        await logEvent(user.id, "auth", "user_signed_in", { email: user.email });
      }
    },
  },

  pages: {
    signIn:   "/signin",
    error:    "/signin",
    newUser:  "/app/onboarding",
  },
};
