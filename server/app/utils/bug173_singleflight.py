"""Bug-173: Redis 击穿保护 (singleflight).

同一 key 大量并发只让 1 个回源, 其余等待结果.
"""

import threading
import time
from collections.abc import Callable
from dataclasses import dataclass


@dataclass
class SFConfig:
    wait_timeout_sec: float = 5.0


@dataclass
class SFCall:
    state: str = "PENDING"  # PENDING / RUNNING / DONE
    value: object = None
    err: str = ""
    started: float = 0.0
    finished: float = 0.0


class SingleFlight:
    """singleflight: 同 key 并发只 1 次回源."""

    def __init__(self, config: SFConfig | None = None):
        self.config = config or SFConfig()
        self._lock = threading.Lock()
        self._inflight: dict[str, SFCall] = {}
        self._stats = {"merged": 0, "executed": 0}

    def do(self, key: str, fn: Callable[[], object]) -> tuple[object, bool]:
        """返回 (value, from_cache). from_cache=True 表示这是合并的等待者."""
        with self._lock:
            call = self._inflight.get(key)
            if call is None:
                call = SFCall(state="RUNNING", started=time.time())
                self._inflight[key] = call
                owner = True
                self._stats["executed"] += 1
            else:
                owner = False
                self._stats["merged"] += 1
        if owner:
            try:
                v = fn()
                with self._lock:
                    call.value = v
                    call.state = "DONE"
                    call.finished = time.time()
                return v, False
            except Exception as e:
                with self._lock:
                    call.err = f"{type(e).__name__}: {e}"
                    call.state = "DONE"
                    call.finished = time.time()
                raise
            finally:
                # 留 60s 缓存给后续, 再清掉
                threading.Timer(60.0, self._cleanup, args=[key]).start()
        else:
            # 等待者: 自旋等待 (实际应该用 condition, 简化)
            deadline = time.time() + self.config.wait_timeout_sec
            while True:
                with self._lock:
                    if call.state == "DONE":
                        if call.err:
                            raise RuntimeError(call.err)
                        return call.value, True
                if time.time() > deadline:
                    raise TimeoutError(f"singleflight wait timeout: {key}")
                time.sleep(0.01)

    def _cleanup(self, key: str) -> None:
        with self._lock:
            self._inflight.pop(key, None)

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
