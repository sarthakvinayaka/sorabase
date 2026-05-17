"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { publicApiBase } from "@/lib/apiBase";
import { apiErrorMessage, isUuid } from "@/lib/parseApiError";

type TranscriptJobDTO = {
  id: string;
  status: string;
  error_message: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type LatestExtractionRunDTO = {
  id: string;
  run_index: number;
  status: string;
  provider_model: string | null;
  error_message: string | null;
  missing_fields: string[];
  ambiguous_fields: string[];
  created_at: string;
  completed_at: string | null;
};

type UploadPipelineDTO = {
  candidate_id: string;
  processing_stage: string;
  extraction_status: string;
  approval_status: string;
  ats_sync_status: string;
  confidence_overall: number | null;
  latest_extraction_run: LatestExtractionRunDTO | null;
};

type AudioUploadDTO = {
  id: string;
  organization_id: string;
  recruiter_id: string | null;
  storage_key: string;
  original_filename: string | null;
  content_type: string | null;
  byte_size: number | null;
  status: string;
  job_reference: string | null;
  upload_notes: string | null;
  checksum_sha256: string | null;
  created_at: string;
  updated_at: string;
  transcript_job: TranscriptJobDTO | null;
  candidate_pipeline?: UploadPipelineDTO | null;
};

type TranscriptSegmentDTO = {
  id: string;
  sequence_index: number;
  start_ms: number;
  end_ms: number;
  speaker_label: string | null;
  text: string;
};

type TranscriptDetailDTO = {
  id: string;
  audio_upload_id: string;
  version: number;
  language: string | null;
  provider: string | null;
  status: string;
  full_text: string;
  segments: TranscriptSegmentDTO[];
  created_at: string;
  updated_at: string;
};

function formatClock(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function UploadDetailWorkspace() {
  const params = useParams();
  const searchParams = useSearchParams();
  const uploadId = typeof params.uploadId === "string" ? params.uploadId : "";

  const defaultOrg = process.env.NEXT_PUBLIC_DEV_ORG_ID ?? "";
  const orgFromQuery = searchParams.get("organization_id") ?? "";
  const [orgId, setOrgId] = useState(orgFromQuery || defaultOrg);

  useEffect(() => {
    if (orgFromQuery) setOrgId(orgFromQuery);
  }, [orgFromQuery]);

  const [upload, setUpload] = useState<AudioUploadDTO | null>(null);
  const [transcript, setTranscript] = useState<TranscriptDetailDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [transcribePhase, setTranscribePhase] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [transcribeMessage, setTranscribeMessage] = useState<string | null>(null);
  const [extractPhase, setExtractPhase] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [extractMessage, setExtractMessage] = useState<string | null>(null);

  const canQuery = useMemo(() => Boolean(uploadId && orgId), [uploadId, orgId]);

  const loadAll = useCallback(async () => {
    if (!canQuery) {
      setLoadError("Missing upload id or organization id.");
      setUpload(null);
      setTranscript(null);
      setPageLoading(false);
      return;
    }
    if (!isUuid(orgId.trim())) {
      setLoadError("Organization ID must be a valid UUID.");
      setUpload(null);
      setTranscript(null);
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    setLoadError(null);
    const q = `organization_id=${encodeURIComponent(orgId)}`;
    try {
      const uRes = await fetch(`${publicApiBase()}/v1/audio/uploads/${encodeURIComponent(uploadId)}?${q}`, {
        cache: "no-store",
      });
      if (!uRes.ok) {
        const raw = await uRes.text();
        throw new Error(apiErrorMessage(uRes.status, raw));
      }
      const uJson = (await uRes.json()) as AudioUploadDTO;
      setUpload(uJson);

      const tRes = await fetch(`${publicApiBase()}/v1/audio/uploads/${encodeURIComponent(uploadId)}/transcript?${q}`, {
        cache: "no-store",
      });
      if (tRes.status === 404) {
        setTranscript(null);
      } else {
        if (!tRes.ok) {
          const raw = await tRes.text();
          throw new Error(apiErrorMessage(tRes.status, raw));
        }
        setTranscript((await tRes.json()) as TranscriptDetailDTO);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setUpload(null);
      setTranscript(null);
    } finally {
      setPageLoading(false);
    }
  }, [canQuery, orgId, uploadId]);

  const runExtract = useCallback(async () => {
    if (!canQuery) return;
    setExtractPhase("running");
    setExtractMessage(null);
    const q = `organization_id=${encodeURIComponent(orgId)}`;
    try {
      const res = await fetch(`${publicApiBase()}/v1/audio/uploads/${encodeURIComponent(uploadId)}/extract?${q}`, {
        method: "POST",
      });
      if (!res.ok) {
        const raw = await res.text();
        throw new Error(apiErrorMessage(res.status, raw));
      }
      setExtractPhase("ok");
      setExtractMessage("Extraction completed. Prior runs are preserved; latest fields are marked current.");
      await loadAll();
    } catch (e) {
      setExtractPhase("error");
      setExtractMessage(e instanceof Error ? e.message : "Extraction failed");
      await loadAll();
    }
  }, [canQuery, loadAll, orgId, uploadId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const runTranscribe = useCallback(async () => {
    if (!canQuery) return;
    setTranscribePhase("running");
    setTranscribeMessage(null);
    const q = `organization_id=${encodeURIComponent(orgId)}`;
    try {
      const res = await fetch(`${publicApiBase()}/v1/audio/uploads/${encodeURIComponent(uploadId)}/transcribe?${q}`, {
        method: "POST",
      });
      if (!res.ok) {
        const raw = await res.text();
        throw new Error(apiErrorMessage(res.status, raw));
      }
      const json = (await res.json()) as { idempotent: boolean; upload: AudioUploadDTO; transcript: TranscriptDetailDTO };
      setUpload(json.upload);
      setTranscript(json.transcript);
      setTranscribePhase("ok");
      setTranscribeMessage(json.idempotent ? "Transcript already present (idempotent)." : "Transcription completed.");
      await loadAll();
    } catch (e) {
      setTranscribePhase("error");
      setTranscribeMessage(e instanceof Error ? e.message : "Transcription failed");
    }
  }, [canQuery, orgId, uploadId, loadAll]);

  const job = upload?.transcript_job;
  const pl = upload?.candidate_pipeline ?? null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Upload detail</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Transcription</h1>
        <p className="text-sm text-zinc-600">
          Tenant-scoped view of the stored file and transcript job. Run mock transcription (no external ASR) to materialize{" "}
          <code className="text-xs">transcripts</code> + <code className="text-xs">transcript_segments</code>.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/upload" className="font-medium text-zinc-700 underline-offset-4 hover:underline">
            ← Back to uploads
          </Link>
          <Link
            href={isUuid(orgId.trim()) ? `/analytics?organization_id=${encodeURIComponent(orgId)}` : "/analytics"}
            className="font-medium text-zinc-700 underline-offset-4 hover:underline"
          >
            Analytics
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Organization</h2>
        <label className="mt-3 block text-xs font-medium text-zinc-600">
          Organization ID
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            spellCheck={false}
          />
        </label>
        {orgId.trim() && !isUuid(orgId.trim()) ? (
          <p className="mt-2 text-xs text-red-600">Use a valid UUID (matches seed / .env defaults).</p>
        ) : null}
        <p className="mt-2 text-xs text-zinc-500">
          Upload id: <span className="font-mono">{uploadId || "—"}</span>
        </p>
      </section>

      {loadError ? <p className="text-sm text-red-600">{loadError}</p> : null}

      {pageLoading && !upload && !loadError ? (
        <p className="text-center text-sm text-zinc-500">Loading upload…</p>
      ) : null}

      {upload ? (
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">File</h2>
          <dl className="grid gap-2 text-sm text-zinc-800 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-zinc-500">Filename</dt>
              <dd className="font-mono text-xs">{upload.original_filename ?? upload.id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-zinc-500">Storage status</dt>
              <dd>{upload.status}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-zinc-500">Bytes</dt>
              <dd>{upload.byte_size != null ? `${Math.round(upload.byte_size / 1024)} KB` : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-zinc-500">Checksum</dt>
              <dd className="break-all font-mono text-xs">{upload.checksum_sha256 ?? "—"}</dd>
            </div>
          </dl>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Transcription status</h3>
            <p className="mt-2 text-sm text-zinc-800">
              Job: <span className="font-mono">{job?.status ?? "—"}</span>
              {job?.error_message ? (
                <span className="mt-1 block text-red-600">{job.error_message}</span>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Transcript row: {transcript ? <span className="font-mono text-zinc-800">{transcript.id}</span> : "not yet created"}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={transcribePhase === "running"}
                onClick={() => void runTranscribe()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {transcribePhase === "running" ? "Transcribing…" : "Run transcription (mock)"}
              </button>
              <button
                type="button"
                onClick={() => void loadAll()}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Refresh
              </button>
            </div>
            {transcribeMessage ? (
              <p
                className={`mt-3 text-sm ${transcribePhase === "error" ? "text-red-600" : transcribePhase === "ok" ? "text-emerald-700" : "text-zinc-600"}`}
              >
                {transcribeMessage}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Extraction &amp; review pipeline</h3>
            <p className="mt-2 text-sm text-zinc-800">
              Stage: <span className="font-mono">{pl?.processing_stage ?? "—"}</span>
              <span className="mx-2 text-zinc-400">·</span>
              Extraction: <span className="font-mono">{pl?.extraction_status ?? "—"}</span>
              <span className="mx-2 text-zinc-400">·</span>
              Approval: <span className="font-mono">{pl?.approval_status ?? "—"}</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Overall confidence:{" "}
              {pl?.confidence_overall != null ? <span className="font-mono text-zinc-800">{pl.confidence_overall}</span> : "—"}
            </p>
            {pl?.latest_extraction_run ? (
              <p className="mt-1 text-xs text-zinc-600">
                Latest run #{pl.latest_extraction_run.run_index}:{" "}
                <span className="font-mono">{pl.latest_extraction_run.status}</span>
                {pl.latest_extraction_run.status === "failed" && pl.latest_extraction_run.error_message ? (
                  <span className="mt-1 block text-red-600">{pl.latest_extraction_run.error_message}</span>
                ) : null}
                {pl.latest_extraction_run.missing_fields?.length ? (
                  <span className="mt-1 block">
                    Missing fields: {pl.latest_extraction_run.missing_fields.length} (see API / DB for list)
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">No extraction run yet for this upload&apos;s primary candidate.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!transcript || extractPhase === "running"}
                onClick={() => void runExtract()}
                className="rounded-lg border border-zinc-900 bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {extractPhase === "running" ? "Extracting…" : "Run extraction (mock)"}
              </button>
              {pl?.candidate_id ? (
                <Link
                  href={`/review/${pl.candidate_id}?organization_id=${encodeURIComponent(orgId)}`}
                  className="inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Review console
                </Link>
              ) : null}
            </div>
            {extractMessage ? (
              <p
                className={`mt-3 text-sm ${extractPhase === "error" ? "text-red-600" : extractPhase === "ok" ? "text-emerald-700" : "text-zinc-600"}`}
              >
                {extractMessage}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {transcript ? (
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Transcript</h2>
              <p className="text-xs text-zinc-500">
                Provider <span className="font-mono">{transcript.provider ?? "—"}</span> · language{" "}
                <span className="font-mono">{transcript.language ?? "—"}</span>
              </p>
            </div>
          </div>

          <ol className="space-y-4">
            {transcript.segments.map((seg) => (
              <li key={seg.id} className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-800">{seg.speaker_label ?? "Speaker"}</span>
                  <span className="font-mono">
                    {formatClock(seg.start_ms)} – {formatClock(seg.end_ms)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-zinc-900">{seg.text}</p>
              </li>
            ))}
          </ol>

          <details className="rounded-lg border border-dashed border-zinc-200 bg-white p-3 text-sm text-zinc-700">
            <summary className="cursor-pointer text-xs font-medium text-zinc-600">Full text (concatenated)</summary>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-xs leading-relaxed">{transcript.full_text}</pre>
          </details>
        </section>
      ) : upload && !loadError ? (
        <p className="text-sm text-zinc-600">No transcript yet. Run mock transcription to generate segments.</p>
      ) : null}
    </div>
  );
}
