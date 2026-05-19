import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean,
    DateTime, ForeignKey, JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Job(Base):
    """A position being filled. Optional — conversations may reference a job."""

    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    requirements = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="open")  # open | filled | cancelled
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    conversations = relationship("Conversation", back_populates="job")


class Candidate(Base):
    """
    A real person identity. Decoupled from any single conversation — one candidate
    can appear across multiple conversations (initial screen, follow-up, re-engagement).
    latest_extraction_run_id is a denormalized pointer; no FK constraint to avoid
    circular dependency with ExtractionRun.
    """

    __tablename__ = "candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=True)
    latest_extraction_run_id = Column(UUID(as_uuid=True), nullable=True)
    approval_status = Column(String(50), nullable=False, default="needs_review")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    conversations = relationship("Conversation", back_populates="candidate")
    extraction_runs = relationship(
        "ExtractionRun", back_populates="candidate", foreign_keys="ExtractionRun.candidate_id"
    )


class Conversation(Base):
    """
    Source node. A single sourcing event — transcript, audio call, Zoom recording, notes, etc.
    source_type describes the medium; raw_text holds the extracted text for current transcript flow.
    """

    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=True)
    source_type = Column(String(50), nullable=False, default="transcript")
    status = Column(String(50), nullable=False, default="raw")  # raw | processing | extracted | failed
    raw_text = Column(Text, nullable=True)
    char_count = Column(Integer, nullable=True)
    recruiter_id = Column(String(255), nullable=True)
    job_reference = Column(String(255), nullable=True)
    # Structured references — optional.
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=True)
    # Arbitrary source metadata (e.g., recording URL, meeting ID).
    source_metadata = Column(JSON, nullable=True)
    # transcript_status tracks whether raw_text is ready for extraction.
    # 'pending' = awaiting transcription (audio/webhook sources).
    # 'ready'   = raw_text is populated and extraction can proceed.
    transcript_status = Column(String(50), nullable=False, default="ready")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    job = relationship("Job", back_populates="conversations")
    candidate = relationship("Candidate", back_populates="conversations")
    extraction_runs = relationship("ExtractionRun", back_populates="conversation")
    source_events = relationship("SourceEvent", back_populates="conversation")
    media_references = relationship("MediaReference", back_populates="conversation")


class ExtractionRun(Base):
    """
    Extraction node. Immutable snapshot of one OpenAI extraction run against a conversation.
    Never mutated after creation — re-extractions produce a new row.
    """

    __tablename__ = "extraction_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=True)
    conversation_id = Column(
        UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False
    )
    candidate_id = Column(
        UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False
    )
    # Future: prompt template versioning.
    template_id = Column(String(100), nullable=True)
    missing_fields = Column(JSON, nullable=False, default=list)
    ambiguous_fields = Column(JSON, nullable=False, default=list)
    suggested_follow_up_questions = Column(JSON, nullable=False, default=list)
    candidate_summary = Column(Text, nullable=True)
    overall_confidence = Column(Float, nullable=True)
    model_used = Column(String(100), nullable=False)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    status = Column(String(50), nullable=False, default="pending")  # pending | completed | failed
    raw_response = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="extraction_runs")
    candidate = relationship(
        "Candidate", back_populates="extraction_runs", foreign_keys=[candidate_id]
    )
    fields = relationship("ExtractedField", back_populates="extraction_run")


class ExtractedField(Base):
    """
    One row per field per extraction run. raw_value is frozen at extraction time.
    normalized_value is the post-processed value. reviewed_value is set by recruiter edits.
    Effective display value: reviewed_value ?? normalized_value ?? raw_value.
    """

    __tablename__ = "extracted_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=True)
    extraction_run_id = Column(
        UUID(as_uuid=True), ForeignKey("extraction_runs.id"), nullable=False
    )
    field_name = Column(String(100), nullable=False)
    raw_value = Column(JSON, nullable=True)
    normalized_value = Column(JSON, nullable=True)
    reviewed_value = Column(JSON, nullable=True)
    evidence_snippet = Column(Text, nullable=True)
    confidence = Column(Float, nullable=False, default=0.0)
    status = Column(String(50), nullable=False)  # extracted | missing | ambiguous | reviewed | edited | confirmed | unresolved
    edited = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    extraction_run = relationship("ExtractionRun", back_populates="fields")


class AnalysisRun(Base):
    """
    Analysis node. One row per candidate × job evaluation.
    Produced by analysis_service.run_analysis() after the recruiter has reviewed
    the extraction. Stores both a full raw LLM dump (results) and typed columns
    for efficient querying and UI rendering.
    """

    __tablename__ = "analysis_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=True)
    extraction_run_id = Column(
        UUID(as_uuid=True), ForeignKey("extraction_runs.id"), nullable=True
    )
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    status = Column(String(50), nullable=False, default="pending")  # pending | completed | failed

    # Typed scoring columns (populated on status="completed")
    overall_score = Column(Integer, nullable=True)           # 0–100
    overall_tier = Column(String(50), nullable=True)         # strong_fit | good_fit | partial_fit | weak_fit | no_fit
    # {skills:{score,rationale}, experience:{score,rationale}, domain:{score,rationale}, logistics:{score,rationale}}
    score_breakdown = Column(JSON, nullable=True)
    hard_requirements_met = Column(JSON, nullable=True)      # list[RequirementAssessment dict]
    hard_requirements_missed = Column(JSON, nullable=True)
    preferred_requirements_met = Column(JSON, nullable=True)
    preferred_requirements_missed = Column(JSON, nullable=True)
    strengths = Column(JSON, nullable=True)                  # list[str]
    gaps = Column(JSON, nullable=True)
    concerns = Column(JSON, nullable=True)
    missing_info = Column(JSON, nullable=True)
    rationale = Column(Text, nullable=True)
    suggested_follow_up_questions = Column(JSON, nullable=True)
    model_used = Column(String(100), nullable=True)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)

    results = Column(JSON, nullable=True)   # full raw LLM response for debugging

    # Recruiter override (set via PATCH /analyses/{id}/override)
    recruiter_override_score  = Column(Integer, nullable=True)   # 0–100
    recruiter_override_reason = Column(Text, nullable=True)
    score_status = Column(String(50), nullable=False, default="ai_scored")  # ai_scored | overridden

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class CandidateDraft(Base):
    """
    Recruiter-ready prose output: a candidate summary or a job-specific submittal.
    Generated by the LLM from reviewed field data; editable by the recruiter.
    Edits overwrite content in place — drafts are working documents, not audit records.
    """

    __tablename__ = "candidate_drafts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=True)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False)
    analysis_run_id = Column(
        UUID(as_uuid=True), ForeignKey("analysis_runs.id"), nullable=True
    )  # null for candidate_summary; set for submittal
    draft_type = Column(String(50), nullable=False)  # candidate_summary | submittal
    content = Column(Text, nullable=False)
    edited = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class SourceEvent(Base):
    """
    Raw ingest record — one row per sourcing event (paste, webhook, upload).
    Immutable after creation. Stores the raw payload and external IDs for
    deduplication/retry. Links to the Conversation it created or updated.
    """

    __tablename__ = "source_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=True)
    source_type = Column(String(50), nullable=False)   # transcript | audio | zoom | google_meet | whatsapp
    external_id = Column(String(255), nullable=True)   # Zoom meeting ID, WhatsApp thread ID — for dedup
    raw_payload = Column(JSON, nullable=True)           # full ingest metadata (no transcript text)
    status = Column(String(50), nullable=False, default="received")  # received | processing | ready | failed
    error_message = Column(Text, nullable=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="source_events")


class MediaReference(Base):
    """
    Audio/video/file pointer attached to a conversation.
    Transcription state lives here so Conversation stays clean.
    Populated by audio/meeting adapters; null for transcript-only conversations.
    """

    __tablename__ = "media_references"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    source_event_id = Column(UUID(as_uuid=True), ForeignKey("source_events.id"), nullable=True)
    ref_type = Column(String(50), nullable=False)       # recording | audio_upload | voice_note | attachment
    storage_url = Column(Text, nullable=True)            # presigned or public URL
    storage_key = Column(String(500), nullable=True)    # S3/GCS object key
    mime_type = Column(String(100), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    size_bytes = Column(Integer, nullable=True)
    transcription_status = Column(String(50), nullable=False, default="pending")  # pending | processing | completed | failed
    transcript_text = Column(Text, nullable=True)        # output of Whisper / transcription service
    whisper_response = Column(JSON, nullable=True)        # full verbose_json from Whisper (segments, timestamps)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="media_references")
    source_event = relationship("SourceEvent")


class MeetingSession(Base):
    """
    Tracks the full lifecycle of an auto-triggered Zoom meeting workflow.
    Created when recording.completed webhook arrives; updated as the background
    task progresses through transcription → extraction → complete.
    """

    __tablename__ = "meeting_sessions"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id          = Column(UUID(as_uuid=True), nullable=True)
    source_event_id = Column(UUID(as_uuid=True), ForeignKey("source_events.id"), nullable=False)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True)
    candidate_id    = Column(UUID(as_uuid=True), ForeignKey("candidates.id"),    nullable=True)

    meeting_id  = Column(String(255), nullable=True)   # Zoom meeting UUID
    host_email  = Column(String(255), nullable=True)

    # transcribing → extracting → complete | failed
    status        = Column(String(50), nullable=False, default="transcribing")
    error_message = Column(Text, nullable=True)

    # "recruiting" runs full extraction; "general" stops at ready for schema review
    mode = Column(String(50), nullable=False, default="recruiting")

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class BotSession(Base):
    """
    Tracks the full lifecycle of a meeting-bot session.
    Created when the recruiter clicks 'Send bot'; updated via provider webhook events.

    Status progression (terminal states: complete | failed):
      joining → waiting_for_admission → in_meeting → recording
             → transcribing → ready → extracting → complete | failed

    Separate from MeetingSession, which handles the Zoom cloud-recording path.
    """

    __tablename__ = "bot_sessions"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id           = Column(UUID(as_uuid=True), nullable=True)

    # Bot provider
    provider         = Column(String(50),  nullable=False, default="recall")  # recall | native
    provider_bot_id  = Column(String(255), nullable=False, unique=True)

    # Meeting info (supplied by recruiter)
    meeting_url      = Column(Text,         nullable=False)
    meeting_label    = Column(String(255),  nullable=True)
    job_reference    = Column(String(255),  nullable=True)

    # Workflow config
    auto_run          = Column(Boolean, nullable=False, default=True)
    workflow_triggered = Column(Boolean, nullable=False, default=False)  # idempotency guard

    # Lifecycle
    status           = Column(String(50), nullable=False, default="joining")
    error_message    = Column(Text,       nullable=True)

    # Downstream pipeline links (populated as steps complete)
    conversation_id  = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True)
    candidate_id     = Column(UUID(as_uuid=True), ForeignKey("candidates.id"),    nullable=True)

    # Transcript artifact metadata
    transcript_chars = Column(Integer, nullable=True)

    # Append-only audit log: every webhook event received is stored here
    webhook_events   = Column(JSON, nullable=False, default=list)

    # "recruiting" runs full extraction; "general" stops at ready for schema review
    mode = Column(String(50), nullable=False, default="recruiting")

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class SchemaTemplate(Base):
    """
    Reusable extraction schema for General Mode.
    Version is incremented in-place on every column update.
    Historical schemas are frozen in ExtractionRun.raw_response so
    existing records always reflect the schema that was actually used.
    """

    __tablename__ = "schema_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    visibility = Column(String(50), nullable=False, default="private")  # private | workspace
    version = Column(Integer, nullable=False, default=1)
    columns = Column(JSON, nullable=False)   # list[{name, description, type, required}]
    created_by = Column(String(255), nullable=True, default="recruiter")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class AuditLog(Base):
    """Append-only event log. Rows are never updated or deleted."""

    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(50), nullable=False)
    actor_id = Column(String(255), nullable=False, default="system")
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    source = Column(String(50), nullable=False, default="system")  # system | human
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


# ---------------------------------------------------------------------------
# Study Mode
# ---------------------------------------------------------------------------

class StudyLecture(Base):
    """
    Primary Study Mode entity. One row per lecture ingested by a user.
    org_id is the isolation boundary — every query must filter by it.
    Child records (concepts, definitions, formulas, flashcards, questions)
    inherit isolation through their lecture_id FK; no direct org_id needed
    on child tables because ownership is always verified via the parent lecture.
    """

    __tablename__ = "study_lectures"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id          = Column(UUID(as_uuid=True), nullable=False, index=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    title           = Column(String(500), nullable=True)
    course          = Column(String(255), nullable=True, index=True)
    lecture_date    = Column(String(20),  nullable=True)   # ISO date "YYYY-MM-DD"
    template_slug   = Column(String(100), nullable=False, default="lecture_notes")
    archive_status  = Column(String(50),  nullable=False, default="needs_review")  # needs_review | archived | discarded
    summary         = Column(Text, nullable=True)
    topics              = Column(JSON, nullable=False, default=list)   # list[str]
    learning_objectives = Column(JSON, nullable=False, default=list)   # list[str]
    transcript      = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    extraction_runs = relationship(
        "StudyExtractionRun", back_populates="lecture",
        order_by="desc(StudyExtractionRun.created_at)",
    )
    concepts    = relationship("StudyConcept",    back_populates="lecture", cascade="all, delete-orphan")
    definitions = relationship("StudyDefinition", back_populates="lecture", cascade="all, delete-orphan")
    formulas    = relationship("StudyFormula",    back_populates="lecture", cascade="all, delete-orphan")
    flashcards  = relationship("StudyFlashcard",  back_populates="lecture", cascade="all, delete-orphan")
    questions   = relationship("StudyQuestion",   back_populates="lecture", cascade="all, delete-orphan")


class StudyExtractionRun(Base):
    """
    Tracks one AI extraction job against a StudyLecture.
    org_id is stored directly so processing jobs can be looked up without
    joining through the lecture (e.g. polling endpoint, background worker).
    """

    __tablename__ = "study_extraction_runs"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id     = Column(UUID(as_uuid=True), nullable=False, index=True)
    lecture_id = Column(UUID(as_uuid=True), ForeignKey("study_lectures.id"), nullable=False, index=True)
    status     = Column(String(50), nullable=False, default="pending")  # pending | running | done | error
    model_used = Column(String(100), nullable=True)
    error_message     = Column(Text,    nullable=True)
    prompt_tokens     = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    lecture = relationship("StudyLecture", back_populates="extraction_runs")


class StudyConcept(Base):
    __tablename__ = "study_concepts"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lecture_id       = Column(UUID(as_uuid=True), ForeignKey("study_lectures.id"), nullable=False, index=True)
    concept          = Column(String(500), nullable=False)
    explanation      = Column(Text,        nullable=False)
    confidence       = Column(Float,       nullable=False, default=0.0)
    evidence_snippet = Column(Text,        nullable=True)
    created_at       = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    lecture = relationship("StudyLecture", back_populates="concepts")


class StudyDefinition(Base):
    __tablename__ = "study_definitions"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lecture_id       = Column(UUID(as_uuid=True), ForeignKey("study_lectures.id"), nullable=False, index=True)
    term             = Column(String(500), nullable=False)
    definition       = Column(Text,        nullable=False)
    confidence       = Column(Float,       nullable=False, default=0.0)
    evidence_snippet = Column(Text,        nullable=True)
    created_at       = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    lecture = relationship("StudyLecture", back_populates="definitions")


class StudyFormula(Base):
    __tablename__ = "study_formulas"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lecture_id       = Column(UUID(as_uuid=True), ForeignKey("study_lectures.id"), nullable=False, index=True)
    notation         = Column(Text,  nullable=False)
    description      = Column(Text,  nullable=False)
    example          = Column(Text,  nullable=True)
    confidence       = Column(Float, nullable=False, default=0.0)
    evidence_snippet = Column(Text,  nullable=True)
    created_at       = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    lecture = relationship("StudyLecture", back_populates="formulas")


class StudyFlashcard(Base):
    __tablename__ = "study_flashcards"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lecture_id       = Column(UUID(as_uuid=True), ForeignKey("study_lectures.id"), nullable=False, index=True)
    front            = Column(Text,        nullable=False)
    back             = Column(Text,        nullable=False)
    concept_tag      = Column(String(255), nullable=True)
    confidence       = Column(Float,       nullable=False, default=0.0)
    evidence_snippet = Column(Text,        nullable=True)
    edited           = Column(Boolean,     nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    lecture = relationship("StudyLecture", back_populates="flashcards")


class StudyQuestion(Base):
    __tablename__ = "study_questions"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lecture_id       = Column(UUID(as_uuid=True), ForeignKey("study_lectures.id"), nullable=False, index=True)
    question         = Column(Text,        nullable=False)
    question_type    = Column(String(50),  nullable=False, default="important")
    difficulty       = Column(String(50),  nullable=True)
    answer_short     = Column(Text,        nullable=True)
    answer_exam      = Column(Text,        nullable=False)
    answer_detailed  = Column(Text,        nullable=True)
    options          = Column(JSON,        nullable=True)   # list[MCQOption dict] | null
    confidence       = Column(Float,       nullable=False, default=0.0)
    source_coverage  = Column(Float,       nullable=True)
    evidence_snippet = Column(Text,        nullable=True)
    topic_tags       = Column(JSON,        nullable=False, default=list)   # list[str]
    edited           = Column(Boolean,     nullable=False, default=False)
    is_hidden        = Column(Boolean,     nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    lecture = relationship("StudyLecture", back_populates="questions")
