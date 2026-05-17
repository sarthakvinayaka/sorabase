from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LatestExtractionRunDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    run_index: int
    status: str
    provider_model: str | None = None
    error_message: str | None = None
    missing_fields: list[str] = Field(default_factory=list)
    ambiguous_fields: list[str] = Field(default_factory=list)
    created_at: datetime
    completed_at: datetime | None = None


class UploadPipelineDTO(BaseModel):
    """Snapshot for one upload's primary candidate (first by created_at)."""

    model_config = ConfigDict(from_attributes=True)

    candidate_id: uuid.UUID
    processing_stage: str
    extraction_status: str
    approval_status: str
    ats_sync_status: str
    confidence_overall: float | None = None
    latest_extraction_run: LatestExtractionRunDTO | None = None


class ExtractionTriggerResponse(BaseModel):
    extraction_run_id: uuid.UUID
    status: str
    candidate_id: uuid.UUID
    processing_stage: str
    extraction_status: str
    approval_status: str
    confidence_overall: float | None = None
    missing_fields: list[str] = Field(default_factory=list)
    ambiguous_fields: list[str] = Field(default_factory=list)
