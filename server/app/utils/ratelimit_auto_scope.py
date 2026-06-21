"""Bug-77: 限流维度自动识别 (Headers 解析).

设计:
  - 自动从 HTTP Headers 中提取限流 key, 减少业务方重复声明 scope
  - 优先级: X-Tenant-ID > X-User-UUID > X-API-Key > X-Forwarded-For > X-Real-IP > client.host > ip
  - 缓存已解析 key 5s, 减少 header 解析开销
  - 也支持业务通过 HeaderRule 自定义提取规则

使用:
    from app.utils.ratelimit_auto_scope import scope_resolver

    key = scope_resolver.resolve(request, scope="tenant")
    # 等同于:  headers.get("X-Tenant-ID", "0")
"""

import logging
import threading
import time
from dataclasses import dataclass

logger = logging.getLogger(__name__)

DEFAULT_HEADER_RULES: dict[str, list[str]] = {
    "tenant": ["X-Tenant-ID", "X-Tenant-Id", "X-Tid"],
    "user": ["X-User-UUID", "X-User-Id", "X-Userid", "X-Uuid"],
    "api_key": ["X-API-Key", "X-Api-Key", "Authorization"],
    "ip": ["X-Forwarded-For", "X-Real-IP", "X-Client-IP"],
}

DEFAULT_FALLBACK = "ip"


@dataclass
class ResolverStats:
    total_resolve: int = 0
    cache_hit: int = 0
    cache_miss: int = 0
    fallback_used: int = 0
    custom_rule_used: int = 0

    def to_dict(self) -> dict:
        return {
            "total_resolve": self.total_resolve,
            "cache_hit": self.cache_hit,
            "cache_miss": self.cache_miss,
            "fallback_used": self.fallback_used,
            "custom_rule_used": self.custom_rule_used,
        }


class ScopeResolver:
    """自动从 headers 解析限流 scope key."""

    def __init__(self, cache_ttl_sec: float = 5.0, max_cache: int = 4096):
        self._rules: dict[str, list[str]] = {k: list(v) for k, v in DEFAULT_HEADER_RULES.items()}
        self._lock = threading.Lock()
        self._cache: dict[str, tuple[str, float]] = {}
        self._cache_ttl = cache_ttl_sec
        self._max_cache = max_cache
        self._stats = ResolverStats()

    def add_rule(self, scope: str, header_names: list[str]) -> None:
        with self._lock:
            self._rules[scope] = list(header_names)

    def get_rules(self) -> dict[str, list[str]]:
        with self._lock:
            return {k: list(v) for k, v in self._rules.items()}

    def _cache_get(self, k: str) -> str | None:
        with self._lock:
            v = self._cache.get(k)
            if v is None:
                return None
            val, ts = v
            if time.time() - ts > self._cache_ttl:
                self._cache.pop(k, None)
                return None
            return val

    def _cache_set(self, k: str, v: str) -> None:
        with self._lock:
            if len(self._cache) >= self._max_cache:
                # 简单清理: 删 1/4 最早的
                items = sorted(self._cache.items(), key=lambda kv: kv[1][1])
                for kk, _ in items[: self._max_cache // 4]:
                    self._cache.pop(kk, None)
            self._cache[k] = (v, time.time())

    def _extract_from_headers(self, scope: str, headers: dict[str, str]) -> str:
        rule = self._rules.get(scope, [])
        for h in rule:
            val = headers.get(h) or headers.get(h.lower()) or headers.get(h.upper())
            if val:
                if h.lower() == "authorization" and val.lower().startswith("bearer "):
                    val = val[7:].strip()
                if h.lower() == "x-forwarded-for" and "," in val:
                    val = val.split(",")[0].strip()
                return val.strip()
        return ""

    def resolve(self, request=None, scope: str = DEFAULT_FALLBACK) -> str:
        """从 request 中自动解析 scope key."""
        self._stats.total_resolve += 1
        # 拿 headers dict
        headers: dict[str, str] = {}
        client_ip = ""
        if request is not None:
            # 尝试标准 FastAPI Request
            try:
                headers = dict(request.headers) if hasattr(request, "headers") else {}
            except Exception:
                headers = {}
            try:
                client = getattr(request, "client", None)
                if client is not None:
                    client_ip = getattr(client, "host", "") or ""
            except Exception:
                client_ip = ""

        # 缓存 key = (scope, headers 序列化, client_ip)
        cache_key = f"{scope}|" + "|".join(f"{k}={v}" for k, v in sorted(headers.items())) + f"|{client_ip}"
        cached = self._cache_get(cache_key)
        if cached is not None:
            self._stats.cache_hit += 1
            return cached
        self._stats.cache_miss += 1

        val = self._extract_from_headers(scope, headers)
        if not val and scope != "ip":
            # 跨 scope 降级
            val = self._extract_from_headers("ip", headers)
            if val:
                self._stats.custom_rule_used += 1
        if not val and client_ip:
            val = client_ip
            self._stats.fallback_used += 1
        if not val:
            val = f"{scope}:unknown"
            self._stats.fallback_used += 1

        # 加前缀避免不同 scope key 撞桶
        final = f"{scope}:{val}"
        self._cache_set(cache_key, final)
        return final

    def clear_cache(self) -> None:
        with self._lock:
            self._cache.clear()

    def stats(self) -> dict:
        return self._stats.to_dict()


# 全局单例
scope_resolver = ScopeResolver()
