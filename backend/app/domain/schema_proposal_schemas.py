"""
Schemas for AI-generated schema proposals (General Mode).

LLM-facing: SchemaProposalLLMResponse — passed to OpenAI Structured Outputs.
API-facing: SchemaProposalResponse   — returned to clients.
"""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class ColumnType(str, Enum):
    TEXT    = "text"
    NUMBER  = "number"
    BOOLEAN = "boolean"
    LIST    = "list"
    DATE    = "date"


class ProposedColumn(BaseModel):
    """One AI-suggested extraction column."""
    name:        str        = Field(description="snake_case column name, e.g. meeting_purpose")
    description: str        = Field(description="1–2 sentences explaining what this column captures and how it is used")
    type:        ColumnType
    required:    bool       = Field(description="true if this information is very likely to be present; false if optional")


# ---------------------------------------------------------------------------
# LLM-facing (OpenAI Structured Outputs response_format)
# ---------------------------------------------------------------------------

class SchemaProposalLLMResponse(BaseModel):
    """
    Structured output schema for schema proposal generation.
    Passed to client.beta.chat.completions.parse(response_format=...).
    """
    columns:   list[ProposedColumn] = Field(
        description="Exactly 5–15 proposed columns for structuring this conversation",
    )
    rationale: str = Field(
        description="2–4 sentences explaining why these columns were chosen for this specific conversation",
    )


# ---------------------------------------------------------------------------
# API-facing (returned to frontend clients)
# ---------------------------------------------------------------------------

class SchemaProposalResponse(BaseModel):
    """Response returned to the client for a schema proposal request."""
    conversation_id: uuid.UUID
    columns:         list[ProposedColumn]
    rationale:       str
    model_used:      str
    generated_at:    datetime
