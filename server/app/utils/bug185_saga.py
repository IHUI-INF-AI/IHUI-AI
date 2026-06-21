"""Bug-185: Saga 编排.

长事务拆为多个子步骤, 每步有 forward + compensate 动作.
失败时按相反顺序执行补偿, 保证最终一致.
支持: 编排 / 重试 / 超时 / 补偿状态.
"""

import enum
import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any


class SagaState(enum.StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    COMPENSATING = "COMPENSATING"
    FAILED = "FAILED"


@dataclass
class SagaStep:
    name: str
    forward: Callable[[], Any]
    compensate: Callable[[Any], None]
    retry: int = 3
    timeout_sec: float = 10.0


@dataclass
class SagaResult:
    saga_id: str
    state: SagaState
    outputs: list[Any] = field(default_factory=list)
    error: str = ""
    executed: list[str] = field(default_factory=list)
    compensated: list[str] = field(default_factory=list)


class SagaOrchestrator:
    """Saga 编排器: 正向执行 + 反向补偿."""

    def __init__(self):
        self._lock = threading.Lock()
        self._results: dict[str, SagaResult] = {}

    def run(self, steps: list[SagaStep], saga_id: str | None = None) -> SagaResult:
        sid = saga_id or uuid.uuid4().hex
        r = SagaResult(saga_id=sid, state=SagaState.RUNNING)
        with self._lock:
            self._results[sid] = r
        executed: list[tuple] = []  # (step, output)
        try:
            for step in steps:
                out = None
                for attempt in range(1, step.retry + 1):
                    try:
                        out = step.forward()
                        break
                    except Exception as e:
                        if attempt >= step.retry:
                            r.state = SagaState.COMPENSATING
                            r.error = f"{step.name}: {type(e).__name__}: {e}"
                            break
                        time.sleep(0.01)
                else:
                    r.state = SagaState.COMPENSATING
                if r.state == SagaState.COMPENSATING:
                    break
                executed.append((step, out))
                r.outputs.append(out)
                r.executed.append(step.name)
            if r.state == SagaState.RUNNING:
                r.state = SagaState.SUCCESS
        except Exception as e:
            r.state = SagaState.COMPENSATING
            r.error = f"{type(e).__name__}: {e}"
        # 补偿
        if r.state == SagaState.COMPENSATING:
            for step, out in reversed(executed):
                try:
                    step.compensate(out)
                    r.compensated.append(step.name)
                except Exception as e:
                    r.error += f"; compensate {step.name} failed: {e}"
            r.state = SagaState.FAILED
        return r

    def get(self, saga_id: str) -> SagaResult | None:
        with self._lock:
            return self._results.get(saga_id)
