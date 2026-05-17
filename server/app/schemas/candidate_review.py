from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.transcription import TranscriptDetailDTO


class ReviewEvidenceDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    evidence_text: str
    model_confidence: float | None = None


class ReviewFieldDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    field_name: str
    group: str
    field_value: str | None
    ai_extracted_value: str | None = None
    confidence: float | None = None
    status: str
    source: str
    edited_at: datetime | None = None
    edited_by_user_id: uuid.UUID | None = None
    evidence_snippets: list[ReviewEvidenceDTO] = Field(default_factory=list)
    is_missing_from_model: bool = False
    is_ambiguous_from_model: bool = False
    needs_attention: bool = False


class ReviewLatestRunDTO(BaseModel):
    id: uuid.UUID
    run_index: int
    status: str
    missing_fields: list[str] = Field(default_factory=list)
    ambiguous_fields: list[str] = Field(default_factory=list)
    provider_model: str | None = None


class ReviewCandidateDTO(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    audio_upload_id: uuid.UUID
    processing_stage: str
    approval_status: str
    extraction_status: str


class ReviewBundleResponse(BaseModel):
    candidate: ReviewCandidateDTO
    transcript: TranscriptDetailDTO | None = None
    latest_extraction_run: ReviewLatestRunDTO | None = None
    fields: list[ReviewFieldDTO] = Field(default_factory=list)
    audio_upload_id: uuid.UUID


class ReviewFieldUpdateItem(BaseModel):
    extracted_field_id: uuid.UUID
    field_value: str | None = None


class ReviewFieldsPatchRequest(BaseModel):
    updates: list[ReviewFieldUpdateItem] = Field(default_factory=list)


class ReviewPatchResponse(BaseModel):
    updated: int


class ReviewActionResponse(BaseModel):
    approval_status: str
    processing_stage: str


class AuditTimelineEntryDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    action: str
    actor_type: str
    actor_user_id: uuid.UUID | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AuditTimelineResponse(BaseModel):
    entries: list[AuditTimelineEntryDTO] = Field(default_factory=list)


class ReviewRejectRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=2000)
