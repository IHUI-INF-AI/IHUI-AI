"""Bug-184: 启动探针.

k8s 风格 startup / readiness / liveness 三态探针,
含启动超时 + 回调注册 + 进度上报.
"""

import enum
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field


class ProbeState(enum.StrEnum):
    PENDING = "PENDING"
    OK = "OK"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"


@dataclass
class ProbeResult:
    state: ProbeState
    elapsed_ms: float
    err: str = ""
    ts: float = field(default_factory=time.time)


@dataclass
class StartupConfig:
    timeout_sec: float = 60.0
    poll_interval_sec: float = 0.5
    min_progress_delta: int = 0  # 至少需要多少"进度事件"


class StartupProbe:
    """启动探针: 进度 + 超时 + 多组件."""

    def __init__(self, config: StartupConfig | None = None):
        self.config = config or StartupConfig()
        self._lock = threading.Lock()
        self._components: dict[str, Callable[[], bool]] = {}
        self._results: dict[str, ProbeResult] = {}
        self._progress: int = 0
        self._started_at: float = 0.0
        self._done = False

    def start(self) -> None:
        with self._lock:
            self._started_at = time.time()
            self._done = False
            self._results.clear()
            self._progress = 0

    def register(self, name: str, check: Callable[[], bool]) -> None:
        with self._lock:
            self._components[name] = check

    def progress(self, delta: int = 1) -> None:
        with self._lock:
            self._progress += delta

    def run_one(self, name: str) -> ProbeResult:
        with self._lock:
            fn = self._components.get(name)
        if not fn:
            return ProbeResult(state=ProbeState.FAILED, elapsed_ms=0, err="no such component")
        start = time.time()
        try:
            ok = fn()
        except Exception as e:
            ok = False
            err = f"{type(e).__name__}: {e}"
            res = ProbeResult(state=ProbeState.FAILED, elapsed_ms=(time.time() - start) * 1000, err=err)
            with self._lock:
                self._results[name] = res
            return res
        res = ProbeResult(
            state=ProbeState.OK if ok else ProbeState.FAILED,
            elapsed_ms=(time.time() - start) * 1000,
        )
        with self._lock:
            self._results[name] = res
        return res

    def run_all(self) -> bool:
        """同步跑完所有组件, 返回是否全部成功 (受 timeout 约束)."""
        cfg = self.config
        self.start()
        with self._lock:
            names = list(self._components.keys())
        for n in names:
            if time.time() - self._started_at > cfg.timeout_sec:
                with self._lock:
                    self._results[n] = ProbeResult(state=ProbeState.TIMEOUT, elapsed_ms=0, err="startup timeout")
                self._done = False
                return False
            self.run_one(n)
        with self._lock:
            self._done = all(r.state == ProbeState.OK for r in self._results.values())
            return self._done

    def is_ready(self) -> bool:
        with self._lock:
            return self._done and all(r.state == ProbeState.OK for r in self._results.values())

    def stats(self) -> dict[str, object]:
        with self._lock:
            return {
                "started": self._started_at > 0,
                "done": self._done,
                "progress": self._progress,
                "components": list(self._results.keys()),
                "results": {k: r.state.value for k, r in self._results.items()},
            }
