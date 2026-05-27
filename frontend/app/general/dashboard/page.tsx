"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getGeneralDashboard } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { HorizontalBar } from "@/components/dashboard/HorizontalBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { TabBar } from "@/components/ui/TabBar";
import type { GeneralDashboardStats, GeneralFieldStats } from "@/lib/types";
import DataExplorer from "@/components/general/DataExplorer";
import { useExtensionStatus } from "@/lib/useExtensionStatus";

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------

type Tab = "analytics" | "data";

// ---------------------------------------------------------------------------
// Analytics tab — original dashboard (unchanged)
// ---------------------------------------------------------------------------

function SectionLabel({ title }: { title: string }) {
  return <p className="section-label mb-3">{title}</p>;
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

function EmptyState({ message }: { message: string }) {
  return <p className="text-xs text-stone-400 dark:text-stone-500 py-2 italic">{message}</p>;
}

type WidgetKind = "bar" | "numeric" | "fill-only";

function widgetKind(field: GeneralFieldStats): WidgetKind {
  if (field.value_counts.length > 0) return "bar";
  if (field.numeric_avg !== null)     return "numeric";
  return "fill-only";
}

const TYPE_COLORS: Record<string, string> = {
  boolean: "bg-amber-400",
  list:    "bg-aubergine-700",
  date:    "bg-orange-400",
  text:    "bg-stone-400",
  number:  "bg-violet-500",
};

function prettyLabel(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function FillBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-aubergine-700" : pct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-stone-400 dark:text-stone-500 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

function FieldCard({ field }: { field: GeneralFieldStats }) {
  const kind    = widgetKind(field);
  const color   = TYPE_COLORS[field.inferred_type] ?? "bg-stone-400";
  const fillPct = Math.round(field.fill_rate * 100);
  const confPct = Math.round(field.avg_confidence * 100);

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 leading-snug">
          {prettyLabel(field.field_name)}
        </p>
        <span className={`shrink-0 inline-block text-2xs font-medium text-white px-1.5 py-0.5 rounded-xs ${color}`}>
          {field.inferred_type}
        </span>
      </div>

      <div className="flex items-center gap-3 text-2xs text-stone-400 dark:text-stone-500">
        <span>
          <span className="tabular-nums font-medium text-stone-600 dark:text-stone-300">{field.extracted_count}</span>
          /{field.total_sessions} sessions
        </span>
        {field.extracted_count > 0 && <span>conf {confPct}%</span>}
      </div>

      <FillBar rate={field.fill_rate} />

      {kind === "bar" && (
        <HorizontalBar items={field.value_counts} colorClass={color} />
      )}
      {kind === "numeric" && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { label: "Avg", val: field.numeric_avg },
            { label: "Min", val: field.numeric_min },
            { label: "Max", val: field.numeric_max },
          ].map(({ label, val }) => (
            <div key={label} className="text-center">
              <p className="text-2xs text-stone-400 dark:text-stone-500">{label}</p>
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-200 tabular-nums mt-0.5">
                {val !== null ? val : "—"}
              </p>
            </div>
          ))}
        </div>
      )}
      {kind === "fill-only" && fillPct === 0 && (
        <EmptyState message="No values extracted yet." />
      )}
    </div>
  );
}

function AnalyticsTab() {
  const [stats,   setStats]   = useState<GeneralDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    getGeneralDashboard()
      .then(setStats)
      .catch(() => setError("Failed to load analytics."))
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

  const { sessions: s, fields } = stats;
  const fillRatePct = Math.round(stats.avg_fill_rate * 100);
  const activeFields = fields.filter((f) => f.extracted_count > 0);
  const emptyFields  = fields.filter((f) => f.extracted_count === 0);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
            Updated {new Date(stats.generated_at).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Session overview */}
      <section>
        <SectionLabel title="Session overview" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total sessions"  value={s.total}       accent />
          <StatCard label="Needs review"    value={s.needs_review} />
          <StatCard label="Approved"        value={s.approved}    />
          <StatCard label="Rejected"        value={s.rejected}    />
          <StatCard
            label="Avg confidence"
            value={s.total > 0 ? `${Math.round(s.avg_confidence * 100)}%` : "—"}
          />
        </div>
      </section>

      {/* Extraction quality */}
      <section>
        <SectionLabel title="Extraction quality" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            <StatCard
              label="Avg fill rate"
              value={s.total > 0 ? `${fillRatePct}%` : "—"}
              sub="fields extracted per session"
            />
            <StatCard
              label="Fields tracked"
              value={fields.length}
              sub="unique field names seen"
            />
          </div>

          {stats.top_missing_fields.length > 0 && (
            <div className="lg:col-span-2">
              <Card title="Most missing fields">
                <HorizontalBar items={stats.top_missing_fields} colorClass="bg-warning-DEFAULT" />
              </Card>
            </div>
          )}

          {stats.top_missing_fields.length === 0 && s.total > 0 && (
            <div className="lg:col-span-2">
              <Card title="Most missing fields">
                <EmptyState message="All fields extracted in every session." />
              </Card>
            </div>
          )}
        </div>
      </section>

      {/* Confidence distribution */}
      {stats.confidence_distribution.length > 0 && (
        <section>
          <SectionLabel title="Confidence distribution" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card title="Sessions by confidence band">
              <HorizontalBar items={stats.confidence_distribution} colorClass="bg-aubergine-700" />
            </Card>
          </div>
        </section>
      )}

      {/* Per-field breakdown */}
      {activeFields.length > 0 && (
        <section>
          <SectionLabel title="Field breakdown" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeFields.map((f) => (
              <FieldCard key={f.field_name} field={f} />
            ))}
          </div>
        </section>
      )}

      {/* Never-extracted */}
      {emptyFields.length > 0 && (
        <section>
          <SectionLabel title="Never extracted" />
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {emptyFields.map((f) => (
                <span
                  key={f.field_name}
                  className="text-xs text-stone-400 dark:text-stone-500 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-2 py-0.5 rounded"
                >
                  {prettyLabel(f.field_name)}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {s.total === 0 && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-6 py-12 text-center">
          <p className="text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">
            No sessions yet
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500 mb-6">
            Run a transcript through General Mode to see extraction analytics here.
          </p>
          <Link
            href="/general"
            className="inline-flex items-center gap-1.5 rounded bg-aubergine-800 text-white text-xs font-medium px-4 py-2 hover:bg-aubergine-900 transition-colors"
          >
            Open workspace →
          </Link>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — tabs
// ---------------------------------------------------------------------------

const TABS: { id: Tab; label: string }[] = [
  { id: "analytics", label: "Analytics" },
  { id: "data",      label: "Data" },
];

function CaptureCTA() {
  const ext = useExtensionStatus();

  if (ext.installed && ext.recording) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
        <p className="text-xs font-medium text-red-700 dark:text-red-400">Recording in progress</p>
      </div>
    );
  }

  if (ext.installed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-aubergine-50 dark:bg-aubergine-950/20 border border-aubergine-200 dark:border-aubergine-900">
        <span className="w-1.5 h-1.5 rounded-full bg-aubergine-500 flex-shrink-0" />
        <p className="text-xs text-aubergine-700 dark:text-aubergine-400">
          Sorabase Capture ready — open extension to record a meeting
        </p>
      </div>
    );
  }

  return (
    <a
      href="https://chrome.google.com/webstore/detail/sorabase-capture/EXTENSION_ID"
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-aubergine-700 dark:text-aubergine-400 hover:text-aubergine-900 dark:hover:text-aubergine-300 transition-colors"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M9 11V7a3 3 0 116 0v4a3 3 0 11-6 0z"/>
      </svg>
      Install capture extension
    </a>
  );
}

export default function GeneralDashboardPage() {
  const searchParams = useSearchParams();
  const initialTab   = searchParams.get("tab") === "data" ? "data" : "analytics";
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <main className="page space-y-6">
      <PageHeader
        eyebrow="General mode"
        title="Dashboard"
        action={<CaptureCTA />}
      />

      <TabBar
        tabs={TABS}
        active={tab}
        onChange={setTab}
        className="mb-2"
      />

      {tab === "analytics" && <AnalyticsTab />}
      {tab === "data"      && <DataExplorer />}
    </main>
  );
}
