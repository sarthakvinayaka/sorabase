from pathlib import Path

from app.core.config import settings
from app.storage.local import LocalFileStorage


def get_local_file_storage() -> LocalFileStorage:
    root = Path(settings.file_storage_root).expanduser().resolve()
    return LocalFileStorage(root)
