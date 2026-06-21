"""Bug-111: GDPR 删除器 (用户级 / 字段级 / 时间窗口).

设计:
  - 注册可擦除目标: 表/字段, 关联的脱敏函数
  - 用户级擦除: 给定 user_id, 抹除所有相关字段
  - 字段级擦除: 给定表/字段, 按规则抹除
  - 时间窗口擦除: 删除某时间范围数据
  - 审计链: 记录每次擦除 (操作者 / 原因 / 影响行数 / hash)
  - dry_run 模式: 只计算影响, 不实际删除
  - 任务状态: PENDING / RUNNING / DONE / FAILED / DRY_RUN
"""

import hashlib
import json
import logging
import threading
import time
import uuid
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import StrEnum

logger = logging.getLogger(__name__)


class EraseScope(StrEnum):
    USER = "user"  # 用户级 (按 user_id 抹除所有相关字段)
    FIELD = "field"  # 字段级
    TIME_WINDOW = "time_window"  # 时间窗口


class EraseStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    DRY_RUN = "dry_run"


@dataclass
class EraseTarget:
    table: str
    field: str
    redact_fn: Callable[[object], object] | None = None
    description: str = ""
    extra: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "table": self.table,
            "field": self.field,
            "description": self.description,
            "extra": self.extra,
        }


@dataclass
class EraseTask:
    id: str
    scope: str
    actor: str
    reason: str
    started_at: float
    finished_at: float = 0.0
    status: str = EraseStatus.PENDING.value
    affected_tables: list[str] = field(default_factory=list)
    affected_rows: int = 0
    details: list[dict] = field(default_factory=list)
    error: str = ""
    dry_run: bool = False
    evidence_hash: str = ""

    def to_dict(self) -> dict:
        return self.__dict__.copy()


class GdprEraser:
    """GDPR 数据擦除器."""

    def __init__(self, max_audit: int = 5000):
        self._lock = threading.Lock()
        # (table, field) -> EraseTarget
        self._targets: dict[tuple, EraseTarget] = {}
        # 模拟的执行器 (实际项目接 ORM/SQL); 注入 callable
        self._executors: dict[str, Callable[[str, dict], int]] = {}
        # 任务历史
        self._tasks: deque[EraseTask] = deque(maxlen=max_audit)

    def register_target(
        self,
        table: str,
        field: str,
        redact_fn: Callable[[object], object] | None = None,
        description: str = "",
    ) -> None:
        with self._lock:
            self._targets[(table, field)] = EraseTarget(
                table=table, field=field, redact_fn=redact_fn, description=description
            )

    def unregister_target(self, table: str, field: str) -> bool:
        with self._lock:
            return self._targets.pop((table, field), None) is not None

    def list_targets(self) -> list[EraseTarget]:
        with self._lock:
            return list(self._targets.values())

    def register_executor(self, table: str, fn: Callable[[str, dict], int]) -> None:
        """注册表级执行器: fn(operation, payload) -> affected_rows."""
        with self._lock:
            self._executors[table] = fn

    def get_target(self, table: str, field: str) -> EraseTarget | None:
        with self._lock:
            return self._targets.get((table, field))

    def find_targets_by_table(self, table: str) -> list[EraseTarget]:
        with self._lock:
            return [t for (k, t) in self._targets.items() if k[0] == table]

    def find_targets_by_field(self, field: str) -> list[EraseTarget]:
        with self._lock:
            return [t for (k, t) in self._targets.items() if k[1] == field]

    def erase_user(
        self,
        user_id: str,
        actor: str = "system",
        reason: str = "gdpr_erasure",
        dry_run: bool = False,
    ) -> EraseTask:
        """用户级擦除: 抹除所有声明 (user_id 字段) 的目标."""
        task = EraseTask(
            id=uuid.uuid4().hex[:12],
            scope=EraseScope.USER.value,
            actor=actor,
            reason=reason,
            started_at=time.time(),
            dry_run=dry_run,
            status=EraseStatus.RUNNING.value,
        )
        try:
            with self._lock:
                targets = [
                    t
                    for t in self._targets.values()
                    if t.field == "user_id" or "user_id" in t.extra.get("match_fields", [])
                ]
            task.affected_tables = sorted({t.table for t in targets})
            for t in targets:
                op = "select" if dry_run else "delete"
                payload = {"field": t.field, "user_id": user_id, "dry_run": dry_run}
                affected = self._execute(t.table, op, payload)
                task.details.append(
                    {
                        "table": t.table,
                        "field": t.field,
                        "op": op,
                        "affected": affected,
                    }
                )
                task.affected_rows += affected
            task.finished_at = time.time()
            task.status = EraseStatus.DRY_RUN.value if dry_run else EraseStatus.DONE.value
        except Exception as e:
            task.status = EraseStatus.FAILED.value
            task.error = f"{type(e).__name__}: {e}"
            task.finished_at = time.time()
        # 计算证据 hash (不含 user_id 等敏感字段, 避免泄露)
        body = json.dumps(
            {
                "id": task.id,
                "scope": task.scope,
                "rows": task.affected_rows,
                "tables": task.affected_tables,
                "ts": task.finished_at,
            },
            sort_keys=True,
            ensure_ascii=False,
        )
        task.evidence_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()
        with self._lock:
            self._tasks.append(task)
        return task

    def erase_field(
        self,
        table: str,
        field: str,
        actor: str = "system",
        reason: str = "gdpr_field_erasure",
        dry_run: bool = False,
    ) -> EraseTask:
        """字段级擦除: 对指定表/字段执行 redact."""
        task = EraseTask(
            id=uuid.uuid4().hex[:12],
            scope=EraseScope.FIELD.value,
            actor=actor,
            reason=reason,
            started_at=time.time(),
            dry_run=dry_run,
            status=EraseStatus.RUNNING.value,
        )
        try:
            t = self.get_target(table, field)
            if t is None:
                raise ValueError(f"target {table}.{field} not registered")
            op = "preview" if dry_run else "redact"
            payload = {"field": field, "dry_run": dry_run}
            affected = self._execute(table, op, payload)
            task.affected_tables = [table]
            task.details.append({"table": table, "field": field, "op": op, "affected": affected})
            task.affected_rows = affected
            task.finished_at = time.time()
            task.status = EraseStatus.DRY_RUN.value if dry_run else EraseStatus.DONE.value
        except Exception as e:
            task.status = EraseStatus.FAILED.value
            task.error = f"{type(e).__name__}: {e}"
            task.finished_at = time.time()
        body = json.dumps(
            {
                "id": task.id,
                "scope": task.scope,
                "table": table,
                "field": field,
                "rows": task.affected_rows,
                "ts": task.finished_at,
            },
            sort_keys=True,
            ensure_ascii=False,
        )
        task.evidence_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()
        with self._lock:
            self._tasks.append(task)
        return task

    def erase_time_window(
        self,
        table: str,
        ts_field: str,
        start_ts: float,
        end_ts: float,
        actor: str = "system",
        reason: str = "gdpr_retention",
        dry_run: bool = False,
    ) -> EraseTask:
        """时间窗口擦除: 删除某时间范围内的数据."""
        task = EraseTask(
            id=uuid.uuid4().hex[:12],
            scope=EraseScope.TIME_WINDOW.value,
            actor=actor,
            reason=reason,
            started_at=time.time(),
            dry_run=dry_run,
            status=EraseStatus.RUNNING.value,
        )
        try:
            op = "select" if dry_run else "delete"
            payload = {"ts_field": ts_field, "start": start_ts, "end": end_ts, "dry_run": dry_run}
            affected = self._execute(table, op, payload)
            task.affected_tables = [table]
            task.details.append(
                {
                    "table": table,
                    "ts_field": ts_field,
                    "start": start_ts,
                    "end": end_ts,
                    "op": op,
                    "affected": affected,
                }
            )
            task.affected_rows = affected
            task.finished_at = time.time()
            task.status = EraseStatus.DRY_RUN.value if dry_run else EraseStatus.DONE.value
        except Exception as e:
            task.status = EraseStatus.FAILED.value
            task.error = f"{type(e).__name__}: {e}"
            task.finished_at = time.time()
        body = json.dumps(
            {
                "id": task.id,
                "scope": task.scope,
                "table": table,
                "ts_field": ts_field,
                "start": start_ts,
                "end": end_ts,
                "rows": task.affected_rows,
                "ts": task.finished_at,
            },
            sort_keys=True,
            ensure_ascii=False,
        )
        task.evidence_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()
        with self._lock:
            self._tasks.append(task)
        return task

    def _execute(self, table: str, op: str, payload: dict) -> int:
        with self._lock:
            fn = self._executors.get(table)
        if fn is not None:
            return int(fn(op, payload))
        # 默认 mock: 返回行数 (test 用)
        return 0

    def get_task(self, task_id: str) -> EraseTask | None:
        with self._lock:
            for t in self._tasks:
                if t.id == task_id:
                    return t
        return None

    def list_tasks(self, limit: int = 100, status: str | None = None) -> list[EraseTask]:
        with self._lock:
            arr = list(self._tasks)
        if status:
            arr = [t for t in arr if t.status == status]
        return arr[-limit:]

    def verify_evidence(self, task_id: str) -> dict[str, object]:
        t = self.get_task(task_id)
        if t is None:
            return {"ok": False, "error": "task_not_found"}
        # 重新计算 evidence_hash (字段顺序与生成时一致)
        if t.scope == EraseScope.USER.value or t.scope == EraseScope.FIELD.value:
            body = json.dumps(
                {
                    "id": t.id,
                    "scope": t.scope,
                    "rows": t.affected_rows,
                    "tables": t.affected_tables,
                    "ts": t.finished_at,
                },
                sort_keys=True,
                ensure_ascii=False,
            )
        else:
            body = json.dumps(
                {
                    "id": t.id,
                    "scope": t.scope,
                    "rows": t.affected_rows,
                    "ts": t.finished_at,
                },
                sort_keys=True,
                ensure_ascii=False,
            )
        recomputed = hashlib.sha256(body.encode("utf-8")).hexdigest()
        return {
            "ok": recomputed == t.evidence_hash,
            "expected": t.evidence_hash,
            "actual": recomputed,
        }

    def stats(self) -> dict:
        with self._lock:
            by_status: dict[str, int] = {}
            for t in self._tasks:
                by_status[t.status] = by_status.get(t.status, 0) + 1
            return {
                "target_count": len(self._targets),
                "executor_count": len(self._executors),
                "task_count": len(self._tasks),
                "by_status": by_status,
            }

    def clear(self) -> None:
        with self._lock:
            self._targets.clear()
            self._executors.clear()
            self._tasks.clear()


# 全局单例
gdpr_eraser = GdprEraser()
