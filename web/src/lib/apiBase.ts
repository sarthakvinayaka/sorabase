/**
 * Browser API base URL (no trailing slash).
 * - If `NEXT_PUBLIC_API_URL` is set → use it (cross-origin; server CORS must allow this site).
 * - Otherwise → `/api` so Next.js rewrites proxy to FastAPI (same origin, no CORS).
 */
export function publicApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  const t = typeof raw === "string" ? raw.trim() : "";
  if (t) return t.replace(/\/+$/, "");
  return "/api";
}
