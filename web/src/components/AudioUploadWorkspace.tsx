"use client";

import Link from "next/link";
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
  candidate_pipeline?: Record<string, unknown> | null;
};

type CreateResponse = {
  upload: AudioUploadDTO;
  processing: TranscriptJobDTO;
};

type TranscriptDetailDTO = {
  id: string;
  audio_upload_id: string;
  version: number;
  status: string;
  full_text: string;
};

type TranscribeResponse = {
  idempotent: boolean;
  transcript: TranscriptDetailDTO;
  upload: AudioUploadDTO;
};

export function AudioUploadWorkspace() {
  const defaultOrg = process.env.NEXT_PUBLIC_DEV_ORG_ID ?? "";
  const defaultRecruiter = process.env.NEXT_PUBLIC_DEV_RECRUITER_ID ?? "";

  const [orgId, setOrgId] = useState(defaultOrg);
  const [recruiterId, setRecruiterId] = useState(defaultRecruiter);
  const [jobRef, setJobRef] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CreateResponse | null>(null);
  const [recent, setRecent] = useState<AudioUploadDTO[]>([]);
  const [recentError, setRecentError] = useState<string | null>(null);

  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptPhase, setTranscriptPhase] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [transcriptMessage, setTranscriptMessage] = useState<string | null>(null);
  const [transcriptResult, setTranscriptResult] = useState<TranscribeResponse | null>(null);

  const canUpload = useMemo(
    () => Boolean(recruiterId && orgId && file && isUuid(orgId.trim()) && isUuid(recruiterId.trim())),
    [recruiterId, orgId, file],
  );

  const canSubmitTranscript = useMemo(
    () => Boolean(recruiterId.trim() && transcriptText.trim() && isUuid(recruiterId.trim())),
    [recruiterId, transcriptText],
  );

  const orgListOk = useMemo(() => !orgId.trim() || isUuid(orgId.trim()), [orgId]);

  const loadRecent = useCallback(
    async (organizationIdOverride?: string) => {
      const oid = (organizationIdOverride ?? orgId).trim();
      if (!oid) {
        setRecentError("Set organization ID (dev default from .env.local).");
        return;
      }
      if (!isUuid(oid)) {
        setRecentError("Organization ID must be a valid UUID.");
        return;
      }
      setRecentError(null);
      try {
        const res = await fetch(
          `${publicApiBase()}/v1/audio/uploads?organization_id=${encodeURIComponent(oid)}&limit=15`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          const raw = await res.text();
          throw new Error(apiErrorMessage(res.status, raw));
        }
        setRecent((await res.json()) as AudioUploadDTO[]);
      } catch (e) {
        setRecentError(e instanceof Error ? e.message : "Failed to load uploads");
      }
    },
    [orgId],
  );

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  const uploadWithProgress = useCallback(() => {
    if (!file || !recruiterId) return;
    setPhase("uploading");
    setProgress(0);
    setMessage(null);
    setLastResult(null);

    const fd = new FormData();
    fd.append("recruiter_id", recruiterId);
    fd.append("file", file);
    if (jobRef.trim()) fd.append("job_reference", jobRef.trim());
    if (notes.trim()) fd.append("upload_notes", notes.trim());

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${publicApiBase()}/v1/audio/uploads`);
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        setProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    };
    xhr.onerror = () => {
      setPhase("error");
      setMessage("Network error during upload.");
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const json = JSON.parse(xhr.responseText) as CreateResponse;
        setLastResult(json);
        setPhase("done");
        setMessage("Upload stored; transcript job is a placeholder until ASR is wired.");
        void loadRecent();
        setFile(null);
        setProgress(100);
      } else {
        setPhase("error");
        setMessage(apiErrorMessage(xhr.status, xhr.responseText));
      }
    };
    xhr.send(fd);
  }, [file, jobRef, loadRecent, notes, recruiterId]);

  const submitTranscriptOnly = useCallback(async () => {
    if (!canSubmitTranscript) return;
    setTranscriptPhase("saving");
    setTranscriptMessage(null);
    setTranscriptResult(null);
    try {
      const res = await fetch(
        `${publicApiBase()}/v1/recruiters/${encodeURIComponent(recruiterId.trim())}/demo-from-transcript`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_text: transcriptText.trim(),
            job_reference: jobRef.trim() || null,
            upload_notes: notes.trim() || null,
          }),
        },
      );
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, raw));
      }
      const json = JSON.parse(raw) as TranscribeResponse;
      setTranscriptResult(json);
      setTranscriptPhase("done");
      setOrgId(json.upload.organization_id);
      setTranscriptMessage(
        "Transcript saved. A tiny placeholder audio file is stored for now; replace with a real recording later if you want ASR.",
      );
      void loadRecent(json.upload.organization_id);
    } catch (e) {
      setTranscriptPhase("error");
      let msg = e instanceof Error ? e.message : "Request failed";
      if (msg === "Failed to fetch" || (e instanceof TypeError && String(e.message).toLowerCase().includes("fetch"))) {
        const origin = typeof window !== "undefined" ? window.location.origin : "this origin";
        const base = publicApiBase();
        const viaProxy = base === "/api" || base.startsWith("/");
        msg = viaProxy
          ? `Could not reach the API (browser calls ${base}/… which Next proxies to FastAPI). Start uvicorn on port 8000, or set API_PROXY_ORIGIN in web/.env.local if the API is elsewhere.`
          : `Could not reach the API at ${base}. Start FastAPI on that host/port, set NEXT_PUBLIC_API_URL in web/.env.local if it differs, and add "${origin}" to CORS_ORIGINS in server/.env.`;
      }
      setTranscriptMessage(msg);
    }
  }, [canSubmitTranscript, jobRef, loadRecent, notes, recruiterId, transcriptText]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Screening intake</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Upload screening audio</h1>
        <p className="text-sm text-zinc-600">
          Upload audio when you have it, or use the transcript panel (below recruiter fields) to walk through extraction and review without a
          recording. Audio upload still uses size/type checks and <code className="text-xs">FILE_STORAGE_ROOT</code>; transcript-only uses a
          small silent placeholder file until real audio is wired.
        </p>
      </header>

      <section className="grid gap-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">Recruiter & tenant</h2>
          <label className="block text-xs font-medium text-zinc-600">
            Organization ID
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              spellCheck={false}
            />
          </label>
          {!orgListOk ? <p className="text-xs text-red-600">Enter a valid UUID to load recent uploads.</p> : null}
          <label className="block text-xs font-medium text-zinc-600">
            Recruiter ID
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm"
              value={recruiterId}
              onChange={(e) => setRecruiterId(e.target.value)}
              spellCheck={false}
            />
          </label>
          {recruiterId.trim() && !isUuid(recruiterId.trim()) ? (
            <p className="text-xs text-red-600">Recruiter ID must be a valid UUID for upload.</p>
          ) : null}
          <label className="block text-xs font-medium text-zinc-600">
            Job / req reference (optional)
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              value={jobRef}
              onChange={(e) => setJobRef(e.target.value)}
              placeholder="e.g. REQ-4412 / Bullhorn Job 90812"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            Notes (optional)
            <textarea
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Client-sensitive context stays out of filenames; keep it here."
            />
          </label>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">Audio file</h2>
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm transition ${
              dragActive ? "border-zinc-900 bg-zinc-50" : "border-zinc-300 bg-zinc-50/60"
            }`}
          >
            <p className="font-medium text-zinc-800">Drag & drop audio here</p>
            <p className="mt-1 text-xs text-zinc-500">WAV, MP3, M4A, WebM — max ~50&nbsp;MB (server limit)</p>
            <label className="mt-4">
              <span className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white">Browse files</span>
              <input
                type="file"
                accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp3,audio/mp4,audio/m4a,audio/x-m4a,audio/webm"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file ? (
              <p className="mt-4 break-all text-xs text-zinc-700">
                Selected: <span className="font-mono">{file.name}</span> ({Math.round(file.size / 1024)} KB)
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!canUpload || phase === "uploading"}
              onClick={uploadWithProgress}
              title={!canUpload ? "Requires audio file plus valid UUIDs for organization and recruiter." : undefined}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {phase === "uploading" ? "Uploading…" : "Start upload"}
            </button>
            <button
              type="button"
              onClick={() => void loadRecent()}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Refresh list
            </button>
          </div>

          {phase === "uploading" ? (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                <div className="h-full bg-zinc-900 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-zinc-500">{progress}%</p>
            </div>
          ) : null}

          {message ? (
            <p className={`text-sm ${phase === "error" ? "text-red-600" : "text-emerald-700"}`}>{message}</p>
          ) : null}

          {lastResult ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800">
              <p className="font-semibold">Last response</p>
              <p className="mt-1 font-mono">upload: {lastResult.upload.id}</p>
              <p className="font-mono">status: {lastResult.upload.status}</p>
              <p className="font-mono">job: {lastResult.processing.id}</p>
              <p className="font-mono">job status: {lastResult.processing.status}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-amber-200/80 bg-amber-50/40 p-6 shadow-sm">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">Temporary</p>
          <h2 className="text-sm font-semibold text-zinc-900">Start from transcript (no recording yet)</h2>
          <p className="text-xs text-zinc-600">
            Only <strong>Recruiter ID</strong> is required here; organization is taken from that recruiter and synced into the field above after
            success. Enable the API with{" "}
            <code className="rounded bg-white/80 px-1 py-0.5 text-[11px]">ALLOW_TRANSCRIPT_ONLY_DEMO=true</code> in{" "}
            <code className="rounded bg-white/80 px-1 py-0.5 text-[11px]">server/.env</code>.
          </p>
        </div>
        <label className="block text-xs font-medium text-zinc-700">
          Transcript text
          <textarea
            className="mt-1 min-h-[140px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-inner"
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder="Paste the screening call transcript here…"
            spellCheck
          />
        </label>
        {transcriptText.trim() && !canSubmitTranscript ? (
          <p className="text-xs text-amber-900/90">
            Enter a valid <strong>Recruiter ID</strong> in the section above (UUID from your seed or database).
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canSubmitTranscript || transcriptPhase === "saving"}
            onClick={() => void submitTranscriptOnly()}
            title={
              !canSubmitTranscript
                ? "Requires non-empty transcript and a valid recruiter UUID (field above)."
                : undefined
            }
            className="rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {transcriptPhase === "saving" ? "Saving…" : "Create from transcript"}
          </button>
        </div>
        {transcriptMessage ? (
          <p className={`text-sm ${transcriptPhase === "error" ? "text-red-600" : "text-emerald-800"}`}>{transcriptMessage}</p>
        ) : null}
        {transcriptResult ? (
          <div className="rounded-lg border border-amber-200/90 bg-white/90 p-3 text-xs text-zinc-800">
            <p className="font-semibold text-zinc-900">Created</p>
            <p className="mt-1 font-mono">upload: {transcriptResult.upload.id}</p>
            <p className="font-mono">transcript: {transcriptResult.transcript.id}</p>
            <p className="mt-2">
              <Link
                href={`/upload/${transcriptResult.upload.id}?organization_id=${encodeURIComponent(transcriptResult.upload.organization_id)}`}
                className="font-medium text-amber-950 underline-offset-4 hover:underline"
              >
                Open upload detail →
              </Link>
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Recent uploads</h2>
          <Link href="/" className="text-xs font-medium text-zinc-600 underline-offset-4 hover:underline">
            Home
          </Link>
        </div>
        {recentError ? <p className="text-sm text-red-600">{recentError}</p> : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="py-2 pr-3">File</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Transcript job</th>
                <th className="py-2 pr-3">Job ref</th>
                <th className="py-2 pr-3">When</th>
                <th className="py-2">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {recent.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 pr-3 font-mono text-xs">{u.original_filename ?? u.id}</td>
                  <td className="py-2 pr-3">{u.status}</td>
                  <td className="py-2 pr-3">{u.transcript_job?.status ?? "—"}</td>
                  <td className="py-2 pr-3 text-xs text-zinc-600">{u.job_reference ?? "—"}</td>
                  <td className="py-2 pr-3 text-xs text-zinc-500">{new Date(u.created_at).toLocaleString()}</td>
                  <td className="py-2">
                    <Link
                      href={`/upload/${u.id}?organization_id=${encodeURIComponent(orgId)}`}
                      className="text-xs font-medium text-zinc-800 underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {recent.length === 0 && !recentError ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-zinc-500">
                    No uploads yet for this organization.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
