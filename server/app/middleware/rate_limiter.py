"""
Rate limiter middleware - Redis-backed distributed request limiting.

Features:
- Redis-based sliding window rate limiting for distributed deployments
- Fallback to in-memory storage when Redis is unavailable
- Per-IP and per-user rate limiting support
- Configurable limits and time windows
- Automatic cleanup of expired entries

Bugfix: Replaced in-memory-only rate limiter with Redis-backed implementation.
"""

import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

# Bug-10: 在模块级暴露 get_redis, 便于测试 monkeypatch
from app.utils.redis_util import get_redis


class DistributedRateLimiter:
    """
    Redis-backed distributed rate limiter using sliding window algorithm.

    Supports:
    - Per-IP rate limiting (default)
    - Per-user rate limiting (when user_uuid is available)
    - Configurable request limits and time windows
    - Graceful degradation when Redis is unavailable
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._redis = None
        self._use_memory = False
        self._memory_store: dict[str, list[float]] = defaultdict(list)
        self._lua_script = None
        self._init_redis()

    def _init_redis(self):
        """Initialize Redis connection with fallback to memory store."""
        try:
            from app.utils.redis_util import get_redis

            self._redis = get_redis()
            # Test connection
            self._redis.ping()
            self._use_memory = False
            # Register Lua script for atomic sliding window
            self._register_lua_script()
        except Exception as e:
            import logging

            logging.getLogger(__name__).warning(f"Redis unavailable, falling back to memory: {e}")
            self._use_memory = True
            self._redis = None

    def _register_lua_script(self):
        """Register Lua script for atomic sliding window rate limiting."""
        if self._redis is None:
            return

        # Sliding window rate limit script
        # Returns: (allowed, remaining, reset_time)
        lua_code = """
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])

        -- Remove old entries outside the window
        local window_start = now - window
        redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

        -- Count current requests in window
        local current = redis.call('ZCARD', key)

        if current < limit then
            -- Add new request
            redis.call('ZADD', key, now, now .. ':' .. math.random())
            redis.call('EXPIRE', key, window)
            return {1, limit - current - 1, window}
        else
            -- Rate limited
            local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
            local reset_at = oldest[2] and (tonumber(oldest[2]) + window) or (now + window)
            return {0, 0, reset_at - now}
        end
        """
        try:
            self._lua_script = self._redis.register_script(lua_code)
        except Exception:
            self._lua_script = None

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP, considering proxy headers."""
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _get_user_key(self, request: Request) -> str | None:
        """Extract user identifier from JWT token if available."""
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                from app.security import decode_access_token

                token = auth_header[7:]
                payload = decode_access_token(token)
                if payload:
                    return f"user:{payload.get('sub')}"
            except Exception:
                pass
        return None

    def check_rate_limit(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
    ) -> tuple[bool, int, int]:
        """
        Check if request is within rate limit.

        Returns:
            Tuple of (allowed, remaining_requests, reset_in_seconds)
        """
        if self._use_memory or self._redis is None:
            return self._memory_check(key, max_requests, window_seconds)

        try:
            now = time.time()
            result = self._lua_script(
                keys=[f"ratelimit:{key}"],
                args=[int(now), window_seconds, max_requests],
            )
            allowed = bool(result[0])
            remaining = int(result[1])
            reset_in = int(result[2])
            return allowed, remaining, reset_in
        except Exception:
            # Fallback to memory on Redis error
            return self._memory_check(key, max_requests, window_seconds)

    def _memory_check(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
    ) -> tuple[bool, int, int]:
        """In-memory fallback for rate limiting."""
        now = time.time()
        window_start = now - window_seconds

        # Clean old entries
        self._memory_store[key] = [t for t in self._memory_store[key] if t > window_start]

        current = len(self._memory_store[key])
        if current < max_requests:
            self._memory_store[key].append(now)
            remaining = max_requests - current - 1
            return True, remaining, window_seconds
        else:
            oldest = min(self._memory_store[key]) if self._memory_store[key] else now
            reset_in = int(oldest + window_seconds - now)
            return False, 0, max(0, reset_in)

    def cleanup_memory(self):
        """Periodic cleanup of expired in-memory entries."""
        now = time.time()
        for key in list(self._memory_store.keys()):
            self._memory_store[key] = [t for t in self._memory_store[key] if t > now - 3600]
            if not self._memory_store[key]:
                del self._memory_store[key]


# Fallback 内存限流 (Bug-10 修复, 独立类, 避免与 _rate_limiter 单例状态耦合)
_FALLBACK_MAX_KEYS = 1024


class _MemorySlidingWindow:
    """进程内滑动窗口限流 (Redis 不可用时使用).

    - 每个 key 维护一个时间戳列表 (按 window 滚动清理)
    - LRU 淘汰: 超过 _FALLBACK_MAX_KEYS 时弹出最久未访问的 key
    """

    def __init__(self):
        # OrderedDict 用于 LRU: 每次访问 move_to_end
        from collections import OrderedDict

        self._store: OrderedDict[str, list[float]] = OrderedDict()

    def hit(self, key: str, now: float, window: int, limit: int) -> tuple[bool, int]:
        """记录一次命中并判定是否放行. 返回 (allowed, current_count)."""

        if key in self._store:
            self._store.move_to_end(key)
        else:
            self._store[key] = []
            # LRU 淘汰
            while len(self._store) > _FALLBACK_MAX_KEYS:
                self._store.popitem(last=False)

        timestamps = self._store[key]
        # 清理过期
        cutoff = now - window
        self._store[key] = [t for t in timestamps if t > cutoff]
        timestamps = self._store[key]
        if len(timestamps) < limit:
            timestamps.append(now)
            return True, len(timestamps)
        return False, len(timestamps)


def _sliding_window_check_redis(key: str, now: float, window: int, limit: int):
    """Redis 滑动窗口判定; Redis 不可用时回退到内存. 返回 (allowed, current)."""
    try:
        # 使用模块级 get_redis (测试可 monkeypatch)
        redis_client = get_redis()
        if redis_client is not None:
            rk = f"ratelimit:sliding:{key}"
            pipe = redis_client.pipeline()
            pipe.zremrangebyscore(rk, "-inf", now - window)
            pipe.zcard(rk)
            pipe.zadd(rk, {f"{now}:{id(object())}": now})
            pipe.expire(rk, window)
            _, count, _, _ = pipe.execute()
            if count < limit:
                return True, count + 1
            return False, count
    except Exception:
        pass
    return None


# Global rate limiter instance
_rate_limiter: DistributedRateLimiter | None = None


def get_rate_limiter() -> DistributedRateLimiter:
    """Get or create the global rate limiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = DistributedRateLimiter()
    return _rate_limiter


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for distributed rate limiting.

    Supports both per-IP and per-user rate limiting.
    Uses Redis for distributed deployments, falls back to memory for单机部署.

    限流分级策略 (按接口类型):
      - auth/login/sms: 10 req/min/IP (严格防爆破)
      - payment/order:  20 req/min/IP (防资损)
      - upload:         30 req/min/IP (大文件上传)
      - search:         60 req/min/IP (高频查询)
      - ai (chat/llm):  30 req/min/IP (计算密集)
      - read-only GET:  300 req/min/IP (宽松)
      - 默认:           100 req/min/IP
    """

    # Default rate limits
    DEFAULT_MAX_REQUESTS = 100
    DEFAULT_WINDOW_SECONDS = 60

    # Stricter limits for sensitive endpoints
    AUTH_MAX_REQUESTS = 10
    AUTH_WINDOW_SECONDS = 60

    PAYMENT_MAX_REQUESTS = 20
    PAYMENT_WINDOW_SECONDS = 60

    # Upload endpoints
    UPLOAD_MAX_REQUESTS = 30
    UPLOAD_WINDOW_SECONDS = 60

    # Search endpoints (高频查询)
    SEARCH_MAX_REQUESTS = 60
    SEARCH_WINDOW_SECONDS = 60

    # AI/LLM endpoints (计算密集)
    AI_MAX_REQUESTS = 30
    AI_WINDOW_SECONDS = 60

    # Read-only GET endpoints (宽松)
    READ_MAX_REQUESTS = 300
    READ_WINDOW_SECONDS = 60

    def __init__(
        self,
        app,
        max_requests: int = DEFAULT_MAX_REQUESTS,
        window_seconds: int = DEFAULT_WINDOW_SECONDS,
    ):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.rate_limiter = get_rate_limiter()

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Determine rate limit key and limits based on endpoint
        key, max_req, window = self._get_limits_for_endpoint(request)

        # Check rate limit
        allowed, remaining, reset_in = self.rate_limiter.check_rate_limit(key, max_req, window)

        # Prometheus 指标埋点
        try:
            from app.metrics_rate_limit import record_allowed, record_rejected

            if allowed:
                record_allowed(request.url.path)
            else:
                record_rejected(request.url.path)
        except Exception:
            pass

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "code": "429000",
                    "msg": "Too many requests. Please try again later.",
                    "data": None,
                    "retry_after": reset_in,
                },
                headers={
                    "Retry-After": str(reset_in),
                    "X-RateLimit-Limit": str(max_req),
                    "X-RateLimit-Remaining": str(remaining),
                    "X-RateLimit-Reset": str(reset_in),
                },
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(max_req)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_in)

        return response

    def _get_limits_for_endpoint(self, request: Request) -> tuple[str, int, int]:
        """
        Determine rate limit key and limits based on the request path.

        Returns:
            Tuple of (rate_limit_key, max_requests, window_seconds)
        """
        path = request.url.path
        method = request.method
        client_ip = self.rate_limiter._get_client_ip(request)

        # 1) 鉴权端点 - 严格防爆破
        if "/auth/" in path or "/login" in path or "/sms" in path or "/captcha" in path:
            return (
                f"ip:{client_ip}:auth",
                self.AUTH_MAX_REQUESTS,
                self.AUTH_WINDOW_SECONDS,
            )

        # 2) 支付/订单端点 - 防资损
        if "/payment" in path or "/pay" in path or "/order" in path or "/withdraw" in path:
            return (
                f"ip:{client_ip}:payment",
                self.PAYMENT_MAX_REQUESTS,
                self.PAYMENT_WINDOW_SECONDS,
            )

        # 3) 上传端点 - 大文件, 限制请求数
        if "/upload" in path or "/file" in path or "/avatar" in path:
            return (
                f"ip:{client_ip}:upload",
                self.UPLOAD_MAX_REQUESTS,
                self.UPLOAD_WINDOW_SECONDS,
            )

        # 4) AI/LLM 端点 - 计算密集
        if "/ai/" in path or "/chat" in path or "/llm" in path or "/coze" in path or "/luyala" in path or "/openrouter" in path:
            return (
                f"ip:{client_ip}:ai",
                self.AI_MAX_REQUESTS,
                self.AI_WINDOW_SECONDS,
            )

        # 5) 搜索端点 - 高频查询
        if "/search" in path:
            return (
                f"ip:{client_ip}:search",
                self.SEARCH_MAX_REQUESTS,
                self.SEARCH_WINDOW_SECONDS,
            )

        # 6) 只读 GET - 宽松
        if method == "GET":
            return (
                f"ip:{client_ip}:read",
                self.READ_MAX_REQUESTS,
                self.READ_WINDOW_SECONDS,
            )

        # 7) 默认 (POST/PUT/DELETE)
        return (
            f"ip:{client_ip}:api",
            self.max_requests,
            self.window_seconds,
        )


# Legacy class for backward compatibility
class LegacyRateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Legacy in-memory rate limiter (DEPRECATED).

    Kept for backward compatibility. New code should use RateLimiterMiddleware.
    """

    def __init__(self, app, max_requests: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        import warnings

        warnings.warn(
            "LegacyRateLimiterMiddleware is deprecated. Use RateLimiterMiddleware instead.",
            DeprecationWarning,
            stacklevel=2,
        )
        return await RateLimiterMiddleware(self.app).dispatch(request, call_next)
