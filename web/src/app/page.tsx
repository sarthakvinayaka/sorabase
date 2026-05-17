import Link from "next/link";

type HealthPayload = { status?: string; error?: string };

async function loadHealth(): Promise<HealthPayload> {
  const base = (process.env.SERVER_API_URL ?? "").trim() || "http://127.0.0.1:8000";
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    if (!res.ok) {
      return { error: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as { status?: string };
    return { status: body.status ?? "unknown" };
  } catch {
    return { error: "API unreachable (is the FastAPI server running on :8000?)" };
  }
}

export default async function Home() {
  const health = await loadHealth();

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Staffing MVP</p>
          <h1 className="text-3xl font-semibold tracking-tight">Pilot — recruiting intake &amp; review</h1>
          <p className="text-sm leading-relaxed text-zinc-600">
            Audio upload with mock transcription and extraction, recruiter review console, exports, and operations analytics. Configure{" "}
            <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-xs">web/.env.local</code> from{" "}
            <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-xs">.env.example</code>, then seed the demo org (see README).
          </p>
        </header>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Demo paths</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-zinc-700">
            <li>
              <Link className="font-medium text-zinc-900 underline-offset-4 hover:underline" href="/upload">
                Upload audio
              </Link>{" "}
              — intake and recent uploads list
            </li>
            <li>
              <Link className="font-medium text-zinc-900 underline-offset-4 hover:underline" href="/analytics">
                Recruiting analytics
              </Link>{" "}
              — add <code className="text-xs">?organization_id=…</code> or set <code className="text-xs">NEXT_PUBLIC_DEV_ORG_ID</code>
            </li>
            <li>
              Open an upload detail page after upload, run mock transcription and extraction, then use{" "}
              <strong className="font-medium">Review console</strong> from the pipeline card.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">API health</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Server-side fetch to <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">GET /health</code> using{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">SERVER_API_URL</code> (Next.js server env). Browser calls use{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">/api</code> by default (rewritten to FastAPI; set{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">NEXT_PUBLIC_API_URL</code> only for direct API origin).
          </p>
          <div className="mt-4 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-sm">
            {health.error ? (
              <span className="text-red-600">{health.error}</span>
            ) : (
              <span className="text-emerald-700">{`status: ${health.status}`}</span>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
