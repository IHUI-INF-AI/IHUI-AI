"""
Model connection test service.

Implements the "Test Model" button logic inspired by:
- **cc-switch**: three-layer probing (connectivity / model list / real chat),
  candidate URL fallback, error classification
- **echobird**: ping + real conversation test, sentinel value for failure

Three test modes:
1. ``connect`` — lightweight reachability check (GET /v1/models or minimal request)
2. ``list``    — fetch available models (GET /v1/models), validates auth + endpoint
3. ``chat``    — real one-turn conversation (max_tokens=1), validates end-to-end

Error classification:
- ``auth``     — HTTP 401/403 (invalid API key)
- ``endpoint`` — HTTP 404/405 (endpoint not supported / wrong path)
- ``network``  — timeout / connection error
- ``format``   — 200 but response not parseable (wrong API format)
- ``unknown``  — anything else

Three-state result:
- ``operational`` — success, responseMs < 2000ms
- ``degraded``    — success, 2000ms ≤ responseMs < 10000ms (slow)
- ``failed``      — any error or responseMs ≥ 10000ms

Security: API keys are NEVER logged. Error details are sanitized via
``mask_sensitive_text`` before returning to the client.
"""

from __future__ import annotations

import time
from datetime import datetime
from typing import Any, Optional
from urllib.parse import urljoin

import httpx
from loguru import logger

from app.schemas.developer_models import (
    ApiFormat,
    ErrorType,
    TestMode,
    TestResult,
    TestStatus,
)
from app.utils.crypto_util import mask_sensitive_text


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_CONNECT_TIMEOUT = 5.0
_READ_TIMEOUT = 15.0
_DEGRADED_THRESHOLD_MS = 2000
_FAILED_THRESHOLD_MS = 10000

_HTTP_TIMEOUT = httpx.Timeout(_READ_TIMEOUT, connect=_CONNECT_TIMEOUT)

# Common headers for all requests
_BASE_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "IHUI-AI-ModelTest/1.0",
}


# ---------------------------------------------------------------------------
# URL helpers (cc-switch candidate fallback)
# ---------------------------------------------------------------------------


def _build_candidate_urls(base_url: str, endpoint_path: str) -> list[str]:
    """Generate candidate URLs by trying different base URL normalizations.

    Inspired by cc-switch's "strip /v1, /anthropic suffixes" approach.
    Handles common URL variations users might enter.
    """
    base = base_url.strip().rstrip("/")
    candidates: list[str] = []

    # 1. Direct join (base already has /v1 or correct prefix)
    candidates.append(f"{base}{endpoint_path}")

    # 2. Strip trailing /v1, /v1beta, /anthropic and re-add
    for suffix in ["/v1", "/v1beta", "/anthropic", "/api"]:
        if base.endswith(suffix):
            stripped = base[: -len(suffix)]
            candidates.append(f"{stripped}/v1{endpoint_path}")
            candidates.append(f"{stripped}{endpoint_path}")
            break

    # 3. If base doesn't have /v1 and endpoint expects it, try adding
    if "/v1" not in base and endpoint_path.startswith("/v1"):
        candidates.append(f"{base}/v1{endpoint_path}")

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            unique.append(c)
    return unique


def _build_headers(api_format: ApiFormat, api_key: str) -> dict[str, str]:
    """Build request headers based on API format."""
    headers = dict(_BASE_HEADERS)
    if api_format == "anthropic_messages":
        headers["x-api-key"] = api_key
        headers["anthropic-version"] = "2023-06-01"
    else:
        # openai_chat, openai_responses
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def _get_endpoint_path(api_format: ApiFormat, mode: TestMode) -> str:
    """Get the API endpoint path for the given format and test mode."""
    if mode == "list":
        # Model list endpoint (OpenAI-compatible)
        if api_format == "anthropic_messages":
            # Anthropic doesn't have /models, use minimal messages request instead
            return "/v1/messages"
        return "/v1/models"

    if api_format == "anthropic_messages":
        return "/v1/messages"
    if api_format == "openai_responses":
        return "/v1/responses"
    # Default: openai_chat
    return "/v1/chat/completions"


def _build_request_body(
    api_format: ApiFormat, mode: TestMode, model_id: Optional[str]
) -> dict[str, Any]:
    """Build the request body for chat/connect mode."""
    model = model_id or _get_default_model(api_format)

    if mode == "list":
        return {}  # GET request, no body

    if api_format == "anthropic_messages":
        return {
            "model": model,
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "hi"}],
        }

    if api_format == "openai_responses":
        return {
            "model": model,
            "input": "hi",
            "max_output_tokens": 1,
        }

    # openai_chat
    return {
        "model": model,
        "max_tokens": 1,
        "messages": [{"role": "user", "content": "hi"}],
    }


def _get_default_model(api_format: ApiFormat) -> str:
    """Get a reasonable default model ID for testing."""
    if api_format == "anthropic_messages":
        return "claude-3-5-haiku-20241022"
    return "gpt-4o-mini"


# ---------------------------------------------------------------------------
# Error classification
# ---------------------------------------------------------------------------


def _classify_error(
    status_code: Optional[int],
    error_text: str,
    exception: Optional[Exception] = None,
) -> tuple[ErrorType, str]:
    """Classify an error into a typed category with a human message."""
    if exception is not None:
        if isinstance(exception, (httpx.TimeoutException,)):
            return "network", "Connection timed out"
        if isinstance(exception, (httpx.ConnectError, httpx.NetworkError)):
            return "network", "Cannot connect to the server"
        if isinstance(exception, httpx.InvalidURL):
            return "endpoint", "Invalid URL format"

    if status_code is not None:
        if status_code in (401, 403):
            return "auth", f"Authentication failed (HTTP {status_code})"
        if status_code in (404, 405):
            return "endpoint", f"Endpoint not supported (HTTP {status_code})"
        if status_code == 429:
            return "unknown", "Rate limited (HTTP 429)"
        if 500 <= status_code < 600:
            return "unknown", f"Server error (HTTP {status_code})"

    # Check if it looks like a format mismatch
    lower_text = error_text.lower()
    if "json" in lower_text or "parse" in lower_text:
        return "format", "Response format mismatch — check API format setting"

    return "unknown", error_text[:200] if error_text else "Unknown error"


def _determine_status(success: bool, response_ms: int) -> TestStatus:
    """Determine three-state status based on success and response time."""
    if not success:
        return "failed"
    if response_ms >= _FAILED_THRESHOLD_MS:
        return "failed"
    if response_ms >= _DEGRADED_THRESHOLD_MS:
        return "degraded"
    return "operational"


# ---------------------------------------------------------------------------
# Core test function
# ---------------------------------------------------------------------------


async def test_model_connection(
    base_url: str,
    api_key: str,
    api_format: ApiFormat,
    model_id: Optional[str] = None,
    mode: TestMode = "chat",
) -> TestResult:
    """Test a model provider connection.

    Makes a real HTTP request to the provider's API endpoint and classifies
    the result. Never logs the API key.

    Args:
        base_url: API base URL (e.g. https://api.openai.com)
        api_key: API key (plaintext, never logged)
        api_format: API format (openai_chat / anthropic_messages / openai_responses)
        model_id: Model ID for testing (e.g. gpt-4o-mini)
        mode: Test mode (connect / list / chat)

    Returns:
        TestResult with status, responseMs, message, detail, errorType
    """
    start_time = time.monotonic()
    endpoint_path = _get_endpoint_path(api_format, mode)
    headers = _build_headers(api_format, api_key)
    body = _build_request_body(api_format, mode, model_id)
    candidate_urls = _build_candidate_urls(base_url, endpoint_path)

    logger.info(
        f"Testing model connection: format={api_format}, mode={mode}, "
        f"base_url={base_url}, candidates={len(candidate_urls)}"
    )

    last_error: Optional[Exception] = None
    last_status_code: Optional[int] = None
    last_error_text: str = ""
    last_response_body: str = ""

    for url in candidate_urls:
        try:
            is_get = mode == "list" and api_format != "anthropic_messages"
            if is_get:
                response = await httpx.AsyncClient(timeout=_HTTP_TIMEOUT).get(
                    url, headers=headers
                )
            else:
                response = await httpx.AsyncClient(timeout=_HTTP_TIMEOUT).post(
                    url, headers=headers, json=body
                )

            response_ms = int((time.monotonic() - start_time) * 1000)
            last_status_code = response.status_code
            last_response_body = response.text

            # Success
            if response.status_code == 200:
                # Validate response format
                try:
                    json_data = response.json()
                except Exception:
                    error_type, msg = "format", "Response is not valid JSON — check API format setting"
                    return TestResult(
                        status="failed",
                        success=False,
                        responseMs=response_ms,
                        mode=mode,
                        message=msg,
                        detail=mask_sensitive_text(last_response_body),
                        errorType=error_type,
                    )

                # For list mode, extract model IDs
                models: Optional[list[str]] = None
                if mode == "list" and isinstance(json_data, dict):
                    raw_models = json_data.get("data", json_data.get("models", []))
                    if isinstance(raw_models, list):
                        models = [
                            m.get("id", str(m)) if isinstance(m, dict) else str(m)
                            for m in raw_models
                        ]

                status = _determine_status(True, response_ms)
                if status == "operational":
                    msg = f"Connection successful ({response_ms}ms)"
                elif status == "degraded":
                    msg = f"Connection successful but slow ({response_ms}ms)"
                else:
                    msg = f"Connection too slow ({response_ms}ms)"

                logger.info(
                    f"Model test success: status={status}, ms={response_ms}, "
                    f"url={url}"
                )
                return TestResult(
                    status=status,
                    success=True,
                    responseMs=response_ms,
                    mode=mode,
                    message=msg,
                    errorType=None,
                    models=models,
                )

            # Non-200: classify error
            last_error_text = response.text

            # Don't try other candidates for auth errors — key is wrong
            if response.status_code in (401, 403):
                error_type, msg = _classify_error(response.status_code, last_error_text)
                return TestResult(
                    status="failed",
                    success=False,
                    responseMs=response_ms,
                    mode=mode,
                    message=msg,
                    detail=mask_sensitive_text(last_error_text),
                    errorType=error_type,
                )

            # For 404/405, try next candidate URL
            logger.debug(f"Candidate URL {url} returned {response.status_code}, trying next")

        except httpx.TimeoutException as exc:
            last_error = exc
            last_error_text = str(exc)
            logger.debug(f"Candidate URL {url} timed out: {exc}")
            continue
        except httpx.ConnectError as exc:
            last_error = exc
            last_error_text = str(exc)
            logger.debug(f"Candidate URL {url} connection failed: {exc}")
            continue
        except Exception as exc:
            last_error = exc
            last_error_text = str(exc)
            logger.debug(f"Candidate URL {url} error: {exc}")
            continue

    # All candidates failed
    response_ms = int((time.monotonic() - start_time) * 1000)
    error_type, msg = _classify_error(last_status_code, last_error_text, last_error)

    logger.info(
        f"Model test failed: errorType={error_type}, ms={response_ms}, "
        f"status_code={last_status_code}"
    )

    return TestResult(
        status="failed",
        success=False,
        responseMs=response_ms,
        mode=mode,
        message=msg,
        detail=mask_sensitive_text(last_error_text) if last_error_text else None,
        errorType=error_type,
    )


# ---------------------------------------------------------------------------
# API format metadata
# ---------------------------------------------------------------------------


API_FORMATS_INFO = [
    {
        "value": "openai_chat",
        "label": "OpenAI Chat Completions",
        "endpoint": "/v1/chat/completions",
        "description": "OpenAI-compatible chat API (most providers support this)",
    },
    {
        "value": "anthropic_messages",
        "label": "Anthropic Messages",
        "endpoint": "/v1/messages",
        "description": "Anthropic Claude native Messages API",
    },
    {
        "value": "openai_responses",
        "label": "OpenAI Responses",
        "endpoint": "/v1/responses",
        "description": "OpenAI Responses API (used by Codex)",
    },
]


def get_api_formats() -> list[dict]:
    """Return supported API format metadata."""
    return API_FORMATS_INFO.copy()
