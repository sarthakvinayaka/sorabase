import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.domain.general_dashboard_schemas import GeneralDashboardStats
from app.repositories import general_dashboard_repo

router = APIRouter()


@router.get("/general-dashboard", response_model=GeneralDashboardStats)
def get_general_dashboard(
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
) -> GeneralDashboardStats:
    return general_dashboard_repo.compute_general_stats(db, org_id)
