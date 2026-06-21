"""Bug-179: 令牌桶限流.

经典令牌桶, 支持突发 + 平均速率 + 多 key 维度.
"""

import threading
import time
from dataclasses import dataclass


@dataclass
class TokenBucketConfig:
    capacity: int = 100
    refill_rate: float = 10.0  # 每秒补充令牌


@dataclass
class Bucket:
    tokens: float
    last_refill: float


class TokenBucketLimiter:
    """令牌桶限流器."""

    def __init__(self, config: TokenBucketConfig | None = None):
        self.config = config or TokenBucketConfig()
        self._lock = threading.Lock()
        self._buckets: dict[str, Bucket] = {}
        self._allowed = 0
        self._denied = 0

    def _refill(self, b: Bucket, now: float) -> None:
        cfg = self.config
        delta = now - b.last_refill
        if delta <= 0:
            return
        b.tokens = min(cfg.capacity, b.tokens + delta * cfg.refill_rate)
        b.last_refill = now

    def acquire(self, key: str, cost: int = 1) -> bool:
        now = time.time()
        with self._lock:
            b = self._buckets.get(key)
            if b is None:
                b = Bucket(tokens=self.config.capacity, last_refill=now)
                self._buckets[key] = b
            self._refill(b, now)
            if b.tokens >= cost:
                b.tokens -= cost
                self._allowed += 1
                return True
            self._denied += 1
            return False

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {"allowed": self._allowed, "denied": self._denied, "keys": len(self._buckets)}
