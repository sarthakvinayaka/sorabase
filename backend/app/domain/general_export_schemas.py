"""
Pydantic schemas for General Mode exports and webhook delivery.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Export payload
# ---------------------------------------------------------------------------

class GeneralExportField(BaseModel):
    value:            Any
    source:           Literal["ai_extracted", "human_edited"]
    confidence:       float
    evidence_snippet: str | None
    status:           str


class GeneralExport(BaseModel):
    exported_at:      datetime
    candidate_id:     uuid.UUID
    conversation_id:  uuid.UUID
    summary:          str | None
    missing_fields:   list[str]
    ambiguous_fields: list[str]
    template_id:      str | None
    template_version: int | None
    fields:           dict[str, GeneralExportField]
    transcript:       str | None = None   # only present when include_transcript=true


# ---------------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------------

class WebhookDeliveryRequest(BaseModel):
    url:                str
    include_transcript: bool = False
    include_summary:    bool = True


class WebhookDeliveryResult(BaseModel):
    status:        Literal["delivered", "failed"]
    http_status:   int | None
    attempt:       int
    error_message: str | None
    delivered_at:  datetime | None
