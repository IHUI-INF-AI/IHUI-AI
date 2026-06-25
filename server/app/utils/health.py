"""Bug-160: 健康检查分级.

liveness / readiness / startup 三态:
- liveness: 进程是否还活着
- readiness: 依赖 (db/redis) 是否就绪
- startup:  启动预热是否完成
"""

import enum
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass


class HealthLevel(enum.StrEnum):
    OK = "OK"
    DEGRADED = "DEGRADED"
    DOWN = "DOWN"


@dataclass
class Check:
    name: str
    fn: Callable[[], bool]
    timeout_sec: float = 1.0
    critical: bool = True
    last_run: float = 0.0
    last_ok: bool = True
    last_err: str = ""


class HealthChecker:
    """三级健康检查: liveness / readiness / startup."""

    def __init__(self):
        self._lock = threading.Lock()
        self._readiness: dict[str, Check] = {}
        self._liveness: dict[str, Check] = {}
        self._startup: dict[str, Check] = {}
        self._startup_done = False
        self._started_at: float = 0.0

    def start(self) -> None:
        with self._lock:
            self._started_at = time.time()

    def mark_startup_done(self) -> None:
        with self._lock:
            self._startup_done = True

    def add_readiness(self, check: Check) -> None:
        with self._lock:
            self._readiness[check.name] = check

    def add_liveness(self, check: Check) -> None:
        with self._lock:
            self._liveness[check.name] = check

    def add_startup(self, check: Check) -> None:
        with self._lock:
            self._startup[check.name] = check

    def _run(self, checks: dict[str, Check]) -> tuple[HealthLevel, dict[str, object]]:
        results: dict[str, object] = {}
        level = HealthLevel.OK
        for name, c in checks.items():
            start = time.time()
            try:
                ok = c.fn()
            except Exception as e:
                ok = False
                c.last_err = str(e)
            c.last_run = time.time()
            c.last_ok = ok
            results[name] = {
                "ok": ok,
                "err": c.last_err,
                "ms": round((time.time() - start) * 1000, 2),
            }
            if not ok and c.critical:
                level = HealthLevel.DOWN
            elif not ok and level == HealthLevel.OK:
                level = HealthLevel.DEGRADED
        return level, results

    def liveness(self) -> tuple[HealthLevel, dict[str, object]]:
        with self._lock:
            return self._run(self._liveness) if self._liveness else (HealthLevel.OK, {})

    def readiness(self) -> tuple[HealthLevel, dict[str, object]]:
        with self._lock:
            return self._run(self._readiness) if self._readiness else (HealthLevel.OK, {})

    def startup(self) -> tuple[HealthLevel, dict[str, object]]:
        with self._lock:
            if not self._startup_done:
                return HealthLevel.DOWN, {"pending": True, "elapsed": time.time() - self._started_at}
            return self._run(self._startup) if self._startup else (HealthLevel.OK, {})

    def stats(self) -> dict[str, object]:
        with self._lock:
            return {
                "startup_done": self._startup_done,
                "readiness_count": len(self._readiness),
                "liveness_count": len(self._liveness),
                "startup_count": len(self._startup),
            }
