"""
API-facing Pydantic schemas: inbound request bodies and outbound response shapes.
These are the contracts between the FastAPI layer and external clients / the frontend.
"""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Inbound request schemas
# ---------------------------------------------------------------------------

class ConversationCreate(BaseModel):
    raw_text: str = Field(..., min_length=50, description="Raw transcript text.")
    recruiter_id: str | None = None
    job_reference: str | None = None
    job_id: uuid.UUID | None = None
    source_type: str = "transcript"


class JobCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    requirements: str | None = None


class JobUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    requirements: str | None = None
    status: Literal["open", "filled", "cancelled"] | None = None


class FieldEditRequest(BaseModel):
    reviewed_value: Any = Field(..., description="Typed value set by the recruiter.")
    actor_id: str = "recruiter"


class ApprovalUpdateRequest(BaseModel):
    approval_status: Literal["needs_review", "approved", "rejected"]
    actor_id: str = "recruiter"


class FieldActionRequest(BaseModel):
    """Body for confirm / unresolve field actions — no value change, just a status transition."""
    actor_id: str = "recruiter"


class SummaryGenerateRequest(BaseModel):
    actor_id: str = "recruiter"


class SubmittalGenerateRequest(BaseModel):
    analysis_run_id: uuid.UUID
    actor_id: str = "recruiter"


class DraftEditRequest(BaseModel):
    content: str = Field(..., min_length=1)
    actor_id: str = "recruiter"


# ---------------------------------------------------------------------------
# Outbound response schemas
# ---------------------------------------------------------------------------

class ConversationSummary(BaseModel):
    """Lightweight shape for list responses — omits raw_text to keep payloads small."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_type: str
    status: str
    transcript_status: str
    char_count: int | None
    recruiter_id: str | None
    job_reference: str | None
    job_id: uuid.UUID | None
    candidate_id: uuid.UUID | None
    source_metadata: dict[str, Any] | None
    created_at: datetime


class ConversationRead(BaseModel):
    """Full conversation shape including raw_text for single-record responses."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_type: str
    status: str
    transcript_status: str
    raw_text: str | None
    char_count: int | None
    recruiter_id: str | None
    job_reference: str | None
    job_id: uuid.UUID | None
    candidate_id: uuid.UUID | None
    created_at: datetime


class SourceEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_type: str
    external_id: str | None
    status: str
    error_message: str | None
    conversation_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class MediaReferenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    source_event_id: uuid.UUID | None
    ref_type: str
    storage_url: str | None
    storage_key: str | None
    mime_type: str | None
    duration_seconds: int | None
    size_bytes: int | None
    transcription_status: str
    created_at: datetime
    updated_at: datetime


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID | None
    title: str
    description: str | None
    requirements: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class ExtractedFieldRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    field_name: str
    raw_value: Any
    normalized_value: Any
    reviewed_value: Any
    evidence_snippet: str | None
    confidence: float
    status: str
    edited: bool
    created_at: datetime
    updated_at: datetime


class ExtractionRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: uuid.UUID
    conversation_id: uuid.UUID
    candidate_id: uuid.UUID
    missing_fields: list[str]
    ambiguous_fields: list[str]
    suggested_follow_up_questions: list[str]
    candidate_summary: str | None
    overall_confidence: float | None
    model_used: str
    status: str
    created_at: datetime


class CandidateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID | None
    latest_extraction_run_id: uuid.UUID | None
    approval_status: str
    created_at: datetime
    updated_at: datetime


class CandidateListItem(BaseModel):
    """Lightweight candidate summary for the queue / list view."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    approval_status: str
    full_name: str | None
    candidate_summary: str | None
    job_reference: str | None
    extraction_status: str | None
    created_at: datetime
    updated_at: datetime


class CandidateListResponse(BaseModel):
    items: list[CandidateListItem]
    total: int
    page: int
    limit: int


class AnalysisTriggerRequest(BaseModel):
    job_id: uuid.UUID
    actor_id: str = "recruiter"


class ScoreOverrideRequest(BaseModel):
    override_score: int = Field(..., ge=0, le=100, description="0–100. UI sends 0–10, multiply ×10 before posting.")
    override_reason: str = Field(..., min_length=1)
    actor_id: str = "recruiter"


class RequirementAssessmentRead(BaseModel):
    requirement: str
    met: bool
    candidate_evidence: str | None
    confidence: float


class DimensionScoreRead(BaseModel):
    score: int
    rationale: str


class AnalysisRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: uuid.UUID
    extraction_run_id: uuid.UUID | None
    candidate_id: uuid.UUID | None
    job_id: uuid.UUID | None
    status: str
    overall_score: int | None
    overall_tier: str | None
    score_breakdown: dict[str, Any] | None          # {skills,experience,domain,logistics: {score,rationale}}
    hard_requirements_met: list[Any] | None
    hard_requirements_missed: list[Any] | None
    preferred_requirements_met: list[Any] | None
    preferred_requirements_missed: list[Any] | None
    strengths: list[str] | None
    gaps: list[str] | None
    concerns: list[str] | None
    missing_info: list[str] | None
    rationale: str | None
    suggested_follow_up_questions: list[str] | None
    model_used: str | None
    prompt_tokens: int | None
    completion_tokens: int | None
    results: Any
    recruiter_override_score: int | None
    recruiter_override_reason: str | None
    score_status: str
    created_at: datetime


class CandidateDetail(BaseModel):
    """Full payload for the recruiter review page."""
    candidate: CandidateRead
    extraction: ExtractionRunRead
    fields: list[ExtractedFieldRead]
    conversation: ConversationRead


class ExtractionCreatedResponse(BaseModel):
    candidate_id: uuid.UUID
    extraction_id: uuid.UUID


class AudioIngestResponse(BaseModel):
    conversation_id: uuid.UUID
    source_event_id: uuid.UUID
    transcript_status: str        # "ready" after synchronous Whisper transcription
    transcript_ready: bool


class CandidateDraftRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    candidate_id: uuid.UUID
    analysis_run_id: uuid.UUID | None
    draft_type: str
    content: str
    edited: bool
    created_at: datetime
    updated_at: datetime


class AuditLogEntry(BaseModel):
    """One row from the audit_logs table, enriched with field_name when applicable."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    action: str
    actor_id: str
    old_value: Any
    new_value: Any
    source: str
    created_at: datetime
    field_name: str | None = None  # populated when entity_type == "field"


class AuditLogResponse(BaseModel):
    entries: list[AuditLogEntry]
    total: int


# ---------------------------------------------------------------------------
# Export schema
# ---------------------------------------------------------------------------

class ExportField(BaseModel):
    value: Any
    source: Literal["ai_extracted", "human_edited"]
    confidence: float
    evidence_snippet: str | None
    status: str


class CandidateExport(BaseModel):
    exported_at: datetime
    candidate_id: uuid.UUID
    conversation_id: uuid.UUID
    candidate_summary: str | None
    missing_fields: list[str]
    ambiguous_fields: list[str]
    suggested_follow_up_questions: list[str]
    fields: dict[str, ExportField]
    latest_analysis: AnalysisRunRead | None = None
    summary_draft: str | None = None           # latest candidate_summary draft content
    submittal_draft: str | None = None         # latest submittal draft content
    submittal_draft_job_id: uuid.UUID | None = None


# ---------------------------------------------------------------------------
# Bot session schemas (meeting-bot / Recall.ai flow)
# ---------------------------------------------------------------------------

class BotSessionCreate(BaseModel):
    meeting_url: str = Field(..., description="Full Zoom/Meet/Teams meeting URL")
    meeting_label: str | None = Field(None, description="Recruiter-provided label for this session")
    job_reference: str | None = None
    auto_run: bool = Field(True, description="Automatically run extraction when transcript is ready")
    mode: str = Field("recruiting", description="'recruiting' runs extraction; 'general' stops at ready for schema review")


class BotSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                uuid.UUID
    provider:          str
    provider_bot_id:   str
    meeting_url:       str
    meeting_label:     str | None
    job_reference:     str | None
    auto_run:          bool
    mode:              str
    workflow_triggered: bool
    status:            str   # joining|waiting_for_admission|in_meeting|recording|transcribing|ready|extracting|complete|failed
    error_message:     str | None
    conversation_id:   uuid.UUID | None
    candidate_id:      uuid.UUID | None
    transcript_chars:  int | None
    created_at:        datetime
    updated_at:        datetime


# ---------------------------------------------------------------------------
# Meeting session schemas
# ---------------------------------------------------------------------------

class MeetingSessionRead(BaseModel):
    """Lifecycle record for one auto-triggered Zoom workflow run."""
    model_config = ConfigDict(from_attributes=True)

    id:              uuid.UUID
    source_event_id: uuid.UUID
    conversation_id: uuid.UUID | None
    candidate_id:    uuid.UUID | None
    meeting_id:      str | None
    host_email:      str | None
    status:          str          # transcribing | extracting | complete | failed
    error_message:   str | None
    created_at:      datetime
    updated_at:      datetime


# ---------------------------------------------------------------------------
# Dashboard schemas
# ---------------------------------------------------------------------------

class CountItem(BaseModel):
    label: str
    count: int


class DashboardCandidates(BaseModel):
    total: int
    needs_review: int
    approved: int
    rejected: int
    extraction_completed: int


class ExtractionCompleteness(BaseModel):
    avg_confidence: float
    avg_extracted_count: float
    avg_missing_count: float
    top_missing_fields: list[CountItem]


class FitScoreStats(BaseModel):
    analyzed_count: int
    avg_score: float
    by_tier: list[CountItem]


class DashboardStats(BaseModel):
    generated_at: datetime
    candidates: DashboardCandidates
    experience_distribution: list[CountItem]
    work_auth_status_breakdown: list[CountItem]
    work_auth_type_breakdown: list[CountItem]
    remote_preference_breakdown: list[CountItem]
    notice_period_distribution: list[CountItem]
    salary_distribution: list[CountItem]
    extraction_completeness: ExtractionCompleteness
    fit_score_stats: FitScoreStats
