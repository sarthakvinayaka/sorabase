from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RecruitingAnalyticsFiltersApplied(BaseModel):
    organization_id: uuid.UUID
    recruiter_id: uuid.UUID | None = None
    approval_status: str | None = None
    processing_stage: str | None = None
    skill_contains: str | None = None
    work_authorization: str | None = None
    visa_status: str | None = None
    location_contains: str | None = None


class RecruiterOptionDTO(BaseModel):
    id: uuid.UUID
    display_label: str


class RecruitingKpisDTO(BaseModel):
    total_uploads: int
    transcripts_total: int
    transcripts_complete: int
    transcripts_failed: int
    transcription_success_rate: float | None = Field(
        default=None,
        description="complete / (complete + failed); null if no terminal transcripts.",
    )
    extraction_runs_total: int
    extraction_runs_complete: int
    extraction_runs_failed: int
    extraction_success_rate: float | None = None
    candidates_in_scope: int
    candidates_ready_ats_sync: int
    candidates_approved: int
    candidates_synced: int
    avg_upload_to_approval_hours: float | None = None


class NamedCountDTO(BaseModel):
    name: str
    count: int


class RecentCandidateRowDTO(BaseModel):
    id: uuid.UUID
    approval_status: str
    processing_stage: str
    extraction_status: str
    ats_sync_status: str
    internal_title: str | None
    updated_at: datetime
    recruiter_label: str | None
    primary_skills_snippet: str | None


class RecruitingAnalyticsResponse(BaseModel):
    filters_applied: RecruitingAnalyticsFiltersApplied
    kpis: RecruitingKpisDTO
    top_missing_fields: list[NamedCountDTO] = Field(default_factory=list)
    top_skills: list[NamedCountDTO] = Field(default_factory=list)
    work_authorization_mix: list[NamedCountDTO] = Field(default_factory=list)
    visa_status_mix: list[NamedCountDTO] = Field(default_factory=list)
    notice_period_distribution: list[NamedCountDTO] = Field(default_factory=list)
    pipeline_counts: dict[str, int] = Field(default_factory=dict)
    recent_candidates: list[RecentCandidateRowDTO] = Field(default_factory=list)
    recruiter_options: list[RecruiterOptionDTO] = Field(default_factory=list)
