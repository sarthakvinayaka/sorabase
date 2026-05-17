from pathlib import Path

from app.storage.base import FileStoragePort


class LocalFileStorage(FileStoragePort):
    """Writes objects under a single root directory; rejects path traversal."""

    def __init__(self, root: Path) -> None:
        self._root = root.resolve()

    def _resolve_target(self, relative_key: str) -> Path:
        rel = Path(relative_key)
        if rel.is_absolute() or ".." in rel.parts:
            msg = "Invalid storage key"
            raise ValueError(msg)
        target = (self._root / rel).resolve()
        try:
            target.relative_to(self._root)
        except ValueError as e:
            msg = "Storage path escapes root"
            raise ValueError(msg) from e
        return target

    def write_bytes(self, relative_key: str, data: bytes) -> str:
        rel = Path(relative_key)
        target = self._resolve_target(relative_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp = target.with_suffix(target.suffix + ".part")
        tmp.write_bytes(data)
        tmp.replace(target)
        return str(rel).as_posix()

    def read_bytes(self, relative_key: str) -> bytes:
        target = self._resolve_target(relative_key)
        if not target.is_file():
            msg = "Object not found"
            raise FileNotFoundError(msg)
        return target.read_bytes()
