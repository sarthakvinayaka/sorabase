"""Domain enums (seed-ready string values; stored as PostgreSQL native ENUM types)."""

from __future__ import annotations

import enum


class AudioUploadStatus(str, enum.Enum):
    PENDING = "pending"
    STORED = "stored"
    FAILED = "failed"


class TranscriptJobStatus(str, enum.Enum):
    """Placeholder pipeline for ASR — no real transcription in this milestone."""

    QUEUED = "queued"
    IN_PROGRESS = "in_progress"
    AWAITING_ASR = "awaiting_asr"
    COMPLETED = "completed"
    FAILED = "failed"


class TranscriptStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class CandidateApprovalStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    PENDING_REVIEW = "pending_review"
    PARTIALLY_APPROVED = "partially_approved"
    APPROVED = "approved"
    REJECTED = "rejected"


class CandidateExtractionStatus(str, enum.Enum):
    NONE = "none"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"
    STALE = "stale"  # e.g. new audio/transcript supersedes prior extraction


class CandidateAtsSyncStatus(str, enum.Enum):
    NONE = "none"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SYNCED = "synced"
    FAILED = "failed"
    SKIPPED = "skipped"


class CandidateProcessingStage(str, enum.Enum):
    """Coarse intake / review / sync pipeline (orthogonal to extraction_status detail)."""

    UPLOADED = "uploaded"
    TRANSCRIBED = "transcribed"
    EXTRACTED = "extracted"
    NEEDS_REVIEW = "needs_review"
    APPROVED = "approved"
    SYNCED = "synced"


class ExtractionRunStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ExtractedFieldStatus(str, enum.Enum):
    PENDING = "pending"
    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUPERSEDED = "superseded"


class ExtractedFieldSource(str, enum.Enum):
    MODEL = "model"
    HEURISTIC = "heuristic"
    MANUAL = "manual"
    HUMAN_EDIT = "human_edit"
    IMPORTED = "imported"


class ExportJobFormat(str, enum.Enum):
    JSON = "json"
    CSV = "csv"


class ExportJobStatus(str, enum.Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class AtsProvider(str, enum.Enum):
    BULLHORN = "bullhorn"
    OTHER = "other"


class AtsConnectionStatus(str, enum.Enum):
    DISCONNECTED = "disconnected"
    CONNECTED = "connected"
    ERROR = "error"
    REVOKED = "revoked"


class AtsSyncLogStatus(str, enum.Enum):
    STARTED = "started"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


class AuditActorType(str, enum.Enum):
    USER = "user"
    SYSTEM = "system"
    API_KEY = "api_key"
