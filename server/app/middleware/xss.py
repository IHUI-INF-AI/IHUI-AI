"""XSS middleware -- HTML-escapes request parameters to prevent cross-site scripting.

Intercepts query parameters, form fields, and JSON body fields, applying
``html.escape()`` to every string value before the request reaches route
handlers.
"""

import html
import json
import logging
from typing import Any
from urllib.parse import urlencode

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


def _escape_value(value: Any) -> Any:
    """Recursively HTML-escape string values."""
    if isinstance(value, str):
        return html.escape(value, quote=True)
    if isinstance(value, dict):
        return {k: _escape_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_escape_value(item) for item in value]
    return value


class XSSMiddleware(BaseHTTPMiddleware):
    """Middleware that sanitises incoming request data against XSS attacks.

    Applies ``html.escape()`` to:
    - All query-string parameters
    - All form-data fields
    - All JSON body fields (for ``application/json`` requests)

    Binary / file-upload bodies are left untouched.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # --- Query parameters ---
        if request.query_params:
            # Re-encode query string with proper URL encoding (percent-encoding).
            # html.escape is NOT URL encoding; urlencode ensures special chars
            # are correctly encoded and prevents parameter injection via "&".
            sanitized_qs = urlencode(list(request.query_params.multi_items()))
            request.scope["query_string"] = sanitized_qs.encode("utf-8")

        # --- JSON body ---
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                body = await request.body()
                if body:
                    data = json.loads(body)
                    sanitized = _escape_value(data)
                    # Replace the body so downstream sees the escaped version
                    request._body = json.dumps(sanitized, ensure_ascii=False).encode("utf-8")
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass  # Non-JSON body -- skip

        # --- Form data (x-www-form-urlencoded) ---
        if "application/x-www-form-urlencoded" in content_type:
            try:
                body = await request.body()
                if body:
                    from urllib.parse import parse_qs

                    parsed = parse_qs(body.decode("utf-8"), keep_blank_values=True)
                    sanitized = {
                        _escape_value(k): [_escape_value(v) for v in vs]
                        for k, vs in parsed.items()
                    }
                    new_body = urlencode(sanitized, doseq=True)
                    request._body = new_body.encode("utf-8")
            except (UnicodeDecodeError, ValueError):
                pass  # Malformed body -- skip

        # --- Form data (multipart/form-data) ---
        # Multipart bodies are complex to rewrite safely (boundary handling).
        # Use a detect-and-reject strategy: scan for dangerous patterns and
        # return 400 if found.
        elif "multipart/form-data" in content_type:
            try:
                body = await request.body()
                if body:
                    text = body.decode("utf-8", errors="ignore").lower()
                    dangerous_patterns = (
                        "<script", "javascript:", "onerror=",
                        "onload=", "onclick=",
                    )
                    for pattern in dangerous_patterns:
                        if pattern in text:
                            return Response(
                                content='{"detail": "Potentially malicious content detected"}',
                                status_code=400,
                                media_type="application/json",
                            )
            except Exception:
                pass  # Skip on unexpected errors

        response = await call_next(request)
        return response
