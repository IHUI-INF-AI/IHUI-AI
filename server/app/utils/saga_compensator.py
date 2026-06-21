"""Bug-114: 分布式 Saga 补偿.

设计:
  - Saga: 多步骤 (forward action + compensation)
  - 状态机: PENDING -> RUNNING -> COMPENSATING -> COMPENSATED / DONE / FAILED
  - 步骤执行: 成功 -> 下一步; 失败 -> 反向补偿
  - 超时兜底: 每步有 timeout, 整体有 deadline
  - 持久化: 步骤 + 状态可序列化 (重启恢复)
  - 重试: 失败可设置重试次数
"""

import enum
import json
import logging
import threading
import time
import uuid
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class SagaState(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPENSATING = "compensating"
    COMPENSATED = "compensated"
    DONE = "done"
    FAILED = "failed"
    TIMEOUT = "timeout"


class StepStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    COMPENSATED = "compensated"
    SKIPPED = "skipped"


@dataclass
class SagaStep:
    name: str
    action: Callable[[dict], dict] | None = None
    compensation: Callable[[dict], dict] | None = None
    timeout_sec: float = 30.0
    max_retries: int = 0
    status: str = StepStatus.PENDING.value
    attempts: int = 0
    last_error: str = ""
    result: dict = field(default_factory=dict)
    started_at: float = 0.0
    finished_at: float = 0.0

    def to_dict(self) -> dict:
        d = self.__dict__.copy()
        # action/compensation 是 callable, 不能 JSON 序列化, 仅保存名字
        if d.get("action") is not None and not isinstance(d["action"], (str, type(None))):
            d["action"] = getattr(d["action"], "__name__", "action")
        if d.get("compensation") is not None and not isinstance(d["compensation"], (str, type(None))):
            d["compensation"] = getattr(d["compensation"], "__name__", "compensation")
        return d


@dataclass
class Saga:
    id: str
    name: str
    steps: list[SagaStep]
    state: str = SagaState.PENDING.value
    context: dict = field(default_factory=dict)
    created_at: float = 0.0
    started_at: float = 0.0
    finished_at: float = 0.0
    deadline_ts: float = 0.0
    error: str = ""
    current_step: int = 0
    compensate_from: int = 0

    def to_dict(self) -> dict:
        d = self.__dict__.copy()
        d["steps"] = [s.to_dict() for s in self.steps]
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "Saga":
        steps = [
            SagaStep(**{k: v for k, v in s.items() if k in SagaStep.__dataclass_fields__}) for s in d.get("steps", [])
        ]
        return cls(
            id=d["id"],
            name=d["name"],
            steps=steps,
            state=d.get("state", SagaState.PENDING.value),
            context=d.get("context", {}),
            created_at=d.get("created_at", 0.0),
            started_at=d.get("started_at", 0.0),
            finished_at=d.get("finished_at", 0.0),
            deadline_ts=d.get("deadline_ts", 0.0),
            error=d.get("error", ""),
            current_step=d.get("current_step", 0),
            compensate_from=d.get("compensate_from", 0),
        )


@dataclass
class SagaAudit:
    saga_id: str
    step: str
    action: str
    detail: str
    ts: float


class SagaRunner:
    """Saga 状态机 + 补偿执行器."""

    def __init__(self, max_audit: int = 5000):
        self._lock = threading.Lock()
        self._sagas: dict[str, Saga] = {}
        self._audit: deque[SagaAudit] = deque(maxlen=max_audit)
        # 持久化路径
        self._persist_path: str = ""

    def set_persist_path(self, path: str) -> None:
        with self._lock:
            self._persist_path = path

    def _audit_log(self, saga_id: str, step: str, action: str, detail: str) -> None:
        with self._lock:
            self._audit.append(SagaAudit(saga_id, step, action, detail, time.time()))

    def _persist(self, saga: Saga) -> None:
        if not self._persist_path:
            return
        try:
            with open(self._persist_path, "w", encoding="utf-8") as f:
                json.dump(saga.to_dict(), f, ensure_ascii=False, indent=2)
        except OSError as e:
            logger.warning("saga persist failed: %s", e)

    def create_saga(
        self,
        name: str,
        step_specs: list[dict[str, object]],
        context: dict | None = None,
        deadline_sec: float = 300.0,
    ) -> Saga:
        steps: list[SagaStep] = []
        for spec in step_specs:
            s = SagaStep(
                name=str(spec.get("name", uuid.uuid4().hex[:6])),
                action=spec.get("action"),
                compensation=spec.get("compensation"),
                timeout_sec=float(spec.get("timeout_sec", 30.0)),
                max_retries=int(spec.get("max_retries", 0)),
            )
            steps.append(s)
        saga = Saga(
            id=uuid.uuid4().hex[:12],
            name=name,
            steps=steps,
            state=SagaState.PENDING.value,
            context=context or {},
            created_at=time.time(),
            deadline_ts=time.time() + deadline_sec,
        )
        with self._lock:
            self._sagas[saga.id] = saga
        self._audit_log(saga.id, "-", "create", f"name={name} steps={len(steps)}")
        return saga

    def get_saga(self, saga_id: str) -> Saga | None:
        with self._lock:
            return self._sagas.get(saga_id)

    def list_sagas(self, state: str | None = None, limit: int = 100) -> list[Saga]:
        with self._lock:
            arr = list(self._sagas.values())
        if state:
            arr = [s for s in arr if s.state == state]
        return arr[-limit:]

    def remove_saga(self, saga_id: str) -> bool:
        with self._lock:
            return self._sagas.pop(saga_id, None) is not None

    def _execute_step(self, saga: Saga, step_idx: int) -> bool:
        if step_idx < 0 or step_idx >= len(saga.steps):
            return False
        step = saga.steps[step_idx]
        deadline = saga.deadline_ts
        if time.time() > deadline:
            saga.state = SagaState.TIMEOUT.value
            saga.error = "deadline_exceeded"
            saga.finished_at = time.time()
            return False
        step.started_at = time.time()
        step.attempts += 1
        step.status = StepStatus.RUNNING.value
        self._audit_log(saga.id, step.name, "start", f"attempt={step.attempts}")
        if step.action is None:
            # 无 action 直接当 done
            step.status = StepStatus.DONE.value
            step.finished_at = time.time()
            self._audit_log(saga.id, step.name, "skip", "no_action")
            return True
        try:
            res = step.action(saga.context)
            step.result = res or {}
            step.status = StepStatus.DONE.value
            step.finished_at = time.time()
            # 合并 context
            if isinstance(res, dict):
                saga.context.update(res)
            self._audit_log(saga.id, step.name, "done", f"result={step.result}")
            return True
        except Exception as e:
            step.last_error = f"{type(e).__name__}: {e}"
            step.status = StepStatus.FAILED.value
            step.finished_at = time.time()
            self._audit_log(saga.id, step.name, "fail", step.last_error)
            # 重试
            if step.attempts <= step.max_retries:
                self._audit_log(saga.id, step.name, "retry", f"next_attempt={step.attempts + 1}")
                step.status = StepStatus.PENDING.value
                return self._execute_step(saga, step_idx)
            return False

    def _compensate(self, saga: Saga, from_idx: int) -> None:
        saga.state = SagaState.COMPENSATING.value
        # 倒序补偿 from_idx 之前的成功步骤
        for i in range(from_idx - 1, -1, -1):
            step = saga.steps[i]
            if step.status != StepStatus.DONE.value:
                continue
            self._audit_log(saga.id, step.name, "compensate_start", "")
            try:
                if step.compensation is not None:
                    res = step.compensation(saga.context) or {}
                    if isinstance(res, dict):
                        saga.context.update(res)
                step.status = StepStatus.COMPENSATED.value
                self._audit_log(saga.id, step.name, "compensate_done", "")
            except Exception as e:
                step.status = StepStatus.FAILED.value
                step.last_error = f"compensate_failed: {type(e).__name__}: {e}"
                self._audit_log(saga.id, step.name, "compensate_fail", step.last_error)
        saga.state = SagaState.COMPENSATED.value
        saga.finished_at = time.time()

    def run(self, saga_id: str) -> dict[str, object]:
        with self._lock:
            saga = self._sagas.get(saga_id)
        if saga is None:
            return {"ok": False, "error": "saga_not_found"}
        if saga.state not in (SagaState.PENDING.value,):
            return {"ok": False, "error": f"bad_state_{saga.state}"}
        saga.state = SagaState.RUNNING.value
        saga.started_at = time.time()
        saga.current_step = 0
        saga.compensate_from = 0
        self._audit_log(saga.id, "-", "run_start", "")
        for idx, step in enumerate(saga.steps):
            saga.current_step = idx
            ok = self._execute_step(saga, idx)
            self._persist(saga)
            if not ok:
                saga.compensate_from = idx
                if saga.state == SagaState.TIMEOUT.value:
                    saga.error = step.last_error or "timeout"
                    # 也补偿
                    self._compensate(saga, idx)
                    return {"ok": False, "state": saga.state, "error": saga.error, "step": step.name}
                saga.error = step.last_error
                self._compensate(saga, idx)
                return {"ok": False, "state": saga.state, "error": saga.error, "step": step.name}
        saga.state = SagaState.DONE.value
        saga.finished_at = time.time()
        self._persist(saga)
        self._audit_log(saga.id, "-", "run_done", "")
        return {"ok": True, "state": saga.state, "steps": [s.name for s in saga.steps]}

    def cancel(self, saga_id: str, reason: str = "manual") -> dict[str, object]:
        with self._lock:
            saga = self._sagas.get(saga_id)
        if saga is None:
            return {"ok": False, "error": "saga_not_found"}
        if saga.state in (SagaState.DONE.value, SagaState.COMPENSATED.value, SagaState.FAILED.value):
            return {"ok": False, "error": f"bad_state_{saga.state}"}
        self._audit_log(saga.id, "-", "cancel", reason)
        self._compensate(saga, saga.current_step)
        saga.error = reason
        return {"ok": True, "state": saga.state}

    def restore(self, saga_dict: dict) -> Saga:
        saga = Saga.from_dict(saga_dict)
        with self._lock:
            self._sagas[saga.id] = saga
        self._audit_log(saga.id, "-", "restore", f"state={saga.state}")
        return saga

    def get_audit(self, saga_id: str | None = None, limit: int = 100) -> list[SagaAudit]:
        with self._lock:
            arr = list(self._audit)
        if saga_id:
            arr = [a for a in arr if a.saga_id == saga_id]
        return arr[-limit:]

    def stats(self) -> dict:
        with self._lock:
            by_state: dict[str, int] = {}
            for s in self._sagas.values():
                by_state[s.state] = by_state.get(s.state, 0) + 1
            return {
                "saga_count": len(self._sagas),
                "audit_count": len(self._audit),
                "by_state": by_state,
            }

    def clear(self) -> None:
        with self._lock:
            self._sagas.clear()
            self._audit.clear()


# 全局单例
saga_runner = SagaRunner()
