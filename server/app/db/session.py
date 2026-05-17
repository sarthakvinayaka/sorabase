from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

_engine: Engine | None = None
SessionLocal: sessionmaker[Session] | None = None


def configure_engine(database_url: str) -> None:
    global _engine, SessionLocal
    if _engine is not None:
        return
    _engine = create_engine(database_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    """FastAPI dependency placeholder for future routes."""
    if SessionLocal is None:
        raise RuntimeError("Engine not configured; ensure application lifespan ran.")
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
