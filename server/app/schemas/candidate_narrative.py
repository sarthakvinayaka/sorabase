from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class NarrativeGenerationDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    version: int
    recruiter_summary: str
    submittal_draft: str
    generator_provider: str
    context_meta: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    created_by_user_id: uuid.UUID | None = None


class NarrativeLatestResponse(BaseModel):
    generation: NarrativeGenerationDTO | None = None


class NarrativeHistoryResponse(BaseModel):
    versions: list[NarrativeGenerationDTO] = Field(default_factory=list)
