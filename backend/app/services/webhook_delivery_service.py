"""
HTTP webhook delivery with exponential-backoff retry.

Delivers a JSON payload to an arbitrary URL.  Up to max_retries attempts
(default 3) with 1s → 2s → 4s backoff.  Each attempt gets a 10-second
connect+read timeout.

Response headers:
  X-Pilot-Event      — event type string
  X-Pilot-Delivery   — unique per-delivery UUID

Returns a WebhookDeliveryResult.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone

import httpx

from app.domain.general_export_schemas import WebhookDeliveryResult

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(10.0)
_BACKOFF  = [1, 2, 4]   # seconds between retry attempt n


def deliver(
    url: str,
    payload: dict,
    event: str = "general.extraction.exported",
    max_retries: int = 3,
) -> WebhookDeliveryResult:
    delivery_id = str(uuid.uuid4())
    headers = {
        "Content-Type":    "application/json",
        "X-Pilot-Event":   event,
        "X-Pilot-Delivery": delivery_id,
    }

    last_status: int | None = None
    last_error:  str | None = None

    for attempt in range(1, max_retries + 1):
        try:
            resp = httpx.post(
                url,
                json=payload,
                headers=headers,
                timeout=_TIMEOUT,
                follow_redirects=True,
            )
            last_status = resp.status_code

            if resp.is_success:
                logger.info("Webhook delivered: url=%s status=%s attempt=%s", url, resp.status_code, attempt)
                return WebhookDeliveryResult(
                    status="delivered",
                    http_status=resp.status_code,
                    attempt=attempt,
                    error_message=None,
                    delivered_at=datetime.now(timezone.utc),
                )

            # 4xx → permanent failure, do not retry
            if resp.status_code < 500:
                logger.warning("Webhook rejected: url=%s status=%s", url, resp.status_code)
                return WebhookDeliveryResult(
                    status="failed",
                    http_status=resp.status_code,
                    attempt=attempt,
                    error_message=f"Endpoint returned {resp.status_code}",
                    delivered_at=None,
                )

            # 5xx → retry
            last_error = f"Endpoint returned {resp.status_code}"
            logger.warning("Webhook 5xx: url=%s status=%s attempt=%s", url, resp.status_code, attempt)

        except httpx.TimeoutException:
            last_error = "Request timed out"
            logger.warning("Webhook timeout: url=%s attempt=%s", url, attempt)
        except httpx.RequestError as exc:
            last_error = str(exc)
            logger.warning("Webhook error: url=%s attempt=%s error=%s", url, attempt, exc)

        if attempt < max_retries:
            time.sleep(_BACKOFF[attempt - 1])

    return WebhookDeliveryResult(
        status="failed",
        http_status=last_status,
        attempt=max_retries,
        error_message=last_error,
        delivered_at=None,
    )
