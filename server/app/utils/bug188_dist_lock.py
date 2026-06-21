"""Bug-188: 分布式锁 (Redis 风格).

owner + token + lease, 支持续约、释放、watchdog.
"""

import enum
import secrets
import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass


class LockState(enum.StrEnum):
    ACQUIRED = "ACQUIRED"
    NOT_ACQUIRED = "NOT_ACQUIRED"
    EXPIRED = "EXPIRED"
    RELEASED = "RELEASED"


@dataclass
class Lock:
    key: str
    owner: str
    token: str
    lease_ms: int
    acquired_at: float
    expires_at: float


class DistributedLock:
    """分布式锁: token 校验 + 续约 + watchdog."""

    def __init__(self, now: Callable[[], float] | None = None):
        self._now = now or time.time
        self._lock = threading.Lock()
        self._locks: dict[str, Lock] = {}
        self._stats = {"acquired": 0, "released": 0, "expired": 0, "renewed": 0}

    def try_acquire(self, key: str, owner: str | None = None, lease_ms: int = 5000) -> tuple:
        owner = owner or uuid.uuid4().hex
        token = secrets.token_hex(8)
        now = self._now()
        with self._lock:
            self._evict_expired(now)
            existing = self._locks.get(key)
            if existing is not None and existing.expires_at > now:
                return (LockState.NOT_ACQUIRED, "", "")
            lock = Lock(
                key=key,
                owner=owner,
                token=token,
                lease_ms=lease_ms,
                acquired_at=now,
                expires_at=now + lease_ms / 1000,
            )
            self._locks[key] = lock
            self._stats["acquired"] += 1
            return (LockState.ACQUIRED, owner, token)

    def release(self, key: str, token: str) -> LockState:
        now = self._now()
        with self._lock:
            lock = self._locks.get(key)
            if lock is None:
                return LockState.RELEASED
            if lock.token != token:
                return LockState.NOT_ACQUIRED
            if lock.expires_at <= now:
                del self._locks[key]
                self._stats["expired"] += 1
                return LockState.EXPIRED
            del self._locks[key]
            self._stats["released"] += 1
            return LockState.RELEASED

    def renew(self, key: str, token: str, lease_ms: int = 5000) -> bool:
        now = self._now()
        with self._lock:
            lock = self._locks.get(key)
            if lock is None or lock.token != token or lock.expires_at <= now:
                return False
            lock.expires_at = now + lease_ms / 1000
            lock.lease_ms = lease_ms
            self._stats["renewed"] += 1
            return True

    def _evict_expired(self, now: float) -> None:
        dead = [k for k, l in self._locks.items() if l.expires_at <= now]
        for k in dead:
            del self._locks[k]
            self._stats["expired"] += 1

    def watchdog(self) -> int:
        """清理过期, 返回清理数."""
        with self._lock:
            before = len(self._locks)
            self._evict_expired(self._now())
            return before - len(self._locks)

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {**self._stats, "active": len(self._locks)}
