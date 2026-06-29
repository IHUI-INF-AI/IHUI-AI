"""Bug-199: 死锁重试.

检测到死锁 (PostgreSQL SQLSTATE 40P01 / 40001 等) 时, 自动重试, 退避后重试.
支持: 异常识别 + 重试上限 + 抖动.
"""

import random
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass


@dataclass
class DeadlockRetryConfig:
    max_attempts: int = 5
    base_delay_ms: int = 20
    max_delay_ms: int = 500
    # PostgreSQL SQLSTATE: 40P01=deadlock_detected, 40001=serialization_failure
    # MySQL errno: 1213=deadlock, 1205=lock_wait_timeout
    error_codes: tuple = ("40P01", "40001", 1213, 1205)


class DeadlockRetrier:
    """死锁重试: 异常码匹配 + 退避 + 抖动."""

    def __init__(self, config: DeadlockRetryConfig | None = None):
        self.config = config or DeadlockRetryConfig()
        self._lock = threading.Lock()
        self._stats = {"retried": 0, "success": 0, "exhausted": 0}
        self._rand = random.Random()

    @staticmethod
    def is_deadlock(exc: BaseException, codes: tuple) -> bool:
        # codes 可包含 SQLSTATE 字符串 (e.g. "40P01") 或整数 errno (e.g. 1213, 40001)
        str_codes = {str(c) for c in codes if isinstance(c, str)}
        int_codes = {c for c in codes if isinstance(c, int)}
        # PostgreSQL psycopg2: 异常的 pgcode 属性持有 SQLSTATE
        for attr in ("pgcode", "sqlstate"):
            v = getattr(exc, attr, None)
            if isinstance(v, str) and v in str_codes:
                return True
            if isinstance(v, tuple) and any(isinstance(x, str) and x in str_codes for x in v):
                return True
        # args / errno / number: 整数型 MySQL-style errno 或 字符串型 SQLSTATE
        for attr in ("args", "errno", "number"):
            v = getattr(exc, attr, None)
            if v is None:
                continue
            if isinstance(v, int) and v in int_codes:
                return True
            if isinstance(v, tuple) and any(
                (isinstance(x, int) and x in int_codes)
                or (isinstance(x, str) and x in str_codes)
                for x in v
            ):
                return True
            if isinstance(v, str) and v in str_codes:
                return True
        # message 检查放在最后: 即使 args 被改写, 仍可识别 deadlock 关键字
        msg = str(exc).lower()
        return bool("deadlock" in msg or "serialization failure" in msg)

    def call(self, fn: Callable, *args, **kwargs):
        cfg = self.config
        last_exc: BaseException | None = None
        for attempt in range(1, cfg.max_attempts + 1):
            try:
                v = fn(*args, **kwargs)
                with self._lock:
                    self._stats["success"] += 1
                return v
            except Exception as e:
                last_exc = e
                if not self.is_deadlock(e, cfg.error_codes):
                    raise
                if attempt >= cfg.max_attempts:
                    break
                with self._lock:
                    self._stats["retried"] += 1
                d = min(cfg.max_delay_ms, cfg.base_delay_ms * (2 ** (attempt - 1)))
                delta = int(d * 0.2)
                d += self._rand.randint(-delta, delta)
                time.sleep(d / 1000)
        with self._lock:
            self._stats["exhausted"] += 1
        raise last_exc  # type: ignore

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
