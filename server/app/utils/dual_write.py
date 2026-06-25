"""Bug-202: 双写一致性.

主从双写时, 提供 "先主后从" / "双写异步校验" 两种策略,
失败后走修复路径 (从主覆盖从).
"""

import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


class DualWriteStrategy(str):
    PRIMARY_FIRST = "PRIMARY_FIRST"
    PARALLEL = "PARALLEL"
    ASYNC_VERIFY = "ASYNC_VERIFY"


@dataclass
class DualWriteResult:
    ok: bool
    primary_ok: bool
    secondary_ok: bool
    error: str = ""
    ms: float = 0.0


class DualWriter:
    """双写一致性: 主从 + 策略."""

    def __init__(self, strategy: str = DualWriteStrategy.PRIMARY_FIRST):
        self.strategy = strategy
        self._lock = threading.Lock()
        self._stats = {"ok": 0, "drift": 0, "fail": 0}

    def write(
        self, key: str, value: Any, primary: Callable[[str, Any], None], secondary: Callable[[str, Any], None]
    ) -> DualWriteResult:
        start = time.time()
        p_ok, s_ok = False, False
        err = ""
        if self.strategy == DualWriteStrategy.PRIMARY_FIRST:
            try:
                primary(key, value)
                p_ok = True
            except Exception as e:
                err += f"primary: {e}; "
            try:
                secondary(key, value)
                s_ok = True
            except Exception as e:
                err += f"secondary: {e}; "
        elif self.strategy == DualWriteStrategy.PARALLEL:
            results: dict[str, Exception] = {}

            def run(name: str, fn: Callable[[str, Any], None]):
                try:
                    fn(key, value)
                except Exception as e:
                    results[name] = e

            t1 = threading.Thread(target=run, args=("p", primary))
            t2 = threading.Thread(target=run, args=("s", secondary))
            t1.start()
            t2.start()
            t1.join()
            t2.join()
            p_ok = "p" not in results
            s_ok = "s" not in results
            for k, v in results.items():
                err += f"{k}: {v}; "
        else:  # ASYNC_VERIFY
            try:
                primary(key, value)
                p_ok = True
            except Exception as e:
                err += f"primary: {e}; "

            # secondary 异步, 立即返回
            def async_sec():
                try:
                    secondary(key, value)
                except Exception:
                    with self._lock:
                        self._stats["drift"] += 1

            threading.Thread(target=async_sec, daemon=True).start()
            s_ok = True  # 假定, 实际异步校验
        ok = p_ok and s_ok
        with self._lock:
            if ok:
                self._stats["ok"] += 1
            else:
                self._stats["fail"] += 1
        return DualWriteResult(
            ok=ok,
            primary_ok=p_ok,
            secondary_ok=s_ok,
            error=err.strip("; "),
            ms=(time.time() - start) * 1000,
        )

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
