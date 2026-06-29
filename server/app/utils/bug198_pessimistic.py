"""Bug-198: 悲观锁.

获取锁 -> 修改 -> 释放; 死锁检测 + 超时释放.
"""

import threading
import time
import uuid
from dataclasses import dataclass


@dataclass
class PessimisticLock:
    key: str
    owner: str
    acquired_at: float
    expires_at: float


class PessimisticLocker:
    """悲观锁: owner + lease, 死锁时主动释放最旧."""

    def __init__(self, lease_sec: float = 10.0):
        self.lease = lease_sec
        self._lock = threading.Lock()
        self._locks: dict[str, PessimisticLock] = {}
        self._stats = {"acquired": 0, "released": 0, "deadlock_resolved": 0}

    def acquire(self, key: str, owner: str | None = None) -> str | None:
        owner = owner or uuid.uuid4().hex
        now = time.time()
        with self._lock:
            self._evict(now)
            existing = self._locks.get(key)
            if existing is None:
                self._locks[key] = PessimisticLock(
                    key=key,
                    owner=owner,
                    acquired_at=now,
                    expires_at=now + self.lease,
                )
                self._stats["acquired"] += 1
                return owner
            # 已持有: 返回 None; 简单实现, 不支持可重入
            return None

    def release(self, key: str, owner: str) -> bool:
        with self._lock:
            lock = self._locks.get(key)
            if lock and lock.owner == owner:
                del self._locks[key]
                self._stats["released"] += 1
                return True
            return False

    def detect_deadlock(self) -> list[str]:
        """简化版: 如果同一 owner 持有多把锁, 视为潜在死锁, 释放最旧一把."""
        with self._lock:
            by_owner: dict[str, list[PessimisticLock]] = {}
            for lock in self._locks.values():
                by_owner.setdefault(lock.owner, []).append(lock)
            dead_keys: list[str] = []
            for _owner, locks in by_owner.items():
                if len(locks) > 1:
                    # 释放最旧
                    oldest = min(locks, key=lambda lock: lock.acquired_at)
                    dead_keys.append(oldest.key)
            for k in dead_keys:
                del self._locks[k]
                self._stats["deadlock_resolved"] += 1
            return dead_keys

    def _evict(self, now: float) -> None:
        dead = [k for k, lock in self._locks.items() if lock.expires_at <= now]
        for k in dead:
            del self._locks[k]

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {**self._stats, "active": len(self._locks)}
