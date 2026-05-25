"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getDashboard, listCandidates } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { HorizontalBar } from "@/components/dashboard/HorizontalBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabBar } from "@/components/ui/TabBar";
import type { DashboardStats, CandidateListResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------

type Tab = "analytics" | "records";

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ title }: { title: string }) {
  return (
    <p className="section-label mb-3">{title}</p>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5">
      {title && (
        <p className="text-xs font-medium text-stone-400 dark:text-stone-500 mb-4">{title}</p>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analytics tab
// ---------------------------------------------------------------------------

function AnalyticsTab() {
  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setStats)
      .catch(() => setError("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-stone-400 py-12">
        <span className="w-4 h-4 rounded-full border-2 border-aubergine-400 border-t-transparent animate-spin inline-block" />
        Loading…
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-lg border border-negative-border bg-negative-light px-4 py-3 text-sm text-negative-text">
        {error ?? "No data available."}
      </div>
    );
  }

  const { candidates, extraction_completeness: ec, fit_score_stats: fs } = stats;

  return (
    <div className="space-y-8">
      <p className="text-xs text-stone-400 dark:text-stone-500">
        Updated {new Date(stats.generated_at).toLocaleString()}
      </p>

      {/* ── Candidate pipeline ─────────────────────────────────────────────── */}
      <section>
        <SectionLabel title="Candidate pipeline" />
        {candidates.total === 0 ? (
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-6 py-12 text-center">
            <p className="text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">No candidates yet</p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mb-6">
              Run your first interview transcript through the workflow to see pipeline analytics here.
            </p>
            <Link
              href="/workflow"
              className="inline-flex items-center gap-1.5 rounded bg-aubergine-800 text-white text-xs font-medium px-4 py-2 hover:bg-aubergine-900 transition-colors"
            >
              Open workflow builder →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Total"             value={candidates.total} accent />
            <StatCard label="Needs Review"      value={candidates.needs_review} />
            <StatCard label="Approved"          value={candidates.approved} />
            <StatCard label="Rejected"          value={candidates.rejected} />
            <StatCard label="Extraction done"   value={candidates.extraction_completed} />
          </div>
        )}
      </section>

      {/* ── Extraction quality ─────────────────────────────────────────────── */}
      <section>
        <SectionLabel title="Extraction quality" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
            <StatCard label="Avg confidence"   value={`${Math.round(ec.avg_confidence * 100)}%`} />
            <StatCard label="Fields extracted" value={ec.avg_extracted_count.toFixed(1)} />
            <StatCard label="Fields missing"   value={ec.avg_missing_count.toFixed(1)} />
          </div>
          {ec.top_missing_fields.length > 0 && (
            <div className="lg:col-span-2">
              <Card title="Top missing fields">
                <HorizontalBar items={ec.top_missing_fields} colorClass="bg-warning-DEFAULT" />
              </Card>
            </div>
          )}
        </div>
      </section>

      {/* ── Confidence distribution ────────────────────────────────────────── */}
      {stats.confidence_distribution.length > 0 && (
        <section>
          <SectionLabel title="Confidence distribution" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card title="Candidates by confidence band">
              <HorizontalBar items={stats.confidence_distribution} colorClass="bg-aubergine-700" />
            </Card>
          </div>
        </section>
      )}

      {/* ── JD fit analysis ────────────────────────────────────────────────── */}
      <section>
        <SectionLabel title="JD fit scoring" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Analyzed" value={fs.analyzed_count} />
          <StatCard
            label="Avg score"
            value={fs.analyzed_count > 0 ? `${fs.avg_score.toFixed(1)}/10` : "—"}
          />
          <Card title="By tier">
            <HorizontalBar items={fs.by_tier} colorClass="bg-aubergine-700" />
          </Card>
        </div>
      </section>

      {/* ── Distributions ──────────────────────────────────────────────────── */}
      <section>
        <SectionLabel title="Candidate distributions" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Card title="Experience">
            <HorizontalBar items={stats.experience_distribution}     colorClass="bg-aubergine-700" />
          </Card>
          <Card title="Work auth status">
            <HorizontalBar items={stats.work_auth_status_breakdown}  colorClass="bg-stone-400" />
          </Card>
          <Card title="Work auth type">
            <HorizontalBar items={stats.work_auth_type_breakdown}    colorClass="bg-stone-400" />
          </Card>
          <Card title="Remote preference">
            <HorizontalBar items={stats.remote_preference_breakdown} colorClass="bg-aubergine-400" />
          </Card>
          <Card title="Notice period">
            <HorizontalBar items={stats.notice_period_distribution}  colorClass="bg-warning-DEFAULT" />
          </Card>
          <Card title="Salary ask (min)">
            <HorizontalBar items={stats.salary_distribution}         colorClass="bg-aubergine-800" />
          </Card>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Records tab
// ---------------------------------------------------------------------------

const APPROVAL_BADGE: Record<string, string> = {
  needs_review: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  approved:     "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  rejected:     "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
};

function RecordsTab() {
  const [data, setData]       = useState<CandidateListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [page, setPage]       = useState(1);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    listCandidates({ page, limit })
      .then(setData)
      .catch(() => setError("Failed to load records."))
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-stone-400 py-12">
        <span className="w-4 h-4 rounded-full border-2 border-aubergine-400 border-t-transparent animate-spin inline-block" />
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-negative-border bg-negative-light px-4 py-3 text-sm text-negative-text">
        {error ?? "No data available."}
      </div>
    );
  }

  if (data.total === 0) {
    return (
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-6 py-12 text-center">
        <p className="text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">No candidates yet</p>
        <p className="text-xs text-stone-400 dark:text-stone-500 mb-6">
          Run your first interview transcript through the workflow.
        </p>
        <Link
          href="/workflow"
          className="inline-flex items-center gap-1.5 rounded bg-aubergine-800 text-white text-xs font-medium px-4 py-2 hover:bg-aubergine-900 transition-colors"
        >
          Open workflow builder →
        </Link>
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / limit);

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-400 dark:text-stone-500">
        {data.total} candidate{data.total !== 1 ? "s" : ""} total
      </p>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-stone-100 dark:border-stone-800">
              <th className="text-left px-4 py-3 font-medium text-stone-400 dark:text-stone-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-stone-400 dark:text-stone-500 hidden sm:table-cell">Job ref</th>
              <th className="text-left px-4 py-3 font-medium text-stone-400 dark:text-stone-500 hidden md:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-medium text-stone-400 dark:text-stone-500">Approval</th>
              <th className="text-left px-4 py-3 font-medium text-stone-400 dark:text-stone-500 hidden lg:table-cell">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data.items.map((c) => (
              <tr
                key={c.id}
                className="border-b last:border-0 border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-stone-700 dark:text-stone-300">
                  {c.full_name ?? <span className="text-stone-400 italic">Unnamed</span>}
                </td>
                <td className="px-4 py-3 text-stone-500 hidden sm:table-cell">
                  {c.job_reference ?? <span className="text-stone-300 dark:text-stone-600">—</span>}
                </td>
                <td className="px-4 py-3 text-stone-500 hidden md:table-cell">
                  {c.extraction_status ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-2xs font-medium ${APPROVAL_BADGE[c.approval_status] ?? "bg-stone-100 text-stone-500"}`}>
                    {c.approval_status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-stone-400 dark:text-stone-500 hidden lg:table-cell tabular-nums">
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/review/${c.id}`}
                    className="text-aubergine-700 dark:text-aubergine-400 hover:underline font-medium"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-xs text-stone-500 hover:text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="text-xs text-stone-400">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-xs text-stone-500 hover:text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TABS: { id: Tab; label: string }[] = [
  { id: "analytics", label: "Analytics" },
  { id: "records",   label: "Records" },
];

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const initialTab   = searchParams.get("tab") === "records" ? "records" : "analytics";
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <main className="page space-y-6">
      <PageHeader
        eyebrow="Recruiting mode"
        title="Dashboard"
      />

      <TabBar
        tabs={TABS}
        active={tab}
        onChange={setTab}
        className="mb-2"
      />

      {tab === "analytics" && <AnalyticsTab />}
      {tab === "records"   && <RecordsTab />}
    </main>
  );
}
