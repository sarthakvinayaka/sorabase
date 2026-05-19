/**
 * Typed API client. All network calls go through these functions.
 * Calls are proxied from /api/* to the FastAPI backend via next.config rewrites.
 */

import type {
  AnalysisRun,
  ApprovalStatus,
  AudioIngestResponse,
  AuditLogResponse,
  BotSession,
  Candidate,
  CandidateDraft,
  CandidateDetail,
  CandidateListResponse,
  ConversationCreatedResponse,
  ConversationSummary,
  DashboardStats,
  ExtractionCreatedResponse,
  ExtractedField,
  FieldValue,
  GeneralDashboardStats,
  GeneralExport,
  Job,
  MeetingSession,
  ProposedColumn,
  RecordsTableResponse,
  SchemaProposalResponse,
  SchemaTemplate,
  SchemaTemplateCreate,
  SchemaTemplateUpdate,
  SchemasListResponse,
  StudyArchiveStatus,
  StudyExtractionCreatedResponse,
  StudyFlashcard,
  StudyLectureDetail,
  StudyQuestion,
  WebhookDeliveryResult,
} from "./types";

class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? body.message ?? detail;
    } catch {
      // ignore parse failure
    }
    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}

export async function listConversations(params: {
  source_type?: string;
  transcript_status?: string;
  limit?: number;
}): Promise<ConversationSummary[]> {
  const search = new URLSearchParams();
  if (params.source_type) search.set("source_type", params.source_type);
  if (params.transcript_status) search.set("transcript_status", params.transcript_status);
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return request(`/api/conversations${qs ? `?${qs}` : ""}`);
}

export async function createConversation(params: {
  raw_text: string;
  job_reference?: string;
  recruiter_id?: string;
  job_id?: string;
  source_type?: string;
}): Promise<ConversationCreatedResponse> {
  return request("/api/conversations", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function extractConversation(
  conversationId: string,
): Promise<ExtractionCreatedResponse> {
  return request(`/api/conversations/${conversationId}/extract`, {
    method: "POST",
  });
}

export async function getCandidateDetail(candidateId: string): Promise<CandidateDetail> {
  return request(`/api/candidates/${candidateId}`);
}

export async function listCandidates(params?: {
  page?: number;
  limit?: number;
  approval_status?: string;
}): Promise<CandidateListResponse> {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.approval_status) search.set("approval_status", params.approval_status);
  const qs = search.toString();
  return request(`/api/candidates${qs ? `?${qs}` : ""}`);
}

export async function updateApproval(
  candidateId: string,
  approvalStatus: ApprovalStatus,
): Promise<Candidate> {
  return request(`/api/candidates/${candidateId}/approval`, {
    method: "PATCH",
    body: JSON.stringify({ approval_status: approvalStatus, actor_id: "recruiter" }),
  });
}

export async function editField(
  candidateId: string,
  fieldId: string,
  reviewedValue: FieldValue,
): Promise<ExtractedField> {
  return request(`/api/candidates/${candidateId}/fields/${fieldId}`, {
    method: "PATCH",
    body: JSON.stringify({ reviewed_value: reviewedValue, actor_id: "recruiter" }),
  });
}

export async function confirmField(
  candidateId: string,
  fieldId: string,
): Promise<ExtractedField> {
  return request(`/api/candidates/${candidateId}/fields/${fieldId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ actor_id: "recruiter" }),
  });
}

export async function unresolveField(
  candidateId: string,
  fieldId: string,
): Promise<ExtractedField> {
  return request(`/api/candidates/${candidateId}/fields/${fieldId}/unresolve`, {
    method: "POST",
    body: JSON.stringify({ actor_id: "recruiter" }),
  });
}

export async function getCandidateAudit(candidateId: string): Promise<AuditLogResponse> {
  return request(`/api/candidates/${candidateId}/audit`);
}

export async function triggerAnalysis(
  candidateId: string,
  jobId: string,
): Promise<AnalysisRun> {
  return request(`/api/candidates/${candidateId}/analyses`, {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, actor_id: "recruiter" }),
  });
}

export async function listAnalyses(candidateId: string): Promise<AnalysisRun[]> {
  return request(`/api/candidates/${candidateId}/analyses`);
}

export async function getAnalysis(
  candidateId: string,
  analysisId: string,
): Promise<AnalysisRun> {
  return request(`/api/candidates/${candidateId}/analyses/${analysisId}`);
}

export async function listJobs(): Promise<Job[]> {
  return request("/api/jobs");
}

export async function createJob(params: {
  title: string;
  description?: string;
  requirements?: string;
}): Promise<Job> {
  return request("/api/jobs", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function overrideAnalysisScore(
  candidateId: string,
  analysisId: string,
  overrideScore: number,
  overrideReason: string,
): Promise<AnalysisRun> {
  return request(`/api/candidates/${candidateId}/analyses/${analysisId}/override`, {
    method: "PATCH",
    body: JSON.stringify({
      override_score: overrideScore,
      override_reason: overrideReason,
      actor_id: "recruiter",
    }),
  });
}

export async function generateSummaryDraft(candidateId: string): Promise<CandidateDraft> {
  return request(`/api/candidates/${candidateId}/drafts/summary`, {
    method: "POST",
    body: JSON.stringify({ actor_id: "recruiter" }),
  });
}

export async function generateSubmittalDraft(
  candidateId: string,
  analysisRunId: string,
): Promise<CandidateDraft> {
  return request(`/api/candidates/${candidateId}/drafts/submittal`, {
    method: "POST",
    body: JSON.stringify({ analysis_run_id: analysisRunId, actor_id: "recruiter" }),
  });
}

export async function listDrafts(candidateId: string): Promise<CandidateDraft[]> {
  return request(`/api/candidates/${candidateId}/drafts`);
}

export async function editDraft(
  candidateId: string,
  draftId: string,
  content: string,
): Promise<CandidateDraft> {
  return request(`/api/candidates/${candidateId}/drafts/${draftId}`, {
    method: "PATCH",
    body: JSON.stringify({ content, actor_id: "recruiter" }),
  });
}

export async function uploadAudio(
  file: File,
  opts?: { job_reference?: string; job_id?: string; recruiter_id?: string },
): Promise<AudioIngestResponse> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (opts?.job_reference) form.append("job_reference", opts.job_reference);
  if (opts?.job_id) form.append("job_id", opts.job_id);
  if (opts?.recruiter_id) form.append("recruiter_id", opts.recruiter_id);

  const res = await fetch("/api/audio", { method: "POST", body: form });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<AudioIngestResponse>;
}

export async function listMeetingSessions(params?: {
  status?: string;
  limit?: number;
}): Promise<MeetingSession[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return request(`/api/meeting-sessions${qs ? `?${qs}` : ""}`);
}

export async function getDashboard(params?: {
  from_date?: string;
  to_date?: string;
}): Promise<DashboardStats> {
  const search = new URLSearchParams();
  if (params?.from_date) search.set("from_date", params.from_date);
  if (params?.to_date) search.set("to_date", params.to_date);
  const qs = search.toString();
  return request(`/api/dashboard${qs ? `?${qs}` : ""}`);
}

// ---------------------------------------------------------------------------
// Bot sessions (meeting-bot / Recall.ai)
// ---------------------------------------------------------------------------

export async function createBotSession(params: {
  meeting_url: string;
  meeting_label?: string;
  job_reference?: string;
  auto_run?: boolean;
  mode?: string;
}): Promise<BotSession> {
  return request("/api/bot-sessions", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getBotSession(id: string): Promise<BotSession> {
  return request(`/api/bot-sessions/${id}`);
}

export async function listBotSessions(params?: {
  status?: string;
  limit?: number;
}): Promise<BotSession[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.limit)  search.set("limit", String(params.limit));
  const qs = search.toString();
  return request(`/api/bot-sessions${qs ? `?${qs}` : ""}`);
}

export async function cancelBotSession(id: string): Promise<void> {
  await fetch(`/api/bot-sessions/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Schema proposals (General Mode)
// ---------------------------------------------------------------------------

export async function proposeSchema(conversationId: string): Promise<SchemaProposalResponse> {
  return request(`/api/conversations/${conversationId}/schema-proposal`, {
    method: "POST",
  });
}

export async function getGeneralDashboard(): Promise<GeneralDashboardStats> {
  return request("/api/general-dashboard");
}

export async function extractGeneralConversation(
  conversationId: string,
  columns: ProposedColumn[],
  opts?: { templateId?: string; templateVersion?: number },
): Promise<ExtractionCreatedResponse> {
  return request(`/api/conversations/${conversationId}/extract-general`, {
    method: "POST",
    body: JSON.stringify({
      columns,
      template_id:      opts?.templateId      ?? null,
      template_version: opts?.templateVersion ?? null,
    }),
  });
}

// ---------------------------------------------------------------------------
// Schema templates (General Mode)
// ---------------------------------------------------------------------------

export async function listTemplates(): Promise<SchemaTemplate[]> {
  return request("/api/schema-templates");
}

export async function createTemplate(body: SchemaTemplateCreate): Promise<SchemaTemplate> {
  return request("/api/schema-templates", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateTemplate(
  id: string,
  body: SchemaTemplateUpdate,
): Promise<SchemaTemplate> {
  return request(`/api/schema-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await fetch(`/api/schema-templates/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// General Mode exports
// ---------------------------------------------------------------------------

export async function getGeneralExportPayload(
  candidateId: string,
  opts?: { includeTranscript?: boolean },
): Promise<GeneralExport> {
  const qs = opts?.includeTranscript ? "?include_transcript=true" : "";
  return request(`/api/candidates/${candidateId}/general-export/payload${qs}`);
}

export async function downloadGeneralJson(
  candidateId: string,
  opts?: { includeTranscript?: boolean },
): Promise<void> {
  const qs = opts?.includeTranscript ? "?include_transcript=true" : "";
  const res = await fetch(`/api/candidates/${candidateId}/general-export${qs}`);
  if (!res.ok) throw new ApiError(res.status, `Export failed (${res.status})`);
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `general_session_${candidateId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadGeneralCsv(
  candidateId: string,
  opts?: { includeTranscript?: boolean },
): Promise<void> {
  const qs = opts?.includeTranscript ? "?include_transcript=true" : "";
  const res = await fetch(`/api/candidates/${candidateId}/general-export/csv${qs}`);
  if (!res.ok) throw new ApiError(res.status, `Export failed (${res.status})`);
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `general_session_${candidateId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function sendGeneralWebhook(
  candidateId: string,
  webhookUrl: string,
  opts?: { includeTranscript?: boolean; includeSummary?: boolean },
): Promise<WebhookDeliveryResult> {
  return request(`/api/candidates/${candidateId}/general-export/webhook`, {
    method: "POST",
    body: JSON.stringify({
      url:                webhookUrl,
      include_transcript: opts?.includeTranscript ?? false,
      include_summary:    opts?.includeSummary    ?? true,
    }),
  });
}

// ---------------------------------------------------------------------------
// General Mode data explorer
// ---------------------------------------------------------------------------

export async function listGeneralSchemas(): Promise<SchemasListResponse> {
  return request("/api/general-data/schemas");
}

export async function getSchemaRecords(
  schemaId: string,
  params?: { page?: number; limit?: number },
): Promise<RecordsTableResponse> {
  const qs = new URLSearchParams();
  if (params?.page)  qs.set("page",  String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  return request(`/api/general-data/schemas/${encodeURIComponent(schemaId)}/records${q ? `?${q}` : ""}`);
}

// ---------------------------------------------------------------------------
// Study Mode
// ---------------------------------------------------------------------------

export async function extractStudyLecture(params: {
  conversation_id: string;
  template_slug: string;
  title?: string;
  course?: string;
  lecture_date?: string;
}): Promise<StudyExtractionCreatedResponse> {
  return request("/api/study/extract", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getStudyLecture(lectureId: string): Promise<StudyLectureDetail> {
  return request(`/api/study/lectures/${lectureId}`);
}

export async function updateStudyOverview(
  lectureId: string,
  data: { summary?: string },
): Promise<{ updated: boolean }> {
  return request(`/api/study/lectures/${lectureId}/overview`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateStudyFlashcard(
  lectureId: string,
  flashcardId: string,
  data: { front?: string; back?: string },
): Promise<StudyFlashcard> {
  return request(`/api/study/lectures/${lectureId}/flashcards/${flashcardId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateStudyQuestion(
  lectureId: string,
  questionId: string,
  data: { question?: string; answer?: string },
): Promise<StudyQuestion> {
  return request(`/api/study/lectures/${lectureId}/questions/${questionId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function archiveStudyLecture(
  lectureId: string,
): Promise<{ lecture_id: string; archive_status: StudyArchiveStatus }> {
  return request(`/api/study/lectures/${lectureId}/archive`, {
    method: "POST",
  });
}

export { ApiError };
