"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { listCandidates, ApiError } from "@/lib/api";
import type { ApprovalStatus, CandidateListItem } from "@/lib/types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  needs_review: { label: "Needs review", dot: "bg-warning-DEFAULT",  text: "text-warning-text"  },
  approved:     { label: "Approved",      dot: "bg-positive-DEFAULT", text: "text-positive-text" },
  rejected:     { label: "Rejected",      dot: "bg-negative-DEFAULT", text: "text-negative-text" },
};

const FILTER_OPTIONS: Array<{ label: string; value: ApprovalStatus | "" }> = [
  { label: "All",          value: ""             },
  { label: "Needs review", value: "needs_review" },
  { label: "Approved",     value: "approved"     },
  { label: "Rejected",     value: "rejected"     },
];

const PAGE_LIMIT = 20;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CandidatesPage() {
  const [items, setItems]   = useState<CandidateListItem[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [filter, setFilter] = useState<ApprovalStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCandidates({ page, limit: PAGE_LIMIT, approval_status: filter || undefined });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to load candidates.");
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { fetch(); }, [fetch]);

  function setFilterAndReset(v: ApprovalStatus | "") {
    setFilter(v);
    setPage(1);
  }

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <main className="page space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Candidate queue
          </h1>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
            {loading ? "…" : `${total.toLocaleString()} candidate${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href="/workflow" className="btn-primary text-xs">
          + New screening
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilterAndReset(value)}
            className={[
              "px-3 py-1.5 text-xs font-medium rounded border transition-colors",
              filter === value
                ? "bg-aubergine-800 text-white border-aubergine-800"
                : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-negative-border bg-negative-light px-4 py-3 text-sm text-negative-text">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-2 text-sm text-stone-400">
          <span className="w-4 h-4 rounded-full border-2 border-aubergine-400 border-t-transparent animate-spin" />
          Loading…
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-stone-300 dark:text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-stone-500 dark:text-stone-400">No candidates found</p>
          {filter ? (
            <button onClick={() => setFilterAndReset("")} className="text-xs text-aubergine-800 dark:text-aubergine-400 hover:underline">
              Clear filter
            </button>
          ) : (
            <Link href="/workflow" className="text-xs text-aubergine-800 dark:text-aubergine-400 hover:underline">
              Start a new screening →
            </Link>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && !error && items.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden shadow-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-100 dark:border-stone-800">
                <th className="py-3 pl-6 pr-4 section-label font-semibold">Candidate</th>
                <th className="py-3 pr-4 section-label font-semibold">Job ref</th>
                <th className="py-3 pr-4 section-label font-semibold w-28">Status</th>
                <th className="py-3 pr-4 section-label font-semibold w-28">Added</th>
                <th className="py-3 pr-6 w-20" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const sc = STATUS_CONFIG[item.approval_status] ?? STATUS_CONFIG.needs_review;
                return (
                  <tr
                    key={item.id}
                    className={[
                      "border-b border-stone-100 dark:border-stone-800 last:border-0",
                      "hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors",
                    ].join(" ")}
                  >
                    <td className="py-3.5 pl-6 pr-4">
                      <p className="text-sm font-medium text-stone-900 dark:text-stone-100 leading-snug">
                        {item.full_name ?? (
                          <span className="text-stone-400 dark:text-stone-500 font-normal italic">Unknown</span>
                        )}
                      </p>
                      {item.candidate_summary && (
                        <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5 line-clamp-1">
                          {item.candidate_summary}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="text-sm text-stone-500 dark:text-stone-400">
                        {item.job_reference ?? <span className="text-stone-300 dark:text-stone-600">—</span>}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                        <span className={`text-xs font-medium ${sc.text}`}>{sc.label}</span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="text-xs text-stone-400 dark:text-stone-500 tabular-nums">
                        {new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </td>
                    <td className="py-3.5 pr-6 text-right">
                      <Link
                        href={`/review/${item.id}`}
                        className="text-xs font-medium text-aubergine-800 dark:text-aubergine-400 hover:text-aubergine-900 dark:hover:text-aubergine-300 transition-colors"
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
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-stone-400 dark:text-stone-500 tabular-nums">
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
