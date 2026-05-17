"""Validate screening audio uploads (type + size)."""

from __future__ import annotations

from app.core.config import settings


def normalize_content_type(raw: str | None) -> str | None:
    if not raw:
        return None
    return raw.split(";")[0].strip().lower()


def validate_audio_upload(*, content_type: str | None, byte_size: int) -> None:
    if byte_size <= 0:
        msg = "Empty upload"
        raise ValueError(msg)
    if byte_size > settings.max_upload_bytes:
        msg = f"File exceeds maximum size of {settings.max_upload_bytes} bytes"
        raise ValueError(msg)
    ct = normalize_content_type(content_type)
    if not ct or ct not in settings.allowed_audio_content_types_list:
        allowed = ", ".join(sorted(settings.allowed_audio_content_types_list))
        msg = f"Unsupported content type {content_type!r}. Allowed: {allowed}"
        raise ValueError(msg)
