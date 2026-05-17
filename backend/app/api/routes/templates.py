"""
CRUD routes for General Mode schema templates.
GET  /api/schema-templates
POST /api/schema-templates
GET  /api/schema-templates/{id}
PATCH /api/schema-templates/{id}
DELETE /api/schema-templates/{id}
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.domain.template_schemas import (
    SchemaTemplateCreate,
    SchemaTemplateRead,
    SchemaTemplateUpdate,
)
from app.repositories import template_repo

router = APIRouter()


def _get_or_404(db: Session, template_id: uuid.UUID):
    t = template_repo.get_template(db, template_id)
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found.")
    return t


@router.get("/schema-templates", response_model=list[SchemaTemplateRead])
def list_templates(db: Session = Depends(get_db)):
    templates = template_repo.list_templates(db)
    return [SchemaTemplateRead.model_validate(t) for t in templates]


@router.post(
    "/schema-templates",
    response_model=SchemaTemplateRead,
    status_code=status.HTTP_201_CREATED,
)
def create_template(body: SchemaTemplateCreate, db: Session = Depends(get_db)):
    t = template_repo.create_template(db, body)
    return SchemaTemplateRead.model_validate(t)


@router.get("/schema-templates/{template_id}", response_model=SchemaTemplateRead)
def get_template(template_id: uuid.UUID, db: Session = Depends(get_db)):
    t = _get_or_404(db, template_id)
    return SchemaTemplateRead.model_validate(t)


@router.patch("/schema-templates/{template_id}", response_model=SchemaTemplateRead)
def update_template(
    template_id: uuid.UUID,
    body: SchemaTemplateUpdate,
    db: Session = Depends(get_db),
):
    t = _get_or_404(db, template_id)
    t = template_repo.update_template(db, t, body)
    return SchemaTemplateRead.model_validate(t)


@router.delete("/schema-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: uuid.UUID, db: Session = Depends(get_db)):
    t = _get_or_404(db, template_id)
    template_repo.delete_template(db, t)
