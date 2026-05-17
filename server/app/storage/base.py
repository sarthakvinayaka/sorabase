from typing import Protocol


class FileStoragePort(Protocol):
    """Local or remote object storage abstraction (MVP scaffold)."""

    def write_bytes(self, relative_key: str, data: bytes) -> str:
        """Persist bytes and return a stable locator (path, URI, or object key)."""
        ...

    def read_bytes(self, relative_key: str) -> bytes:
        """Read object bytes at the given key (same path rules as writes)."""
        ...
