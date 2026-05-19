"""Pydantic schemas for the General Mode schema-first data explorer."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class FieldCell(BaseModel):
    value:            Any
    confidence:       float
    status:           str
    evidence_snippet: str | None
    edited:           bool


class RecordRow(BaseModel):
    record_id:       str        # candidate_id
    run_id:          str        # extraction_run_id
    created_at:      datetime
    approval_status: str
    confidence:      float
    fill_rate:       float
    missing_fields:  list[str]
    summary:         str | None
    source_type:     str | None
    fields:          dict[str, FieldCell]


class RecordsTableResponse(BaseModel):
    schema_id:   str
    name:        str
    field_names: list[str]  # canonical ordered column list for this schema
    records:     list[RecordRow]
    total:       int
    page:        int
    limit:       int


class SchemaInfo(BaseModel):
    schema_id:      str
    name:           str
    record_count:   int
    avg_confidence: float
    avg_fill_rate:  float
    last_updated:   datetime
    field_names:    list[str]


class SchemasListResponse(BaseModel):
    schemas:      list[SchemaInfo]
    generated_at: datetime
