"""Bug-178: 一致性窗口.

跨地域写入后, 在一致性窗口内强制从本地主读, 避免读到旧数据.
"""

import threading
import time
from dataclasses import dataclass


@dataclass
class ConsistencyConfig:
    window_sec: float = 2.0
    max_window_sec: float = 30.0


@dataclass
class PendingWrite:
    key: str
    region: str
    deadline: float


class ConsistencyWindow:
    """写入后, 一致性窗口内禁止读 follower."""

    def __init__(self, config: ConsistencyConfig | None = None):
        self.config = config or ConsistencyConfig()
        self._lock = threading.Lock()
        self._pending: dict[str, PendingWrite] = {}
        self._stats = {"forced_master": 0, "allowed_follower": 0, "evicted": 0}

    def mark(self, key: str, region: str, window_sec: float | None = None) -> None:
        w = window_sec if window_sec is not None else self.config.window_sec
        w = min(w, self.config.max_window_sec)
        with self._lock:
            self._pending[key] = PendingWrite(key=key, region=region, deadline=time.time() + w)

    def can_read_follower(self, key: str, region: str) -> bool:
        now = time.time()
        with self._lock:
            self._evict_locked(now)
            p = self._pending.get(key)
            if p is None:
                self._stats["allowed_follower"] += 1
                return True
            if p.region == region:
                self._stats["allowed_follower"] += 1
                return True
            self._stats["forced_master"] += 1
            return False

    def _evict_locked(self, now: float) -> None:
        dead = [k for k, p in self._pending.items() if p.deadline <= now]
        for k in dead:
            del self._pending[k]
            self._stats["evicted"] += 1

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
