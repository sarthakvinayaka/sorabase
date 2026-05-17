"use client";

import { humanizeFieldName } from "@/lib/humanizeFieldName";

import type { AuditTimelineEntryDTO } from "./reviewTypes";

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function actionTitle(action: string): string {
  const titles: Record<string, string> = {
    "review.field_edited": "Field edited",
    "review.approved": "Record approved",
    "review.rejected": "Record rejected",
    "review.fields_saved": "Fields saved (batch)",
    "extraction.run_completed": "Extraction completed",
  };
  return titles[action] ?? action;
}

function summarizeMeta(entry: AuditTimelineEntryDTO): string | null {
  const m = entry.metadata;
  if (entry.action === "review.field_edited") {
    const name = typeof m.field_name === "string" ? m.field_name : "";
    const oldV = typeof m.old_value === "string" || m.old_value == null ? String(m.old_value ?? "") : "…";
    const newV = typeof m.new_value === "string" || m.new_value == null ? String(m.new_value ?? "") : "…";
    const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
    return `${humanizeFieldName(name)} · ${clip(oldV, 48)} → ${clip(newV, 48)}`;
  }
  if (entry.action === "review.approved" || entry.action === "review.rejected") {
    const prev = typeof m.previous_approval_status === "string" ? m.previous_approval_status : "";
    const next = typeof m.new_approval_status === "string" ? m.new_approval_status : "";
    const ps = typeof m.previous_processing_stage === "string" ? m.previous_processing_stage : "";
    const ns = typeof m.new_processing_stage === "string" ? m.new_processing_stage : "";
    const parts: string[] = [];
    if (prev && next) parts.push(`Approval: ${prev} → ${next}`);
    if (ps && ns && ps !== ns) parts.push(`Stage: ${ps} → ${ns}`);
    const base = parts.length ? parts.join(" · ") : "";
    if (entry.action === "review.rejected" && typeof m.reason === "string" && m.reason.trim()) {
      const r = m.reason.trim();
      const clipped = r.length > 120 ? `${r.slice(0, 120)}…` : r;
      return base ? `${base} · Reason: ${clipped}` : `Reason: ${clipped}`;
    }
    if (base) return base;
  }
  if (entry.action === "extraction.run_completed") {
    const run = typeof m.run_index === "number" ? `Run #${m.run_index}` : "Run";
    const prov = typeof m.provider === "string" ? m.provider : "";
    return prov ? `${run} · ${prov}` : run;
  }
  return null;
}

type Props = {
  entries: AuditTimelineEntryDTO[];
  loading: boolean;
  error: string | null;
};

export function AuditTimelinePanel({ entries, loading, error }: Props) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <header className="border-b border-zinc-100 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Audit timeline</h2>
        <p className="mt-0.5 text-sm text-zinc-600">Field edits, approvals, rejections, and extraction milestones for this candidate.</p>
      </header>
      <div className="max-h-[min(420px,50vh)] overflow-y-auto px-4 py-3">
        {loading ? <p className="text-sm text-zinc-500">Loading audit…</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!loading && !error && entries.length === 0 ? (
          <p className="text-sm text-zinc-500">No audit events yet.</p>
        ) : null}
        {!loading && !error && entries.length > 0 ? (
          <ol className="space-y-4">
            {entries.map((e) => {
              const sub = summarizeMeta(e);
              return (
                <li key={e.id} className="border-l-2 border-zinc-200 pl-3">
                  <p className="text-[11px] text-zinc-500">{formatWhen(e.created_at)}</p>
                  <p className="text-sm font-medium text-zinc-900">{actionTitle(e.action)}</p>
                  <p className="text-[11px] text-zinc-400">
                    {e.actor_type === "user" ? "User" : e.actor_type}
                    {e.actor_user_id ? ` · ${e.actor_user_id}` : ""}
                  </p>
                  {sub ? <p className="mt-1 font-mono text-xs leading-relaxed text-zinc-600">{sub}</p> : null}
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
