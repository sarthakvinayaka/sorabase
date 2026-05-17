"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { publicApiBase } from "@/lib/apiBase";
import { apiErrorMessage } from "@/lib/parseApiError";

const SLATE = ["#1e293b", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1"];
const GRID = "#e7e5e4";
const AXIS = "#78716c";

type NamedCount = { name: string; count: number };

type Kpis = {
  total_uploads: number;
  transcripts_total: number;
  transcripts_complete: number;
  transcripts_failed: number;
  transcription_success_rate: number | null;
  extraction_runs_total: number;
  extraction_runs_complete: number;
  extraction_runs_failed: number;
  extraction_success_rate: number | null;
  candidates_in_scope: number;
  candidates_ready_ats_sync: number;
  candidates_approved: number;
  candidates_synced: number;
  avg_upload_to_approval_hours: number | null;
};

type RecentRow = {
  id: string;
  approval_status: string;
  processing_stage: string;
  extraction_status: string;
  ats_sync_status: string;
  internal_title: string | null;
  updated_at: string;
  recruiter_label: string | null;
  primary_skills_snippet: string | null;
};

type RecruiterOption = { id: string; display_label: string };

type DashboardPayload = {
  kpis: Kpis;
  top_missing_fields: NamedCount[];
  top_skills: NamedCount[];
  work_authorization_mix: NamedCount[];
  visa_status_mix: NamedCount[];
  notice_period_distribution: NamedCount[];
  pipeline_counts: Record<string, number>;
  recent_candidates: RecentRow[];
  recruiter_options: RecruiterOption[];
};

const APPROVAL_FILTERS = [
  { value: "", label: "Any approval" },
  { value: "not_started", label: "Not started" },
  { value: "pending_review", label: "Pending review" },
  { value: "partially_approved", label: "Partially approved" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const STAGE_FILTERS = [
  { value: "", label: "Any stage" },
  { value: "uploaded", label: "Uploaded" },
  { value: "transcribed", label: "Transcribed" },
  { value: "extracted", label: "Extracted" },
  { value: "needs_review", label: "Needs review" },
  { value: "approved", label: "Approved" },
  { value: "synced", label: "Synced" },
];

function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 1000) / 10}%`;
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200/90 bg-white px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-medium tabular-nums tracking-tight text-stone-900">{value}</p>
      {hint ? <p className="mt-1.5 text-xs leading-snug text-stone-500">{hint}</p> : null}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <h3 className="text-sm font-medium tracking-tight text-stone-900">{title}</h3>
      {subtitle ? <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p> : null}
      <div className="mt-4 h-64 w-full">{children}</div>
    </div>
  );
}

export function RecruitingAnalyticsDashboard() {
  const searchParams = useSearchParams();
  const defaultOrg = process.env.NEXT_PUBLIC_DEV_ORG_ID ?? "";
  const orgId = searchParams.get("organization_id") ?? defaultOrg;

  type F = {
    recruiterId: string;
    approval: string;
    stage: string;
    skill: string;
    workAuth: string;
    visa: string;
    location: string;
  };
  const empty: F = {
    recruiterId: "",
    approval: "",
    stage: "",
    skill: "",
    workAuth: "",
    visa: "",
    location: "",
  };
  const [draft, setDraft] = useState<F>(empty);
  const [applied, setApplied] = useState<F>(empty);

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const buildQuery = useCallback(
    (f: F) => {
      const p = new URLSearchParams();
      p.set("organization_id", orgId);
      if (f.recruiterId) p.set("recruiter_id", f.recruiterId);
      if (f.approval) p.set("approval_status", f.approval);
      if (f.stage) p.set("processing_stage", f.stage);
      if (f.skill.trim()) p.set("skill_contains", f.skill.trim());
      if (f.workAuth.trim()) p.set("work_authorization", f.workAuth.trim());
      if (f.visa.trim()) p.set("visa_status", f.visa.trim());
      if (f.location.trim()) p.set("location_contains", f.location.trim());
      return p.toString();
    },
    [orgId],
  );

  const load = useCallback(async () => {
    if (!orgId) {
      setError("Set organization_id (query or NEXT_PUBLIC_DEV_ORG_ID).");
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${publicApiBase()}/v1/analytics/recruiting?${buildQuery(applied)}`, { cache: "no-store" });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, raw));
      }
      setData(JSON.parse(raw) as DashboardPayload);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [applied, buildQuery, orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visaChart = useMemo(() => {
    if (!data) return [];
    return [...data.visa_status_mix]
      .reverse()
      .map((s) => ({ name: s.name.length > 28 ? `${s.name.slice(0, 27)}…` : s.name, count: s.count }));
  }, [data]);

  const pipelineSummary = useMemo(() => {
    if (!data) return "";
    const p = data.pipeline_counts;
    return `In scope ${p.candidates ?? 0} · Pending review ${p.pending_review ?? 0} · Approved (incl. partial) ${p.approved ?? 0} · Rejected ${p.rejected ?? 0} · Extraction complete ${p.extraction_complete ?? 0}`;
  }, [data]);

  const ratesBar = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Transcription", rate: data.kpis.transcription_success_rate ?? 0 },
      { name: "Extraction", rate: data.kpis.extraction_success_rate ?? 0 },
    ];
  }, [data]);

  const skillsChart = useMemo(() => {
    if (!data) return [];
    return [...data.top_skills]
      .reverse()
      .map((s) => ({ name: s.name.length > 32 ? `${s.name.slice(0, 31)}…` : s.name, count: s.count }));
  }, [data]);

  const workAuthPie = useMemo(() => {
    if (!data?.work_authorization_mix.length) return [];
    const rows = data.work_authorization_mix.slice(0, 6);
    const rest = data.work_authorization_mix.slice(6).reduce((s, x) => s + x.count, 0);
    if (rest > 0) rows.push({ name: "Other", count: rest });
    return rows;
  }, [data]);

  const missingChart = useMemo(() => {
    if (!data) return [];
    return data.top_missing_fields.map((m) => ({
      name: m.name.replace(/_/g, " "),
      count: m.count,
    }));
  }, [data]);

  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900">
      <header className="border-b border-stone-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-6 py-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Operations</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">Recruiting analytics</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-600">
              Pipeline health, intake quality, and field gaps — scoped to your organization. Filters narrow the candidate cohort; uploads and
              transcripts follow the recruiter filter on the uploader where set.
            </p>
          </div>
          <Link href="/upload" className="text-sm font-medium text-stone-700 underline-offset-4 hover:text-stone-900 hover:underline">
            Uploads
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <section className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Filters</h2>
          <p className="mt-2 text-xs text-stone-500">
            Edit fields, then <span className="font-medium text-stone-700">Apply filters</span> to refresh metrics. Changing organization in the URL reloads automatically.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-medium text-stone-600">
              Recruiter
              <select
                className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-900 outline-none ring-stone-400 focus:ring-1"
                value={draft.recruiterId}
                onChange={(e) => setDraft((d) => ({ ...d, recruiterId: e.target.value }))}
              >
                <option value="">All</option>
                {(data?.recruiter_options ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.display_label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-stone-600">
              Approval
              <select
                className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-900 outline-none ring-stone-400 focus:ring-1"
                value={draft.approval}
                onChange={(e) => setDraft((d) => ({ ...d, approval: e.target.value }))}
              >
                {APPROVAL_FILTERS.map((o) => (
                  <option key={o.value || "any"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-stone-600">
              Stage
              <select
                className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-900 outline-none ring-stone-400 focus:ring-1"
                value={draft.stage}
                onChange={(e) => setDraft((d) => ({ ...d, stage: e.target.value }))}
              >
                {STAGE_FILTERS.map((o) => (
                  <option key={o.value || "any-s"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-stone-600">
              Skill contains
              <input
                className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-900 outline-none ring-stone-400 focus:ring-1"
                value={draft.skill}
                onChange={(e) => setDraft((d) => ({ ...d, skill: e.target.value }))}
                placeholder="e.g. Kubernetes"
              />
            </label>
            <label className="block text-xs font-medium text-stone-600">
              Work authorization
              <input
                className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-900 outline-none ring-stone-400 focus:ring-1"
                value={draft.workAuth}
                onChange={(e) => setDraft((d) => ({ ...d, workAuth: e.target.value }))}
                placeholder="Substring match"
              />
            </label>
            <label className="block text-xs font-medium text-stone-600">
              Visa status
              <input
                className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-900 outline-none ring-stone-400 focus:ring-1"
                value={draft.visa}
                onChange={(e) => setDraft((d) => ({ ...d, visa: e.target.value }))}
                placeholder="Substring match"
              />
            </label>
            <label className="block text-xs font-medium text-stone-600">
              Location
              <input
                className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm text-stone-900 outline-none ring-stone-400 focus:ring-1"
                value={draft.location}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                placeholder="current_location"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setApplied({ ...draft })}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800"
            >
              Apply filters
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(empty);
                setApplied(empty);
              }}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Reset
            </button>
            {loading ? <span className="self-center text-xs text-stone-500">Loading…</span> : null}
          </div>
        </section>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Total uploads" value={data.kpis.total_uploads} hint="Audio files in org (uploader filter if set)." />
              <Kpi
                label="Transcription success"
                value={pct(data.kpis.transcription_success_rate)}
                hint={`${data.kpis.transcripts_complete} complete / ${data.kpis.transcripts_failed} failed · ${data.kpis.transcripts_total} rows.`}
              />
              <Kpi
                label="Extraction success"
                value={pct(data.kpis.extraction_success_rate)}
                hint={`${data.kpis.extraction_runs_complete} complete / ${data.kpis.extraction_runs_failed} failed · scoped runs.`}
              />
              <Kpi label="Candidates in scope" value={data.kpis.candidates_in_scope} hint="After table + field filters." />
              <Kpi label="Ready for ATS sync" value={data.kpis.candidates_ready_ats_sync} hint="Approved, not synced/skipped." />
              <Kpi label="Approved records" value={data.kpis.candidates_approved} />
              <Kpi label="Synced records" value={data.kpis.candidates_synced} />
              <Kpi
                label="Avg. upload → approval"
                value={data.kpis.avg_upload_to_approval_hours != null ? `${data.kpis.avg_upload_to_approval_hours} h` : "—"}
                hint="Proxy: audio upload created → candidate updated (approved only)."
              />
            </section>

            <p className="text-center text-xs leading-relaxed text-stone-500">{pipelineSummary}</p>

            <section className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="Terminal success rates" subtitle="Complete ÷ (complete + failed) for transcripts and extraction runs.">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={ratesBar} margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} horizontal={false} />
                    <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: AXIS, fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value) => {
                        const n = typeof value === "number" ? value : Number(value);
                        return pct(Number.isFinite(n) ? n : null);
                      }}
                    />
                    <Bar dataKey="rate" fill="#334155" radius={[0, 4, 4, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Work authorization mix" subtitle="Latest completed extraction per scoped candidate.">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={workAuthPie} dataKey="count" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
                      {workAuthPie.map((_, i) => (
                        <Cell key={i} fill={SLATE[i % SLATE.length]} stroke="#fff" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: "11px", color: "#57534e" }} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e7e5e4", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Visa status mix" subtitle="Latest completed extraction per scoped candidate.">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={visaChart} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} horizontal={false} />
                    <XAxis type="number" tick={{ fill: AXIS, fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fill: AXIS, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e7e5e4", fontSize: "12px" }} />
                    <Bar dataKey="count" fill="#57534e" radius={[0, 4, 4, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Top missing fields" subtitle="From latest run meta on scoped candidates.">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={missingChart} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} horizontal={false} />
                    <XAxis type="number" tick={{ fill: AXIS, fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fill: AXIS, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e7e5e4", fontSize: "12px" }} />
                    <Bar dataKey="count" fill="#64748b" radius={[0, 4, 4, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Common skills (tokens)" subtitle="Comma-split from primary_skills on latest run.">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={skillsChart} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} horizontal={false} />
                    <XAxis type="number" tick={{ fill: AXIS, fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fill: AXIS, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e7e5e4", fontSize: "12px" }} />
                    <Bar dataKey="count" fill="#475569" radius={[0, 4, 4, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </section>

            {data && data.notice_period_distribution.length > 0 ? (
              <section className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                <h3 className="text-sm font-medium text-stone-900">Notice period distribution</h3>
                <p className="mt-0.5 text-xs text-stone-500">Top raw values from latest extraction.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.notice_period_distribution.slice(0, 9).map((n) => (
                    <div
                      key={n.name}
                      className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2 text-xs text-stone-800"
                    >
                      <span className="truncate pr-2" title={n.name}>
                        {n.name}
                      </span>
                      <span className="font-mono tabular-nums text-stone-600">{n.count}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
              <h3 className="text-sm font-medium text-stone-900">Recent candidate records</h3>
              <p className="mt-0.5 text-xs text-stone-500">Newest first · up to 25 rows in current scope.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                      <th className="py-2 pr-3">Updated</th>
                      <th className="py-2 pr-3">Title</th>
                      <th className="py-2 pr-3">Recruiter</th>
                      <th className="py-2 pr-3">Approval</th>
                      <th className="py-2 pr-3">Stage</th>
                      <th className="py-2 pr-3">Extraction</th>
                      <th className="py-2 pr-3">ATS</th>
                      <th className="py-2">Skills</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_candidates.map((r) => (
                      <tr key={r.id} className="border-b border-stone-100 text-stone-800 last:border-0">
                        <td className="py-2.5 pr-3 font-mono text-xs text-stone-600">
                          {new Date(r.updated_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="py-2.5 pr-3">
                          <Link href={`/review/${r.id}?organization_id=${encodeURIComponent(orgId)}`} className="font-medium text-stone-900 hover:underline">
                            {r.internal_title || "—"}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-stone-600">{r.recruiter_label ?? "—"}</td>
                        <td className="py-2.5 pr-3 text-xs">{r.approval_status}</td>
                        <td className="py-2.5 pr-3 text-xs">{r.processing_stage}</td>
                        <td className="py-2.5 pr-3 text-xs">{r.extraction_status}</td>
                        <td className="py-2.5 pr-3 text-xs">{r.ats_sync_status}</td>
                        <td className="max-w-[200px] truncate py-2.5 text-xs text-stone-600" title={r.primary_skills_snippet ?? ""}>
                          {r.primary_skills_snippet ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.recent_candidates.length === 0 ? <p className="mt-4 text-sm text-stone-500">No rows in this scope.</p> : null}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
