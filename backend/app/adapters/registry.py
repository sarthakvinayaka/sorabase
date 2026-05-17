"""
Source adapter registry.

Maps source_type strings to adapter instances.
Adapters are singletons — they hold no per-request state.
"""

from app.adapters.audio_adapter import AudioAdapter
from app.adapters.meet_adapter import GoogleMeetAdapter
from app.adapters.transcript_adapter import TranscriptAdapter
from app.adapters.whatsapp_adapter import WhatsAppAdapter
from app.adapters.zoom_adapter import ZoomAdapter

_REGISTRY = {
    "transcript": TranscriptAdapter(),
    "audio": AudioAdapter(),
    "zoom": ZoomAdapter(),
    "google_meet": GoogleMeetAdapter(),
    "whatsapp": WhatsAppAdapter(),
}


def get_adapter(source_type: str):
    """Return the registered adapter for source_type. Raises ValueError if unknown."""
    adapter = _REGISTRY.get(source_type)
    if adapter is None:
        registered = ", ".join(sorted(_REGISTRY))
        raise ValueError(
            f"No adapter registered for source_type={source_type!r}. "
            f"Registered types: {registered}."
        )
    return adapter
