"use client";

import { useCallback, useEffect, useState } from "react";

import { publicApiBase } from "@/lib/apiBase";
import { apiErrorMessage } from "@/lib/parseApiError";

type Props = {
  candidateId: string;
  organizationId: string;
  enabled: boolean;
};

export function JsonProfileTab({ candidateId, organizationId, enabled }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !candidateId || !organizationId) {
      setText(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = `organization_id=${encodeURIComponent(organizationId)}`;
      const res = await fetch(`${publicApiBase()}/v1/candidates/${encodeURIComponent(candidateId)}/export/preview?${q}`, {
        cache: "no-store",
      });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, raw));
      }
      const parsed = JSON.parse(raw) as unknown;
      setText(JSON.stringify(parsed, null, 2));
    } catch (e) {
      setText(null);
      setError(e instanceof Error ? e.message : "Failed to load JSON");
    } finally {
      setLoading(false);
    }
  }, [candidateId, enabled, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-3 px-4 py-6 sm:px-6">
      {!enabled ? (
        <p className="text-sm text-zinc-500">Approve this candidate record to preview the deterministic approved JSON export.</p>
      ) : null}
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        <strong className="font-semibold">Approved structured export.</strong> This JSON is read-only here and matches the deterministic{" "}
        <code className="rounded bg-amber-100/80 px-1">export.json</code> download (latest completed run, approved field values only). It is not the
        same as auto-generated narrative text on other tabs.
      </div>
      {loading ? <p className="text-sm text-zinc-500">Loading…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {text ? (
        <pre className="max-h-[min(560px,65vh)] overflow-auto rounded-lg border border-zinc-200 bg-white p-4 font-mono text-xs leading-relaxed text-zinc-900 shadow-sm">
          {text}
        </pre>
      ) : null}
      <button
        type="button"
        onClick={() => void load()}
        className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
      >
        Refresh JSON
      </button>
    </div>
  );
}
