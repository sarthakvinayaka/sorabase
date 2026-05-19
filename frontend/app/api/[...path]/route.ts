/**
 * Authenticated API proxy — catches all /api/* routes not handled by a
 * more-specific Next.js handler (i.e., everything going to the FastAPI backend).
 *
 * For every request:
 *  1. Validate the NextAuth session server-side.
 *  2. Compute HMAC-SHA256(userId, BACKEND_API_SECRET) as the X-Api-Token.
 *  3. Forward to BACKEND_URL with X-User-Id and X-Api-Token headers.
 *
 * Webhook paths (/api/webhooks/*) bypass session validation because they
 * are called by third-party services (Zoom, Recall.ai) with their own
 * signature validation.
 */

import { createHmac } from "crypto";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-config";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const BACKEND_API_SECRET = process.env.BACKEND_API_SECRET || "";

async function handle(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    return await proxyRequest(req, context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ detail: `Proxy error: ${message}` }, { status: 500 });
  }
}

async function proxyRequest(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const pathStr = path.join("/");

  // Webhooks bypass auth — validated by provider signatures in the backend.
  const isWebhook = pathStr.startsWith("webhooks/");
  const isHealth  = pathStr === "health";

  let extraHeaders: Record<string, string> = {};

  if (!isWebhook && !isHealth) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ detail: "Authentication required." }, { status: 401 });
    }

    const userId = session.user.id;
    const token  = createHmac("sha256", BACKEND_API_SECRET)
      .update(userId)
      .digest("hex");

    extraHeaders = {
      "x-user-id":   userId,
      "x-api-token": token,
    };
  }

  // Build the target URL, forwarding all query params.
  const targetUrl = new URL(`${BACKEND_URL}/api/${pathStr}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  // Forward the body for mutating methods.
  const body =
    req.method !== "GET" && req.method !== "HEAD" ? await req.arrayBuffer() : undefined;

  // Forward Content-Type for POST/PATCH/PUT but skip for multipart (browser sets it with boundary).
  const contentType = req.headers.get("content-type") ?? "";
  const forwardHeaders: Record<string, string> = {
    ...extraHeaders,
  };
  if (!contentType.startsWith("multipart/form-data")) {
    forwardHeaders["content-type"] = contentType || "application/json";
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: forwardHeaders,
      body: body ? Buffer.from(body) : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { detail: `Backend unreachable: ${message}` },
      { status: 502 },
    );
  }

  // Stream the response back.
  const resBody = await backendRes.arrayBuffer();
  return new NextResponse(resBody, {
    status: backendRes.status,
    headers: {
      "content-type": backendRes.headers.get("content-type") ?? "application/json",
    },
  });
}

export const GET     = handle;
export const POST    = handle;
export const PATCH   = handle;
export const PUT     = handle;
export const DELETE  = handle;
