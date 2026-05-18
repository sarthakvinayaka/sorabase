from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analyses, audio, bot_sessions, candidates, conversations, dashboard, drafts, exports, general_dashboard, general_exports, jobs, meeting_sessions, schema_proposals, templates, webhooks

app = FastAPI(
    title="Staffing Recruiter API",
    description="Conversation ingestion, structured extraction, and candidate review.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://www.sorabase.org",
        "https://sorabase.org",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(conversations.router, prefix="/api", tags=["conversations"])
app.include_router(audio.router, prefix="/api", tags=["audio"])
app.include_router(jobs.router, prefix="/api", tags=["jobs"])
app.include_router(candidates.router, prefix="/api", tags=["candidates"])
app.include_router(exports.router, prefix="/api", tags=["exports"])
app.include_router(analyses.router, prefix="/api", tags=["analyses"])
app.include_router(drafts.router, prefix="/api", tags=["drafts"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(webhooks.router, prefix="/api", tags=["webhooks"])
app.include_router(meeting_sessions.router, prefix="/api", tags=["meeting-sessions"])
app.include_router(bot_sessions.router,      prefix="/api", tags=["bot-sessions"])
app.include_router(schema_proposals.router,    prefix="/api", tags=["schema-proposals"])
app.include_router(general_dashboard.router,  prefix="/api", tags=["general-dashboard"])
app.include_router(templates.router,          prefix="/api", tags=["templates"])
app.include_router(general_exports.router,    prefix="/api", tags=["general-exports"])


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
