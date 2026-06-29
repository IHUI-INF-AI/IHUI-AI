"""Bug-192: 重试补偿.

给定补偿链 (forward + compensation), 失败时自动补偿.
"""

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any


@dataclass
class CompAction:
    name: str
    forward: Callable[[], Any]
    compensate: Callable[[Any], None]
    attempts: int = 3
    delay_ms: int = 100


@dataclass
class CompResult:
    ok: bool
    outputs: list[Any] = field(default_factory=list)
    executed: list[str] = field(default_factory=list)
    compensated: list[str] = field(default_factory=list)
    error: str = ""


class RetryCompensator:
    """重试 + 补偿: 失败 N 次后逐级回滚已成功步骤."""

    def run(self, actions: list[CompAction]) -> CompResult:
        r = CompResult(ok=True)
        executed: list[tuple] = []
        for a in actions:
            v = None
            for i in range(1, a.attempts + 1):
                try:
                    v = a.forward()
                    break
                except Exception as e:
                    if i >= a.attempts:
                        r.ok = False
                        r.error = f"{a.name}: {type(e).__name__}: {e}"
                        break
                    time.sleep(a.delay_ms / 1000)
            if not r.ok:
                break
            executed.append((a, v))
            r.outputs.append(v)
            r.executed.append(a.name)
        if not r.ok:
            for a, v in reversed(executed):
                try:
                    a.compensate(v)
                    r.compensated.append(a.name)
                except Exception as e:
                    r.error += f"; comp {a.name}: {e}"
        return r
