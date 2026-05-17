"use client";

import { useEffect, useMemo, useState } from "react";

import type { NarrativeGenerationDTO } from "./reviewTypes";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

type Props = {
  mode: "summary" | "submittal";
  versions: NarrativeGenerationDTO[];
  loading: boolean;
  error: string | null;
  generateBusy: boolean;
  onRegenerate: () => void | Promise<void>;
};

export function NarrativeWorkspace({ mode, versions, loading, error, generateBusy, onRegenerate }: Props) {
  const [pickVersion, setPickVersion] = useState<number | null>(null);

  useEffect(() => {
    setPickVersion(null);
  }, [versions]);

  const active = useMemo(() => {
    if (versions.length === 0) return null;
    if (pickVersion == null) return versions[0];
    return versions.find((x) => x.version === pickVersion) ?? versions[0];
  }, [versions, pickVersion]);

  const body = active ? (mode === "summary" ? active.recruiter_summary : active.submittal_draft) : "";

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-6 sm:px-6">
      <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
        <strong className="font-semibold">Auto-generated draft.</strong> Built only from{" "}
        <strong className="font-medium">approved</strong> structured fields and an optional verbatim transcript excerpt. It does{" "}
        <strong className="font-medium">not</strong> invent missing facts. The editable structured profile on the{" "}
        <em>Structured profile</em> tab remains the verification surface.
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={generateBusy}
          onClick={() => void onRegenerate()}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generateBusy ? "Generating…" : "Regenerate"}
        </button>
        {versions.length > 0 ? (
          <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
            <span className="text-zinc-500">Version</span>
            <select
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm"
              value={active?.version ?? ""}
              onChange={(e) => setPickVersion(Number(e.target.value))}
            >
              {versions.map((g) => (
                <option key={g.id} value={g.version}>
                  v{g.version} — {formatWhen(g.created_at)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {active ? (
          <span className="text-xs text-zinc-500">
            Generator: <span className="font-mono">{active.generator_provider}</span>
          </span>
        ) : null}
      </div>
      {loading ? <p className="text-sm text-zinc-500">Loading narratives…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && !error && versions.length === 0 ? (
        <p className="text-sm text-zinc-600">No generations yet. Click Regenerate to create version 1.</p>
      ) : null}
      {body ? (
        <pre className="max-h-[min(520px,60vh)] overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 font-sans text-sm leading-relaxed text-zinc-900 shadow-sm">
          {body}
        </pre>
      ) : null}
      {versions.length > 1 ? (
        <details className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-sm text-zinc-700">
          <summary className="cursor-pointer font-medium text-zinc-900">All versions ({versions.length})</summary>
          <ul className="mt-2 space-y-2 border-t border-zinc-200 pt-2">
            {versions.map((g) => (
              <li key={g.id} className="font-mono text-xs text-zinc-600">
                v{g.version} · {formatWhen(g.created_at)} · {g.id}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
