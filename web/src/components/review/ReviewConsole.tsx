"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { publicApiBase } from "@/lib/apiBase";
import { DEV_DEFAULT_EDITOR_USER_ID } from "@/lib/devEditorUser";
import { apiErrorMessage } from "@/lib/parseApiError";
import { AuditTimelinePanel } from "./AuditTimelinePanel";
import { CandidateExportPanel } from "./CandidateExportPanel";
import { JsonProfileTab } from "./JsonProfileTab";
import { NarrativeWorkspace } from "./NarrativeWorkspace";
import { ReviewRecordTabBar, type RecordTabId } from "./ReviewRecordTabBar";
import { ReviewStickyActionBar } from "./ReviewStickyActionBar";
import { StructuredFieldsPanel } from "./StructuredFieldsPanel";
import { TranscriptPanel } from "./TranscriptPanel";
import type {
  AuditTimelineEntryDTO,
  AuditTimelineResponse,
  NarrativeGenerationDTO,
  NarrativeHistoryResponse,
  ReviewBundleResponse,
} from "./reviewTypes";

function humanizeEnum(value: string): string {
  return value.replace(/_/g, " ");
}

function editorUserId(): string {
  return process.env.NEXT_PUBLIC_DEV_EDITOR_USER_ID ?? DEV_DEFAULT_EDITOR_USER_ID;
}

export function ReviewConsole() {
  const params = useParams();
  const searchParams = useSearchParams();
  const candidateId = typeof params.candidateId === "string" ? params.candidateId : "";
  const defaultOrg = process.env.NEXT_PUBLIC_DEV_ORG_ID ?? "";
  const orgId = searchParams.get("organization_id") ?? defaultOrg;

  const [bundle, setBundle] = useState<ReviewBundleResponse | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditTimelineEntryDTO[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [saveBusy, setSaveBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" | "info" } | null>(null);
  const [recordTab, setRecordTab] = useState<RecordTabId>("structured");
  const [narrativeVersions, setNarrativeVersions] = useState<NarrativeGenerationDTO[]>([]);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const [narrativeGenBusy, setNarrativeGenBusy] = useState(false);
  const [narrativeBanner, setNarrativeBanner] = useState<string | null>(null);

  const fromFields = useCallback((b: ReviewBundleResponse) => {
    const m: Record<string, string> = {};
    for (const f of b.fields) {
      m[f.id] = f.field_value ?? "";
    }
    return m;
  }, []);

  const loadBundle = useCallback(async () => {
    if (!candidateId || !orgId) {
      setLoadError("Missing candidate id or organization id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setAuditLoading(true);
    setLoadError(null);
    setAuditError(null);
    setToast(null);
    try {
      const q = `organization_id=${encodeURIComponent(orgId)}`;
      const base = publicApiBase();
      const cid = encodeURIComponent(candidateId);
      const [res, resAudit] = await Promise.all([
        fetch(`${base}/v1/candidates/${cid}/review?${q}`, { cache: "no-store" }),
        fetch(`${base}/v1/candidates/${cid}/audit-timeline?${q}`, { cache: "no-store" }),
      ]);
      const rawBundle = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, rawBundle));
      }
      const data = JSON.parse(rawBundle) as ReviewBundleResponse;
      setBundle(data);
      const init = fromFields(data);
      setLocalValues(init);
      setBaseline(init);

      const rawAudit = await resAudit.text();
      if (resAudit.ok) {
        const aud = JSON.parse(rawAudit) as AuditTimelineResponse;
        setAuditEntries(aud.entries ?? []);
      } else {
        setAuditEntries([]);
        setAuditError(apiErrorMessage(resAudit.status, rawAudit));
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setBundle(null);
      setAuditEntries([]);
    } finally {
      setLoading(false);
      setAuditLoading(false);
    }
  }, [candidateId, fromFields, orgId]);

  useEffect(() => {
    void loadBundle();
  }, [loadBundle]);

  const dirty = useMemo(() => {
    for (const id of Object.keys(localValues)) {
      if ((localValues[id] ?? "") !== (baseline[id] ?? "")) return true;
    }
    return false;
  }, [baseline, localValues]);

  const save = useCallback(async () => {
    if (!bundle || !candidateId || !orgId) return;
    const updates = Object.keys(localValues)
      .filter((id) => (localValues[id] ?? "") !== (baseline[id] ?? ""))
      .map((extracted_field_id) => ({ extracted_field_id, field_value: localValues[extracted_field_id] ?? "" }));
    if (updates.length === 0) {
      setToast({ text: "Nothing to save.", kind: "info" });
      return;
    }
    setSaveBusy(true);
    setToast(null);
    try {
      const q = `organization_id=${encodeURIComponent(orgId)}&editor_user_id=${encodeURIComponent(editorUserId())}`;
      const res = await fetch(`${publicApiBase()}/v1/candidates/${encodeURIComponent(candidateId)}/review/fields?${q}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, raw));
      }
      await loadBundle();
      setToast({ text: "Saved.", kind: "success" });
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : "Save failed", kind: "error" });
    } finally {
      setSaveBusy(false);
    }
  }, [baseline, bundle, candidateId, localValues, loadBundle, orgId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const approve = useCallback(async () => {
    if (!candidateId || !orgId) return;
    if (!window.confirm("Approve this candidate record and mark all draft fields approved?")) return;
    setActionBusy(true);
    setToast(null);
    try {
      const q = `organization_id=${encodeURIComponent(orgId)}&editor_user_id=${encodeURIComponent(editorUserId())}`;
      const res = await fetch(`${publicApiBase()}/v1/candidates/${encodeURIComponent(candidateId)}/review/approve?${q}`, { method: "POST" });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, raw));
      }
      await loadBundle();
      setToast({ text: "Approved.", kind: "success" });
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : "Approve failed", kind: "error" });
    } finally {
      setActionBusy(false);
    }
  }, [candidateId, loadBundle, orgId]);

  const reject = useCallback(async () => {
    if (!candidateId || !orgId) return;
    const reason = window.prompt("Optional rejection reason (stored in audit log):");
    if (reason === null) return;
    setActionBusy(true);
    setToast(null);
    try {
      const q = `organization_id=${encodeURIComponent(orgId)}&editor_user_id=${encodeURIComponent(editorUserId())}`;
      const res = await fetch(`${publicApiBase()}/v1/candidates/${encodeURIComponent(candidateId)}/review/reject?${q}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() ? reason.trim() : null }),
      });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, raw));
      }
      await loadBundle();
      setToast({ text: "Rejected.", kind: "success" });
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : "Reject failed", kind: "error" });
    } finally {
      setActionBusy(false);
    }
  }, [candidateId, loadBundle, orgId]);

  const rerunExtraction = useCallback(async () => {
    if (!bundle || !orgId) return;
    if (!window.confirm("Re-run extraction? A new extraction version will be created; this page will reload data.")) return;
    setActionBusy(true);
    setToast(null);
    try {
      const q = `organization_id=${encodeURIComponent(orgId)}`;
      const res = await fetch(`${publicApiBase()}/v1/audio/uploads/${encodeURIComponent(bundle.audio_upload_id)}/extract?${q}`, {
        method: "POST",
      });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, raw));
      }
      await loadBundle();
      setToast({ text: "Extraction re-run complete.", kind: "success" });
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : "Re-run failed", kind: "error" });
    } finally {
      setActionBusy(false);
    }
  }, [bundle, loadBundle, orgId]);

  const onFieldChange = useCallback((fieldId: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const canUseApprovedExports = useMemo(() => {
    if (!bundle) return false;
    const s = bundle.candidate.approval_status;
    return s === "approved" || s === "partially_approved";
  }, [bundle]);

  const loadNarratives = useCallback(async () => {
    if (!candidateId || !orgId || !canUseApprovedExports) {
      setNarrativeVersions([]);
      setNarrativeError(null);
      return;
    }
    setNarrativeLoading(true);
    setNarrativeError(null);
    try {
      const q = `organization_id=${encodeURIComponent(orgId)}`;
      const res = await fetch(`${publicApiBase()}/v1/candidates/${encodeURIComponent(candidateId)}/narratives/history?${q}`, {
        cache: "no-store",
      });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, raw));
      }
      const data = JSON.parse(raw) as NarrativeHistoryResponse;
      setNarrativeVersions(data.versions ?? []);
    } catch (e) {
      setNarrativeVersions([]);
      setNarrativeError(e instanceof Error ? e.message : "Failed to load narratives");
    } finally {
      setNarrativeLoading(false);
    }
  }, [candidateId, canUseApprovedExports, orgId]);

  useEffect(() => {
    void loadNarratives();
  }, [loadNarratives]);

  useEffect(() => {
    if (!bundle) return;
    if (!canUseApprovedExports && recordTab !== "structured") {
      setRecordTab("structured");
    }
  }, [bundle, canUseApprovedExports, recordTab]);

  const regenerateNarratives = useCallback(async () => {
    if (!candidateId || !orgId || !canUseApprovedExports) return;
    setNarrativeGenBusy(true);
    setNarrativeError(null);
    setNarrativeBanner(null);
    try {
      const q = `organization_id=${encodeURIComponent(orgId)}&editor_user_id=${encodeURIComponent(editorUserId())}`;
      const res = await fetch(`${publicApiBase()}/v1/candidates/${encodeURIComponent(candidateId)}/narratives/generate?${q}`, {
        method: "POST",
      });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.status, raw));
      }
      const row = JSON.parse(raw) as NarrativeGenerationDTO;
      setNarrativeBanner(`Generated version ${row.version}.`);
      await loadNarratives();
    } catch (e) {
      setNarrativeError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setNarrativeGenBusy(false);
    }
  }, [candidateId, canUseApprovedExports, loadNarratives, orgId]);

  const busy = saveBusy || actionBusy;

  const hasCompleteExtraction = Boolean(bundle?.latest_extraction_run);
  const approval = bundle?.candidate.approval_status ?? "";
  const approveDisabled = !hasCompleteExtraction || approval === "approved" || approval === "rejected";
  const rejectDisabled = approval === "rejected";
  const saveBarDisabled = !dirty || busy || !hasCompleteExtraction;

  return (
    <div className="min-h-screen bg-zinc-100 pb-24 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Review console</p>
            <h1 className="text-lg font-semibold tracking-tight">Candidate record</h1>
            {bundle ? (
              <>
                <p className="mt-1 font-mono text-xs text-zinc-500">
                  {bundle.candidate.id} · {bundle.candidate.extraction_status}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-medium text-zinc-700">
                    Stage: {humanizeEnum(bundle.candidate.processing_stage)}
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-medium text-zinc-700">
                    Approval: {humanizeEnum(bundle.candidate.approval_status)}
                  </span>
                  {!hasCompleteExtraction ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-900">
                      Awaiting completed extraction
                    </span>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            {bundle?.audio_upload_id ? (
              <Link
                href={`/upload/${bundle.audio_upload_id}?organization_id=${encodeURIComponent(orgId)}`}
                className="text-zinc-600 underline-offset-4 hover:underline"
              >
                Upload detail
              </Link>
            ) : null}
            <Link href="/upload" className="text-zinc-600 underline-offset-4 hover:underline">
              All uploads
            </Link>
            <Link
              href={`/analytics?organization_id=${encodeURIComponent(orgId)}`}
              className="text-zinc-600 underline-offset-4 hover:underline"
            >
              Analytics
            </Link>
          </div>
        </div>
      </header>

      {toast ? (
        <div className="mx-auto max-w-[1600px] px-4 pt-3 sm:px-6">
          <p
            className={`rounded-md border px-3 py-2 text-sm ${
              toast.kind === "error"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : toast.kind === "info"
                  ? "border-zinc-200 bg-zinc-50 text-zinc-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-950"
            }`}
          >
            {toast.text}
          </p>
        </div>
      ) : null}

      {loading && bundle ? (
        <p className="mx-auto max-w-[1600px] px-4 pt-2 text-center text-xs text-zinc-500 sm:px-6">Refreshing…</p>
      ) : null}

      {bundle ? (
        <ReviewRecordTabBar active={recordTab} onChange={setRecordTab} canUseApprovedExports={canUseApprovedExports} />
      ) : null}

      {loadError ? (
        <div className="mx-auto max-w-[1600px] space-y-3 px-4 py-8 sm:px-6">
          <p className="text-sm text-red-600">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadBundle()}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && !bundle ? (
        <div className="mx-auto max-w-[1600px] px-4 py-16 text-center text-sm text-zinc-500 sm:px-6">Loading…</div>
      ) : null}

      {bundle ? (
        <>
          {recordTab === "structured" ? (
            <>
              <p className="mx-auto max-w-[1600px] px-4 pt-3 text-xs text-zinc-600 sm:px-6">
                <strong className="font-medium text-zinc-800">Verified structured profile</strong> — values on this tab are the extraction-backed
                fields you edit and save. Generated summaries live on other tabs.
              </p>
              <div className="mx-auto grid max-w-[1600px] lg:grid-cols-2 lg:divide-x lg:divide-zinc-200">
                <TranscriptPanel transcript={bundle.transcript} />
                <StructuredFieldsPanel
                  fields={bundle.fields}
                  needsReviewOnly={needsReviewOnly}
                  onNeedsReviewOnlyChange={setNeedsReviewOnly}
                  localValues={localValues}
                  baseline={baseline}
                  disabled={busy}
                  onChange={onFieldChange}
                />
              </div>
              <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
                <CandidateExportPanel
                  candidateId={candidateId}
                  organizationId={orgId}
                  approvalStatus={bundle.candidate.approval_status}
                  disabled={busy}
                />
              </div>
            </>
          ) : null}
          {recordTab === "json" ? (
            <JsonProfileTab candidateId={candidateId} organizationId={orgId} enabled={canUseApprovedExports} />
          ) : null}
          {recordTab === "summary" ? (
            <NarrativeWorkspace
              mode="summary"
              versions={narrativeVersions}
              loading={narrativeLoading}
              error={narrativeError}
              generateBusy={narrativeGenBusy}
              onRegenerate={regenerateNarratives}
            />
          ) : null}
          {recordTab === "submittal" ? (
            <NarrativeWorkspace
              mode="submittal"
              versions={narrativeVersions}
              loading={narrativeLoading}
              error={narrativeError}
              generateBusy={narrativeGenBusy}
              onRegenerate={regenerateNarratives}
            />
          ) : null}
          {narrativeBanner ? (
            <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">{narrativeBanner}</p>
            </div>
          ) : null}
          <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
            <AuditTimelinePanel entries={auditEntries} loading={auditLoading} error={auditError} />
          </div>
        </>
      ) : null}

      {bundle && recordTab === "structured" && bundle.fields.length === 0 && !loading ? (
        <div className="mx-auto max-w-[1600px] px-4 py-6 text-center text-sm text-zinc-600 sm:px-6">
          No extracted fields on the latest completed run. Run extraction from the upload detail page, then refresh.
        </div>
      ) : null}

      {bundle && recordTab === "structured" ? (
        <ReviewStickyActionBar
          dirty={dirty}
          saveDisabled={saveBarDisabled}
          actionDisabled={busy}
          approveDisabled={approveDisabled}
          rejectDisabled={rejectDisabled}
          onSave={() => void save()}
          onApprove={() => void approve()}
          onReject={() => void reject()}
          onRerunExtraction={() => void rerunExtraction()}
        />
      ) : null}
    </div>
  );
}
