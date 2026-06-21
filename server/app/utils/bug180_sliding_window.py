"""Bug-180: 滑动窗口限流.

固定窗口/滑动窗口计数, 拒绝超额请求.
"""

import threading
import time
from collections import deque
from dataclasses import dataclass


@dataclass
class SlidingWindowConfig:
    window_sec: float = 1.0
    max_count: int = 100


class SlidingWindowLimiter:
    """滑动窗口限流: 精确到毫秒的请求计数."""

    def __init__(self, config: SlidingWindowConfig | None = None):
        self.config = config or SlidingWindowConfig()
        self._lock = threading.Lock()
        self._buckets: dict[str, deque[float]] = {}
        self._allowed = 0
        self._denied = 0

    def acquire(self, key: str) -> bool:
        cfg = self.config
        now = time.time()
        limit = now - cfg.window_sec
        with self._lock:
            q = self._buckets.setdefault(key, deque())
            while q and q[0] < limit:
                q.popleft()
            if len(q) < cfg.max_count:
                q.append(now)
                self._allowed += 1
                return True
            self._denied += 1
            return False

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {"allowed": self._allowed, "denied": self._denied, "keys": len(self._buckets)}
