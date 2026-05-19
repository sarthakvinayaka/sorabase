"use client";

import { useEffect, useRef, useState } from "react";
import { listGeneralSchemas, getSchemaRecords } from "@/lib/api";
import type { FieldCell, RecordRow, RecordsTableResponse, SchemaInfo } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function displayCell(cell: FieldCell | undefined): string {
  if (!cell) return "—";
  const v = cell.value;
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function confidenceColor(c: number) {
  if (c >= 0.85) return "text-emerald-600 dark:text-emerald-400";
  if (c >= 0.60) return "text-amber-500 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    approved:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    needs_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    rejected:     "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  const cls = map[status] ?? "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400";
  const label = status.replace(/_/g, " ");
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-2xs font-medium capitalize ${cls}`}>
      {label}
    </span>
  );
}

function prettyFieldName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Schema card
// ---------------------------------------------------------------------------

function SchemaCard({
  schema,
  selected,
  onClick,
}: {
  schema: SchemaInfo;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left rounded-lg border px-4 py-4 transition-all",
        selected
          ? "border-aubergine-700 bg-aubergine-50 dark:bg-aubergine-900/20 ring-1 ring-aubergine-700"
          : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-600",
      ].join(" ")}
    >
      <p className={`text-sm font-semibold leading-snug mb-2 ${selected ? "text-aubergine-800 dark:text-aubergine-300" : "text-stone-800 dark:text-stone-100"}`}>
        {schema.name === "general" ? "Ad-hoc Sessions" : schema.name}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <Kv label="Records" value={String(schema.record_count)} />
        <Kv label="Fields"  value={String(schema.field_names.length)} />
        <Kv label="Avg conf" value={pct(schema.avg_confidence)} />
        <Kv label="Fill rate" value={pct(schema.avg_fill_rate)} />
      </div>
      <p className="text-2xs text-stone-400 dark:text-stone-500 mt-3">
        Updated {fmtDate(schema.last_updated)}
      </p>
    </button>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs text-stone-400 dark:text-stone-500">{label}</p>
      <p className="text-xs font-medium text-stone-700 dark:text-stone-300 tabular-nums">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row detail panel
// ---------------------------------------------------------------------------

function DetailPanel({
  row,
  fieldNames,
  onClose,
}: {
  row: RecordRow;
  fieldNames: string[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
        onClick={onClose}
      />
      {/* panel */}
      <div
        ref={ref}
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-700 z-50 overflow-y-auto shadow-xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-700 sticky top-0 bg-white dark:bg-stone-900 z-10">
          <div>
            <p className="text-xs text-stone-400 dark:text-stone-500 mb-0.5">Record detail</p>
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 font-mono">
              {row.record_id.slice(0, 8)}…
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 p-1 rounded"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Meta */}
        <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800">
          <div className="grid grid-cols-2 gap-4">
            <MetaItem label="Date"       value={fmtDate(row.created_at)} />
            <MetaItem label="Status"     value={row.approval_status.replace(/_/g, " ")} />
            <MetaItem label="Confidence" value={pct(row.confidence)} />
            <MetaItem label="Fill rate"  value={pct(row.fill_rate)} />
            {row.source_type && (
              <MetaItem label="Source" value={row.source_type} />
            )}
          </div>
          {row.summary && (
            <div className="mt-4">
              <p className="text-2xs text-stone-400 dark:text-stone-500 mb-1">Summary</p>
              <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{row.summary}</p>
            </div>
          )}
          {row.missing_fields.length > 0 && (
            <div className="mt-3">
              <p className="text-2xs text-stone-400 dark:text-stone-500 mb-1.5">Missing fields</p>
              <div className="flex flex-wrap gap-1.5">
                {row.missing_fields.map((f) => (
                  <span key={f} className="text-2xs bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 px-2 py-0.5 rounded">
                    {prettyFieldName(f)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="px-6 py-4 flex-1">
          <p className="text-xs font-medium text-stone-400 dark:text-stone-500 mb-4">Extracted fields</p>
          <div className="space-y-4">
            {fieldNames.map((name) => {
              const cell = row.fields[name];
              if (!cell) return null;
              const val = displayCell(cell);
              if (val === "—") return null;
              return (
                <div key={name}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                      {prettyFieldName(name)}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {cell.edited && (
                        <span className="text-2xs text-aubergine-600 dark:text-aubergine-400 font-medium">edited</span>
                      )}
                      <span className={`text-2xs tabular-nums font-medium ${confidenceColor(cell.confidence)}`}>
                        {pct(cell.confidence)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5 leading-relaxed">{val}</p>
                  {cell.evidence_snippet && (
                    <p className="text-2xs text-stone-400 dark:text-stone-500 mt-1 italic leading-relaxed border-l-2 border-stone-200 dark:border-stone-700 pl-2">
                      &ldquo;{cell.evidence_snippet}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs text-stone-400 dark:text-stone-500">{label}</p>
      <p className="text-xs font-medium text-stone-700 dark:text-stone-300 capitalize">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Records table
// ---------------------------------------------------------------------------

type SortDir = "asc" | "desc";

function RecordsTable({
  data,
  onRowClick,
}: {
  data: RecordsTableResponse;
  onRowClick: (row: RecordRow) => void;
}) {
  const [search, setSearch]       = useState("");
  const [sortCol, setSortCol]     = useState<string>("created_at");
  const [sortDir, setSortDir]     = useState<SortDir>("desc");
  const [statusFilter, setStatus] = useState<string>("");

  const META_COLS = ["created_at", "approval_status", "confidence", "fill_rate"] as const;
  const dynamicCols = data.field_names;

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const filtered = data.records
    .filter((r) => {
      if (statusFilter && r.approval_status !== statusFilter) return false;
      if (!search) return true;
      const hay = [
        r.record_id,
        r.approval_status,
        r.summary ?? "",
        ...Object.values(r.fields).map((c) => displayCell(c)),
      ].join(" ").toLowerCase();
      return hay.includes(search.toLowerCase());
    })
    .sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortCol === "created_at") {
        av = a.created_at; bv = b.created_at;
      } else if (sortCol === "confidence") {
        av = a.confidence; bv = b.confidence;
      } else if (sortCol === "fill_rate") {
        av = a.fill_rate; bv = b.fill_rate;
      } else if (sortCol === "approval_status") {
        av = a.approval_status; bv = b.approval_status;
      } else {
        av = displayCell(a.fields[sortCol]);
        bv = displayCell(b.fields[sortCol]);
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <span className="opacity-30">↕</span>;
    return <span className="text-aubergine-700">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const thCls = "px-3 py-2.5 text-left text-2xs font-semibold text-stone-500 dark:text-stone-400 whitespace-nowrap cursor-pointer select-none hover:text-stone-700 dark:hover:text-stone-300";
  const tdCls = "px-3 py-2.5 text-xs text-stone-600 dark:text-stone-400 whitespace-nowrap";

  const statuses = Array.from(new Set(data.records.map((r) => r.approval_status)));

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search records…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md text-stone-700 dark:text-stone-300 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-aubergine-600"
          />
        </div>

        {statuses.length > 1 && (
          <select
            value={statusFilter}
            onChange={(e) => setStatus(e.target.value)}
            className="text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md px-2.5 py-2 text-stone-600 dark:text-stone-400 focus:outline-none focus:ring-1 focus:ring-aubergine-600"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        )}

        <p className="text-2xs text-stone-400 dark:text-stone-500 ml-auto">
          {filtered.length} of {data.records.length} records
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-700">
        <table className="min-w-full border-collapse">
          <thead className="bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-700">
            <tr>
              <th className={`${thCls} sticky left-0 bg-stone-50 dark:bg-stone-800/80 z-10 min-w-28`} onClick={() => handleSort("created_at")}>
                Date <SortIcon col="created_at" />
              </th>
              <th className={thCls} onClick={() => handleSort("approval_status")}>
                Status <SortIcon col="approval_status" />
              </th>
              <th className={thCls} onClick={() => handleSort("confidence")}>
                Confidence <SortIcon col="confidence" />
              </th>
              <th className={thCls} onClick={() => handleSort("fill_rate")}>
                Fill rate <SortIcon col="fill_rate" />
              </th>
              {dynamicCols.map((col) => (
                <th key={col} className={thCls} onClick={() => handleSort(col)}>
                  {prettyFieldName(col)} <SortIcon col={col} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4 + dynamicCols.length} className="px-4 py-10 text-center text-xs text-stone-400 dark:text-stone-500 italic">
                  No records match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.record_id}
                  onClick={() => onRowClick(row)}
                  className="cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                >
                  <td className={`${tdCls} sticky left-0 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800/50 font-medium text-stone-700 dark:text-stone-300`}>
                    {fmtDateShort(row.created_at)}
                  </td>
                  <td className={tdCls}>{statusBadge(row.approval_status)}</td>
                  <td className={`${tdCls} ${confidenceColor(row.confidence)} font-medium tabular-nums`}>
                    {pct(row.confidence)}
                  </td>
                  <td className={`${tdCls} tabular-nums`}>{pct(row.fill_rate)}</td>
                  {dynamicCols.map((col) => (
                    <td key={col} className={`${tdCls} max-w-48 truncate`}>
                      {displayCell(row.fields[col])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.total > data.records.length && (
        <p className="text-2xs text-stone-400 dark:text-stone-500 text-center">
          Showing {data.records.length} of {data.total} records.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DataExplorer
// ---------------------------------------------------------------------------

type ExplorerState = "loading" | "error" | "empty" | "ready";

export default function DataExplorer() {
  const [schemas,        setSchemas]        = useState<SchemaInfo[]>([]);
  const [state,          setState]          = useState<ExplorerState>("loading");
  const [selectedSchema, setSelectedSchema] = useState<SchemaInfo | null>(null);
  const [tableData,      setTableData]      = useState<RecordsTableResponse | null>(null);
  const [tableLoading,   setTableLoading]   = useState(false);
  const [tableError,     setTableError]     = useState<string | null>(null);
  const [detailRow,      setDetailRow]      = useState<RecordRow | null>(null);

  useEffect(() => {
    listGeneralSchemas()
      .then((res) => {
        setSchemas(res.schemas);
        setState(res.schemas.length === 0 ? "empty" : "ready");
        if (res.schemas.length > 0) setSelectedSchema(res.schemas[0]);
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    if (!selectedSchema) return;
    setTableLoading(true);
    setTableError(null);
    setTableData(null);
    getSchemaRecords(selectedSchema.schema_id, { limit: 100 })
      .then(setTableData)
      .catch(() => setTableError("Failed to load records."))
      .finally(() => setTableLoading(false));
  }, [selectedSchema]);

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-stone-400 py-12">
        <span className="w-4 h-4 rounded-full border-2 border-aubergine-400 border-t-transparent animate-spin inline-block" />
        Loading data…
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-lg border border-negative-border bg-negative-light px-4 py-3 text-sm text-negative-text">
        Failed to load schemas.
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-6 py-14 text-center">
        <p className="text-sm font-medium text-stone-600 dark:text-stone-300 mb-1">No extracted data yet</p>
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Run a session through General Mode to see structured records here.
        </p>
      </div>
    );
  }

  return (
    <>
      {detailRow && selectedSchema && tableData && (
        <DetailPanel
          row={detailRow}
          fieldNames={tableData.field_names}
          onClose={() => setDetailRow(null)}
        />
      )}

      <div className="flex gap-5 items-start">
        {/* Schema sidebar */}
        <div className="w-56 shrink-0 flex flex-col gap-2">
          <p className="text-2xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider px-0.5 mb-1">
            Schemas
          </p>
          {schemas.map((s) => (
            <SchemaCard
              key={s.schema_id}
              schema={s}
              selected={selectedSchema?.schema_id === s.schema_id}
              onClick={() => setSelectedSchema(s)}
            />
          ))}
        </div>

        {/* Records area */}
        <div className="flex-1 min-w-0">
          {/* Schema header */}
          {selectedSchema && (
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100">
                  {selectedSchema.name === "general" ? "Ad-hoc Sessions" : selectedSchema.name}
                </h2>
                <p className="text-2xs text-stone-400 dark:text-stone-500 mt-0.5">
                  {selectedSchema.record_count} record{selectedSchema.record_count !== 1 ? "s" : ""} · {selectedSchema.field_names.length} fields
                </p>
              </div>
            </div>
          )}

          {tableLoading && (
            <div className="flex items-center gap-2 text-sm text-stone-400 py-10">
              <span className="w-4 h-4 rounded-full border-2 border-aubergine-400 border-t-transparent animate-spin inline-block" />
              Loading records…
            </div>
          )}

          {tableError && (
            <div className="rounded-lg border border-negative-border bg-negative-light px-4 py-3 text-sm text-negative-text">
              {tableError}
            </div>
          )}

          {tableData && !tableLoading && (
            <RecordsTable data={tableData} onRowClick={setDetailRow} />
          )}
        </div>
      </div>
    </>
  );
}
