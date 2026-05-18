"use client";

import { useEffect, useState } from "react";
import { getGeneralDashboard } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { HorizontalBar } from "@/components/dashboard/HorizontalBar";
import type { GeneralDashboardStats, GeneralFieldStats } from "@/lib/types";

// ---------------------------------------------------------------------------
// Layout helpers — same patterns as Recruiting Mode dashboard
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

// ---------------------------------------------------------------------------
// Field-type-to-widget mapping
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Per-field card
// ---------------------------------------------------------------------------

function FieldCard({ field }: { field: GeneralFieldStats }) {
  const kind      = widgetKind(field);
  const color     = TYPE_COLORS[field.inferred_type] ?? "bg-stone-400";
  const fillPct   = Math.round(field.fill_rate * 100);
  const confPct   = Math.round(field.avg_confidence * 100);

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 leading-snug">
          {prettyLabel(field.field_name)}
        </p>
        <span className={`shrink-0 inline-block text-2xs font-medium text-white px-1.5 py-0.5 rounded-xs ${color}`}>
          {field.inferred_type}
        </span>
      </div>

      {/* Fill rate + confidence chips */}
      <div className="flex items-center gap-3 text-2xs text-stone-400 dark:text-stone-500">
        <span>
          <span className="tabular-nums font-medium text-stone-600 dark:text-stone-300">{field.extracted_count}</span>
          /{field.total_sessions} sessions
        </span>
        {field.extracted_count > 0 && (
          <span>conf {confPct}%</span>
        )}
      </div>

      {/* Fill bar */}
      <FillBar rate={field.fill_rate} />

      {/* Widget */}
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GeneralDashboardPage() {
  const [stats,   setStats]   = useState<GeneralDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    getGeneralDashboard()
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

  const { sessions: s, fields } = stats;
  const fillRatePct = Math.round(stats.avg_fill_rate * 100);

  // Fields that have enough data to be worth showing (extracted in ≥1 session)
  const activeFields  = fields.filter((f) => f.extracted_count > 0);
  // Fields never extracted — group separately
  const emptyFields   = fields.filter((f) => f.extracted_count === 0);

  return (
    <main className="page space-y-10">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="section-label mb-1">General mode</p>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Dashboard
          </h1>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
            Updated {new Date(stats.generated_at).toLocaleString()}
          </p>
        </div>
      </div>

      {/* ── Session overview ───────────────────────────────────────────────── */}
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

      {/* ── Extraction quality ─────────────────────────────────────────────── */}
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
                <HorizontalBar
                  items={stats.top_missing_fields}
                  colorClass="bg-warning-DEFAULT"
                />
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

      {/* ── Confidence distribution ────────────────────────────────────────── */}
      {stats.confidence_distribution.length > 0 && (
        <section>
          <SectionLabel title="Confidence distribution" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card title="Sessions by confidence band">
              <HorizontalBar
                items={stats.confidence_distribution}
                colorClass="bg-aubergine-700"
              />
            </Card>
          </div>
        </section>
      )}

      {/* ── Per-field breakdown ────────────────────────────────────────────── */}
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

      {/* ── Never-extracted fields ─────────────────────────────────────────── */}
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

      {/* Empty state — no sessions yet */}
      {s.total === 0 && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-6 py-12 text-center">
          <p className="text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">
            No General Mode sessions yet
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Run a transcript through General Mode to see extraction analytics here.
          </p>
        </div>
      )}
    </main>
  );
}
