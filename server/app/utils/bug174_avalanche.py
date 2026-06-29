"""Bug-174: Redis 雪崩保护 (随机过期 + 预热).

大量 key 同时过期导致回源雪崩, 加随机偏移 + 预热.
"""

import contextlib
import random
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass


@dataclass
class AvalancheConfig:
    base_ttl: int = 300
    jitter_pct: float = 0.2  # 0.2 = ±20% 抖动
    max_ttl_jitter_sec: int = 60
    preload_ahead_sec: int = 30  # 提前多少秒预热


class AvalancheGuard:
    """雪崩保护: TTL 抖动 + 预热调度."""

    def __init__(self, config: AvalancheConfig | None = None, on_preload: Callable[[str], None] | None = None):
        self.config = config or AvalancheConfig()
        self._on_preload = on_preload
        self._lock = threading.Lock()
        self._keys: dict[str, int] = {}  # key -> expire_at
        self._rand = random.Random()
        self._prewarmed: list[str] = []

    def ttl(self, key: str, base: int | None = None) -> int:
        """返回带抖动的 TTL."""
        cfg = self.config
        b = base if base is not None else cfg.base_ttl
        delta = min(cfg.max_ttl_jitter_sec, int(b * cfg.jitter_pct))
        return b + self._rand.randint(-delta, delta)

    def register(self, key: str, ttl: int) -> None:
        with self._lock:
            self._keys[key] = int(time.time()) + ttl

    def tick(self) -> list[str]:
        """扫描即将过期 key, 触发预热."""
        cfg = self.config
        now = time.time()
        need_preload: list[str] = []
        with self._lock:
            for k, exp in list(self._keys.items()):
                if exp - now <= cfg.preload_ahead_sec:
                    need_preload.append(k)
                    self._prewarmed.append(k)
                    del self._keys[k]
        for k in need_preload:
            if self._on_preload:
                with contextlib.suppress(Exception):
                    self._on_preload(k)  # intentionally ignored
        return need_preload

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {"tracked": len(self._keys), "prewarmed_total": len(self._prewarmed)}
