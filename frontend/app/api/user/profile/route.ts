import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/db";

// GET — return the current user's profile
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  return NextResponse.json(profile);
}

// PATCH — update mutable profile fields
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    onboarded?:    boolean;
    accessType?:   "recruiter" | "general" | "study" | "pending";
    // Set keepOnboarded=true when switching home workspace for an already-
    // onboarded user.  Without it, accessType changes reset onboarded so the
    // user sees the workspace tour again (intended for first-time access grants).
    keepOnboarded?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (typeof body.onboarded  === "boolean") data.onboarded  = body.onboarded;
  if (body.accessType)                      data.accessType = body.accessType;

  // When access is granted for the first time, reset onboarded so user sees
  // workspace onboarding.  Skip the reset when switching home workspace for an
  // already-onboarded user (keepOnboarded=true).
  if (body.accessType && body.accessType !== "pending" && !body.keepOnboarded) {
    data.onboarded = false;
  }

  const updated = await prisma.userProfile.update({
    where: { userId: session.user.id },
    data,
  });

  // Log meaningful state changes
  if (body.onboarded === true) {
    prisma.activityLog.create({
      data: {
        userId:    session.user.id,
        eventType: "workspace",
        eventName: "onboarding_completed",
        metadata:  { accessType: updated.accessType },
      },
    }).catch(() => undefined);
  }

  if (body.accessType) {
    prisma.activityLog.create({
      data: {
        userId:    session.user.id,
        eventType: "workspace",
        eventName: "access_granted",
        metadata:  { accessType: body.accessType },
      },
    }).catch(() => undefined);
  }

  return NextResponse.json(updated);
}
