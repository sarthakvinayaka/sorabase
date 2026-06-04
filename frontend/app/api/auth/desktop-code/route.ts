/**
 * Desktop OAuth handshake
 *
 * GET  /api/auth/desktop-code
 *   Requires an active NextAuth session (system browser has the httpOnly cookie).
 *   Generates a 64-byte random one-time code, stores cookie name+value server-side,
 *   returns { code }.  Expires in 2 minutes.
 *
 * POST /api/auth/desktop-code  { code: "..." }
 *   Called by the Electron app (no browser cookies).
 *   Validates the code and returns { cookie_name, cookie_value }.
 *   Single-use — deleted on first successful exchange.
 */

import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { authOptions } from "@/lib/auth-config";

interface CodeEntry {
  cookieName: string;
  cookieValue: string;
  expiresAt: number;
}

// In-memory store — acceptable for single-server Railway deployment.
// Codes are single-use and expire in 2 minutes.
const store = new Map<string, CodeEntry>();

function prune() {
  const now = Date.now();
  for (const [k, v] of store) if (v.expiresAt < now) store.delete(k);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const cookieName =
    req.cookies.has("__Secure-next-auth.session-token")
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";
  const cookieValue = req.cookies.get(cookieName)?.value;

  if (!cookieValue) {
    return NextResponse.json({ error: "Session cookie not found" }, { status: 400 });
  }

  prune();
  const code = randomBytes(64).toString("hex");
  store.set(code, { cookieName, cookieValue, expiresAt: Date.now() + 120_000 });

  return NextResponse.json({ code });
}

export async function POST(req: NextRequest) {
  let code: string | undefined;
  try {
    ({ code } = await req.json() as { code?: string });
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  prune();
  const entry = store.get(code);
  if (!entry || entry.expiresAt < Date.now()) {
    store.delete(code);
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 404 });
  }

  store.delete(code); // single-use
  return NextResponse.json({ cookie_name: entry.cookieName, cookie_value: entry.cookieValue });
}
