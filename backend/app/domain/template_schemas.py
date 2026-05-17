"""
Pydantic schemas for schema template CRUD.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ProposedColumnSchema(BaseModel):
    name:        str
    description: str
    type:        str   # text | number | boolean | list | date
    required:    bool


class SchemaTemplateCreate(BaseModel):
    name:        str
    description: str | None = None
    visibility:  str = "private"   # private | workspace
    columns:     list[ProposedColumnSchema]


class SchemaTemplateUpdate(BaseModel):
    name:        str | None = None
    description: str | None = None
    visibility:  str | None = None
    columns:     list[ProposedColumnSchema] | None = None


class SchemaTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:          str
    name:        str
    description: str | None
    visibility:  str
    version:     int
    columns:     list[Any]   # list[{name, description, type, required}]
    created_by:  str | None
    created_at:  datetime
    updated_at:  datetime
