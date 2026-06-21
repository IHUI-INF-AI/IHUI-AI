"""Bug-121: 缓存击穿防护 (singleflight + 后台刷新 + 热点探测).

设计:
  - singleflight: 同 key 并发请求合并为一次
  - 后台刷新: TTL 到期前异步刷新, 避免阻塞
  - 热点探测: 高频 key 自动延长 TTL
  - 降级: loader 失败时返回 stale
  - 注入: loader 函数由调用方提供
"""

import enum
import logging
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


class CacheEntryState(enum.StrEnum):
    FRESH = "fresh"
    STALE = "stale"
    LOADING = "loading"
    ERROR = "error"


@dataclass
class CacheEntry:
    key: str
    value: Any = None
    created_at: float = 0.0
    last_hit_at: float = 0.0
    expires_at: float = 0.0
    hit_count: int = 0
    state: str = CacheEntryState.FRESH.value
    error: str = ""
    loader_version: int = 0


@dataclass
class SingleFlightCall:
    key: str
    started_at: float
    event: threading.Event
    result: Any = None
    error: Exception | None = None
    finished: bool = False


class CacheBreakdownGuard:
    """缓存击穿防护控制器."""

    def __init__(
        self,
        default_ttl_sec: float = 60.0,
        hot_threshold: int = 100,
        hot_ttl_multiplier: float = 3.0,
        stale_grace_sec: float = 30.0,
        max_entries: int = 5000,
    ):
        self._lock = threading.RLock()
        self._default_ttl = default_ttl_sec
        self._hot_threshold = hot_threshold
        self._hot_multiplier = hot_ttl_multiplier
        self._stale_grace = stale_grace_sec
        self._max_entries = max_entries
        self._entries: dict[str, CacheEntry] = {}
        self._inflight: dict[str, SingleFlightCall] = {}
        self._recent_hits: deque[tuple[str, float]] = deque(maxlen=20000)
        self._total_get = 0
        self._total_hit = 0
        self._total_miss = 0
        self._total_merged = 0
        self._total_error = 0
        self._total_hot = 0
        self._total_stale_served = 0

    def get(self, key: str, loader: Callable[[], Any], ttl_sec: float | None = None) -> Any:
        """获取缓存值. miss 或过期时由 loader 加载. 并发请求合并."""
        with self._lock:
            self._total_get += 1
            self._record_hit(key)
            entry = self._entries.get(key)
            if entry is not None:
                if entry.state == CacheEntryState.FRESH.value and entry.expires_at > time.time():
                    entry.hit_count += 1
                    entry.last_hit_at = time.time()
                    # 热点检测: 累计 hit 超过阈值, 延长 expires_at
                    if entry.hit_count >= self._hot_threshold:
                        span = entry.expires_at - entry.created_at
                        new_span = max(span, (ttl_sec or self._default_ttl) * self._hot_multiplier)
                        entry.expires_at = entry.created_at + new_span
                        self._total_hot += 1
                    self._total_hit += 1
                    return entry.value
                # 已过期但 stale grace 内: 返回 stale 并后台刷新
                if entry.expires_at + self._stale_grace > time.time():
                    self._total_stale_served += 1
                    entry.state = CacheEntryState.STALE.value
                    self._background_refresh(key, loader, ttl_sec)
                    return entry.value
            # miss: 走 singleflight
            self._total_miss += 1
            return self._singleflight_load(key, loader, ttl_sec)

    def set(self, key: str, value: Any, ttl_sec: float | None = None) -> None:
        with self._lock:
            ttl = ttl_sec or self._default_ttl
            entry = CacheEntry(
                key=key,
                value=value,
                created_at=time.time(),
                expires_at=time.time() + ttl,
                state=CacheEntryState.FRESH.value,
            )
            self._entries[key] = entry
            self._evict_if_needed()

    def invalidate(self, key: str) -> bool:
        with self._lock:
            return self._entries.pop(key, None) is not None

    def _singleflight_load(self, key: str, loader: Callable[[], Any], ttl_sec: float | None = None) -> Any:
        with self._lock:
            existing = self._inflight.get(key)
            if existing is not None:
                self._total_merged += 1
                # 等候
                ev = existing.event
            else:
                # 启动新加载
                call = SingleFlightCall(key=key, started_at=time.time(), event=threading.Event())
                self._inflight[key] = call
                ev = None
        if ev is not None:
            ev.wait(timeout=ttl_sec or self._default_ttl)
            with self._lock:
                call = self._inflight.get(key)
            if call is not None and call.finished:
                if call.error is not None:
                    return self._serve_stale_or_raise(key, call.error)
                return call.result
            # 等待超时: 走降级
            return self._serve_stale_or_raise(key, TimeoutError("singleflight timeout"))
        # 首次执行
        try:
            value = loader()
            with self._lock:
                self._store_loaded(key, value, ttl_sec or self._default_ttl)
                call = self._inflight.pop(key, None)
                if call is not None:
                    call.result = value
                    call.finished = True
                    call.event.set()
            return value
        except Exception as e:
            with self._lock:
                self._total_error += 1
                call = self._inflight.pop(key, None)
                if call is not None:
                    call.error = e
                    call.finished = True
                    call.event.set()
            return self._serve_stale_or_raise(key, e)

    def _background_refresh(self, key: str, loader: Callable[[], Any], ttl_sec: float | None) -> None:
        """后台异步刷新. 不影响返回."""
        t = threading.Thread(target=self._do_refresh, args=(key, loader, ttl_sec), daemon=True)
        t.start()

    def _do_refresh(self, key: str, loader: Callable[[], Any], ttl_sec: float | None) -> None:
        try:
            value = loader()
            with self._lock:
                self._store_loaded(key, value, ttl_sec or self._default_ttl)
        except Exception:
            logger.warning("Caught unexpected exception")

    def _store_loaded(self, key: str, value: Any, ttl: float) -> None:
        with self._lock:
            # 已有 entry: 仅在 value 更新时刷新 ttl, 否则保持
            existing = self._entries.get(key)
            if existing is not None and existing.value == value:
                # 值未变, 不动 entry (让 hot 机制处理)
                return
            entry = CacheEntry(
                key=key,
                value=value,
                created_at=time.time(),
                expires_at=time.time() + ttl,
                state=CacheEntryState.FRESH.value,
            )
            self._entries[key] = entry
            self._evict_if_needed()

    def _serve_stale_or_raise(self, key: str, err: Exception) -> Any:
        with self._lock:
            entry = self._entries.get(key)
            if entry is not None and entry.state != CacheEntryState.ERROR.value:
                entry.state = CacheEntryState.STALE.value
                self._total_stale_served += 1
                return entry.value
        raise err

    def _record_hit(self, key: str) -> None:
        with self._lock:
            self._recent_hits.append((key, time.time()))

    def _evict_if_needed(self) -> None:
        with self._lock:
            if len(self._entries) <= self._max_entries:
                return
            # LRU 驱逐: 按 last_hit_at 排序
            arr = sorted(self._entries.values(), key=lambda e: e.last_hit_at)
            n = len(arr) - self._max_entries
            for e in arr[:n]:
                self._entries.pop(e.key, None)

    def hot_keys(self, top: int = 10) -> list[tuple[str, int]]:
        with self._lock:
            counter: dict[str, int] = {}
            for k, _ in self._recent_hits:
                counter[k] = counter.get(k, 0) + 1
            return sorted(counter.items(), key=lambda x: x[1], reverse=True)[:top]

    def get_entry(self, key: str) -> CacheEntry | None:
        with self._lock:
            return self._entries.get(key)

    def list_entries(self) -> list[CacheEntry]:
        with self._lock:
            return list(self._entries.values())

    def stats(self) -> dict:
        with self._lock:
            return {
                "default_ttl": self._default_ttl,
                "total_get": self._total_get,
                "hit": self._total_hit,
                "miss": self._total_miss,
                "merged": self._total_merged,
                "error": self._total_error,
                "hot_promoted": self._total_hot,
                "stale_served": self._total_stale_served,
                "entries": len(self._entries),
                "inflight": len(self._inflight),
                "hit_rate": (self._total_hit / self._total_get) if self._total_get else 0.0,
            }

    def reset_stats(self) -> None:
        with self._lock:
            self._total_get = 0
            self._total_hit = 0
            self._total_miss = 0
            self._total_merged = 0
            self._total_error = 0
            self._total_hot = 0
            self._total_stale_served = 0

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
            self._inflight.clear()
            self._recent_hits.clear()


# 全局单例
cache_guard = CacheBreakdownGuard()
