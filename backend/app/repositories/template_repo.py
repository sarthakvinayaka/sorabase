"""
CRUD for SchemaTemplate.
"""

from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy.orm import Session

from app.db.models import SchemaTemplate
from app.domain.template_schemas import SchemaTemplateCreate, SchemaTemplateUpdate


def list_templates(db: Session, org_id: uuid.UUID) -> Sequence[SchemaTemplate]:
    return (
        db.query(SchemaTemplate)
        .filter(SchemaTemplate.org_id == org_id)
        .order_by(SchemaTemplate.updated_at.desc())
        .all()
    )


def get_template(db: Session, template_id: uuid.UUID, org_id: uuid.UUID | None = None) -> SchemaTemplate | None:
    template = db.get(SchemaTemplate, template_id)
    if template is None:
        return None
    if org_id is not None and template.org_id != org_id:
        return None
    return template


def create_template(
    db: Session,
    body: SchemaTemplateCreate,
    org_id: uuid.UUID,
    created_by: str = "recruiter",
) -> SchemaTemplate:
    template = SchemaTemplate(
        org_id=org_id,
        name=body.name,
        description=body.description,
        visibility=body.visibility,
        columns=[c.model_dump() for c in body.columns],
        created_by=created_by,
        version=1,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


def update_template(
    db: Session,
    template: SchemaTemplate,
    body: SchemaTemplateUpdate,
) -> SchemaTemplate:
    if body.name is not None:
        template.name = body.name
    if body.description is not None:
        template.description = body.description
    if body.visibility is not None:
        template.visibility = body.visibility
    if body.columns is not None:
        template.columns = [c.model_dump() for c in body.columns]
        template.version = (template.version or 1) + 1
    db.commit()
    db.refresh(template)
    return template


def delete_template(db: Session, template: SchemaTemplate) -> None:
    db.delete(template)
    db.commit()
