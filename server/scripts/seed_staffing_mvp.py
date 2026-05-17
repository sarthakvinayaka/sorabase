#!/usr/bin/env python3
"""
Destructively seed the staffing MVP database (PostgreSQL).

Usage (from `server/`):

    export DATABASE_URL=postgresql+psycopg://...
    python scripts/seed_staffing_mvp.py

Requires migrations applied (`alembic upgrade head`).
"""

from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

_SCENARIOS_PATH = ROOT / "scripts" / "seed_staffing_scenarios.py"
_SPEC = importlib.util.spec_from_file_location("seed_staffing_scenarios", _SCENARIOS_PATH)
assert _SPEC and _SPEC.loader
S = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(S)

from app.core.config import settings  # noqa: E402
from app.db.enums import (  # noqa: E402
    AtsConnectionStatus,
    AtsProvider,
    AtsSyncLogStatus,
    AudioUploadStatus,
    CandidateApprovalStatus,
    CandidateAtsSyncStatus,
    CandidateExtractionStatus,
    CandidateProcessingStage,
    ExtractedFieldSource,
    TranscriptStatus,
)
from app.db.models.ats_connection import AtsConnection  # noqa: E402
from app.db.models.ats_sync_log import AtsSyncLog  # noqa: E402
from app.db.models.audio_upload import AudioUpload  # noqa: E402
from app.db.models.audit_log import AuditLog  # noqa: E402
from app.db.models.candidate_record import CandidateRecord  # noqa: E402
from app.db.models.extraction_run import ExtractionRun  # noqa: E402
from app.db.models.extracted_field import ExtractedField  # noqa: E402
from app.db.models.field_evidence import FieldEvidence  # noqa: E402
from app.db.models.organization import Organization  # noqa: E402
from app.db.models.recruiter import Recruiter  # noqa: E402
from app.db.models.transcript import Transcript  # noqa: E402
from app.db.models.transcript_segment import TranscriptSegment  # noqa: E402
from app.db.models.user import User  # noqa: E402


def _processing_stage_for_seed(spec: dict) -> CandidateProcessingStage:
    c = spec["candidate"]
    if c["ats"] == CandidateAtsSyncStatus.SYNCED:
        return CandidateProcessingStage.SYNCED
    if c["approval"] in (CandidateApprovalStatus.APPROVED, CandidateApprovalStatus.PARTIALLY_APPROVED):
        return CandidateProcessingStage.APPROVED
    if c["extraction"] == CandidateExtractionStatus.COMPLETE:
        if c["approval"] == CandidateApprovalStatus.PENDING_REVIEW:
            return CandidateProcessingStage.NEEDS_REVIEW
        return CandidateProcessingStage.EXTRACTED
    return CandidateProcessingStage.TRANSCRIBED


def _truncate(session: Session) -> None:
    session.execute(text("TRUNCATE organizations CASCADE"))
    session.commit()


def _pick_segment(segments: list[TranscriptSegment], snippet: str) -> TranscriptSegment | None:
    if not snippet:
        return segments[0] if segments else None
    low = snippet.lower()
    for seg in segments:
        if low in seg.text.lower():
            return seg
    return segments[0] if segments else None


def _span(full_text: str, snippet: str) -> tuple[int | None, int | None]:
    if not snippet:
        return None, None
    start = full_text.find(snippet)
    if start < 0:
        return None, None
    return start, start + len(snippet)


def seed(session: Session) -> None:
    org = Organization(
        id=S.ORG_ID,
        name="Northline Talent Partners",
        slug="northline-talent",
        notes="Regional staffing + light consulting. Demo seed — not real client data.",
        settings={"hq": "Chicago", "timezone": "America/Chicago", "segment": "healthcare + tech + finance"},
    )
    ats = AtsConnection(
        id=S.ATS_CONN_ID,
        organization_id=S.ORG_ID,
        label="Bullhorn (prod-like)",
        provider=AtsProvider.BULLHORN,
        status=AtsConnectionStatus.CONNECTED,
        vault_secret_ref="vault://mock/northline/bullhorn/oauth",
        config={
            "field_map_preview": {
                "technical_skills": "customTextBlock1",
                "work_authorization": "customTextBlock2",
                "location_preference": "address.city",
                "compensation_expectations": "salary",
                "notice_period": "customTextBlock3",
                "availability": "customTextBlock4",
                "target_role": "category",
            }
        },
    )

    users = [
        User(
            id=S.USER_MORGAN,
            organization_id=S.ORG_ID,
            email="morgan.avery@northline-seed.example",
            full_name="Morgan Avery",
            password_hash=None,
            is_active=True,
            notes="Principal recruiter — clinical + acute.",
        ),
        User(
            id=S.USER_LUIS,
            organization_id=S.ORG_ID,
            email="luis.ortega@northline-seed.example",
            full_name="Luis Ortega",
            password_hash=None,
            is_active=True,
            notes="Contract desk — SAP / finance.",
        ),
        User(
            id=S.USER_JAMIE,
            organization_id=S.ORG_ID,
            email="jamie.patel@northline-seed.example",
            full_name="Jamie Patel",
            password_hash=None,
            is_active=True,
            notes="Tech perm — backend/platform.",
        ),
    ]

    recruiters = [
        Recruiter(
            id=S.REC_MORGAN,
            user_id=S.USER_MORGAN,
            organization_id=S.ORG_ID,
            display_title="Principal Recruiter, Clinical",
            notes="Covers travel nursing and infusion.",
        ),
        Recruiter(
            id=S.REC_LUIS,
            user_id=S.USER_LUIS,
            organization_id=S.ORG_ID,
            display_title="Managing Consultant, SAP / Finance Contracts",
            notes="Ledgerline + manufacturing FI.",
        ),
        Recruiter(
            id=S.REC_JAMIE,
            user_id=S.USER_JAMIE,
            organization_id=S.ORG_ID,
            display_title="Senior Recruiter, Software (Perm)",
            notes="Series A–C backend hires.",
        ),
    ]

    session.add_all([org, ats, *users, *recruiters])
    session.flush()

    scenarios = S.scenarios()
    for spec in scenarios:
        slug = spec["slug"]
        rid = S.RECRUITER_BY_KEY[spec["recruiter_key"]]
        aid = S.audio_id(slug)
        tid = S.transcript_id(slug)
        cid = S.candidate_id(slug)
        erid = S.run_id(slug)

        audio = AudioUpload(
            id=aid,
            organization_id=S.ORG_ID,
            uploaded_by_recruiter_id=rid,
            storage_key=f"northline/{S.ORG_ID}/audio/{slug}/v1.bin",
            original_filename=spec["audio"]["filename"],
            content_type="audio/wav" if spec["audio"]["filename"].endswith(".wav") else "audio/mp4",
            byte_size=spec["audio"]["bytes"],
            duration_seconds=spec["audio"]["duration_s"],
            checksum_sha256=None,
            status=AudioUploadStatus.STORED,
        )
        tr_meta = spec["transcript"]
        transcript = Transcript(
            id=tid,
            audio_upload_id=aid,
            version=1,
            language=tr_meta["language"],
            provider=tr_meta["provider"],
            full_text=tr_meta["full_text"],
            status=TranscriptStatus.COMPLETE,
        )
        session.add_all([audio, transcript])
        session.flush()

        segments: list[TranscriptSegment] = []
        for row in tr_meta["segments"]:
            sid = S.segment_id(slug, row["sequence_index"])
            segments.append(
                TranscriptSegment(
                    id=sid,
                    transcript_id=tid,
                    sequence_index=row["sequence_index"],
                    start_ms=row["start_ms"],
                    end_ms=row["end_ms"],
                    text=row["text"],
                    speaker_label=row["speaker_label"],
                ),
            )
        session.add_all(segments)
        session.flush()

        cand = CandidateRecord(
            id=cid,
            organization_id=S.ORG_ID,
            created_by_recruiter_id=rid,
            audio_upload_id=aid,
            primary_transcript_id=tid,
            internal_title=spec["internal_title"],
            notes=spec["candidate"]["notes"],
            approval_status=spec["candidate"]["approval"],
            extraction_status=spec["candidate"]["extraction"],
            ats_sync_status=spec["candidate"]["ats"],
            confidence_overall=spec["candidate"]["confidence_overall"],
            processing_stage=_processing_stage_for_seed(spec),
        )
        run = ExtractionRun(
            id=erid,
            candidate_record_id=cid,
            run_index=1,
            status=spec["run"]["status"],
            provider_model=spec["run"]["provider_model"],
            provider_job_ref=f"extract_job:{slug}:v1",
            error_message=None,
            completed_at=spec["run"]["completed_at"],
            meta={"seed": True, "scenario": slug},
        )
        session.add_all([cand, run])
        session.flush()

        field_rows: dict[str, ExtractedField] = {}
        for f in spec["fields"]:
            name = f["name"]
            fid = S.field_id(slug, name)
            edited_by = f.get("edited_by")
            edited_uid = S.USER_BY_KEY[edited_by] if edited_by else None
            src = f["source"]
            raw_ai = f.get("ai_extracted_value")
            if raw_ai is not None:
                ai_snap = raw_ai
            elif isinstance(src, ExtractedFieldSource) and src in (
                ExtractedFieldSource.MODEL,
                ExtractedFieldSource.HEURISTIC,
                ExtractedFieldSource.IMPORTED,
            ):
                ai_snap = f.get("value")
            else:
                ai_snap = None
            row = ExtractedField(
                id=fid,
                extraction_run_id=erid,
                field_name=name,
                field_value=f.get("value"),
                ai_extracted_value=ai_snap,
                confidence=f.get("confidence"),
                status=f["status"],
                source=f["source"],
                edited_by_user_id=edited_uid,
                edited_at=spec["run"]["completed_at"] if edited_uid else None,
                bullhorn_field_key=f.get("bullhorn"),
                notes=None,
            )
            session.add(row)
            field_rows[name] = row

        session.flush()

        for f in spec["fields"]:
            name = f["name"]
            fid = field_rows[name].id
            for i, snip in enumerate(snippets):
                seg = _pick_segment(segments, snip)
                span_s, span_e = _span(tr_meta["full_text"], snip)
                session.add(
                    FieldEvidence(
                        id=S.evidence_id(slug, name, i),
                        extracted_field_id=fid,
                        transcript_id=tid,
                        transcript_segment_id=seg.id if seg else None,
                        span_start_char=span_s,
                        span_end_char=span_e,
                        evidence_text=snip,
                        model_confidence=f.get("confidence"),
                        provider_span_ref=f"asr:{slug}:{name}:{i}",
                    ),
                )
                seg = _pick_segment(segments, snip)
                span_s, span_e = _span(tr_meta["full_text"], snip)
                session.add(
                    FieldEvidence(
                        id=S.evidence_id(slug, name, i),
                        extracted_field_id=fid,
                        transcript_id=tid,
                        transcript_segment_id=seg.id if seg else None,
                        span_start_char=span_s,
                        span_end_char=span_e,
                        evidence_text=snip,
                        model_confidence=f.get("confidence"),
                        provider_span_ref=f"asr:{slug}:{name}:{i}",
                    ),
                )

        if spec.get("ats_sync"):
            sync = spec["ats_sync"]
            status_map = {
                "success": AtsSyncLogStatus.SUCCESS,
                "failed": AtsSyncLogStatus.FAILED,
                "partial": AtsSyncLogStatus.PARTIAL,
                "started": AtsSyncLogStatus.STARTED,
            }
            session.add(
                AtsSyncLog(
                    id=S.sync_log_id(slug),
                    ats_connection_id=S.ATS_CONN_ID,
                    candidate_record_id=cid,
                    extraction_run_id=erid,
                    status=status_map[sync["status"]],
                    request_summary=sync.get("request_summary"),
                    response_summary=sync.get("response_summary"),
                    external_entity_ref=sync.get("external_entity_ref"),
                ),
            )

        for i, a in enumerate(spec.get("audits", [])):
            actor_key = a.get("actor_user_key")
            actor_id = S.USER_BY_KEY[actor_key] if actor_key else None
            entity_type = a["entity_type"]
            entity_id = None
            if entity_type == "candidate_record":
                entity_id = cid
            elif entity_type == "extracted_field":
                meta = a.get("metadata") or {}
                fname = meta.get("field")
                if fname and fname in field_rows:
                    entity_id = field_rows[fname].id
            elif entity_type == "ats_sync_log":
                entity_id = S.sync_log_id(slug) if spec.get("ats_sync") else None
            elif entity_type == "audio_upload":
                entity_id = aid

            session.add(
                AuditLog(
                    id=S.audit_id(slug, i),
                    organization_id=S.ORG_ID,
                    actor_user_id=actor_id,
                    actor_type=a["actor_type"],
                    action=a["action"],
                    entity_type=entity_type,
                    entity_id=entity_id,
                    metadata_=a.get("metadata") or {},
                    ip_address="198.51.100.42" if actor_id else None,
                    user_agent="NorthlineWeb/seed" if actor_id else "NorthlineWorker/seed",
                ),
            )

        session.flush()

    session.commit()


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed staffing MVP demo data (destructive).")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print scenario count and exit without touching the database.",
    )
    args = parser.parse_args()

    scenarios = S.scenarios()
    if args.dry_run:
        print(f"Dry run: would TRUNCATE organizations CASCADE then insert {len(scenarios)} scenarios.")
        return 0

    engine = create_engine(settings.database_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

    with SessionLocal() as session:
        _truncate(session)
        seed(session)

    print(f"Seeded Northline demo: org + ATS + 3 recruiters + {len(scenarios)} candidate workflows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
