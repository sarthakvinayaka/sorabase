/**
 * POST /api/extension/text-complete
 *
 * Finalises a desktop live-capture CaptureSession and, for study mode,
 * triggers lecture extraction. Called by the desktop app after the user
 * clicks Stop and Deepgram transcription is done.
 *
 * Request body (JSON):
 *   session_id    string   — the CaptureSession UUID
 *   mode          string   — "general" | "recruiting" | "study"
 *   label?        string   — session label
 *   course?       string   — study mode: course name
 *   title?        string   — study mode: lecture title
 *   template_slug? string  — study mode extraction template (default "lecture_notes")
 *
 * Response:
 *   { conversation_id, lecture_id?, redirect_url }
 *
 * Auth: validates the caller's NextAuth session cookie (same as the
 * extension upload route). The desktop app uses session.fromPartition
 * with the sorabase partition so the cookie is present on every call.
 */

import { createHmac }       from "crypto";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions }      from "@/lib/auth-config";

const BACKEND_URL        = process.env.BACKEND_URL        || "http://localhost:8000";
const BACKEND_API_SECRET = process.env.BACKEND_API_SECRET || "";

function hmacToken(userId: string): string {
  return createHmac("sha256", BACKEND_API_SECRET).update(userId).digest("hex");
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin":      "*",
    "Access-Control-Allow-Methods":     "POST, OPTIONS",
    "Access-Control-Allow-Headers":     "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { detail: "Authentication required." },
      { status: 401, headers: corsHeaders() },
    );
  }

  const userId  = session.user.id;
  const headers = {
    "x-user-id":    userId,
    "x-api-token":  hmacToken(userId),
    "content-type": "application/json",
  };

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: {
    session_id: string;
    mode?: string;
    label?: string;
    course?: string;
    title?: string;
    template_slug?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { detail: "Invalid JSON body." },
      { status: 400, headers: corsHeaders() },
    );
  }

  const { session_id, mode = "general", label, course, title, template_slug } = body;

  if (!session_id) {
    return NextResponse.json(
      { detail: "session_id is required." },
      { status: 400, headers: corsHeaders() },
    );
  }

  // ── Step 1: Complete the CaptureSession → get conversation_id ─────────────
  let completeRes: Response;
  try {
    completeRes = await fetch(
      `${BACKEND_URL}/api/capture-sessions/${session_id}/complete`,
      { method: "POST", headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { detail: `Backend unreachable: ${msg}` },
      { status: 502, headers: corsHeaders() },
    );
  }

  if (!completeRes.ok) {
    const text = await completeRes.text();
    return NextResponse.json(
      { detail: text || `Complete failed (${completeRes.status})` },
      { status: completeRes.status, headers: corsHeaders() },
    );
  }

  const { conversation_id } = (await completeRes.json()) as {
    conversation_id: string;
  };

  const baseUrl = process.env.NEXTAUTH_URL || "https://www.sorabase.org";

  // ── Step 2: Study — trigger lecture extraction ─────────────────────────────
  if (mode === "study") {
    const extractBody = JSON.stringify({
      conversation_id,
      template_slug: template_slug ?? "lecture_notes",
      title:  title  || label || undefined,
      course: course || undefined,
    });

    try {
      const extractRes = await fetch(`${BACKEND_URL}/api/study/extract`, {
        method:  "POST",
        headers,
        body:    extractBody,
      });

      if (extractRes.ok) {
        const { lecture_id } = (await extractRes.json()) as { lecture_id: string };
        return NextResponse.json(
          {
            conversation_id,
            lecture_id,
            redirect_url: `${baseUrl}/study/processing/${lecture_id}?source=desktop`,
          },
          { status: 200, headers: corsHeaders() },
        );
      }
    } catch {
      // Extraction failed — fall through and return conversation_id only
    }

    return NextResponse.json(
      {
        conversation_id,
        lecture_id: null,
        redirect_url: `${baseUrl}/workflow?conv=${conversation_id}&source=desktop`,
        warning: "Study extraction failed. Transcript is saved and can be reprocessed.",
      },
      { status: 200, headers: corsHeaders() },
    );
  }

  // ── General / Recruiting ───────────────────────────────────────────────────
  const redirectUrl =
    mode === "general"
      ? `${baseUrl}/general/schema/${conversation_id}?source=desktop`
      : `${baseUrl}/workflow?conv=${conversation_id}&source=desktop`;

  return NextResponse.json(
    { conversation_id, lecture_id: null, redirect_url: redirectUrl },
    { status: 200, headers: corsHeaders() },
  );
}
