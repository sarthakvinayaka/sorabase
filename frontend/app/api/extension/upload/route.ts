/**
 * POST /api/extension/upload
 *
 * Receives a recorded audio file from the Chrome extension, transcribes it
 * via Whisper (through the existing FastAPI audio pipeline), and — if mode is
 * "study" — automatically triggers lecture extraction.
 *
 * Request: multipart/form-data
 *   file          File        — audio/webm (recorded by MediaRecorder)
 *   mode          string      — "general" | "recruiting" | "study"
 *   job_reference string?     — human label (session label or tab title)
 *   course        string?     — study mode: course name
 *   title         string?     — study mode: lecture title
 *   template_slug string?     — study mode: extraction template (default "lecture_notes")
 *
 * Response: application/json
 *   { conversation_id, lecture_id?, redirect_url }
 *
 * Auth: validates the caller's NextAuth session (same credentials:"include"
 * cookie the extension sends). Returns 401 if no valid session.
 *
 * The route proxies to FastAPI using the same HMAC pattern as the catch-all
 * proxy, keeping the backend auth contract unchanged.
 */

import { createHmac }       from "crypto";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions }      from "@/lib/auth-config";

const BACKEND_URL        = process.env.BACKEND_URL        || "http://localhost:8000";
const BACKEND_API_SECRET = process.env.BACKEND_API_SECRET || "";

function hmacToken(userId: string): string {
  return createHmac("sha256", BACKEND_API_SECRET)
    .update(userId)
    .digest("hex");
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
    "x-user-id":   userId,
    "x-api-token": hmacToken(userId),
  };

  // ── Parse the incoming form data ──────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { detail: "Invalid multipart form data." },
      { status: 400, headers: corsHeaders() },
    );
  }

  const file           = formData.get("file")          as File | null;
  const mode           = (formData.get("mode")          as string | null) ?? "general";
  const jobReference   = (formData.get("job_reference") as string | null) ?? "";
  const course         = (formData.get("course")        as string | null) ?? "";
  const title          = (formData.get("title")         as string | null) ?? "";
  const templateSlug   = (formData.get("template_slug") as string | null) ?? "lecture_notes";

  if (!file) {
    return NextResponse.json(
      { detail: "No audio file provided." },
      { status: 400, headers: corsHeaders() },
    );
  }

  // ── Step 1: Upload audio → Whisper transcription via existing /api/audio ──
  // We set source_type="browser_capture" via the job_reference metadata.
  // The backend audio route accepts audio/webm and returns conversation_id.
  const audioForm = new FormData();
  audioForm.append("file",          file, file.name || "capture.webm");
  audioForm.append("job_reference", jobReference || "Browser capture");

  let audioRes: Response;
  try {
    audioRes = await fetch(`${BACKEND_URL}/api/audio`, {
      method:  "POST",
      headers,       // no Content-Type — fetch sets multipart boundary automatically
      body:    audioForm,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { detail: `Backend unreachable: ${msg}` },
      { status: 502, headers: corsHeaders() },
    );
  }

  if (!audioRes.ok) {
    const body = await audioRes.text();
    return NextResponse.json(
      { detail: body || `Audio upload failed (${audioRes.status})` },
      { status: audioRes.status, headers: corsHeaders() },
    );
  }

  const audioData = await audioRes.json() as {
    conversation_id: string;
    transcript_ready: boolean;
  };

  const conversationId = audioData.conversation_id;
  const baseUrl        = process.env.NEXTAUTH_URL || "https://www.sorabase.org";

  // ── Step 2 (Study only): trigger lecture extraction ───────────────────────
  if (mode === "study") {
    const extractBody = JSON.stringify({
      conversation_id: conversationId,
      template_slug:   templateSlug,
      title:           title   || undefined,
      course:          course  || undefined,
    });

    let extractRes: Response;
    try {
      extractRes = await fetch(`${BACKEND_URL}/api/study/extract`, {
        method:  "POST",
        headers: { ...headers, "content-type": "application/json" },
        body:    extractBody,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Transcription succeeded but extraction failed — still return
      // conversation_id so the extension can show a partial success.
      return NextResponse.json(
        {
          conversation_id: conversationId,
          lecture_id:      null,
          redirect_url:    `${baseUrl}/workflow?conv=${conversationId}&source=capture`,
          warning:         `Study extraction failed: ${msg}`,
        },
        { status: 200, headers: corsHeaders() },
      );
    }

    if (extractRes.ok) {
      const extractData = await extractRes.json() as {
        lecture_id:    string;
        extraction_id: string;
      };
      return NextResponse.json(
        {
          conversation_id: conversationId,
          lecture_id:      extractData.lecture_id,
          extraction_id:   extractData.extraction_id,
          redirect_url:    `${baseUrl}/study/processing/${extractData.lecture_id}?source=capture`,
        },
        { status: 200, headers: corsHeaders() },
      );
    }

    // Extract call failed — fall through and return conversation_id only.
  }

  // ── General or Recruiting: return conversation_id + redirect URL ──────────
  const redirectUrl = mode === "general"
    ? `${baseUrl}/general/schema/${conversationId}?source=capture`
    : `${baseUrl}/workflow?conv=${conversationId}&source=capture`;

  return NextResponse.json(
    {
      conversation_id: conversationId,
      lecture_id:      null,
      redirect_url:    redirectUrl,
    },
    { status: 200, headers: corsHeaders() },
  );
}
