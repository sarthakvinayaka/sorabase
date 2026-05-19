// TypeScript mirrors of backend Pydantic schemas.
// Source of truth: backend/app/domain/extraction_schemas.py + api_schemas.py

export type FieldStatus =
  | "extracted"
  | "missing"
  | "ambiguous"
  | "reviewed"
  | "edited"
  | "confirmed"
  | "unresolved";
export type ApprovalStatus = "needs_review" | "approved" | "rejected";

export type RemotePreference = "remote" | "hybrid" | "onsite" | "flexible" | "unknown";
export type WorkAuthStatus =
  | "authorized_now"
  | "requires_future_sponsorship"
  | "requires_current_sponsorship"
  | "unknown";
export type CompensationPeriod = "annual" | "hourly";

export type FieldValue = string | string[] | number | boolean | null;

export interface ExtractedField {
  id: string;
  field_name: string;
  raw_value: FieldValue;
  normalized_value: FieldValue;
  reviewed_value: FieldValue;
  evidence_snippet: string | null;
  confidence: number;
  status: FieldStatus;
  edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExtractionRun {
  id: string;
  conversation_id: string;
  candidate_id: string;
  missing_fields: string[];
  ambiguous_fields: string[];
  suggested_follow_up_questions: string[];
  candidate_summary: string | null;
  overall_confidence: number | null;
  model_used: string;
  status: string;
  created_at: string;
}

export interface Candidate {
  id: string;
  org_id: string | null;
  latest_extraction_run_id: string | null;
  approval_status: ApprovalStatus;
  created_at: string;
  updated_at: string;
}

export interface CandidateListItem {
  id: string;
  approval_status: ApprovalStatus;
  full_name: string | null;
  candidate_summary: string | null;
  job_reference: string | null;
  extraction_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateListResponse {
  items: CandidateListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface Conversation {
  id: string;
  source_type: string;
  status: string;
  raw_text: string | null;
  char_count: number | null;
  recruiter_id: string | null;
  job_reference: string | null;
  job_id: string | null;
  candidate_id: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  org_id: string | null;
  title: string;
  description: string | null;
  requirements: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateDetail {
  candidate: Candidate;
  extraction: ExtractionRun;
  fields: ExtractedField[];
  conversation: Conversation;
}

export interface ExtractionCreatedResponse {
  candidate_id: string;
  extraction_id: string;
}

export interface ConversationSummary {
  id: string;
  source_type: string;
  status: string;
  transcript_status: string;
  char_count: number | null;
  recruiter_id: string | null;
  job_reference: string | null;
  job_id: string | null;
  candidate_id: string | null;
  source_metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ConversationCreatedResponse {
  id: string;
  source_type: string;
  status: string;
  char_count: number | null;
  recruiter_id: string | null;
  job_reference: string | null;
  job_id: string | null;
  candidate_id: string | null;
  created_at: string;
}

// Human-readable labels for the 35 extracted fields.
export const FIELD_LABELS: Record<string, string> = {
  // Identity / contact
  full_name: "Full Name",
  email: "Email",
  phone: "Phone",
  current_location: "Current Location",
  preferred_location: "Preferred Location",
  // Authorization / visa
  work_authorization: "Work Auth Document",
  work_authorization_status: "Work Auth Status",
  work_authorization_text: "Work Auth (Verbatim)",
  willing_to_relocate: "Willing to Relocate",
  // Work style
  remote_preference: "Remote Preference",
  remote_preference_text: "Remote Preference (Verbatim)",
  // Experience
  current_title: "Current Title",
  years_experience_years: "Years of Experience",
  years_experience_text: "Years of Experience (Verbatim)",
  primary_skills: "Primary Skills",
  secondary_skills: "Secondary Skills",
  domain_experience: "Domain Experience",
  industries_worked_in: "Industries",
  current_company: "Current Company",
  previous_companies: "Previous Companies",
  education: "Education",
  certifications: "Certifications",
  // Preferences / logistics
  target_roles: "Target Roles",
  target_salary_min: "Salary Min",
  target_salary_max: "Salary Max",
  compensation_period: "Compensation Period",
  compensation_text: "Compensation (Verbatim)",
  employment_type_preference: "Employment Type",
  availability_date: "Availability Date",
  notice_period_days: "Notice Period (Days)",
  notice_period_text: "Notice Period (Verbatim)",
  interview_availability: "Interview Availability",
  // Recruiter notes
  client_fit_summary: "Client Fit Summary",
  recruiter_recommendation: "Recruiter Recommendation",
  concerns_or_red_flags: "Concerns / Red Flags",
};

// Ordered display sequence — key identity fields first, then structured
// numeric/enum fields, then free-text companions grouped after their parent.
export const FIELD_ORDER: string[] = [
  // Identity
  "full_name", "current_title", "current_company", "email", "phone",
  "current_location", "preferred_location",
  // Authorization
  "work_authorization", "work_authorization_status", "work_authorization_text",
  "willing_to_relocate",
  // Work style
  "remote_preference", "remote_preference_text",
  // Experience
  "years_experience_years", "years_experience_text",
  "primary_skills", "secondary_skills", "domain_experience",
  "industries_worked_in", "previous_companies", "education", "certifications",
  // Preferences / logistics
  "target_roles",
  "target_salary_min", "target_salary_max", "compensation_period", "compensation_text",
  "employment_type_preference", "availability_date",
  "notice_period_days", "notice_period_text",
  "interview_availability",
  // Recruiter notes
  "client_fit_summary", "recruiter_recommendation", "concerns_or_red_flags",
];

/** Returns the effective display value: reviewed → normalized → raw → null. */
export function effectiveValue(field: ExtractedField): FieldValue {
  if (field.edited && field.reviewed_value !== null) return field.reviewed_value;
  if (field.normalized_value !== null) return field.normalized_value;
  return field.raw_value;
}

/** Format any field value for human display. */
export function displayValue(val: FieldValue): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) return val.join(", ");
  return val;
}

/** Format a salary bound integer as a dollar string. */
export function formatSalaryBound(val: FieldValue): string {
  if (typeof val !== "number") return displayValue(val);
  return `$${val.toLocaleString()}`;
}

/** Returns the AI-extracted value (normalized > raw) — not affected by recruiter edits. */
export function aiValue(field: ExtractedField): FieldValue {
  if (field.normalized_value !== null) return field.normalized_value;
  return field.raw_value;
}

export type DraftType = "candidate_summary" | "submittal";

export interface CandidateDraft {
  id: string;
  candidate_id: string;
  analysis_run_id: string | null;
  draft_type: DraftType;
  content: string;
  edited: boolean;
  created_at: string;
  updated_at: string;
}

export type AnalysisTier =
  | "strong_fit"
  | "good_fit"
  | "partial_fit"
  | "weak_fit"
  | "no_fit";

export interface RequirementAssessment {
  requirement: string;
  met: boolean;
  candidate_evidence: string | null;
  confidence: number;
}

export interface DimensionScore {
  score: number;
  rationale: string;
}

export interface ScoreBreakdown {
  skills: DimensionScore;
  experience: DimensionScore;
  domain: DimensionScore;
  logistics: DimensionScore;
}

export interface AnalysisRun {
  id: string;
  extraction_run_id: string | null;
  candidate_id: string | null;
  job_id: string | null;
  status: string;
  overall_score: number | null;
  overall_tier: AnalysisTier | null;
  score_breakdown: ScoreBreakdown | null;
  hard_requirements_met: RequirementAssessment[] | null;
  hard_requirements_missed: RequirementAssessment[] | null;
  preferred_requirements_met: RequirementAssessment[] | null;
  preferred_requirements_missed: RequirementAssessment[] | null;
  strengths: string[] | null;
  gaps: string[] | null;
  concerns: string[] | null;
  missing_info: string[] | null;
  rationale: string | null;
  suggested_follow_up_questions: string[] | null;
  model_used: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  recruiter_override_score: number | null;
  recruiter_override_reason: string | null;
  score_status: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Dashboard types
// ---------------------------------------------------------------------------

export interface CountItem {
  label: string;
  count: number;
}

export interface DashboardCandidates {
  total: number;
  needs_review: number;
  approved: number;
  rejected: number;
  extraction_completed: number;
}

export interface ExtractionCompleteness {
  avg_confidence: number;
  avg_extracted_count: number;
  avg_missing_count: number;
  top_missing_fields: CountItem[];
}

export interface FitScoreStats {
  analyzed_count: number;
  avg_score: number;
  by_tier: CountItem[];
}

export interface DashboardStats {
  generated_at: string;
  candidates: DashboardCandidates;
  experience_distribution: CountItem[];
  work_auth_status_breakdown: CountItem[];
  work_auth_type_breakdown: CountItem[];
  remote_preference_breakdown: CountItem[];
  notice_period_distribution: CountItem[];
  salary_distribution: CountItem[];
  extraction_completeness: ExtractionCompleteness;
  fit_score_stats: FitScoreStats;
}

export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string;
  old_value: unknown;
  new_value: unknown;
  source: string;
  created_at: string;
  field_name: string | null;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
}

// ---------------------------------------------------------------------------
// Bot session (meeting-bot / Recall.ai flow)
// ---------------------------------------------------------------------------

export type BotSessionStatus =
  | "joining"
  | "waiting_for_admission"
  | "in_meeting"
  | "recording"
  | "transcribing"
  | "ready"
  | "extracting"
  | "complete"
  | "failed";

export interface BotSession {
  id: string;
  provider: string;
  provider_bot_id: string;
  meeting_url: string;
  meeting_label: string | null;
  job_reference: string | null;
  auto_run: boolean;
  mode: string;
  workflow_triggered: boolean;
  status: BotSessionStatus;
  error_message: string | null;
  conversation_id: string | null;
  candidate_id: string | null;
  transcript_chars: number | null;
  created_at: string;
  updated_at: string;
}

export interface BotSessionCreate {
  meeting_url: string;
  meeting_label?: string;
  job_reference?: string;
  auto_run?: boolean;
  mode?: string;
}

export interface MeetingSession {
  id: string;
  source_event_id: string;
  conversation_id: string | null;
  candidate_id: string | null;
  meeting_id: string | null;
  host_email: string | null;
  /** transcribing | extracting | complete | failed */
  status: "transcribing" | "extracting" | "complete" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AudioIngestResponse {
  conversation_id: string;
  source_event_id: string;
  transcript_status: string;
  transcript_ready: boolean;
}

// ---------------------------------------------------------------------------
// General Mode dashboard
// ---------------------------------------------------------------------------

export interface GeneralSessionStats {
  total: number;
  needs_review: number;
  approved: number;
  rejected: number;
  avg_confidence: number;
}

export interface GeneralFieldStats {
  field_name: string;
  inferred_type: string;      // text | number | boolean | list | date
  total_sessions: number;
  extracted_count: number;
  fill_rate: number;
  avg_confidence: number;
  value_counts: CountItem[];
  numeric_avg: number | null;
  numeric_min: number | null;
  numeric_max: number | null;
}

export interface GeneralDashboardStats {
  generated_at: string;
  sessions: GeneralSessionStats;
  avg_fill_rate: number;
  top_missing_fields: CountItem[];
  confidence_distribution: CountItem[];
  fields: GeneralFieldStats[];
}

// ---------------------------------------------------------------------------
// General Mode export
// ---------------------------------------------------------------------------

export interface GeneralExportField {
  value:            FieldValue;
  source:           "ai_extracted" | "human_edited";
  confidence:       number;
  evidence_snippet: string | null;
  status:           string;
}

export interface GeneralExport {
  exported_at:      string;
  candidate_id:     string;
  conversation_id:  string;
  summary:          string | null;
  missing_fields:   string[];
  ambiguous_fields: string[];
  template_id:      string | null;
  template_version: number | null;
  fields:           Record<string, GeneralExportField>;
  transcript:       string | null;
}

export interface WebhookDeliveryResult {
  status:        "delivered" | "failed";
  http_status:   number | null;
  attempt:       number;
  error_message: string | null;
  delivered_at:  string | null;
}

// ---------------------------------------------------------------------------
// Schema templates (General Mode)
// ---------------------------------------------------------------------------

export interface SchemaTemplate {
  id:          string;
  name:        string;
  description: string | null;
  visibility:  string;          // "private" | "workspace"
  version:     number;
  columns:     ProposedColumn[];
  created_by:  string | null;
  created_at:  string;
  updated_at:  string;
}

export interface SchemaTemplateCreate {
  name:        string;
  description: string | null;
  visibility:  string;
  columns:     ProposedColumn[];
}

export interface SchemaTemplateUpdate {
  name?:        string;
  description?: string;
  visibility?:  string;
  columns?:     ProposedColumn[];
}

/** Persisted to localStorage under `sorabase-schema-${conversationId}`. */
export interface StoredSchema {
  columns:          ProposedColumn[];
  templateId?:      string;
  templateVersion?: number;
}

// ---------------------------------------------------------------------------
// Schema proposal (General Mode)
// ---------------------------------------------------------------------------

export type ColumnType = "text" | "number" | "boolean" | "list" | "date";

export interface ProposedColumn {
  name:        string;
  description: string;
  type:        ColumnType;
  required:    boolean;
}

export interface SchemaProposalResponse {
  conversation_id: string;
  columns:         ProposedColumn[];
  rationale:       string;
  model_used:      string;
  generated_at:    string;
}

// ---------------------------------------------------------------------------
// General Mode data explorer
// ---------------------------------------------------------------------------

export interface SchemaInfo {
  schema_id:      string;
  name:           string;
  record_count:   number;
  avg_confidence: number;
  avg_fill_rate:  number;
  last_updated:   string;
  field_names:    string[];
}

export interface SchemasListResponse {
  schemas:      SchemaInfo[];
  generated_at: string;
}

export interface FieldCell {
  value:            FieldValue;
  confidence:       number;
  status:           string;
  evidence_snippet: string | null;
  edited:           boolean;
}

export interface RecordRow {
  record_id:       string;
  run_id:          string;
  created_at:      string;
  approval_status: string;
  confidence:      number;
  fill_rate:       number;
  missing_fields:  string[];
  summary:         string | null;
  source_type:     string | null;
  fields:          Record<string, FieldCell>;
}

export interface RecordsTableResponse {
  schema_id:   string;
  name:        string;
  field_names: string[];
  records:     RecordRow[];
  total:       number;
  page:        number;
  limit:       number;
}
