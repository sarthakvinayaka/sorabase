import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.domain.api_schemas import DashboardStats
from app.repositories import dashboard_repo

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard(
    db: Annotated[Session, Depends(get_db)],
    org_id: uuid.UUID = Depends(get_current_org_id),
    from_date: datetime | None = Query(None, description="Filter candidates created on or after this date (ISO 8601)."),
    to_date: datetime | None = Query(None, description="Filter candidates created on or before this date (ISO 8601)."),
) -> DashboardStats:
    return dashboard_repo.compute_stats(db, org_id, from_date=from_date, to_date=to_date)
