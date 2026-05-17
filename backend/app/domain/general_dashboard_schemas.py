"""
Response schemas for GET /api/general-dashboard.
"""

from datetime import datetime
from pydantic import BaseModel

from app.domain.api_schemas import CountItem


class GeneralSessionStats(BaseModel):
    total: int
    needs_review: int
    approved: int
    rejected: int
    avg_confidence: float


class GeneralFieldStats(BaseModel):
    field_name: str
    inferred_type: str      # text | number | boolean | list | date
    total_sessions: int
    extracted_count: int
    fill_rate: float        # 0.0–1.0
    avg_confidence: float
    value_counts: list[CountItem]   # boolean/text(enum-like)/list/date
    numeric_avg: float | None       # number fields only
    numeric_min: float | None
    numeric_max: float | None


class GeneralDashboardStats(BaseModel):
    generated_at: datetime
    sessions: GeneralSessionStats
    avg_fill_rate: float
    top_missing_fields: list[CountItem]
    confidence_distribution: list[CountItem]
    fields: list[GeneralFieldStats]
