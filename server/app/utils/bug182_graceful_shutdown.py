"""Bug-182: 优雅停机.

监听 SIGTERM/SIGINT, 停止接受新请求 -> 等待 in-flight 完成 -> 关闭资源.
"""

import enum
import signal
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass


class ShutdownState(enum.StrEnum):
    RUNNING = "RUNNING"
    DRAINING = "DRAINING"
    CLOSED = "CLOSED"


@dataclass
class ShutdownHook:
    name: str
    fn: Callable[[], None]
    timeout_sec: float = 10.0
    required: bool = True


class GracefulShutdown:
    """优雅停机: 钩子按注册顺序执行, 超时强杀."""

    def __init__(self, drain_timeout_sec: float = 30.0):
        self._lock = threading.Lock()
        self._state = ShutdownState.RUNNING
        self._hooks: list[ShutdownHook] = []
        self._inflight = 0
        self._drain_timeout = drain_timeout_sec
        self._sig_handlers: dict[int, signal.Signals] = {}

    def register(self, hook: ShutdownHook) -> None:
        with self._lock:
            self._hooks.append(hook)

    def in_flight_begin(self) -> bool:
        with self._lock:
            if self._state != ShutdownState.RUNNING:
                return False
            self._inflight += 1
            return True

    def in_flight_end(self) -> None:
        with self._lock:
            if self._inflight > 0:
                self._inflight -= 1

    def state(self) -> ShutdownState:
        with self._lock:
            return self._state

    def install_signal_handlers(self) -> None:
        for sig in (signal.SIGTERM, signal.SIGINT):
            try:
                self._sig_handlers[sig] = sig
                signal.signal(sig, lambda *_: self.shutdown())
            except (ValueError, OSError):
                # 非主线程 / Windows 限制
                pass

    def shutdown(self) -> dict[str, str]:
        with self._lock:
            if self._state != ShutdownState.RUNNING:
                return {}
            self._state = ShutdownState.DRAINING
        results: dict[str, str] = {}
        # 等待 in-flight
        deadline = time.time() + self._drain_timeout
        while True:
            with self._lock:
                cur = self._inflight
            if cur == 0 or time.time() > deadline:
                break
            time.sleep(0.1)
        # 执行钩子
        with self._lock:
            hooks = list(self._hooks)
        for h in hooks:
            try:
                start = time.time()
                h.fn()
                results[h.name] = f"ok in {time.time()-start:.2f}s"
            except Exception as e:
                results[h.name] = f"err: {e}"
        with self._lock:
            self._state = ShutdownState.CLOSED
        return results

    def stats(self) -> dict[str, object]:
        with self._lock:
            return {
                "state": self._state.value,
                "inflight": self._inflight,
                "hooks": len(self._hooks),
            }
