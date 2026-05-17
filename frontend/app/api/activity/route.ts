import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/db";

// Valid event names — extend as the product grows
const VALID_EVENTS = new Set([
  "workspace_accessed",
  "session_created",
  "transcript_uploaded",
  "meeting_connected",
  "schema_proposed",
  "schema_saved",
  "extraction_run",
  "export_json",
  "webhook_sent",
  "plan_viewed",
  "upgrade_clicked",
]);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    eventName: string;
    eventType?: string;
    metadata?: Record<string, unknown>;
  };

  if (!VALID_EVENTS.has(body.eventName)) {
    return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }

  await prisma.activityLog.create({
    data: {
      userId:    session.user.id,
      eventType: body.eventType ?? "product",
      eventName: body.eventName,
      metadata:  (body.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
