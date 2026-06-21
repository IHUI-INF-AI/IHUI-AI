import asyncio
import hashlib
import logging
import secrets
import time
from collections import defaultdict
from collections.abc import Callable
from datetime import datetime, timedelta

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

class RateLimiter:
    def __init__(
        self,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
        burst_size: int = 10
    ):
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.burst_size = burst_size
        self._requests: dict[str, list] = defaultdict(list)
        self._lock = asyncio.Lock()

    def _get_client_key(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        if request.client:
            return request.client.host

        return "unknown"

    async def is_allowed(self, request: Request) -> tuple:
        key = self._get_client_key(request)
        now = time.time()

        async with self._lock:
            requests = self._requests[key]

            requests[:] = [t for t in requests if now - t < 3600]

            minute_ago = now - 60
            minute_requests = sum(1 for t in requests if t > minute_ago)

            hour_requests = len(requests)

            if minute_requests >= self.requests_per_minute:
                retry_after = int(60 - (now - min(t for t in requests if t > minute_ago)))
                return False, f"超过每分钟请求限制({self.requests_per_minute})", retry_after

            if hour_requests >= self.requests_per_hour:
                retry_after = int(3600 - (now - requests[0]))
                return False, f"超过每小时请求限制({self.requests_per_hour})", retry_after

            requests.append(now)
            return True, None, 0

    async def __call__(self, request: Request, call_next: Callable):
        allowed, message, retry_after = await self.is_allowed(request)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "请求过于频繁",
                    "message": message,
                    "retry_after": retry_after
                },
                headers={"Retry-After": str(retry_after)}
            )

        return await call_next(request)


class SecurityHeaders:
    def __init__(self):
        self.headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
        }

    async def __call__(self, request: Request, call_next: Callable):
        response = await call_next(request)

        for header, value in self.headers.items():
            response.headers[header] = value

        return response


class InputValidator:
    SQL_KEYWORDS = [
        "SELECT", "INSERT", "UPDATE", "DELETE", "DROP", "UNION",
        "OR", "AND", "WHERE", "FROM", "INTO", "VALUES", "SET"
    ]

    XSS_PATTERNS = [
        "<script", "</script>", "javascript:", "onerror=", "onload=",
        "eval(", "document.", "window.", "alert("
    ]

    @classmethod
    def sanitize_string(cls, value: str) -> str:
        if not isinstance(value, str):
            return value

        sanitized = value.strip()

        for pattern in cls.XSS_PATTERNS:
            sanitized = sanitized.replace(pattern.lower(), "")
            sanitized = sanitized.replace(pattern.upper(), "")

        return sanitized

    @classmethod
    def check_sql_injection(cls, value: str) -> bool:
        if not isinstance(value, str):
            return False

        upper_value = value.upper()

        for keyword in cls.SQL_KEYWORDS:
            if keyword in upper_value and ("'" in value or '"' in value or ";" in value):
                return True

        return False

    @classmethod
    def validate_file_type(cls, filename: str, allowed_types: list) -> bool:
        if not filename:
            return False

        ext = filename.lower().split(".")[-1] if "." in filename else ""
        return ext in allowed_types


class CSRFProtection:
    def __init__(self, secret_key: str | None = None):
        self.secret_key = secret_key or secrets.token_urlsafe(32)
        self._tokens: dict[str, datetime] = {}

    def generate_token(self, session_id: str) -> str:
        timestamp = str(time.time())
        data = f"{session_id}:{timestamp}:{self.secret_key}"
        token = hashlib.sha256(data.encode()).hexdigest()

        self._tokens[token] = datetime.now() + timedelta(hours=24)

        return token

    def validate_token(self, token: str, session_id: str) -> bool:
        if not token or token not in self._tokens:
            return False

        if datetime.now() > self._tokens[token]:
            del self._tokens[token]
            return False

        return True

    def cleanup_expired(self):
        now = datetime.now()
        expired = [t for t, exp in self._tokens.items() if now > exp]
        for token in expired:
            del self._tokens[token]


class SecurityMiddleware:
    def __init__(
        self,
        rate_limit_per_minute: int = 60,
        rate_limit_per_hour: int = 1000
    ):
        self.rate_limiter = RateLimiter(
            requests_per_minute=rate_limit_per_minute,
            requests_per_hour=rate_limit_per_hour
        )
        self.security_headers = SecurityHeaders()
        self.csrf = CSRFProtection()

    async def __call__(self, request: Request, call_next: Callable):
        response = await self.rate_limiter(request, call_next)

        if isinstance(response, JSONResponse) and response.status_code == 429:
            return response

        for header, value in self.security_headers.headers.items():
            response.headers[header] = value

        return response

    def get_csrf_token(self, session_id: str) -> str:
        return self.csrf.generate_token(session_id)

    def validate_csrf(self, token: str, session_id: str) -> bool:
        return self.csrf.validate_token(token, session_id)


security_middleware = SecurityMiddleware()
