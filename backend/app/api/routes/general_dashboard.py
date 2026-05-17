from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.domain.general_dashboard_schemas import GeneralDashboardStats
from app.repositories import general_dashboard_repo

router = APIRouter()


@router.get("/general-dashboard", response_model=GeneralDashboardStats)
def get_general_dashboard(db: Session = Depends(get_db)) -> GeneralDashboardStats:
    return general_dashboard_repo.compute_general_stats(db)
