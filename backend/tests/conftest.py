"""
Test configuration.

Tests run against a real PostgreSQL database. Set TEST_DATABASE_URL in the
environment or in a .env.test file before running. The test suite creates all
tables at the start of the session and drops them afterwards.

  TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/staffing_test pytest
"""

import os
import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/staffing_test",
)

# Patch settings before importing anything that reads them.
os.environ.setdefault("DATABASE_URL", TEST_DATABASE_URL)
os.environ.setdefault("OPENAI_API_KEY", "sk-test-key")

from app.db.models import Base  # noqa: E402 — after env patch
from app.main import app  # noqa: E402
from app.db.session import get_db  # noqa: E402


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture()
def db(engine) -> Session:
    connection = engine.connect()
    transaction = connection.begin()
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = TestingSession()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db) -> TestClient:
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
