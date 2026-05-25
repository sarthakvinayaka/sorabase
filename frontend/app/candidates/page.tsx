"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getRecruitingTableData } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  FIELD_LABELS,
  FIELD_ORDER,
  displayValue,
  formatSalaryBound,
  type FieldCell,
  type FieldValue,
  type RecordRow,
  type RecordsTableResponse,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Column config — derived from FIELD_ORDER / FIELD_LABELS; all 35 fields live
// in the detail drawer. This is the curated visible-by-default ATS set.
// ---------------------------------------------------------------------------

const TABLE_COLS = [
  { key: "full_name",                 label: "Name",       width: "w-36" },
  { key: "current_title",             label: "Title",      width: "w-36" },
  { key: "current_company",           label: "Company",    width: "w-32" },
  { key: "years_experience_years",    label: "Exp",        width: "w-16" },
  { key: "work_authorization_status", label: "Work Auth",  width: "w-28" },
  { key: "remote_preference",         label: "Remote",     width: "w-24" },
  { key: "current_location",          label: "Location",   width: "w-28" },
  { key: "target_salary_min",         label: "Salary Min", width: "w-24" },
  { key: "notice_period_days",        label: "Notice",     width: "w-16" },
  { key: "primary_skills",            label: "Skills",     width: "w-40" },
] as const;

type ColKey = typeof TABLE_COLS[number]["key"];
type SortDir = "asc" | "desc";

const APPROVAL_OPTIONS = [
  { value: "",             label: "All statuses" },
  { value: "needs_review", label: "Needs review" },
  { value: "approved",     label: "Approved"     },
  { value: "rejected",     label: "Rejected"     },
];

const APPROVAL_BADGE: Record<string, string> = {
  needs_review: "bg-amber-100   text-amber-700   dark:bg-amber-950/30   dark:text-amber-400",
  approved:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  rejected:     "bg-red-100     text-red-700     dark:bg-red-950/30     dark:text-red-400",
};

const LIMIT = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCell(key: string, cell: FieldCell | undefined): string {
  if (!cell || cell.status === "missing") return "—";
  const v = cell.value as FieldValue;
  if (key === "target_salary_min" || key === "target_salary_max") return formatSalaryBound(v);
  if (key === "years_experience_years") return typeof v === "number" ? `${v} yr` : displayValue(v);
  if (key === "notice_period_days")     return typeof v === "number" ? `${v}d`   : displayValue(v);
  return displayValue(v);
}

function confColor(c: number) {
  if (c >= 0.85) return "text-emerald-600 dark:text-emerald-400";
  if (c >= 0.6)  return "text-amber-500  dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------

function DetailDrawer({ row, onClose }: { row: RecordRow; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const nameCell    = row.fields["full_name"];
  const displayName = nameCell ? displayValue(nameCell.value as FieldValue) : "Unknown";

  return (
    <>
      <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40" onClick={onClose} />
      <div
        ref={ref}
        className="fixed right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-700 z-50 flex flex-col shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-700 sticky top-0 bg-white dark:bg-stone-900 z-10 gap-3">
          <div className="min-w-0">
            <p className="text-2xs text-stone-400 dark:text-stone-500 mb-0.5">Candidate detail</p>
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">{displayName}</p>
            {row.summary && (
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed line-clamp-2">{row.summary}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-block px-2 py-0.5 rounded text-2xs font-medium capitalize ${APPROVAL_BADGE[row.approval_status] ?? "bg-stone-100 text-stone-500"}`}>
              {row.approval_status.replace(/_/g, " ")}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 p-1 rounded transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Meta strip */}
        <div className="px-6 py-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 flex-shrink-0">
          <div className="flex items-center gap-6 flex-wrap">
            <MetaKv label="Confidence" value={`${Math.round(row.confidence * 100)}%`}  colored={confColor(row.confidence)} />
            <MetaKv label="Fill rate"  value={`${Math.round(row.fill_rate * 100)}%`} />
            <MetaKv label="Source"     value={row.source_type ?? "—"} />
            <MetaKv label="Added"      value={new Date(row.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} />
          </div>
          {row.missing_fields.length > 0 && (
            <div className="mt-3">
              <p className="text-2xs text-stone-400 dark:text-stone-500 mb-1.5">Missing fields</p>
              <div className="flex flex-wrap gap-1">
                {row.missing_fields.map((f) => (
                  <span key={f} className="text-2xs bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 px-2 py-0.5 rounded">
                    {FIELD_LABELS[f] ?? f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Field list — ALL fields in FIELD_ORDER */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {FIELD_ORDER.map((key) => {
              const cell = row.fields[key];
              if (!cell || cell.status === "missing") return null;
              const val = displayValue(cell.value as FieldValue);
              if (val === "—") return null;
              return (
                <div key={key}>
                  <div className="flex items-start justify-between gap-3 mb-0.5">
                    <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 leading-snug">
                      {FIELD_LABELS[key] ?? key}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {cell.edited && (
                        <span className="text-2xs text-aubergine-600 dark:text-aubergine-400 font-medium">edited</span>
                      )}
                      <span className={`text-2xs tabular-nums font-medium ${confColor(cell.confidence)}`}>
                        {Math.round(cell.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">{val}</p>
                  {cell.evidence_snippet && (
                    <p className="text-2xs text-stone-400 dark:text-stone-500 mt-1.5 italic leading-relaxed border-l-2 border-stone-200 dark:border-stone-700 pl-2">
                      &ldquo;{cell.evidence_snippet}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 flex-shrink-0">
          <Link
            href={`/review/${row.record_id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-aubergine-700 dark:text-aubergine-400 hover:text-aubergine-900 dark:hover:text-aubergine-300 transition-colors"
          >
            Open full review →
          </Link>
        </div>
      </div>
    </>
  );
}

function MetaKv({ label, value, colored }: { label: string; value: string; colored?: string }) {
  return (
    <div>
      <p className="text-2xs text-stone-400 dark:text-stone-500">{label}</p>
      <p className={`text-xs font-medium ${colored ?? "text-stone-700 dark:text-stone-300"}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <tr key={i} className="border-b border-stone-100 dark:border-stone-800">
          {Array.from({ length: TABLE_COLS.length + 3 }).map((_, j) => (
            <td key={j} className="px-3 py-2.5">
              <div
                className="h-3 rounded bg-stone-100 dark:bg-stone-800 animate-pulse"
                style={{ width: `${45 + ((i * 3 + j * 7) % 40)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

function CandidateTable({
  data,
  loading,
  selectedId,
  onRowClick,
}: {
  data: RecordsTableResponse | null;
  loading: boolean;
  selectedId: string | null;
  onRowClick: (row: RecordRow) => void;
}) {
  const [sortCol, setSortCol] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  const rows = data?.records ?? [];

  const sorted = [...rows].sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    if (sortCol === "created_at")        { av = a.created_at;       bv = b.created_at; }
    else if (sortCol === "confidence")   { av = a.confidence;       bv = b.confidence; }
    else if (sortCol === "approval_status") { av = a.approval_status; bv = b.approval_status; }
    else {
      const ac = a.fields[sortCol];
      const bc = b.fields[sortCol];
      const av2 = ac?.value; const bv2 = bc?.value;
      if (typeof av2 === "number" && typeof bv2 === "number") { av = av2; bv = bv2; }
      else { av = displayValue(av2 as FieldValue); bv = displayValue(bv2 as FieldValue); }
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortArrow({ col }: { col: string }) {
    if (sortCol !== col) return <span className="opacity-25 ml-0.5">↕</span>;
    return <span className="text-aubergine-700 dark:text-aubergine-400 ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const thCls = "px-3 py-2.5 text-left text-2xs font-semibold text-stone-500 dark:text-stone-400 whitespace-nowrap cursor-pointer select-none hover:text-stone-800 dark:hover:text-stone-200 transition-colors";
  const tdCls = "px-3 py-2.5 text-xs text-stone-600 dark:text-stone-400 max-w-[180px] truncate";

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
      <table className="min-w-full border-collapse text-left">
        <thead className="bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-700">
          <tr>
            {TABLE_COLS.map(({ key, label }) => (
              <th key={key} className={thCls} onClick={() => toggleSort(key)}>
                {label}<SortArrow col={key} />
              </th>
            ))}
            <th className={thCls} onClick={() => toggleSort("approval_status")}>
              Status<SortArrow col="approval_status" />
            </th>
            <th className={thCls} onClick={() => toggleSort("confidence")}>
              Conf<SortArrow col="confidence" />
            </th>
            <th className={thCls} onClick={() => toggleSort("created_at")}>
              Added<SortArrow col="created_at" />
            </th>
            <th className="px-3 py-2.5 w-16" />
          </tr>
        </thead>
        <tbody>
          {loading && <SkeletonRows />}

          {!loading && sorted.length === 0 && (
            <tr>
              <td colSpan={TABLE_COLS.length + 4} className="px-6 py-20 text-center">
                <p className="text-sm font-medium text-stone-500 dark:text-stone-400 mb-1.5">No candidates found</p>
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  Try adjusting the filter or run a screening through the workflow.
                </p>
              </td>
            </tr>
          )}

          {!loading && sorted.map((row) => {
            const isSelected = row.record_id === selectedId;
            return (
              <tr
                key={row.record_id}
                onClick={() => onRowClick(row)}
                className={[
                  "border-b border-stone-100 dark:border-stone-800 last:border-0 cursor-pointer transition-colors",
                  isSelected
                    ? "bg-aubergine-50 dark:bg-aubergine-900/20"
                    : "hover:bg-stone-50 dark:hover:bg-stone-800/50",
                ].join(" ")}
              >
                {TABLE_COLS.map(({ key }) => {
                  const cell   = row.fields[key as ColKey];
                  const val    = renderCell(key, cell);
                  const isMiss = !cell || cell.status === "missing";
                  return (
                    <td key={key} className={tdCls} title={isMiss ? undefined : val}>
                      {key === "full_name" ? (
                        <span className="font-medium text-stone-800 dark:text-stone-200">{val}</span>
                      ) : isMiss ? (
                        <span className="text-stone-300 dark:text-stone-600">—</span>
                      ) : (
                        val
                      )}
                    </td>
                  );
                })}

                {/* Status badge */}
                <td className="px-3 py-2.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-2xs font-medium capitalize ${APPROVAL_BADGE[row.approval_status] ?? "bg-stone-100 text-stone-500"}`}>
                    {row.approval_status.replace(/_/g, " ")}
                  </span>
                </td>

                {/* Confidence */}
                <td className="px-3 py-2.5">
                  <span className={`text-xs font-medium tabular-nums ${confColor(row.confidence)}`}>
                    {Math.round(row.confidence * 100)}%
                  </span>
                </td>

                {/* Date */}
                <td className="px-3 py-2.5 text-xs text-stone-400 dark:text-stone-500 whitespace-nowrap">
                  {new Date(row.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </td>

                {/* Review link */}
                <td className="px-3 py-2.5 text-right">
                  <Link
                    href={`/review/${row.record_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-2xs font-medium text-aubergine-700 dark:text-aubergine-400 hover:text-aubergine-900 dark:hover:text-aubergine-300 transition-colors whitespace-nowrap"
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CandidatesPage() {
  const [data,         setData]        = useState<RecordsTableResponse | null>(null);
  const [loading,      setLoading]     = useState(true);
  const [error,        setError]       = useState<string | null>(null);
  const [page,         setPage]        = useState(1);
  const [search,       setSearch]      = useState("");
  const [debouncedQ,   setDebouncedQ]  = useState("");
  const [statusFilter, setStatusFilter]= useState("");
  const [selectedRow,  setSelectedRow] = useState<RecordRow | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onSearchChange(v: string) {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedQ(v);
      setPage(1);
    }, 300);
  }

  function onStatusChange(v: string) {
    setStatusFilter(v);
    setPage(1);
  }

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    getRecruitingTableData({
      page,
      limit:           LIMIT,
      search:          debouncedQ || undefined,
      approval_status: statusFilter || undefined,
    })
      .then(setData)
      .catch(() => setError("Failed to load candidates."))
      .finally(() => setLoading(false));
  }, [page, debouncedQ, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);
  const pageRows   = data?.records ?? [];

  // Summary counts from current page data
  const needsReview = pageRows.filter((r) => r.approval_status === "needs_review").length;
  const approved    = pageRows.filter((r) => r.approval_status === "approved").length;
  const rejected    = pageRows.filter((r) => r.approval_status === "rejected").length;
  const avgConf     = pageRows.length > 0
    ? Math.round((pageRows.reduce((s, r) => s + r.confidence, 0) / pageRows.length) * 100)
    : 0;

  return (
    <main className="page space-y-6">

      <PageHeader
        eyebrow="Recruiting"
        title="Candidates"
        sub={loading ? "…" : `${total.toLocaleString()} candidate${total !== 1 ? "s" : ""}`}
        action={
          <Link href="/workflow" className="btn-primary text-xs">
            + New screening
          </Link>
        }
      />

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total"          value={total}      accent />
        <StatCard label="Needs review"   value={statusFilter ? needsReview : "—"} />
        <StatCard label="Approved"       value={statusFilter ? approved    : "—"} />
        <StatCard label="Rejected"       value={statusFilter ? rejected    : "—"} />
        <StatCard label="Avg confidence" value={pageRows.length > 0 ? `${avgConf}%` : "—"} />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-56">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
            width="13" height="13" viewBox="0 0 16 16" fill="none"
          >
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md text-stone-700 dark:text-stone-300 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-aubergine-600"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md px-3 py-2 text-stone-600 dark:text-stone-400 focus:outline-none focus:ring-1 focus:ring-aubergine-600"
        >
          {APPROVAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <p className="text-2xs text-stone-400 dark:text-stone-500 ml-auto tabular-nums">
          {loading ? "Loading…" : `${total} candidate${total !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-negative-border bg-negative-light px-4 py-3 text-sm text-negative-text">
          {error}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <CandidateTable
        data={data}
        loading={loading}
        selectedId={selectedRow?.record_id ?? null}
        onRowClick={(row) =>
          setSelectedRow((prev) => prev?.record_id === row.record_id ? null : row)
        }
      />

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Previous
          </button>
          <span className="text-xs text-stone-400 dark:text-stone-500 tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Detail drawer ───────────────────────────────────────────────────── */}
      {selectedRow && (
        <DetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </main>
  );
}
