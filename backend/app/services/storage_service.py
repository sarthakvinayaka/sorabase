"""
Local file storage for audio uploads.

FileStorage protocol defines the interface; LocalFileStorage writes to a
configurable directory. Future implementations (S3, GCS) satisfy the same protocol.
"""

import os
import uuid
from pathlib import Path
from typing import Protocol, runtime_checkable


@runtime_checkable
class FileStorage(Protocol):
    def save(self, data: bytes, filename: str) -> str:
        """Persist bytes and return a storage key."""
        ...

    def open(self, key: str) -> bytes:
        """Load bytes by storage key."""
        ...

    def delete(self, key: str) -> None:
        """Remove a stored object."""
        ...


class LocalFileStorage:
    """Stores files on the local filesystem under `base_dir`."""

    def __init__(self, base_dir: str) -> None:
        self._base = Path(base_dir)
        self._base.mkdir(parents=True, exist_ok=True)

    def save(self, data: bytes, filename: str) -> str:
        suffix = Path(filename).suffix or ""
        key = f"{uuid.uuid4().hex}{suffix}"
        (self._base / key).write_bytes(data)
        return key

    def open(self, key: str) -> bytes:
        path = self._base / key
        if not path.exists():
            raise FileNotFoundError(f"Storage key not found: {key!r}")
        return path.read_bytes()

    def delete(self, key: str) -> None:
        path = self._base / key
        if path.exists():
            os.remove(path)


def get_audio_storage() -> LocalFileStorage:
    from app.config import settings
    return LocalFileStorage(settings.audio_upload_dir)
