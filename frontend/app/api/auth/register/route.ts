import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string; email?: string; password?: string };
    const name  = (body.name  ?? "").trim();
    const email = (body.email ?? "").toLowerCase().trim();
    const pass  = body.password ?? "";

    if (!name)        return NextResponse.json({ error: "Full name is required." },              { status: 400 });
    if (!email)       return NextResponse.json({ error: "Email is required." },                  { status: 400 });
    if (pass.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(pass, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        profile: {
          create: {
            accessType:   "pending",
            planType:     "free",
            meetingLimit: 10,
            meetingsUsed: 0,
            onboarded:    false,
          },
        },
      },
    });

    // Activity log — fire and forget
    prisma.activityLog.create({
      data: {
        userId:    user.id,
        eventType: "auth",
        eventName: "user_signed_up",
        metadata:  { email, name, method: "credentials" },
      },
    }).catch(() => undefined);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
