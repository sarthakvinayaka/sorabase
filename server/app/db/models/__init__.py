"""Import all model modules for mapper registration and Alembic metadata."""

from app.db.models.ats_connection import AtsConnection
from app.db.models.ats_sync_log import AtsSyncLog
from app.db.models.audio_upload import AudioUpload
from app.db.models.audit_log import AuditLog
from app.db.models.candidate_narrative_generation import CandidateNarrativeGeneration
from app.db.models.candidate_record import CandidateRecord
from app.db.models.export_job import ExportJob
from app.db.models.extracted_field import ExtractedField
from app.db.models.extraction_run import ExtractionRun
from app.db.models.field_evidence import FieldEvidence
from app.db.models.organization import Organization
from app.db.models.recruiter import Recruiter
from app.db.models.transcript import Transcript
from app.db.models.transcript_generation_job import TranscriptGenerationJob
from app.db.models.transcript_segment import TranscriptSegment
from app.db.models.user import User

__all__ = [
    "AtsConnection",
    "AtsSyncLog",
    "AudioUpload",
    "AuditLog",
    "CandidateNarrativeGeneration",
    "CandidateRecord",
    "ExportJob",
    "ExtractedField",
    "ExtractionRun",
    "FieldEvidence",
    "Organization",
    "Recruiter",
    "Transcript",
    "TranscriptGenerationJob",
    "TranscriptSegment",
    "User",
]
