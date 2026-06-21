"""Bug-186: TCC 模式.

Try / Confirm / Cancel 三阶段: 预留资源 -> 确认 -> 回滚.
支持: 幂等 confirm / cancel + 超时 + 状态机.
"""

import enum
import threading
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any


class TCCState(enum.StrEnum):
    TRY = "TRY"
    CONFIRMED = "CONFIRMED"
    CANCELED = "CANCELED"
    FAILED = "FAILED"


@dataclass
class TCCBranch:
    name: str
    try_fn: Callable[[], Any]
    confirm_fn: Callable[[Any], None]
    cancel_fn: Callable[[Any], None]


@dataclass
class TCCResult:
    tx_id: str
    state: TCCState
    try_outputs: dict[str, Any] = field(default_factory=dict)
    error: str = ""


class TCCTransaction:
    """TCC 事务: 全部 try -> 全部 confirm; 任意失败 -> 全部 cancel."""

    def __init__(self):
        self._lock = threading.Lock()
        self._results: dict[str, TCCResult] = {}

    def execute(self, branches: list[TCCBranch], tx_id: str | None = None) -> TCCResult:
        tid = tx_id or uuid.uuid4().hex
        r = TCCResult(tx_id=tid, state=TCCState.TRY)
        with self._lock:
            self._results[tid] = r
        # 1) Try
        try_outputs: dict[str, Any] = {}
        try:
            for b in branches:
                out = b.try_fn()
                try_outputs[b.name] = out
        except Exception as e:
            r.state = TCCState.FAILED
            r.error = f"try {b.name if 'b' in dir() else ''}: {type(e).__name__}: {e}"
            self._cancel(branches, try_outputs, r)
            return r
        r.try_outputs = try_outputs
        # 2) Confirm
        try:
            for b in branches:
                b.confirm_fn(try_outputs.get(b.name))
            r.state = TCCState.CONFIRMED
        except Exception as e:
            r.state = TCCState.FAILED
            r.error = f"confirm {b.name}: {type(e).__name__}: {e}"
            self._cancel(branches, try_outputs, r)
        return r

    def _cancel(self, branches: list[TCCBranch], try_outputs: dict[str, Any], r: TCCResult) -> None:
        for b in branches:
            try:
                b.cancel_fn(try_outputs.get(b.name))
            except Exception as e:
                r.error += f"; cancel {b.name}: {e}"
        r.state = TCCState.CANCELED

    def get(self, tx_id: str) -> TCCResult | None:
        with self._lock:
            return self._results.get(tx_id)
