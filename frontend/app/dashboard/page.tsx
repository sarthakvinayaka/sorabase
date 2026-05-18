"use client";

import { useEffect, useState } from "react";
import { getDashboard } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { HorizontalBar } from "@/components/dashboard/HorizontalBar";
import type { DashboardStats } from "@/lib/types";

// ---------------------------------------------------------------------------
// Sub-components
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
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setStats)
      .catch(() => setError("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="page">
        <div className="flex items-center gap-2 text-sm text-stone-400">
          <span className="w-4 h-4 rounded-full border-2 border-aubergine-400 border-t-transparent animate-spin inline-block" />
          Loading…
        </div>
      </main>
    );
  }

  if (error || !stats) {
    return (
      <main className="page">
        <div className="rounded-lg border border-negative-border bg-negative-light px-4 py-3 text-sm text-negative-text">
          {error ?? "No data available."}
        </div>
      </main>
    );
  }

  const { candidates, extraction_completeness: ec, fit_score_stats: fs } = stats;

  return (
    <main className="page space-y-10">

      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Dashboard
          </h1>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
            Updated {new Date(stats.generated_at).toLocaleString()}
          </p>
        </div>
      </div>

      {/* ── Candidate pipeline ─────────────────────────────────────────────── */}
      <section>
        <SectionLabel title="Candidate pipeline" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total" value={candidates.total} accent />
          <StatCard label="Needs Review"      value={candidates.needs_review} />
          <StatCard label="Approved"          value={candidates.approved} />
          <StatCard label="Rejected"          value={candidates.rejected} />
          <StatCard label="Extraction done"   value={candidates.extraction_completed} />
        </div>
      </section>

      {/* ── Extraction quality ─────────────────────────────────────────────── */}
      <section>
        <SectionLabel title="Extraction quality" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
            <StatCard label="Avg confidence"      value={`${Math.round(ec.avg_confidence * 100)}%`} />
            <StatCard label="Fields extracted"    value={ec.avg_extracted_count.toFixed(1)} />
            <StatCard label="Fields missing"      value={ec.avg_missing_count.toFixed(1)} />
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
    </main>
  );
}
