"use client";

// Client-side helper for logging product events.
// Fires and forgets — never throws, never blocks the caller.

type EventName =
  | "workspace_accessed"
  | "session_created"
  | "transcript_uploaded"
  | "meeting_connected"
  | "schema_proposed"
  | "schema_saved"
  | "extraction_run"
  | "export_json"
  | "webhook_sent"
  | "plan_viewed"
  | "upgrade_clicked";

export async function logActivity(
  eventName: EventName,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch("/api/activity", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ eventName, eventType: "product", metadata }),
    });
  } catch {
    // Silently fail — analytics must never break the product
  }
}
