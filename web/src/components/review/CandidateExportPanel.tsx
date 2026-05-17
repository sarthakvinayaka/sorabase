"use client";

import { useCallback, useState } from "react";

import { publicApiBase } from "@/lib/apiBase";
import { DEV_DEFAULT_EDITOR_USER_ID } from "@/lib/devEditorUser";
import { apiErrorMessage } from "@/lib/parseApiError";

function editorUserId(): string {
  return process.env.NEXT_PUBLIC_DEV_EDITOR_USER_ID ?? DEV_DEFAULT_EDITOR_USER_ID;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type Props = {
  candidateId: string;
  organizationId: string;
  approvalStatus: string;
  disabled: boolean;
};

export function CandidateExportPanel({ candidateId, organizationId, approvalStatus, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const canExport = approvalStatus === "approved" || approvalStatus === "partially_approved";

  const baseQuery = useCallback(() => {
    const q = new URLSearchParams({
      organization_id: organizationId,
      requested_by_user_id: editorUserId(),
    });
    return q.toString();
  }, [organizationId]);

  const runPreview = useCallback(async () => {
    if (!canExport || !candidateId || !organizationId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const url = `${publicApiBase()}/v1/candidates/${encodeURIComponent(candidateId)}/export/preview?${baseQuery()}`;
      const res = await fetch(url, { cache: "no-store" });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, raw));
      }
      const parsed = JSON.parse(raw) as unknown;
      setPreviewText(JSON.stringify(parsed, null, 2));
      setPreviewOpen(true);
      setSuccess("Preview loaded.");
    } catch (e) {
      setPreviewText(null);
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }, [baseQuery, canExport, candidateId, organizationId]);

  const downloadJson = useCallback(async () => {
    if (!canExport || !candidateId || !organizationId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const url = `${publicApiBase()}/v1/candidates/${encodeURIComponent(candidateId)}/export.json?${baseQuery()}`;
      const res = await fetch(url, { cache: "no-store" });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, raw));
      }
      downloadBlob(`candidate-${candidateId}.json`, new Blob([raw], { type: "application/json;charset=utf-8" }));
      setSuccess("JSON export downloaded (job logged).");
    } catch (e) {
      setError(e instanceof Error ? e.message : "JSON export failed");
    } finally {
      setBusy(false);
    }
  }, [baseQuery, canExport, candidateId, organizationId]);

  const downloadCsv = useCallback(async () => {
    if (!canExport || !candidateId || !organizationId) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const url = `${publicApiBase()}/v1/candidates/${encodeURIComponent(candidateId)}/export.csv?${baseQuery()}`;
      const res = await fetch(url, { cache: "no-store" });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, raw));
      }
      downloadBlob(`candidate-${candidateId}.csv`, new Blob([raw], { type: "text/csv;charset=utf-8" }));
      setSuccess("CSV export downloaded (job logged).");
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV export failed");
    } finally {
      setBusy(false);
    }
  }, [baseQuery, canExport, candidateId, organizationId]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Export</h2>
          <p className="mt-0.5 text-sm text-zinc-600">
            JSON and CSV use the latest <strong className="font-medium text-zinc-800">completed</strong> extraction run and only{" "}
            <strong className="font-medium text-zinc-800">approved</strong> field values.
          </p>
        </div>
      </div>
      <div className="space-y-3 px-4 py-3">
        {!canExport ? (
          <p className="text-sm text-zinc-500">Approve the candidate record to enable exports.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void runPreview()}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Preview JSON
            </button>
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void downloadJson()}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download JSON
            </button>
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void downloadCsv()}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Download CSV
            </button>
          </div>
        )}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-800">{success}</p> : null}
        {previewOpen && previewText ? (
          <div>
            <button
              type="button"
              className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline"
              onClick={() => setPreviewOpen(false)}
            >
              Hide preview
            </button>
            <pre className="mt-2 max-h-[min(360px,45vh)] overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-900">
              {previewText}
            </pre>
          </div>
        ) : null}
      </div>
    </section>
  );
}
