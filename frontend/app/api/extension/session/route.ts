/**
 * GET /api/extension/session
 *
 * Called by the Chrome extension popup to check whether the current browser
 * session belongs to a signed-in Sorabase user.
 *
 * The extension fetch() call includes cookies (credentials:"include"). Because
 * the extension has host_permissions for sorabase.org and extension requests
 * bypass SameSite restrictions in Chrome, this route reliably receives the
 * NextAuth session cookie and can validate it server-side.
 *
 * Returns:
 *   200 { authenticated: true,  user: { id, email, name } }   — valid session
 *   200 { authenticated: false }                               — no session
 *
 * Always returns 200 so the extension can distinguish "not signed in"
 * (authenticated:false) from "Sorabase unreachable" (fetch throw/non-200).
 *
 * CORS: the response includes explicit CORS headers allowing the extension
 * origin (chrome-extension://*) so the popup can read the response body.
 */

import { getServerSession }  from "next-auth";
import { NextResponse }      from "next/server";
import { authOptions }       from "@/lib/auth-config";

function corsHeaders(): Record<string, string> {
  return {
    // Chrome extensions send requests from chrome-extension:// origins.
    // Wildcard is safe here because the route returns no sensitive data —
    // it only confirms whether the *server-side* session is valid.
    "Access-Control-Allow-Origin":      "*",
    "Access-Control-Allow-Methods":     "GET, OPTIONS",
    "Access-Control-Allow-Headers":     "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { authenticated: false },
      { status: 200, headers: corsHeaders() },
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        id:    session.user.id,
        email: session.user.email ?? null,
        name:  session.user.name  ?? null,
      },
    },
    { status: 200, headers: corsHeaders() },
  );
}
