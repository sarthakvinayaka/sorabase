"""
Append-only audit log writer. Called after every state-changing operation.
Rows written here are never updated or deleted.
"""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import AuditLog


def log(
    db: Session,
    entity_type: str,
    entity_id: uuid.UUID,
    action: str,
    actor_id: str,
    *,
    old_value: Any = None,
    new_value: Any = None,
    source: str = "system",
) -> None:
    entry = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_id=actor_id,
        old_value=old_value,
        new_value=new_value,
        source=source,
    )
    db.add(entry)
    db.flush()
