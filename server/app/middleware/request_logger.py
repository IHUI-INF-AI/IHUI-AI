"""
Structured request logging middleware.
"""

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request

logger = logging.getLogger("request_logger")


class RequestLoggerMiddleware(BaseHTTPMiddleware):
    """Log every request with method, path, status, duration."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000

        logger.info(
            "%s %s → %d  (%.0f ms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response
