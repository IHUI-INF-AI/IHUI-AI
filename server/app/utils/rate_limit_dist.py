"""Bug-68: API 限流令牌桶分布式化 (Redis Lua 滑动窗口).

设计:
  - 经典令牌桶 + 滑动窗口
  - 分布式: 通过 Redis Lua 脚本保证多实例原子计数
  - 维度: (key, bucket) 复合
  - 限流维度: ip / user / api_key / tenant / 全局
  - 自定义: 每条规则 (path, limit, window, strategy)
  - 限流时返回 Retry-After 头

使用:
    from app.utils.rate_limit_dist import rate_limiter, RateLimitExceeded

    @app.get("/api/v1/x")
    @rate_limiter.limit(scope="ip", rule="api_x", limit=10, window=1)
    def handler(...): ...
"""

import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 60
DEFAULT_WINDOW_SEC = 60
DEFAULT_SCOPE = "ip"


# Lua: 滑动窗口 (固定窗口 + 原子递增)
# KEYS[1] = key
# ARGV[1] = limit
# ARGV[2] = window_ms
# ARGV[3] = now_ms
# 返回: [allowed, count, reset_after_ms]
_SLIDING_WINDOW_SCRIPT = """
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])

-- 清理窗口外
redis.call('ZREMRANGEBYSCORE', key, 0, now_ms - window_ms)
local count = redis.call('ZCARD', key)
if count >= limit then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local reset_after = window_ms
    if oldest[2] then
        reset_after = math.max(0, tonumber(oldest[2]) + window_ms - now_ms)
    end
    return {0, count, reset_after}
end
redis.call('ZADD', key, now_ms, now_ms .. ':' .. math.random(1, 1e9))
redis.call('PEXPIRE', key, window_ms)
return {1, count + 1, window_ms}
"""


# Lua: 令牌桶
# KEYS[1] = bucket_key
# ARGV[1] = capacity
# ARGV[2] = refill_per_sec
# ARGV[3] = now_ms
# ARGV[4] = cost
# 返回: [allowed, remaining, retry_after_ms]
_TOKEN_BUCKET_SCRIPT = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then
    tokens = capacity
    ts = now_ms
end
-- 补 token
local elapsed = math.max(0, now_ms - ts) / 1000.0
tokens = math.min(capacity, tokens + elapsed * refill)
if tokens >= cost then
    tokens = tokens - cost
    redis.call('HMSET', key, 'tokens', tokens, 'ts', now_ms)
    redis.call('PEXPIRE', key, 60000)
    return {1, math.floor(tokens), 0}
else
    local need = cost - tokens
    local retry_after = math.ceil(need / refill * 1000)
    redis.call('HMSET', key, 'tokens', tokens, 'ts', now_ms)
    redis.call('PEXPIRE', key, 60000)
    return {0, math.floor(tokens), retry_after}
end
"""


class RateLimitExceeded(Exception):
    """限流超出."""

    def __init__(self, scope: str, rule: str, retry_after: int, count: int, limit: int):
        self.scope = scope
        self.rule = rule
        self.retry_after = retry_after
        self.count = count
        self.limit = limit
        super().__init__(f"rate_limited:{scope}:{rule} retry_in={retry_after}ms")


@dataclass
class RateLimitRule:
    name: str
    limit: int
    window_sec: float
    strategy: str = "sliding_window"  # or "token_bucket"
    capacity: int | None = None
    refill_per_sec: float | None = None
    scope: str = DEFAULT_SCOPE  # ip / user / tenant / api_key / global

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "limit": self.limit,
            "window_sec": self.window_sec,
            "strategy": self.strategy,
            "scope": self.scope,
        }


class RateLimiter:
    """分布式限流器."""

    KEY_PREFIX = "zhs:ratelimit"

    def __init__(self):
        self._rules: dict[str, RateLimitRule] = {}
        self._lock = threading.Lock()
        self._lua_window = None
        self._lua_bucket = None
        self._scope_extractors: dict[str, Callable] = {}
        self._default_extractor: Callable | None = None
        self._total_allowed = 0
        self._total_blocked = 0
        self._register_default_extractors()

    def _register_default_extractors(self) -> None:
        self._scope_extractors["ip"] = self._extract_ip
        self._scope_extractors["user"] = self._extract_user
        self._scope_extractors["tenant"] = self._extract_tenant
        self._scope_extractors["api_key"] = self._extract_api_key
        self._scope_extractors["global"] = self._extract_global

    def set_extractor(self, scope: str, extractor: Callable) -> None:
        self._scope_extractors[scope] = extractor

    def _get_redis(self):
        # 委托到模块级 _get_redis, 便于 monkeypatch
        from app.utils.rate_limit_dist import _get_redis as _mgr

        return _mgr()

    def _get_lua(self, kind: str):
        r = self._get_redis()
        if r is None:
            return None
        try:
            if kind == "window":
                if self._lua_window is None:
                    self._lua_window = r.register_script(_SLIDING_WINDOW_SCRIPT)
                return self._lua_window
            elif kind == "bucket":
                if self._lua_bucket is None:
                    self._lua_bucket = r.register_script(_TOKEN_BUCKET_SCRIPT)
                return self._lua_bucket
        except Exception as e:
            logger.debug(f"register lua {kind} fail: {e}")
            return None
        return None

    # ----- 规则 -----
    def add_rule(self, rule: RateLimitRule) -> None:
        with self._lock:
            self._rules[rule.name] = rule

    def remove_rule(self, name: str) -> None:
        with self._lock:
            self._rules.pop(name, None)

    def get_rule(self, name: str) -> RateLimitRule | None:
        with self._lock:
            return self._rules.get(name)

    def list_rules(self) -> list:
        with self._lock:
            return [r.to_dict() for r in self._rules.values()]

    # ----- 提取 scope 值 -----
    def _extract_ip(self, request=None) -> str:
        if request is None:
            return "ip:unknown"
        try:
            return f"ip:{request.client.host if request.client else 'unknown'}"
        except Exception:
            return "ip:unknown"

    def _extract_user(self, request=None) -> str:
        try:
            from app.telemetry import get_request_context

            ctx = get_request_context() or {}
            uid = str(ctx.get("user_uuid", "")) or "anonymous"
            return f"user:{uid}"
        except Exception:
            return "user:unknown"

    def _extract_tenant(self, request=None) -> str:
        try:
            from app.core.tenant import get_current_tenant_id

            tid = get_current_tenant_id() or 0
            return f"tenant:{tid}"
        except Exception:
            return "tenant:0"

    def _extract_api_key(self, request=None) -> str:
        if request is None:
            return "apikey:unknown"
        try:
            key = request.headers.get("X-API-Key", "none")
            return f"apikey:{key}"
        except Exception:
            return "apikey:unknown"

    def _extract_global(self, request=None) -> str:
        return "global:all"

    # ----- 检查 -----
    def check(self, rule_name: str, request=None) -> dict:
        """检查限流. 返回 {allowed, count, limit, retry_after_ms, remaining}"""
        rule = self.get_rule(rule_name)
        if rule is None:
            return {
                "allowed": True,
                "count": 0,
                "limit": 0,
                "retry_after_ms": 0,
                "remaining": -1,
                "rule": rule_name,
            }
        scope_key = self._scope_extractors.get(rule.scope, self._extract_ip)(request)
        bucket_key = f"{self.KEY_PREFIX}:{rule_name}:{scope_key}"
        r = self._get_redis()
        if r is None:
            # 降级: 进程内计数
            return self._check_inproc(bucket_key, rule)
        if rule.strategy == "token_bucket":
            return self._check_token_bucket(bucket_key, rule, r)
        return self._check_sliding_window(bucket_key, rule, r)

    def _check_inproc(self, key: str, rule: RateLimitRule) -> dict:
        # 简单进程内: 用 dict 计数 + TTL 模拟
        from app.utils.rate_limit_dist import _inproc_state

        with _inproc_state["lock"]:
            data = _inproc_state["buckets"]
            now = time.time()
            entry = data.get(key, {"count": 0, "reset_at": now + rule.window_sec})
            if now >= entry["reset_at"]:
                entry = {"count": 0, "reset_at": now + rule.window_sec}
            entry["count"] += 1
            data[key] = entry
            allowed = entry["count"] <= rule.limit
            count = entry["count"]
        if allowed:
            self._total_allowed += 1
        else:
            self._total_blocked += 1
        return {
            "allowed": allowed,
            "count": count,
            "limit": rule.limit,
            "retry_after_ms": int(max(0, entry["reset_at"] - now) * 1000),
            "remaining": max(0, rule.limit - count),
            "rule": rule.name,
        }

    def _check_sliding_window(self, key: str, rule: RateLimitRule, r) -> dict:
        lua = self._get_lua("window")
        if lua is None:
            return self._check_inproc(key, rule)
        now_ms = int(time.time() * 1000)
        window_ms = int(rule.window_sec * 1000)
        try:
            allowed_int, count, reset_after = lua(keys=[key], args=[rule.limit, window_ms, now_ms])
        except Exception as e:
            logger.debug(f"sliding_window lua fail: {e}")
            return self._check_inproc(key, rule)
        allowed = bool(int(allowed_int))
        if allowed:
            self._total_allowed += 1
        else:
            self._total_blocked += 1
        return {
            "allowed": allowed,
            "count": int(count),
            "limit": rule.limit,
            "retry_after_ms": int(reset_after),
            "remaining": max(0, rule.limit - int(count)),
            "rule": rule.name,
        }

    def _check_token_bucket(self, key: str, rule: RateLimitRule, r) -> dict:
        lua = self._get_lua("bucket")
        if lua is None:
            return self._check_inproc(key, rule)
        now_ms = int(time.time() * 1000)
        capacity = rule.capacity or rule.limit
        refill = rule.refill_per_sec or (rule.limit / rule.window_sec)
        try:
            allowed_int, remaining, retry_after = lua(keys=[key], args=[capacity, refill, now_ms, 1])
        except Exception as e:
            logger.debug(f"token_bucket lua fail: {e}")
            return self._check_inproc(key, rule)
        allowed = bool(int(allowed_int))
        if allowed:
            self._total_allowed += 1
        else:
            self._total_blocked += 1
        return {
            "allowed": allowed,
            "count": capacity - int(remaining),
            "limit": capacity,
            "retry_after_ms": int(retry_after),
            "remaining": int(remaining),
            "rule": rule.name,
        }

    def stats(self) -> dict:
        return {
            "rules": self.list_rules(),
            "total_allowed": self._total_allowed,
            "total_blocked": self._total_blocked,
            "block_rate": round(self._total_blocked / max(1, self._total_allowed + self._total_blocked), 4),
        }

    # ----- 装饰器 -----
    def limit(
        self,
        scope: str = DEFAULT_SCOPE,
        rule: str = "",
        limit: int = DEFAULT_LIMIT,
        window: float = DEFAULT_WINDOW_SEC,
        strategy: str = "sliding_window",
    ):
        """装饰器: 在 endpoint 上加限流."""
        if not rule:
            rule = f"auto_{scope}_{int(time.time() * 1000)}"
        self.add_rule(
            RateLimitRule(
                name=rule,
                limit=limit,
                window_sec=window,
                strategy=strategy,
                scope=scope,
            )
        )
        from functools import wraps

        def deco(fn: Callable) -> Callable:
            import inspect

            if inspect.iscoroutinefunction(fn):

                @wraps(fn)
                async def async_w(*args, **kwargs):
                    request = kwargs.get("request") or (args[0] if args else None)
                    result = self.check(rule, request)
                    if not result["allowed"]:
                        raise RateLimitExceeded(
                            scope=scope,
                            rule=rule,
                            retry_after=result["retry_after_ms"],
                            count=result["count"],
                            limit=result["limit"],
                        )
                    return await fn(*args, **kwargs)

                return async_w

            @wraps(fn)
            def sync_w(*args, **kwargs):
                request = kwargs.get("request") or (args[0] if args else None)
                result = self.check(rule, request)
                if not result["allowed"]:
                    raise RateLimitExceeded(
                        scope=scope,
                        rule=rule,
                        retry_after=result["retry_after_ms"],
                        count=result["count"],
                        limit=result["limit"],
                    )
                return fn(*args, **kwargs)

            return sync_w

        return deco


# 进程内 fallback 状态
_inproc_state: dict = {"buckets": {}, "lock": threading.Lock()}


def _get_redis():
    """模块级 redis 客户端获取 (供 monkeypatch / 业务覆盖)."""
    try:
        from app.utils.redis_client import get_redis

        return get_redis()
    except Exception as e:
        logger.debug(f"rate_limiter redis unavailable: {e}")
        return None


# 全局单例
rate_limiter = RateLimiter()
