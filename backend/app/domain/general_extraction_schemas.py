"""
Domain schemas for General Mode custom extraction.
Separate from the fixed recruiting-mode extraction schemas.
"""

from typing import Literal
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request body — list of user-approved columns
# ---------------------------------------------------------------------------

class ApprovedColumn(BaseModel):
    name: str
    description: str
    type: Literal["text", "number", "boolean", "list", "date"]
    required: bool


class GeneralExtractRequest(BaseModel):
    columns:          list[ApprovedColumn]
    template_id:      str | None = None
    template_version: int | None = None


# ---------------------------------------------------------------------------
# Per-field LLM output shapes — typed so OpenAI gets tight JSON value types.
# ---------------------------------------------------------------------------

FieldStatus = Literal["extracted", "missing", "ambiguous"]


class TextFieldExtraction(BaseModel):
    value:            str | None = None
    confidence:       float = Field(ge=0.0, le=1.0, default=0.0)
    status:           FieldStatus
    evidence_snippet: str | None = None


class NumberFieldExtraction(BaseModel):
    value:            float | None = None
    confidence:       float = Field(ge=0.0, le=1.0, default=0.0)
    status:           FieldStatus
    evidence_snippet: str | None = None


class BooleanFieldExtraction(BaseModel):
    value:            bool | None = None
    confidence:       float = Field(ge=0.0, le=1.0, default=0.0)
    status:           FieldStatus
    evidence_snippet: str | None = None


class ListFieldExtraction(BaseModel):
    value:            list[str] | None = None
    confidence:       float = Field(ge=0.0, le=1.0, default=0.0)
    status:           FieldStatus
    evidence_snippet: str | None = None


class DateFieldExtraction(BaseModel):
    value:            str | None = None
    confidence:       float = Field(ge=0.0, le=1.0, default=0.0)
    status:           FieldStatus
    evidence_snippet: str | None = None


FIELD_TYPE_MAP: dict[str, type] = {
    "text":    TextFieldExtraction,
    "number":  NumberFieldExtraction,
    "boolean": BooleanFieldExtraction,
    "list":    ListFieldExtraction,
    "date":    DateFieldExtraction,
}
