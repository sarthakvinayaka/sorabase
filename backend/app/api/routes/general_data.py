import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.domain.general_data_schemas import RecordsTableResponse, SchemasListResponse
from app.repositories import general_data_repo

router = APIRouter()


@router.get("/general-data/schemas", response_model=SchemasListResponse)
def list_schemas(
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
) -> SchemasListResponse:
    return general_data_repo.list_schemas(db, org_id)


@router.get("/general-data/schemas/{schema_id}/records", response_model=RecordsTableResponse)
def get_schema_records(
    schema_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
) -> RecordsTableResponse:
    return general_data_repo.get_schema_records(db, org_id, schema_id, page=page, limit=limit)
