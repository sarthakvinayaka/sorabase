"""
Deterministic staffing-demo content for `seed_staffing_mvp.py`.

IDs are stable UUIDv5 namespaced URLs so re-seeding is idempotent after TRUNCATE.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.db.enums import (
    AuditActorType,
    CandidateApprovalStatus,
    CandidateAtsSyncStatus,
    CandidateExtractionStatus,
    ExtractionRunStatus,
    ExtractedFieldSource,
    ExtractedFieldStatus,
)

NS = uuid.NAMESPACE_URL


def uid(*parts: str) -> uuid.UUID:
    return uuid.uuid5(NS, "/" + "/".join(parts))


ORG_ID = uid("org", "northline-talent")
ATS_CONN_ID = uid("ats", "northline", "bullhorn-prod")

USER_MORGAN = uid("user", "morgan.avery")
USER_LUIS = uid("user", "luis.ortega")
USER_JAMIE = uid("user", "jamie.patel")

REC_MORGAN = uid("recruiter", "morgan")
REC_LUIS = uid("recruiter", "luis")
REC_JAMIE = uid("recruiter", "jamie")

RECRUITER_BY_KEY: dict[str, uuid.UUID] = {
    "morgan": REC_MORGAN,
    "luis": REC_LUIS,
    "jamie": REC_JAMIE,
}

USER_BY_KEY: dict[str, uuid.UUID] = {
    "morgan": USER_MORGAN,
    "luis": USER_LUIS,
    "jamie": USER_JAMIE,
}


def _turns_to_transcript(
    turns: list[dict[str, str]],
    target_total_ms: int,
) -> tuple[str, list[dict[str, Any]]]:
    """Build full_text + segments with monotonic timestamps."""
    char_total = sum(len(t["text"]) for t in turns) + 1
    ms_budget = max(target_total_ms, 120_000)
    ms_per_char = max(28, ms_budget // char_total)

    segments: list[dict[str, Any]] = []
    full_lines: list[str] = []
    cursor = 0
    for idx, turn in enumerate(turns):
        speaker = turn["speaker"]
        text = turn["text"].strip()
        duration = max(3_500, min(55_000, len(text) * ms_per_char))
        start = cursor
        end = cursor + duration
        cursor = end + 400  # short pause
        segments.append(
            {
                "sequence_index": idx,
                "start_ms": int(start),
                "end_ms": int(end),
                "speaker_label": speaker,
                "text": text,
            },
        )
        full_lines.append(f"[{speaker}]: {text}")
    return "\n\n".join(full_lines), segments


def _now() -> datetime:
    return datetime.now(timezone.utc)


Turn = dict[str, str]  # speaker, text


def scenarios() -> list[dict[str, Any]]:
    """Ordered list of five screening scenarios."""
    priya_turns: list[Turn] = [
        {
            "speaker": "Recruiter (Luis)",
            "text": (
                "Thanks for hopping on, Priya — this is Luis with Northline. "
                "We’re supporting Ledgerline on a contract-to-hire SAP FI role, heavy cash application and bank rec. "
                "Walk me through your last 18 months technically, and where SD touches your day-to-day."
            ),
        },
        {
            "speaker": "Candidate (Priya)",
            "text": (
                "Sure. I’ve been leading month-end close for two entities on S/4, FI-AR, lockbox, and I rebuilt "
                "the clearing house interface last quarter. SD is mostly downstream for me — billing blocks, "
                "credit releases — not a full SD functional lead."
            ),
        },
        {
            "speaker": "Recruiter (Luis)",
            "text": (
                "Got it. Client wants Chicago hybrid two days — does that work with your commute reality, "
                "and are you still on a corp-to-corp structure today?"
            ),
        },
        {
            "speaker": "Candidate (Priya)",
            "text": (
                "Hybrid is fine if it’s downtown or west loop. I’m C2C today with a small implementer; "
                "I’m open to W2 if the rate maps. I can start interviewing next week but I owe a clean handoff — "
                "call it mid-month earliest for a new start."
            ),
        },
        {
            "speaker": "Recruiter (Luis)",
            "text": (
                "Perfect. I’m going to let the pipeline finish structured extraction while you send two anonymized "
                "process diagrams if you have them. Any VIM exposure?"
            ),
        },
        {
            "speaker": "Candidate (Priya)",
            "text": (
                "Light VIM — not deep workflow config. I know what good looks like, I’d lean on a functional partner "
                "for anything cute on the workflow side."
            ),
        },
    ]

    marcus_turns: list[Turn] = [
        {
            "speaker": "Recruiter (Morgan)",
            "text": (
                "Marcus, thanks for making time — Northline is staffing a 13-week infusion clinic travel contract "
                "in Phoenix, 36-hour guarantee, every third weekend. Confirm your active licenses and any discipline flags."
            ),
        },
        {
            "speaker": "Candidate (Marcus)",
            "text": (
                "I’m RN compact, Arizona is my primary, California attached. ACLS/BLS current. "
                "No flags — last assignment was outpatient oncology infusion, prior was step-down."
            ),
        },
        {
            "speaker": "Recruiter (Morgan)",
            "text": (
                "Great. Work authorization for the client packet: what should we list — US citizen, green card, TN, "
                "or something else? They’re picky on I-9 wording."
            ),
        },
        {
            "speaker": "Candidate (Marcus)",
            "text": (
                "It’s… a little messy on paper. I started on TN years ago from Vancouver, but I’m married to a USC now "
                "and we filed AOS last winter. I’m working authorized, but I don’t want the hospital to assume TN-only "
                "if that limits renewals."
            ),
        },
        {
            "speaker": "Recruiter (Morgan)",
            "text": (
                "Understood — we’ll put ‘authorized to work’ in the submittal notes and let compliance verify. "
                "What’s your notice to the current agency if we lock this?"
            ),
        },
        {
            "speaker": "Candidate (Marcus)",
            "text": (
                "It’s a travel contract so it’s really a wind-down with my recruiter there — I didn’t give a hard date "
                "on this call because it depends if the extension lands."
            ),
        },
        {
            "speaker": "Recruiter (Morgan)",
            "text": (
                "Fair. Skills-wise: PICC experience, chemo/bio, pump programming — where are you strongest?"
            ),
        },
        {
            "speaker": "Candidate (Marcus)",
            "text": (
                "Alaris and Zyno pumps, chemo/bio competent, port access yes, PICC draws if policy allows. "
                "I’m weaker on pediatrics — wouldn’t market me there."
            ),
        },
    ]

    elena_turns: list[Turn] = [
        {
            "speaker": "Recruiter (Jamie)",
            "text": (
                "Elena — Jamie from Northline. Client is a Series B payments shop, staff backend. "
                "They want someone who can own Postgres performance and on-call without drama. What are you optimizing lately?"
            ),
        },
        {
            "speaker": "Candidate (Elena)",
            "text": (
                "Read path latency and write amplification. I cut p95 checkout writes by 38% after partitioning a hot "
                "ledger table and tightening an N+1 in the settlement worker. Go services, mostly k8s."
            ),
        },
        {
            "speaker": "Recruiter (Jamie)",
            "text": (
                "Comp expectations for remote CONUS? They’re budgeted 175–190 base plus bonus, no public equity yet."
            ),
        },
        {
            "speaker": "Candidate (Elena)",
            "text": (
                "If the scope is staff-level ownership, 185 base is fair. I’m not chasing title inflation — "
                "I want sane on-call and a team that actually does incident reviews."
            ),
        },
        {
            "speaker": "Recruiter (Jamie)",
            "text": (
                "Availability if we move fast? They want someone inside three weeks."
            ),
        },
        {
            "speaker": "Candidate (Elena)",
            "text": (
                "Two weeks notice is contractual; I can overlap a little on documentation in week two. "
                "Target title is Staff Software Engineer, backend-heavy."
            ),
        },
    ]

    jordan_turns: list[Turn] = [
        {
            "speaker": "Recruiter (Jamie)",
            "text": (
                "Jordan — thanks for the time. This is a six-month DevOps contract in the Bay, mostly Terraform + EKS, "
                "some pager duty. Client wants somebody who can also coach juniors on CI hygiene."
            ),
        },
        {
            "speaker": "Candidate (Jordan)",
            "text": (
                "That’s my lane. I’ve been building golden paths in GitHub Actions and migrating legacy Jenkins footguns. "
                "On-call is fine if the runbooks aren’t fiction."
            ),
        },
        {
            "speaker": "Recruiter (Jamie)",
            "text": (
                "Rate card first pass: what number should I float to the hiring manager today?"
            ),
        },
        {
            "speaker": "Candidate (Jordan)",
            "text": (
                "For corp-to-corp, I’m at ninety-five an hour on my current extension. That’s the real floor."
            ),
        },
        {
            "speaker": "Recruiter (Jamie)",
            "text": (
                "Copy. If they flip perm after the contract, does that change your calculus?"
            ),
        },
        {
            "speaker": "Candidate (Jordan)",
            "text": (
                "Yeah — if it goes perm I’d want low one-sixties base minimum because benefits hit different. "
                "But I don’t want the SOW written fuzzy; pick a lane for the client so we don’t look sloppy."
            ),
        },
        {
            "speaker": "Recruiter (Jamie)",
            "text": (
                "Notice period if they paper this week?"
            ),
        },
        {
            "speaker": "Candidate (Jordan)",
            "text": (
                "Ten business days, clean. I can be onsite South Bay Tuesdays if they really care."
            ),
        },
    ]

    sam_turns: list[Turn] = [
        {
            "speaker": "Recruiter (Luis)",
            "text": (
                "Sam — Luis at Northline. We’ve got a Workday payroll implementation lead for a PE-backed rollup, "
                "hybrid Bay Area. I need to know if you can own cutover weekend and union pay rules."
            ),
        },
        {
            "speaker": "Candidate (Sam)",
            "text": (
                "Cutover yes — I’ve led three with parallel pay + parallel timekeeping. Union rules depend on the CBA; "
                "I’ve done teamsters and SEIU flavors, but I won’t bluff on a local I haven’t read."
            ),
        },
        {
            "speaker": "Recruiter (Luis)",
            "text": (
                "Location: client badge says Oakland two days. You’re listed SF — is that workable?"
            ),
        },
        {
            "speaker": "Candidate (Sam)",
            "text": (
                "I’m Bay Area hybrid on paper, but I’m mostly remote for now. I could do one week a month in-office "
                "if it’s the right team and parking isn’t a nightmare. Oakland is fine if BART lines up."
            ),
        },
        {
            "speaker": "Recruiter (Luis)",
            "text": (
                "Comp band is 165–180 plus bonus. Where do you want to be?"
            ),
        },
        {
            "speaker": "Candidate (Sam)",
            "text": (
                "If bonus is real and not ‘target,’ 175 is fair. I’m a US citizen, no sponsorship story."
            ),
        },
        {
            "speaker": "Recruiter (Luis)",
            "text": (
                "Notice if we move — what should I tell the client?"
            ),
        },
        {
            "speaker": "Candidate (Sam)",
            "text": (
                "Let’s come back to that — my current employer monitors email threads with vendors and I don’t want "
                "to negotiate against myself on a recorded line."
            ),
        },
    ]

    priya_full, priya_seg = _turns_to_transcript(priya_turns, 22 * 60 * 1000)
    marcus_full, marcus_seg = _turns_to_transcript(marcus_turns, 26 * 60 * 1000)
    elena_full, elena_seg = _turns_to_transcript(elena_turns, 19 * 60 * 1000)
    jordan_full, jordan_seg = _turns_to_transcript(jordan_turns, 24 * 60 * 1000)
    sam_full, sam_seg = _turns_to_transcript(sam_turns, 21 * 60 * 1000)

    return [
        {
            "slug": "priya-shah-sap-fi",
            "internal_title": "SAP FI / OTC screen — Priya Shah (Ledgerline)",
            "recruiter_key": "luis",
            "audio": {
                "filename": "screening_priya_shah_ledgerline_20260211.wav",
                "bytes": 38_442_112,
                "duration_s": 1320.0,
            },
            "transcript": {"language": "en", "provider": "mock-asr", "full_text": priya_full, "segments": priya_seg},
            "candidate": {
                "approval": CandidateApprovalStatus.NOT_STARTED,
                "extraction": CandidateExtractionStatus.RUNNING,
                "ats": CandidateAtsSyncStatus.NONE,
                "confidence_overall": None,
                "notes": "Extraction still running — transcript available for manual review.",
            },
            "run": {"status": ExtractionRunStatus.RUNNING, "completed_at": None, "provider_model": "gpt-4.1-mini"},
            "fields": [],
            "audits": [
                {
                    "action": "audio_upload.stored",
                    "actor_type": AuditActorType.SYSTEM,
                    "actor_user_key": None,
                    "entity_type": "audio_upload",
                    "metadata": {"slug": "priya-shah-sap-fi", "vendor": "northline-storage"},
                },
            ],
            "ats_sync": None,
        },
        {
            "slug": "marcus-lee-rn-infusion",
            "internal_title": "Travel RN — Marcus Lee (Phoenix infusion)",
            "recruiter_key": "morgan",
            "audio": {
                "filename": "screening_marcus_lee_phoenix_20260209.m4a",
                "bytes": 29_110_528,
                "duration_s": 1560.0,
            },
            "transcript": {"language": "en", "provider": "mock-asr", "full_text": marcus_full, "segments": marcus_seg},
            "candidate": {
                "approval": CandidateApprovalStatus.PENDING_REVIEW,
                "extraction": CandidateExtractionStatus.COMPLETE,
                "ats": CandidateAtsSyncStatus.NONE,
                "confidence_overall": 0.6125,
                "notes": "Visa narrative ambiguous; notice not pinned — hold submittal until compliance clears.",
            },
            "run": {
                "status": ExtractionRunStatus.COMPLETE,
                "completed_at": _now(),
                "provider_model": "gpt-4.1-mini",
            },
            "fields": [
                {
                    "name": "technical_skills",
                    "value": "Infusion RN; Alaris/Zyno pumps; chemo/bio; port access; ACLS/BLS; avoids peds",
                    "confidence": 0.84,
                    "status": ExtractedFieldStatus.PENDING,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "customTextBlock1",
                    "snippets": ["Alaris and Zyno pumps, chemo/bio competent"],
                },
                {
                    "name": "work_authorization",
                    "value": "Authorized to work (TN history + AOS pending — verify with compliance; do not label TN-only)",
                    "confidence": 0.41,
                    "status": ExtractedFieldStatus.DRAFT,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "customTextBlock2",
                    "snippets": [
                        "I started on TN years ago",
                        "we filed AOS last winter",
                        "I’m working authorized",
                    ],
                },
                {
                    "name": "location_preference",
                    "value": "Phoenix metro travel; compact licenses incl. AZ + CA",
                    "confidence": 0.79,
                    "status": ExtractedFieldStatus.PENDING,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "address.city",
                    "snippets": ["travel contract in Phoenix"],
                },
                {
                    "name": "compensation_expectations",
                    "value": "Not explicitly stated as hourly/base on call — recruiter to qualify with agency bill rate",
                    "confidence": 0.33,
                    "status": ExtractedFieldStatus.PENDING,
                    "source": ExtractedFieldSource.HEURISTIC,
                    "bullhorn": "customFloat1",
                    "snippets": ["13-week infusion clinic travel contract"],
                },
                {
                    "name": "availability",
                    "value": "Available after travel extension decision; no hard start date on call",
                    "confidence": 0.52,
                    "status": ExtractedFieldStatus.PENDING,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "customTextBlock3",
                    "snippets": ["I didn’t give a hard date on this call"],
                },
                {
                    "name": "target_role",
                    "value": "Infusion clinic RN (adult)",
                    "confidence": 0.88,
                    "status": ExtractedFieldStatus.PENDING,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "category",
                    "snippets": ["infusion clinic travel contract"],
                },
                # notice_period intentionally omitted
            ],
            "audits": [
                {
                    "action": "extraction.completed",
                    "actor_type": AuditActorType.SYSTEM,
                    "actor_user_key": None,
                    "entity_type": "candidate_record",
                    "metadata": {"slug": "marcus-lee-rn-infusion", "run_index": 1},
                },
                {
                    "action": "candidate_record.viewed",
                    "actor_type": AuditActorType.USER,
                    "actor_user_key": "morgan",
                    "entity_type": "candidate_record",
                    "metadata": {"slug": "marcus-lee-rn-infusion"},
                },
            ],
            "ats_sync": None,
        },
        {
            "slug": "elena-vasquez-backend-staff",
            "internal_title": "Staff Backend — Elena Vásquez (payments)",
            "recruiter_key": "jamie",
            "audio": {
                "filename": "screening_elena_vasquez_backend_20260204.wav",
                "bytes": 24_920_064,
                "duration_s": 1180.0,
            },
            "transcript": {"language": "en", "provider": "mock-asr", "full_text": elena_full, "segments": elena_seg},
            "candidate": {
                "approval": CandidateApprovalStatus.APPROVED,
                "extraction": CandidateExtractionStatus.COMPLETE,
                "ats": CandidateAtsSyncStatus.PENDING,
                "confidence_overall": 0.9012,
                "notes": "Approved for submittal — ATS push queued behind nightly window.",
            },
            "run": {"status": ExtractionRunStatus.COMPLETE, "completed_at": _now(), "provider_model": "gpt-4.1-mini"},
            "fields": [
                {
                    "name": "technical_skills",
                    "value": "Go, Kubernetes, Postgres performance, incident response hygiene",
                    "confidence": 0.91,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "customTextBlock1",
                    "snippets": ["Go services, mostly k8s", "partitioning a hot ledger table"],
                },
                {
                    "name": "work_authorization",
                    "value": "Not stated explicitly on call — default unknown (recruiter verbally confirmed US work auth offline)",
                    "confidence": 0.29,
                    "status": ExtractedFieldStatus.REJECTED,
                    "source": ExtractedFieldSource.HEURISTIC,
                    "bullhorn": "customTextBlock2",
                    "snippets": [],
                },
                {
                    "name": "location_preference",
                    "value": "Remote CONUS",
                    "confidence": 0.86,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "address.state",
                    "snippets": ["remote CONUS"],
                },
                {
                    "name": "compensation_expectations",
                    "value": "185k base target (staff scope); client band discussed 175–190",
                    "confidence": 0.83,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "salary",
                    "snippets": ["185 base is fair", "175–190 base plus bonus"],
                },
                {
                    "name": "notice_period",
                    "value": "Two weeks contractual; documentation overlap possible in week two",
                    "confidence": 0.8,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "customTextBlock3",
                    "snippets": ["Two weeks notice is contractual"],
                },
                {
                    "name": "availability",
                    "value": "Inside three weeks from signed offer, subject to notice",
                    "confidence": 0.74,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "customTextBlock4",
                    "snippets": ["inside three weeks"],
                },
                {
                    "name": "target_role",
                    "value": "Staff Software Engineer, backend-heavy",
                    "confidence": 0.9,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "category",
                    "snippets": ["Staff Software Engineer, backend-heavy"],
                },
            ],
            "audits": [
                {
                    "action": "extracted_field.approved",
                    "actor_type": AuditActorType.USER,
                    "actor_user_key": "jamie",
                    "entity_type": "extracted_field",
                    "metadata": {"field": "technical_skills", "slug": "elena-vasquez-backend-staff"},
                },
                {
                    "action": "extracted_field.rejected",
                    "actor_type": AuditActorType.USER,
                    "actor_user_key": "jamie",
                    "entity_type": "extracted_field",
                    "metadata": {"field": "work_authorization", "reason": "needs offline verification note"},
                },
                {
                    "action": "candidate_record.approved",
                    "actor_type": AuditActorType.USER,
                    "actor_user_key": "jamie",
                    "entity_type": "candidate_record",
                    "metadata": {"slug": "elena-vasquez-backend-staff"},
                },
            ],
            "ats_sync": None,
        },
        {
            "slug": "jordan-okonkwo-devops-contract",
            "internal_title": "DevOps contract — Jordan Okonkwo (Bay Area)",
            "recruiter_key": "jamie",
            "audio": {
                "filename": "screening_jordan_okonkwo_devops_20260130.wav",
                "bytes": 33_554_432,
                "duration_s": 1440.0,
            },
            "transcript": {"language": "en", "provider": "mock-asr", "full_text": jordan_full, "segments": jordan_seg},
            "candidate": {
                "approval": CandidateApprovalStatus.APPROVED,
                "extraction": CandidateExtractionStatus.COMPLETE,
                "ats": CandidateAtsSyncStatus.SYNCED,
                "confidence_overall": 0.7055,
                "notes": "Compensation lane conflict flagged in evidence; still synced per client exception.",
            },
            "run": {"status": ExtractionRunStatus.COMPLETE, "completed_at": _now(), "provider_model": "gpt-4.1-mini"},
            "fields": [
                {
                    "name": "technical_skills",
                    "value": "Terraform, EKS, GitHub Actions, Jenkins migration, golden paths, on-call",
                    "confidence": 0.9,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "customTextBlock1",
                    "snippets": ["Terraform + EKS", "GitHub Actions"],
                },
                {
                    "name": "work_authorization",
                    "value": "Not discussed on call",
                    "confidence": 0.12,
                    "status": ExtractedFieldStatus.SUPERSEDED,
                    "source": ExtractedFieldSource.HEURISTIC,
                    "bullhorn": "customTextBlock2",
                    "snippets": [],
                },
                {
                    "name": "location_preference",
                    "value": "South Bay onsite Tuesdays acceptable; otherwise remote-friendly",
                    "confidence": 0.68,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "address.city",
                    "snippets": ["onsite South Bay Tuesdays"],
                },
                {
                    "name": "compensation_expectations",
                    "value": "Conflict: $95/hr C2C stated as floor vs low 160s base if perm conversion",
                    "confidence": 0.44,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "customTextBlock5",
                    "snippets": [
                        "ninety-five an hour on my current extension",
                        "low one-sixties base minimum",
                    ],
                    "dual_evidence": True,
                },
                {
                    "name": "notice_period",
                    "value": "10 business days",
                    "confidence": 0.86,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "customTextBlock3",
                    "snippets": ["Ten business days, clean"],
                },
                {
                    "name": "availability",
                    "value": "2–3 weeks from signed SOW depending client paperwork",
                    "confidence": 0.62,
                    "status": ExtractedFieldStatus.DRAFT,
                    "source": ExtractedFieldSource.MANUAL,
                    "ai_extracted_value": "About two weeks once paperwork clears",
                    "bullhorn": "customTextBlock4",
                    "snippets": [],
                    "edited_by": "jamie",
                },
                {
                    "name": "target_role",
                    "value": "Senior DevOps Engineer (contract)",
                    "confidence": 0.88,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "category",
                    "snippets": ["six-month DevOps contract"],
                },
            ],
            "audits": [
                {
                    "action": "extracted_field.updated",
                    "actor_type": AuditActorType.USER,
                    "actor_user_key": "jamie",
                    "entity_type": "extracted_field",
                    "metadata": {"field": "availability", "note": "clarified SOW timing verbally"},
                },
                {
                    "action": "candidate_record.approved",
                    "actor_type": AuditActorType.USER,
                    "actor_user_key": "jamie",
                    "entity_type": "candidate_record",
                    "metadata": {"slug": "jordan-okonkwo-devops-contract"},
                },
                {
                    "action": "ats_sync.success",
                    "actor_type": AuditActorType.SYSTEM,
                    "actor_user_key": None,
                    "entity_type": "ats_sync_log",
                    "metadata": {"slug": "jordan-okonkwo-devops-contract"},
                },
            ],
            "ats_sync": {
                "status": "success",
                "external_entity_ref": "bullhorn:Candidate:908221",
                "request_summary": {"fields": 7, "redacted": True},
                "response_summary": {"candidateId": "908221", "duplicatesChecked": True},
            },
        },
        {
            "slug": "sam-rivera-payroll-workday",
            "internal_title": "Workday payroll lead — Sam Rivera (rollup)",
            "recruiter_key": "luis",
            "audio": {
                "filename": "screening_sam_rivera_workday_20260127.wav",
                "bytes": 27_262_976,
                "duration_s": 1260.0,
            },
            "transcript": {"language": "en", "provider": "mock-asr", "full_text": sam_full, "segments": sam_seg},
            "candidate": {
                "approval": CandidateApprovalStatus.PARTIALLY_APPROVED,
                "extraction": CandidateExtractionStatus.COMPLETE,
                "ats": CandidateAtsSyncStatus.FAILED,
                "confidence_overall": 0.5388,
                "notes": "ATS validation failed on office MSA vs remote posture; legal reviewing hybrid language.",
            },
            "run": {"status": ExtractionRunStatus.COMPLETE, "completed_at": _now(), "provider_model": "gpt-4.1-mini"},
            "fields": [
                {
                    "name": "technical_skills",
                    "value": "Workday payroll, parallel pay/time, cutover weekends, union pay rules (CBA-dependent)",
                    "confidence": 0.87,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "customTextBlock1",
                    "snippets": ["parallel pay + parallel timekeeping", "teamsters and SEIU flavors"],
                },
                {
                    "name": "work_authorization",
                    "value": "US citizen (explicit)",
                    "confidence": 0.93,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "customTextBlock2",
                    "snippets": ["I’m a US citizen"],
                },
                {
                    "name": "location_preference",
                    "value": "Ambiguous: hybrid Bay Area vs mostly remote; Oakland possible 1wk/mo in-office",
                    "confidence": 0.46,
                    "status": ExtractedFieldStatus.DRAFT,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "address.city",
                    "snippets": [
                        "mostly remote for now",
                        "one week a month in-office",
                        "Oakland is fine",
                    ],
                },
                {
                    "name": "compensation_expectations",
                    "value": "175k target if bonus is real; client band 165–180 + bonus",
                    "confidence": 0.78,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "salary",
                    "snippets": ["175 is fair", "165–180 plus bonus"],
                },
                {
                    "name": "availability",
                    "value": "Deferred on call (monitoring concern)",
                    "confidence": 0.22,
                    "status": ExtractedFieldStatus.REJECTED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "customTextBlock4",
                    "snippets": ["Let’s come back to that"],
                },
                {
                    "name": "target_role",
                    "value": "Workday payroll implementation lead",
                    "confidence": 0.9,
                    "status": ExtractedFieldStatus.APPROVED,
                    "source": ExtractedFieldSource.MODEL,
                    "bullhorn": "category",
                    "snippets": ["Workday payroll implementation lead"],
                },
            ],
            "audits": [
                {
                    "action": "extracted_field.updated",
                    "actor_type": AuditActorType.USER,
                    "actor_user_key": "luis",
                    "entity_type": "extracted_field",
                    "metadata": {"field": "location_preference", "note": "flagged for client MSA review"},
                },
                {
                    "action": "ats_sync.failed",
                    "actor_type": AuditActorType.SYSTEM,
                    "actor_user_key": None,
                    "entity_type": "ats_sync_log",
                    "metadata": {"slug": "sam-rivera-payroll-workday", "error": "mapping_validation"},
                },
            ],
            "ats_sync": {
                "status": "failed",
                "external_entity_ref": None,
                "request_summary": {"fields": 6, "officeDays": 2},
                "response_summary": {"error": "BullhornValidation", "detail": "Office MSA mismatch for hybrid badge"},
            },
        },
    ]


def candidate_id(slug: str) -> uuid.UUID:
    return uid("candidate", slug)


def audio_id(slug: str) -> uuid.UUID:
    return uid("audio", slug)


def transcript_id(slug: str) -> uuid.UUID:
    return uid("transcript", slug)


def segment_id(slug: str, index: int) -> uuid.UUID:
    return uid("segment", slug, str(index))


def run_id(slug: str) -> uuid.UUID:
    return uid("extraction_run", slug, "1")


def field_id(slug: str, field_name: str) -> uuid.UUID:
    return uid("extracted_field", slug, field_name)


def evidence_id(slug: str, field_name: str, idx: int) -> uuid.UUID:
    return uid("field_evidence", slug, field_name, str(idx))


def audit_id(slug: str, idx: int) -> uuid.UUID:
    return uid("audit", slug, str(idx))


def sync_log_id(slug: str) -> uuid.UUID:
    return uid("ats_sync_log", slug)
