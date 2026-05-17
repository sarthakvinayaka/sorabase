"""
Tests for webhook_delivery_service.deliver().

No DB, no OpenAI — all network calls are mocked via httpx.
"""

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services.webhook_delivery_service import deliver


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_response(status_code: int) -> MagicMock:
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.is_success = (200 <= status_code < 300)
    return resp


# ---------------------------------------------------------------------------
# Successful delivery
# ---------------------------------------------------------------------------

class TestSuccessfulDelivery:
    @patch("app.services.webhook_delivery_service.httpx.post")
    def test_delivered_on_200(self, mock_post):
        mock_post.return_value = _mock_response(200)

        result = deliver("https://example.com/hook", {"key": "value"})

        assert result.status == "delivered"
        assert result.http_status == 200
        assert result.attempt == 1
        assert result.delivered_at is not None
        assert result.error_message is None

    @patch("app.services.webhook_delivery_service.httpx.post")
    def test_delivered_on_201(self, mock_post):
        mock_post.return_value = _mock_response(201)

        result = deliver("https://example.com/hook", {})

        assert result.status == "delivered"
        assert result.http_status == 201

    @patch("app.services.webhook_delivery_service.httpx.post")
    def test_sends_pilot_event_header(self, mock_post):
        mock_post.return_value = _mock_response(200)

        deliver("https://example.com/hook", {}, event="general.extraction.exported")

        call_kwargs = mock_post.call_args[1]
        headers = call_kwargs["headers"]
        assert headers["X-Pilot-Event"] == "general.extraction.exported"
        assert "X-Pilot-Delivery" in headers

    @patch("app.services.webhook_delivery_service.httpx.post")
    def test_sends_json_payload(self, mock_post):
        mock_post.return_value = _mock_response(200)
        payload = {"candidate_id": "abc-123", "fields": {"topic": {"value": "Q2"}}}

        deliver("https://example.com/hook", payload)

        call_kwargs = mock_post.call_args[1]
        assert call_kwargs["json"] == payload


# ---------------------------------------------------------------------------
# Permanent 4xx failure — no retry
# ---------------------------------------------------------------------------

class TestPermanentFailure:
    @patch("app.services.webhook_delivery_service.httpx.post")
    def test_fails_immediately_on_400(self, mock_post):
        mock_post.return_value = _mock_response(400)

        result = deliver("https://example.com/hook", {})

        assert result.status == "failed"
        assert result.http_status == 400
        assert result.attempt == 1
        # Must NOT retry — only one call
        assert mock_post.call_count == 1

    @patch("app.services.webhook_delivery_service.httpx.post")
    def test_fails_immediately_on_401(self, mock_post):
        mock_post.return_value = _mock_response(401)

        result = deliver("https://example.com/hook", {})

        assert result.status == "failed"
        assert mock_post.call_count == 1

    @patch("app.services.webhook_delivery_service.httpx.post")
    def test_fails_immediately_on_404(self, mock_post):
        mock_post.return_value = _mock_response(404)

        result = deliver("https://example.com/hook", {})

        assert result.status == "failed"
        assert mock_post.call_count == 1


# ---------------------------------------------------------------------------
# 5xx retry with backoff
# ---------------------------------------------------------------------------

class TestRetryOn5xx:
    @patch("app.services.webhook_delivery_service.time.sleep")
    @patch("app.services.webhook_delivery_service.httpx.post")
    def test_retries_on_500(self, mock_post, mock_sleep):
        # First two calls fail with 500, third succeeds
        mock_post.side_effect = [
            _mock_response(500),
            _mock_response(500),
            _mock_response(200),
        ]

        result = deliver("https://example.com/hook", {}, max_retries=3)

        assert result.status == "delivered"
        assert result.attempt == 3
        assert mock_post.call_count == 3

    @patch("app.services.webhook_delivery_service.time.sleep")
    @patch("app.services.webhook_delivery_service.httpx.post")
    def test_exhausts_retries_and_fails(self, mock_post, mock_sleep):
        mock_post.return_value = _mock_response(503)

        result = deliver("https://example.com/hook", {}, max_retries=3)

        assert result.status == "failed"
        assert result.http_status == 503
        assert mock_post.call_count == 3

    @patch("app.services.webhook_delivery_service.time.sleep")
    @patch("app.services.webhook_delivery_service.httpx.post")
    def test_sleeps_between_retries(self, mock_post, mock_sleep):
        mock_post.return_value = _mock_response(503)

        deliver("https://example.com/hook", {}, max_retries=3)

        # Two sleeps between three attempts
        assert mock_sleep.call_count == 2


# ---------------------------------------------------------------------------
# Network error handling
# ---------------------------------------------------------------------------

class TestNetworkErrors:
    @patch("app.services.webhook_delivery_service.time.sleep")
    @patch("app.services.webhook_delivery_service.httpx.post")
    def test_timeout_is_retried(self, mock_post, mock_sleep):
        mock_post.side_effect = [
            httpx.TimeoutException("timed out"),
            httpx.TimeoutException("timed out"),
            _mock_response(200),
        ]

        result = deliver("https://example.com/hook", {}, max_retries=3)

        assert result.status == "delivered"
        assert result.attempt == 3

    @patch("app.services.webhook_delivery_service.time.sleep")
    @patch("app.services.webhook_delivery_service.httpx.post")
    def test_connection_error_exhausts_retries(self, mock_post, mock_sleep):
        mock_post.side_effect = httpx.ConnectError("connection refused")

        result = deliver("https://example.com/hook", {}, max_retries=2)

        assert result.status == "failed"
        assert result.http_status is None
        assert result.error_message is not None
        assert mock_post.call_count == 2
