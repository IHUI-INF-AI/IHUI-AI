"""Bug-169: 重试策略.

指数退避 + 抖动 + 熔断联动 + 重试上限.
"""

import random
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass
class RetryConfig:
    max_attempts: int = 3
    base_delay_ms: int = 100
    max_delay_ms: int = 5000
    jitter: bool = True
    exponential: bool = True
    retriable: tuple[type, ...] = (Exception,)


@dataclass
class RetryResult:
    ok: bool
    attempts: int
    value: object = None
    err: str = ""
    delays_ms: list[int] = field(default_factory=list)


class Retrier:
    """重试器: 指数退避 + 抖动 + 异常白名单."""

    def __init__(self, config: RetryConfig | None = None):
        self.config = config or RetryConfig()
        self._lock = threading.Lock()
        self._stats = {"success": 0, "exhausted": 0, "non_retriable": 0}
        self._rand = random.Random()

    def _delay(self, attempt: int) -> int:
        cfg = self.config
        d = cfg.base_delay_ms * 2 ** (attempt - 1) if cfg.exponential else cfg.base_delay_ms
        d = min(d, cfg.max_delay_ms)
        if cfg.jitter:
            d = int(d * (0.5 + self._rand.random() * 0.5))
        return d

    def call(self, fn: Callable, *args, **kwargs) -> RetryResult:
        cfg = self.config
        delays: list[int] = []
        last_err = ""
        for attempt in range(1, cfg.max_attempts + 1):
            try:
                v = fn(*args, **kwargs)
                with self._lock:
                    self._stats["success"] += 1
                return RetryResult(ok=True, attempts=attempt, value=v, delays_ms=delays)
            except Exception as e:
                last_err = f"{type(e).__name__}: {e}"
                # 不可重试异常
                if cfg.retriable and not isinstance(e, cfg.retriable):
                    with self._lock:
                        self._stats["non_retriable"] += 1
                    return RetryResult(ok=False, attempts=attempt, err=last_err, delays_ms=delays)
                if attempt < cfg.max_attempts:
                    d = self._delay(attempt)
                    delays.append(d)
                    time.sleep(d / 1000)
        with self._lock:
            self._stats["exhausted"] += 1
        return RetryResult(ok=False, attempts=cfg.max_attempts, err=last_err, delays_ms=delays)

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
