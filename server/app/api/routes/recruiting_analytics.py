"""Recruiting operations analytics (aggregates for agency managers)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.recruiting_analytics import RecruitingAnalyticsResponse
from app.services.recruiting_analytics_service import RecruitingAnalyticsService

router = APIRouter(tags=["analytics"])


@router.get("/analytics/recruiting", response_model=RecruitingAnalyticsResponse)
def get_recruiting_analytics(
    db: Annotated[Session, Depends(get_db)],
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope.")],
    recruiter_id: Annotated[uuid.UUID | None, Query(description="Filter by candidate created_by recruiter.")] = None,
    approval_status: Annotated[str | None, Query()] = None,
    processing_stage: Annotated[str | None, Query()] = None,
    skill_contains: Annotated[str | None, Query(description="Case-insensitive match on latest primary_skills.")] = None,
    work_authorization: Annotated[str | None, Query()] = None,
    visa_status: Annotated[str | None, Query()] = None,
    location_contains: Annotated[str | None, Query(description="Match on latest current_location.")] = None,
) -> RecruitingAnalyticsResponse:
    svc = RecruitingAnalyticsService(db)
    return svc.get_dashboard(
        organization_id=organization_id,
        recruiter_id=recruiter_id,
        approval_status=approval_status,
        processing_stage=processing_stage,
        skill_contains=skill_contains,
        work_authorization=work_authorization,
        visa_status=visa_status,
        location_contains=location_contains,
    )
