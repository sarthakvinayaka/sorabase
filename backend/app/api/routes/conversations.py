import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.config import settings
from app.db.session import get_db
from app.adapters.transcript_adapter import TranscriptAdapter
from app.adapters.base import TranscriptPayload
from app.domain.schemas import ConversationCreate, ConversationRead, ConversationSummary, ExtractionCreatedResponse
from app.domain.general_extraction_schemas import GeneralExtractRequest
from app.repositories import conversation_repo
from app.services.extraction_service import (
    ConversationNotFoundError,
    ConversationTooLargeError,
    TranscriptNotReadyError,
    run_extraction,
)
from app.services.openai_client import ExtractionError
from app.services.general_extraction_service import (
    ConversationNotFoundError as GenConvNotFoundError,
    ConversationTooLargeError as GenConvTooLargeError,
    TranscriptNotReadyError as GenTranscriptNotReadyError,
    run_general_extraction,
)
from app.services.general_extraction_client import GeneralExtractionError

router = APIRouter()
_transcript_adapter = TranscriptAdapter()


@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(
    source_type: str | None = None,
    transcript_status: str | None = "ready",
    limit: int = 30,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    if source_type is not None:
        convs = conversation_repo.list_by_source_type(
            db, source_type=source_type, org_id=org_id, transcript_status=transcript_status, limit=limit
        )
    else:
        convs = []
    return [ConversationSummary.model_validate(c) for c in convs]


@router.post("/conversations", response_model=ConversationRead, status_code=201)
def create_conversation(
    body: ConversationCreate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    if len(body.raw_text) > settings.max_transcript_chars:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Conversation is {len(body.raw_text):,} characters. "
                f"Maximum allowed is {settings.max_transcript_chars:,}."
            ),
        )
    # Only transcript source_type is accepted on this endpoint.
    # Future source types (audio, zoom, whatsapp) will use POST /ingest.
    if body.source_type != "transcript":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Source type {body.source_type!r} is not supported on this endpoint. "
                "Use POST /ingest for non-transcript sources."
            ),
        )
    payload = TranscriptPayload(
        raw_text=body.raw_text,
        recruiter_id=body.recruiter_id,
        job_id=body.job_id,
        job_reference=body.job_reference,
    )
    result = _transcript_adapter.ingest(payload, db, org_id=org_id)
    return conversation_repo.get(db, result.conversation_id)


@router.get("/conversations/{conversation_id}", response_model=ConversationRead)
def get_conversation(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    conversation = conversation_repo.get(db, conversation_id, org_id=org_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conversation


@router.post(
    "/conversations/{conversation_id}/extract",
    response_model=ExtractionCreatedResponse,
    status_code=201,
)
def extract_conversation(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    # Validate ownership before running extraction
    if conversation_repo.get(db, conversation_id, org_id=org_id) is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    try:
        candidate, extraction_run = run_extraction(db, conversation_id)
    except ConversationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ConversationTooLargeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except TranscriptNotReadyError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except ExtractionError as exc:
        raise HTTPException(status_code=503, detail=f"Extraction failed: {exc}")
    except Exception:
        raise HTTPException(status_code=500, detail="Internal extraction error.")

    return ExtractionCreatedResponse(
        candidate_id=candidate.id,
        extraction_id=extraction_run.id,
    )


@router.post(
    "/conversations/{conversation_id}/extract-general",
    response_model=ExtractionCreatedResponse,
    status_code=201,
)
def extract_general_conversation(
    conversation_id: uuid.UUID,
    body: GeneralExtractRequest,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    # Validate ownership before running extraction
    if conversation_repo.get(db, conversation_id, org_id=org_id) is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    try:
        candidate, extraction_run = run_general_extraction(
            db,
            conversation_id,
            body.columns,
            template_id=body.template_id,
            template_version=body.template_version,
        )
    except GenConvNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except GenConvTooLargeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except GenTranscriptNotReadyError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except GeneralExtractionError as exc:
        raise HTTPException(status_code=503, detail=f"Extraction failed: {exc}")
    except Exception:
        raise HTTPException(status_code=500, detail="Internal extraction error.")

    return ExtractionCreatedResponse(
        candidate_id=candidate.id,
        extraction_id=extraction_run.id,
    )
