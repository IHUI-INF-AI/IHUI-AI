"""Bug-151: 缓存预热命中.

启动时/定时把热点 key 预先加载到缓存, 减少冷启动穿透.
支持: 调度器, 并发限流, 命中率统计, 失败重试.
"""

import threading
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass


@dataclass
class WarmKey:
    key: str
    loader: Callable[[], object]
    ttl: int = 300
    weight: int = 1
    retries: int = 1


@dataclass
class WarmResult:
    key: str
    ok: bool
    ms: float
    err: str = ""
    attempts: int = 1


@dataclass
class WarmConfig:
    concurrency: int = 4
    batch_size: int = 100
    min_interval_sec: int = 300  # 两次预热最小间隔


class CacheWarmer:
    """缓存预热: 批量预热 + 命中统计 + 失败重试."""

    def __init__(
        self,
        cache_get: Callable[[str], object | None],
        cache_set: Callable[[str, object, int], None],
        config: WarmConfig | None = None,
    ):
        self._get = cache_get
        self._set = cache_set
        self.config = config or WarmConfig()
        self._lock = threading.Lock()
        self._last_warm_ts: float = 0
        self._hits = 0
        self._misses = 0
        self._warm_runs: list[tuple[float, int, int]] = []  # ts, total, ok

    def register(
        self, key: str, loader: Callable[[], object], ttl: int = 300, weight: int = 1, retries: int = 1
    ) -> WarmKey:
        return WarmKey(key=key, loader=loader, ttl=ttl, weight=weight, retries=retries)

    def warm(self, keys: list[WarmKey], force: bool = False) -> list[WarmResult]:
        now = time.time()
        with self._lock:
            if not force and now - self._last_warm_ts < self.config.min_interval_sec:
                return []
            self._last_warm_ts = now
        results: list[WarmResult] = []
        with ThreadPoolExecutor(max_workers=self.config.concurrency) as pool:
            futs = [pool.submit(self._warm_one, k) for k in keys]
            for f in futs:
                results.append(f.result())
        ok = sum(1 for r in results if r.ok)
        with self._lock:
            self._warm_runs.append((now, len(keys), ok))
            if len(self._warm_runs) > 100:
                self._warm_runs = self._warm_runs[-100:]
        return results

    def _warm_one(self, k: WarmKey) -> WarmResult:
        start = time.time()
        last_err = ""
        for i in range(max(1, k.retries)):
            try:
                val = k.loader()
                self._set(k.key, val, k.ttl)
                return WarmResult(key=k.key, ok=True, ms=(time.time() - start) * 1000, attempts=i + 1)
            except Exception as e:
                last_err = str(e)
        return WarmResult(key=k.key, ok=False, ms=(time.time() - start) * 1000, err=last_err, attempts=k.retries)

    def hit(self) -> None:
        with self._lock:
            self._hits += 1

    def miss(self) -> None:
        with self._lock:
            self._misses += 1

    def hit_rate(self) -> float:
        with self._lock:
            total = self._hits + self._misses
            return self._hits / total if total else 0.0

    def stats(self) -> dict[str, object]:
        with self._lock:
            return {
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": self.hit_rate(),
                "warm_runs": len(self._warm_runs),
                "last_warm_ts": self._last_warm_ts,
            }
