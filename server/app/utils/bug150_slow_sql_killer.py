"""Bug-150: 慢查询熔断.

统计 SQL 执行耗时, 滑动窗口 P95/P99, 超过阈值后熔断该指纹
一段时间, 直接返回熔断异常, 避免雪崩.
"""

import enum
import hashlib
import math
import threading
import time
from collections import deque
from dataclasses import dataclass, field


class CircuitState(enum.StrEnum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitOpen(Exception):
    pass


@dataclass
class SlowSQLConfig:
    window_size: int = 200  # 滑动窗口样本数
    p_threshold: float = 0.95  # 选用分位数
    slow_ms: int = 500  # 单次执行视为慢查询
    breaker_p_ms: int = 1000  # P95 超过此值触发熔断
    open_sec: int = 30  # 熔断持续时间
    half_open_probes: int = 3  # 半开探测次数
    cooldown_ms: int = 50  # 半开最大允许耗时


@dataclass
class SQLSample:
    fp: str
    ms: float
    ok: bool
    ts: float = field(default_factory=time.time)


class SlowSQLKiller:
    """慢 SQL 熔断器: 滑动窗口 + 分位数熔断 + 半开探测."""

    def __init__(self, config: SlowSQLConfig | None = None):
        self.config = config or SlowSQLConfig()
        self._lock = threading.Lock()
        self._samples: dict[str, deque[SQLSample]] = {}
        self._state: dict[str, CircuitState] = {}
        self._open_until: dict[str, float] = {}
        self._probe_count: dict[str, int] = {}
        self._slow_count: dict[str, int] = {}

    @staticmethod
    def fingerprint(sql: str) -> str:
        norm = " ".join(sql.lower().split())
        return hashlib.md5(norm.encode("utf-8")).hexdigest()[:12]

    def _p(self, samples: list[float], q: float) -> float:
        if not samples:
            return 0.0
        s = sorted(samples)
        idx = max(0, min(len(s) - 1, math.ceil(q * len(s)) - 1))
        return s[idx]

    def record(self, sql: str, ms: float, ok: bool = True) -> CircuitState:
        fp = self.fingerprint(sql)
        cfg = self.config
        now = time.time()
        sample = SQLSample(fp=fp, ms=ms, ok=ok, ts=now)
        with self._lock:
            q = self._samples.setdefault(fp, deque(maxlen=cfg.window_size))
            q.append(sample)
            if not ok or ms >= cfg.slow_ms:
                self._slow_count[fp] = self._slow_count.get(fp, 0) + 1
            p_ms = self._p([s.ms for s in q], cfg.p_threshold)
            st = self._state.get(fp, CircuitState.CLOSED)
            if st == CircuitState.OPEN and now >= self._open_until.get(fp, 0):
                self._state[fp] = CircuitState.HALF_OPEN
                self._probe_count[fp] = 0
                st = CircuitState.HALF_OPEN
            if st == CircuitState.CLOSED and p_ms >= cfg.breaker_p_ms:
                self._state[fp] = CircuitState.OPEN
                self._open_until[fp] = now + cfg.open_sec
                st = CircuitState.OPEN
            return st

    def before_call(self, sql: str) -> None:
        """执行前检查熔断状态, 熔断中直接抛 CircuitOpen."""
        fp = self.fingerprint(sql)
        now = time.time()
        with self._lock:
            st = self._state.get(fp, CircuitState.CLOSED)
            if st == CircuitState.OPEN and now < self._open_until.get(fp, 0):
                raise CircuitOpen(f"slow sql breaker open: {fp}")
            if st == CircuitState.OPEN and now >= self._open_until.get(fp, 0):
                self._state[fp] = CircuitState.HALF_OPEN
                self._probe_count[fp] = 0
            if st == CircuitState.HALF_OPEN:
                used = self._probe_count.get(fp, 0)
                if used >= self.config.half_open_probes:
                    self._state[fp] = CircuitState.OPEN
                    self._open_until[fp] = now + self.config.open_sec
                    raise CircuitOpen(f"slow sql half-open probes exhausted: {fp}")
                self._probe_count[fp] = used + 1

    def after_call(self, sql: str, ms: float, ok: bool = True) -> None:
        """执行后回填, 半开期按结果恢复或再熔断."""
        st = self.record(sql, ms, ok)
        fp = self.fingerprint(sql)
        with self._lock:
            if st == CircuitState.HALF_OPEN and ok and ms < self.config.cooldown_ms:
                self._state[fp] = CircuitState.CLOSED
                self._probe_count[fp] = 0

    def stats(self) -> dict[str, int]:
        with self._lock:
            # 任何出现在 _samples 但未在 _state 中标记为 OPEN/HALF_OPEN 的, 都视为 CLOSED
            open_n = 0
            half_n = 0
            closed_n = 0
            for fp in self._samples:
                st = self._state.get(fp, CircuitState.CLOSED)
                if st == CircuitState.OPEN:
                    open_n += 1
                elif st == CircuitState.HALF_OPEN:
                    half_n += 1
                else:
                    closed_n += 1
            return {
                "tracked_fps": len(self._samples),
                "open": open_n,
                "half_open": half_n,
                "closed": closed_n,
            }
