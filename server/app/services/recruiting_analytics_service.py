"""Aggregated recruiting / pipeline analytics (PostgreSQL)."""

from __future__ import annotations

import uuid
from collections import Counter
from typing import Any

from sqlalchemy import and_, func, select, text
from sqlalchemy.orm import Session

from app.db.enums import (
    CandidateApprovalStatus,
    CandidateAtsSyncStatus,
    CandidateExtractionStatus,
    ExtractionRunStatus,
    TranscriptStatus,
)
from app.db.models.audio_upload import AudioUpload
from app.db.models.candidate_record import CandidateRecord
from app.db.models.extraction_run import ExtractionRun
from app.db.models.extracted_field import ExtractedField
from app.db.models.recruiter import Recruiter
from app.db.models.transcript import Transcript
from app.db.models.user import User
from app.schemas.recruiting_analytics import (
    NamedCountDTO,
    RecentCandidateRowDTO,
    RecruiterOptionDTO,
    RecruitingAnalyticsFiltersApplied,
    RecruitingAnalyticsResponse,
    RecruitingKpisDTO,
)


def _blank(s: str | None) -> bool:
    return not (s or "").strip()


def _opt_str(s: str | None) -> str | None:
    if _blank(s):
        return None
    return (s or "").strip()


class RecruitingAnalyticsService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _scoped_candidate_ids(
        self,
        *,
        organization_id: uuid.UUID,
        recruiter_id: uuid.UUID | None,
        approval_status: str | None,
        processing_stage: str | None,
        skill_contains: str | None,
        work_authorization: str | None,
        visa_status: str | None,
        location_contains: str | None,
    ) -> list[uuid.UUID]:
        where = ["c.organization_id = :org_id"]
        params: dict[str, Any] = {"org_id": str(organization_id)}
        if recruiter_id is not None:
            where.append("c.created_by_recruiter_id = :recruiter_id")
            params["recruiter_id"] = str(recruiter_id)
        if approval_status:
            where.append("c.approval_status::text = :approval")
            params["approval"] = approval_status
        if processing_stage:
            where.append("c.processing_stage::text = :stage")
            params["stage"] = processing_stage

        field_exists: list[str] = []
        if skill_contains:
            params["skill"] = skill_contains
            field_exists.append(
                """(
                lr.run_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM extracted_fields ef
                  WHERE ef.extraction_run_id = lr.run_id
                    AND ef.field_name = 'primary_skills'
                    AND ef.field_value ILIKE '%' || :skill || '%'
                ))""",
            )
        if work_authorization:
            params["work"] = work_authorization
            field_exists.append(
                """(
                lr.run_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM extracted_fields ef
                  WHERE ef.extraction_run_id = lr.run_id
                    AND ef.field_name = 'work_authorization'
                    AND ef.field_value ILIKE '%' || :work || '%'
                ))""",
            )
        if visa_status:
            params["visa"] = visa_status
            field_exists.append(
                """(
                lr.run_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM extracted_fields ef
                  WHERE ef.extraction_run_id = lr.run_id
                    AND ef.field_name = 'visa_status'
                    AND ef.field_value ILIKE '%' || :visa || '%'
                ))""",
            )
        if location_contains:
            params["loc"] = location_contains
            field_exists.append(
                """(
                lr.run_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM extracted_fields ef
                  WHERE ef.extraction_run_id = lr.run_id
                    AND ef.field_name = 'current_location'
                    AND ef.field_value ILIKE '%' || :loc || '%'
                ))""",
            )
        if field_exists:
            where.append(" AND ".join(field_exists))

        where_sql = " AND ".join(where)
        sql = text(
            f"""
            WITH latest_runs AS (
                SELECT DISTINCT ON (er.candidate_record_id)
                    er.candidate_record_id AS cid,
                    er.id AS run_id
                FROM extraction_runs er
                INNER JOIN candidate_records c2 ON c2.id = er.candidate_record_id
                WHERE c2.organization_id = CAST(:org_id AS uuid)
                  AND er.status = 'complete'
                ORDER BY er.candidate_record_id, er.run_index DESC
            )
            SELECT c.id
            FROM candidate_records c
            LEFT JOIN latest_runs lr ON lr.cid = c.id
            WHERE {where_sql}
            """,
        )
        return [r[0] for r in self._session.execute(sql, params).all()]

    def _recruiter_options(self, organization_id: uuid.UUID) -> list[RecruiterOptionDTO]:
        stmt = (
            select(Recruiter, User)
            .join(User, User.id == Recruiter.user_id)
            .where(Recruiter.organization_id == organization_id)
            .order_by(User.full_name.nulls_last(), User.email)
        )
        out: list[RecruiterOptionDTO] = []
        for rec, user in self._session.execute(stmt).all():
            label = user.full_name or user.email
            if rec.display_title:
                label = f"{label} ({rec.display_title})"
            out.append(RecruiterOptionDTO(id=rec.id, display_label=label))
        return out

    def _primary_skills_snippet(self, candidate_id: uuid.UUID, max_len: int = 96) -> str | None:
        row = self._session.execute(
            text(
                """
                SELECT ef.field_value
                FROM extraction_runs er
                INNER JOIN extracted_fields ef ON ef.extraction_run_id = er.id
                WHERE er.candidate_record_id = CAST(:cid AS uuid)
                  AND er.status = 'complete'
                  AND ef.field_name = 'primary_skills'
                ORDER BY er.run_index DESC
                LIMIT 1
                """,
            ),
            {"cid": str(candidate_id)},
        ).first()
        if not row or not row[0]:
            return None
        s = str(row[0]).strip().replace("\n", " ")
        return s if len(s) <= max_len else s[: max_len - 1] + "…"

    def get_dashboard(
        self,
        *,
        organization_id: uuid.UUID,
        recruiter_id: uuid.UUID | None = None,
        approval_status: str | None = None,
        processing_stage: str | None = None,
        skill_contains: str | None = None,
        work_authorization: str | None = None,
        visa_status: str | None = None,
        location_contains: str | None = None,
    ) -> RecruitingAnalyticsResponse:
        ap = _opt_str(approval_status)
        st = _opt_str(processing_stage)
        sk = _opt_str(skill_contains)
        wo = _opt_str(work_authorization)
        vi = _opt_str(visa_status)
        lo = _opt_str(location_contains)

        scoped_ids = self._scoped_candidate_ids(
            organization_id=organization_id,
            recruiter_id=recruiter_id,
            approval_status=ap,
            processing_stage=st,
            skill_contains=sk,
            work_authorization=wo,
            visa_status=vi,
            location_contains=lo,
        )
        id_set = set(scoped_ids)

        filters_applied = RecruitingAnalyticsFiltersApplied(
            organization_id=organization_id,
            recruiter_id=recruiter_id,
            approval_status=ap,
            processing_stage=st,
            skill_contains=sk,
            work_authorization=wo,
            visa_status=vi,
            location_contains=lo,
        )

        uq = select(func.count()).select_from(AudioUpload).where(AudioUpload.organization_id == organization_id)
        if recruiter_id is not None:
            uq = uq.where(AudioUpload.uploaded_by_recruiter_id == recruiter_id)
        total_uploads = int(self._session.scalar(uq) or 0)

        tq = (
            select(Transcript.status, func.count())
            .select_from(Transcript)
            .join(AudioUpload, AudioUpload.id == Transcript.audio_upload_id)
            .where(AudioUpload.organization_id == organization_id)
        )
        if recruiter_id is not None:
            tq = tq.where(AudioUpload.uploaded_by_recruiter_id == recruiter_id)
        tq = tq.group_by(Transcript.status)
        t_counts: dict[str, int] = {}
        for status_val, n in self._session.execute(tq).all():
            t_counts[status_val.value] = int(n)
        transcripts_total = sum(t_counts.values())
        transcripts_complete = t_counts.get(TranscriptStatus.COMPLETE.value, 0)
        transcripts_failed = t_counts.get(TranscriptStatus.FAILED.value, 0)
        terminal = transcripts_complete + transcripts_failed
        transcription_rate = (transcripts_complete / terminal) if terminal else None

        if id_set:
            erq = (
                select(ExtractionRun.status, func.count())
                .where(ExtractionRun.candidate_record_id.in_(id_set))
                .group_by(ExtractionRun.status)
            )
            er_counts: dict[str, int] = {}
            for status_val, n in self._session.execute(erq).all():
                er_counts[status_val.value] = int(n)
        else:
            er_counts = {}
        extraction_runs_total = sum(er_counts.values())
        extraction_complete = er_counts.get(ExtractionRunStatus.COMPLETE.value, 0)
        extraction_failed = er_counts.get(ExtractionRunStatus.FAILED.value, 0)
        ext_terminal = extraction_complete + extraction_failed
        extraction_rate = (extraction_complete / ext_terminal) if ext_terminal else None

        if id_set:
            cq = select(CandidateRecord).where(CandidateRecord.id.in_(id_set))
            candidates = list(self._session.scalars(cq).all())
        else:
            candidates = []
        n_scope = len(candidates)
        approved = sum(
            1
            for c in candidates
            if c.approval_status
            in (CandidateApprovalStatus.APPROVED, CandidateApprovalStatus.PARTIALLY_APPROVED)
        )
        synced = sum(1 for c in candidates if c.ats_sync_status == CandidateAtsSyncStatus.SYNCED)
        ready_ats = sum(
            1
            for c in candidates
            if c.approval_status
            in (CandidateApprovalStatus.APPROVED, CandidateApprovalStatus.PARTIALLY_APPROVED)
            and c.ats_sync_status
            not in (CandidateAtsSyncStatus.SYNCED, CandidateAtsSyncStatus.SKIPPED)
        )

        hours: list[float] = []
        for c in candidates:
            if c.approval_status not in (
                CandidateApprovalStatus.APPROVED,
                CandidateApprovalStatus.PARTIALLY_APPROVED,
            ):
                continue
            au = self._session.get(AudioUpload, c.audio_upload_id)
            if au is None or au.created_at is None or c.updated_at is None:
                continue
            delta = c.updated_at - au.created_at
            sec = delta.total_seconds()
            if sec >= 0:
                hours.append(sec / 3600.0)
        avg_hours = sum(hours) / len(hours) if hours else None

        missing_counter: Counter[str] = Counter()
        if id_set:
            ids_list = list(id_set)
            mx = (
                select(ExtractionRun.candidate_record_id, func.max(ExtractionRun.run_index).label("mx"))
                .where(
                    ExtractionRun.candidate_record_id.in_(ids_list),
                    ExtractionRun.status == ExtractionRunStatus.COMPLETE,
                )
                .group_by(ExtractionRun.candidate_record_id)
            ).subquery()
            mstmt = select(ExtractionRun.meta).join(
                mx,
                and_(
                    ExtractionRun.candidate_record_id == mx.c.candidate_record_id,
                    ExtractionRun.run_index == mx.c.mx,
                    ExtractionRun.status == ExtractionRunStatus.COMPLETE,
                ),
            )
            for (meta,) in self._session.execute(mstmt).all():
                if not meta:
                    continue
                for name in meta.get("missing_fields") or []:
                    if isinstance(name, str) and name.strip():
                        missing_counter[name.strip()] += 1
        top_missing = [NamedCountDTO(name=k, count=v) for k, v in missing_counter.most_common(12)]

        skills_counter: Counter[str] = Counter()
        work_mix: Counter[str] = Counter()
        visa_mix: Counter[str] = Counter()
        notice_mix: Counter[str] = Counter()

        if id_set:
            ids_list = list(id_set)
            mx2 = (
                select(ExtractionRun.candidate_record_id, func.max(ExtractionRun.run_index).label("mx"))
                .where(
                    ExtractionRun.candidate_record_id.in_(ids_list),
                    ExtractionRun.status == ExtractionRunStatus.COMPLETE,
                )
                .group_by(ExtractionRun.candidate_record_id)
            ).subquery()
            fstmt = (
                select(ExtractedField.field_name, ExtractedField.field_value)
                .join(ExtractionRun, ExtractionRun.id == ExtractedField.extraction_run_id)
                .join(
                    mx2,
                    and_(
                        ExtractionRun.candidate_record_id == mx2.c.candidate_record_id,
                        ExtractionRun.run_index == mx2.c.mx,
                        ExtractionRun.status == ExtractionRunStatus.COMPLETE,
                    ),
                )
                .where(
                    ExtractedField.field_name.in_(
                        ("primary_skills", "work_authorization", "visa_status", "notice_period"),
                    ),
                )
            )
            for fname, val in self._session.execute(fstmt).all():
                if val is None or not str(val).strip():
                    continue
                raw = str(val).strip()
                if fname == "primary_skills":
                    parts = [p.strip() for p in raw.replace(";", ",").split(",") if p.strip()]
                    if not parts:
                        parts = [raw]
                    for p in parts[:12]:
                        skills_counter[p[:80]] += 1
                elif fname == "work_authorization":
                    work_mix[raw[:120]] += 1
                elif fname == "visa_status":
                    visa_mix[raw[:120]] += 1
                elif fname == "notice_period":
                    notice_mix[raw[:120]] += 1

        top_skills = [NamedCountDTO(name=k, count=v) for k, v in skills_counter.most_common(15)]
        work_authorization_mix = [NamedCountDTO(name=k, count=v) for k, v in work_mix.most_common(10)]
        visa_status_mix = [NamedCountDTO(name=k, count=v) for k, v in visa_mix.most_common(10)]
        notice_period_distribution = [NamedCountDTO(name=k, count=v) for k, v in notice_mix.most_common(12)]

        pipeline_counts = {
            "candidates": n_scope,
            "pending_review": sum(1 for c in candidates if c.approval_status == CandidateApprovalStatus.PENDING_REVIEW),
            "approved": approved,
            "rejected": sum(1 for c in candidates if c.approval_status == CandidateApprovalStatus.REJECTED),
            "extraction_complete": sum(
                1 for c in candidates if c.extraction_status == CandidateExtractionStatus.COMPLETE
            ),
            "extraction_failed": sum(1 for c in candidates if c.extraction_status == CandidateExtractionStatus.FAILED),
        }

        recent: list[RecentCandidateRowDTO] = []
        if id_set:
            stmt = (
                select(CandidateRecord, Recruiter, User)
                .outerjoin(Recruiter, Recruiter.id == CandidateRecord.created_by_recruiter_id)
                .outerjoin(User, User.id == Recruiter.user_id)
                .where(CandidateRecord.id.in_(id_set))
                .order_by(CandidateRecord.updated_at.desc())
                .limit(25)
            )
            for cand, rec, user in self._session.execute(stmt).all():
                snippet = self._primary_skills_snippet(cand.id)
                rlabel = None
                if user:
                    rlabel = user.full_name or user.email
                    if rec and rec.display_title:
                        rlabel = f"{rlabel} ({rec.display_title})"
                recent.append(
                    RecentCandidateRowDTO(
                        id=cand.id,
                        approval_status=cand.approval_status.value,
                        processing_stage=cand.processing_stage.value,
                        extraction_status=cand.extraction_status.value,
                        ats_sync_status=cand.ats_sync_status.value,
                        internal_title=cand.internal_title,
                        updated_at=cand.updated_at,
                        recruiter_label=rlabel,
                        primary_skills_snippet=snippet,
                    ),
                )

        kpis = RecruitingKpisDTO(
            total_uploads=total_uploads,
            transcripts_total=transcripts_total,
            transcripts_complete=transcripts_complete,
            transcripts_failed=transcripts_failed,
            transcription_success_rate=round(transcription_rate, 4) if transcription_rate is not None else None,
            extraction_runs_total=extraction_runs_total,
            extraction_runs_complete=extraction_complete,
            extraction_runs_failed=extraction_failed,
            extraction_success_rate=round(extraction_rate, 4) if extraction_rate is not None else None,
            candidates_in_scope=n_scope,
            candidates_ready_ats_sync=ready_ats,
            candidates_approved=approved,
            candidates_synced=synced,
            avg_upload_to_approval_hours=round(avg_hours, 2) if avg_hours is not None else None,
        )

        return RecruitingAnalyticsResponse(
            filters_applied=filters_applied,
            kpis=kpis,
            top_missing_fields=top_missing,
            top_skills=top_skills,
            work_authorization_mix=work_authorization_mix,
            visa_status_mix=visa_status_mix,
            notice_period_distribution=notice_period_distribution,
            pipeline_counts=pipeline_counts,
            recent_candidates=recent,
            recruiter_options=self._recruiter_options(organization_id),
        )
