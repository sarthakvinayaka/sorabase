"""
Authentication dependency for FastAPI routes.

The Next.js proxy sets two headers on every request:
  X-User-Id:   the NextAuth user ID (CUID string)
  X-Api-Token: HMAC-SHA256(user_id, BACKEND_API_SECRET) as hex

The backend validates the HMAC so nobody can forge an arbitrary user ID without
knowing the shared secret. The backend must NOT be publicly exposed — it is only
reachable via the Next.js proxy.
"""

import hashlib
import hmac
import uuid

from fastapi import Header, HTTPException

from app.config import settings

# Fixed UUID namespace for deterministic CUID → UUID conversion.
# Never change this value after first deployment (it determines all stored org_ids).
_USER_NS = uuid.UUID("2da09810-3c6a-11ee-a70b-0242ac130003")


def user_id_to_org_id(user_id: str) -> uuid.UUID:
    """Deterministically convert a NextAuth CUID to a UUID used as org_id."""
    return uuid.uuid5(_USER_NS, user_id)


async def get_current_org_id(
    x_user_id: str | None = Header(default=None),
    x_api_token: str | None = Header(default=None),
) -> uuid.UUID:
    """
    FastAPI dependency: resolve the calling user's org_id.

    Validates the HMAC signature to ensure the headers were set by our
    trusted Next.js proxy and not forged by a client.
    """
    if not x_user_id or not x_api_token:
        raise HTTPException(status_code=401, detail="Authentication required.")

    secret = settings.backend_api_secret
    if not secret:
        raise HTTPException(status_code=500, detail="Server misconfiguration: missing BACKEND_API_SECRET.")

    expected = hmac.new(
        key=secret.encode(),
        msg=x_user_id.encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, x_api_token):
        raise HTTPException(status_code=401, detail="Invalid authentication token.")

    return user_id_to_org_id(x_user_id)
