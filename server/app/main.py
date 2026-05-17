from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    audio_uploads,
    auth_debug,
    candidate_export,
    candidate_narrative,
    candidate_review,
    dev_transcript_demo,
    extraction_execution,
    health,
    recruiting_analytics,
    transcription,
)
from app.core.config import settings
from app.db.session import configure_engine


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    configure_engine(settings.database_url)
    Path(settings.file_storage_root).expanduser().resolve().mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Pilot API", version="0.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(auth_debug.router, prefix="/v1", tags=["auth"])
app.include_router(audio_uploads.router, prefix="/v1")
app.include_router(dev_transcript_demo.router, prefix="/v1")
app.include_router(transcription.router, prefix="/v1")
app.include_router(extraction_execution.router, prefix="/v1")
app.include_router(candidate_review.router, prefix="/v1")
app.include_router(candidate_export.router, prefix="/v1")
app.include_router(candidate_narrative.router, prefix="/v1")
app.include_router(recruiting_analytics.router, prefix="/v1")
