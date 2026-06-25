"""Bug-142: Redis 缓存击穿/雪崩.
设计:
  - 缓存击穿防护: singleflight (同 key 只查一次后端)
  - 缓存雪崩防护: 过期时间抖动 (jitter)
  - 空值缓存 (防止穿透)
  - 互斥锁 (mutex lock) 防止并发重建
  - 后端风暴: 限流 + 退避
  - 命中/未命中统计
"""

from __future__ import annotations

import random
import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class CacheState(StrEnum):
    HIT = "HIT"
    MISS = "MISS"
    NEGATIVE_HIT = "NEGATIVE_HIT"  # 命中空值缓存
    LOCKED = "LOCKED"  # 被其他线程锁定重建
    ERROR = "ERROR"


@dataclass
class CacheConfig:
    default_ttl: float = 60.0
    jitter_ratio: float = 0.2  # 过期抖动 ±20%
    negative_ttl: float = 5.0  # 空值缓存时间
    lock_ttl: float = 5.0  # 互斥锁持有时间
    lock_wait_timeout: float = 1.0
    enable_negative_cache: bool = True
    enable_jitter: bool = True


@dataclass
class CacheEntry:
    key: str
    value: Any
    expires_at: float
    is_negative: bool = False
    version: int = 0


class SingleFlight:
    """同 key 合并请求, 只放行一个真正查后端."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._inflight: dict[str, threading.Event] = {}
        self._results: dict[str, Any] = {}

    def do(self, key: str, fn: Callable[[], Any]) -> tuple[bool, Any]:
        with self._lock:
            ev = self._inflight.get(key)
            if ev is not None:
                first = False
            else:
                ev = threading.Event()
                self._inflight[key] = ev
                first = True
        if first:
            try:
                result = fn()
                with self._lock:
                    self._results[key] = result
                ev.set()
                return True, result
            except Exception as e:
                with self._lock:
                    self._results[key] = e
                ev.set()
                raise
            finally:
                with self._lock:
                    self._inflight.pop(key, None)
        else:
            ev.wait(timeout=2.0)
            with self._lock:
                r = self._results.get(key)
            if isinstance(r, Exception):
                raise r
            return False, r


class CacheGuard:
    """Redis 缓存击穿/雪崩防护器 (内存模拟)."""

    def __init__(self, config: CacheConfig | None = None) -> None:
        self.config = config or CacheConfig()
        self._lock = threading.RLock()
        self._store: dict[str, CacheEntry] = {}
        self._locks: dict[str, tuple[str, float]] = {}  # key -> (token, expires_at)
        self._single = SingleFlight()
        self._stats = {"hit": 0, "miss": 0, "negative": 0, "lock_wait": 0, "set": 0, "evict": 0}

    def _now(self) -> float:
        return time.time()

    def _apply_jitter(self, ttl: float) -> float:
        if not self.config.enable_jitter or self.config.jitter_ratio <= 0:
            return ttl
        delta = ttl * self.config.jitter_ratio
        return max(0.0, ttl + random.uniform(-delta, delta))

    def _purge(self) -> None:
        with self._lock:
            now = self._now()
            expired = [k for k, e in self._store.items() if e.expires_at > 0 and now > e.expires_at]
            for k in expired:
                self._store.pop(k, None)
            self._stats["evict"] += len(expired)
            # 锁过期
            for k in list(self._locks.keys()):
                _, exp = self._locks[k]
                if now > exp:
                    self._locks.pop(k, None)

    def get(self, key: str) -> tuple[CacheState, Any]:
        self._purge()
        with self._lock:
            e = self._store.get(key)
            if e is None:
                self._stats["miss"] += 1
                return CacheState.MISS, None
            if e.expires_at > 0 and self._now() > e.expires_at:
                self._store.pop(key, None)
                self._stats["miss"] += 1
                return CacheState.MISS, None
            if e.is_negative:
                self._stats["negative"] += 1
                return CacheState.NEGATIVE_HIT, None
            self._stats["hit"] += 1
            return CacheState.HIT, e.value

    def set(self, key: str, value: Any, ttl: float | None = None) -> bool:
        self._purge()
        with self._lock:
            actual_ttl = self._apply_jitter(ttl if ttl is not None else self.config.default_ttl)
            self._store[key] = CacheEntry(
                key=key,
                value=value,
                expires_at=self._now() + actual_ttl if actual_ttl > 0 else 0.0,
            )
            self._stats["set"] += 1
            return True

    def set_negative(self, key: str, ttl: float | None = None) -> bool:
        if not self.config.enable_negative_cache:
            return False
        self._purge()
        with self._lock:
            actual_ttl = self._apply_jitter(ttl if ttl is not None else self.config.negative_ttl)
            self._store[key] = CacheEntry(
                key=key,
                value=None,
                expires_at=self._now() + actual_ttl if actual_ttl > 0 else 0.0,
                is_negative=True,
            )
            return True

    def delete(self, key: str) -> bool:
        with self._lock:
            return self._store.pop(key, None) is not None

    def acquire_lock(self, key: str) -> str | None:
        with self._lock:
            now = self._now()
            existing = self._locks.get(key)
            if existing is not None and existing[1] > now:
                return None
            token = uuid.uuid4().hex
            self._locks[key] = (token, now + self.config.lock_ttl)
            return token

    def release_lock(self, key: str, token: str) -> bool:
        with self._lock:
            existing = self._locks.get(key)
            if existing is None or existing[0] != token:
                return False
            self._locks.pop(key, None)
            return True

    def get_or_load(self, key: str, loader: Callable[[], Any], ttl: float | None = None) -> tuple[CacheState, Any]:
        """带击穿防护的 get-or-load."""
        state, val = self.get(key)
        if state == CacheState.HIT:
            return state, val
        if state == CacheState.NEGATIVE_HIT:
            return state, None
        # 未命中, 尝试获取锁
        token = self.acquire_lock(key)
        if token is None:
            with self._lock:
                self._stats["lock_wait"] += 1
            # 等一会儿, 看其他线程是否填好
            deadline = self._now() + self.config.lock_wait_timeout
            while self._now() < deadline:
                time.sleep(0.02)
                state, val = self.get(key)
                if state == CacheState.HIT:
                    return state, val
            return CacheState.LOCKED, None
        try:
            _is_first, val = self._single.do(key, loader)
            if val is None:
                self.set_negative(key)
                return CacheState.NEGATIVE_HIT, None
            self.set(key, val, ttl)
            return CacheState.HIT, val
        finally:
            self.release_lock(key, token)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
            self._locks.clear()

    def stats(self) -> dict[str, Any]:
        with self._lock:
            total = self._stats["hit"] + self._stats["miss"]
            hit_rate = (self._stats["hit"] / total) if total > 0 else 0.0
            return {**self._stats, "entries": len(self._store), "hit_rate": round(hit_rate, 4)}
