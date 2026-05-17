/**
 * Normalize FastAPI / Starlette error bodies for UI.
 * `detail` may be a string, or a list of validation objects `{ loc, msg, type }`.
 */
export function detailFromUnknown(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (item && typeof item === "object" && "msg" in item) {
        const msg = (item as { msg?: unknown }).msg;
        if (typeof msg === "string" && msg.trim()) return msg.trim();
      }
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    });
    const joined = parts.filter(Boolean).join("; ");
    return joined || null;
  }
  if (detail != null && typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      return String(detail);
    }
  }
  return null;
}

export function parseApiErrorJsonBody(raw: string): string | null {
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    return detailFromUnknown(j.detail);
  } catch {
    return null;
  }
}

/** Prefer server message; fall back to HTTP status line. */
export function apiErrorMessage(status: number, rawBody: string): string {
  const fromJson = parseApiErrorJsonBody(rawBody);
  if (fromJson) return fromJson;
  const trimmed = rawBody.trim();
  if (trimmed.length > 0 && trimmed.length < 400 && !trimmed.startsWith("<")) return trimmed;
  return `HTTP ${status}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}
