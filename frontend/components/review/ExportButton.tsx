"use client";

import { useState } from "react";

interface Props {
  candidateId: string;
}

export default function ExportButton({ candidateId }: Props) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/export`);
      if (!res.ok) {
        let detail = `Export failed (${res.status})`;
        try {
          const body = await res.json();
          detail = body.detail ?? detail;
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `candidate_${candidateId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleExport}
        disabled={exporting}
        className="rounded-lg bg-white border border-stone-300 text-stone-700 font-medium px-4 py-2 text-sm hover:bg-stone-50 transition-colors disabled:opacity-50"
      >
        {exporting ? "Exporting…" : "Export JSON"}
      </button>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
