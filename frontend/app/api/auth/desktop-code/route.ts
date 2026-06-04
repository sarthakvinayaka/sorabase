/**
 * GET /api/auth/desktop-code
 *
 * Called by /auth/desktop-complete (system browser, same origin) with the
 * user's session cookie included automatically. Reads the httpOnly NextAuth
 * session cookie server-side and returns its name + value as JSON so the
 * page can forward them to Electron's local callback server.
 *
 * No shared state, no code exchange — works correctly on Vercel serverless
 * where in-memory Maps reset between invocations.
 */

import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-config";

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: cors() });
  }

  // NextAuth sets __Secure- prefix on HTTPS, plain name on HTTP (dev)
  const cookieName = req.cookies.has("__Secure-next-auth.session-token")
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  const cookieValue = req.cookies.get(cookieName)?.value;
  if (!cookieValue) {
    return NextResponse.json({ error: "Session cookie not found" }, { status: 400, headers: cors() });
  }

  return NextResponse.json({ cookie_name: cookieName, cookie_value: cookieValue }, { headers: cors() });
}
