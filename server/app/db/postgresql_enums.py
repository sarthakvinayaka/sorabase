"""PostgreSQL ENUM columns that store Python :class:`enum.Enum` *values*, not member names."""

from __future__ import annotations

from enum import Enum as PyEnum

from sqlalchemy import Enum as SAEnum


def pg_str_enum(enum_cls: type[PyEnum], *, name: str) -> SAEnum:
    """
    SQLAlchemy's :class:`~sqlalchemy.types.Enum` defaults to enum **member names** as PG labels.
    Our domain enums use ``UPPER = "lower"`` — labels must be the string **values** (e.g. ``bullhorn``).
    """
    return SAEnum(
        enum_cls,
        name=name,
        values_callable=lambda obj: [member.value for member in obj],
    )
