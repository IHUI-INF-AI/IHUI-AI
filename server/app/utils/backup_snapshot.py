"""Bug-112: 备份快照协调.

设计:
  - 注册备份目标 (DB / 文件目录 / Redis / S3 ...)
  - 调度: cron-like (interval_sec + jitter)
  - 触发: schedule / 手动 trigger
  - 执行: 调用注入的 runner 函数, 拿到结果
  - 校验: 完成后调用 verifier, 失败标记 FAILED
  - 老化: 超过 retention 的快照标记 expired
  - 状态机: PENDING -> RUNNING -> DONE / FAILED / VERIFY_FAILED / EXPIRED
  - 审计: 每次快照记录 hash + size + duration
"""

import enum
import logging
import random
import threading
import time
import uuid
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class SnapshotStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    VERIFY_FAILED = "verify_failed"
    EXPIRED = "expired"


@dataclass
class BackupTarget:
    name: str
    kind: str  # db / fs / redis / s3
    runner: Callable[[], dict] | None = None  # 返回 {path, size, checksum}
    verifier: Callable[[dict], bool] | None = None
    interval_sec: float = 86400.0
    retention_count: int = 7
    jitter_sec: float = 60.0
    enabled: bool = True
    last_run_at: float = 0.0
    next_run_at: float = 0.0
    last_status: str = SnapshotStatus.PENDING.value
    description: str = ""

    def to_dict(self) -> dict:
        return self.__dict__.copy()


@dataclass
class SnapshotRecord:
    id: str
    target: str
    started_at: float
    finished_at: float = 0.0
    status: str = SnapshotStatus.PENDING.value
    path: str = ""
    size: int = 0
    checksum: str = ""
    duration_sec: float = 0.0
    error: str = ""
    actor: str = "scheduler"
    trigger: str = "schedule"  # schedule / manual
    meta: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return self.__dict__.copy()


class BackupCoordinator:
    """备份快照协调器."""

    def __init__(self, max_records: int = 1000):
        self._lock = threading.Lock()
        self._targets: dict[str, BackupTarget] = {}
        self._records: deque[SnapshotRecord] = deque(maxlen=max_records)

    def register_target(
        self,
        name: str,
        kind: str,
        runner: Callable[[], dict] | None = None,
        verifier: Callable[[dict], bool] | None = None,
        interval_sec: float = 86400.0,
        retention_count: int = 7,
        jitter_sec: float = 60.0,
        description: str = "",
    ) -> BackupTarget:
        with self._lock:
            if name in self._targets:
                raise ValueError(f"target {name} already registered")
            now = time.time()
            t = BackupTarget(
                name=name,
                kind=kind,
                runner=runner,
                verifier=verifier,
                interval_sec=interval_sec,
                retention_count=retention_count,
                jitter_sec=jitter_sec,
                next_run_at=now + interval_sec,
                description=description,
            )
            self._targets[name] = t
            return t

    def unregister_target(self, name: str) -> bool:
        with self._lock:
            return self._targets.pop(name, None) is not None

    def get_target(self, name: str) -> BackupTarget | None:
        with self._lock:
            return self._targets.get(name)

    def list_targets(self) -> list[BackupTarget]:
        with self._lock:
            return list(self._targets.values())

    def enable(self, name: str, enabled: bool = True) -> bool:
        with self._lock:
            t = self._targets.get(name)
            if t is None:
                return False
            t.enabled = enabled
            return True

    def tick(self, now: float | None = None) -> list[SnapshotRecord]:
        """检查所有目标, 对到期且 enabled 的触发备份, 返回本轮触发的记录."""
        now = now if now is not None else time.time()
        triggered: list[SnapshotRecord] = []
        with self._lock:
            due: list[str] = []
            for name, t in self._targets.items():
                if t.enabled and t.next_run_at and now >= t.next_run_at:
                    due.append(name)
        for name in due:
            rec = self.run(name, trigger="schedule")
            triggered.append(rec)
        return triggered

    def run(self, target_name: str, trigger: str = "manual", actor: str = "operator") -> SnapshotRecord:
        rec = SnapshotRecord(
            id=uuid.uuid4().hex[:12],
            target=target_name,
            started_at=time.time(),
            trigger=trigger,
            actor=actor,
        )
        with self._lock:
            t = self._targets.get(target_name)
        if t is None:
            rec.status = SnapshotStatus.FAILED.value
            rec.error = "target_not_found"
            rec.finished_at = time.time()
            with self._lock:
                self._records.append(rec)
            return rec
        if t.runner is None:
            rec.status = SnapshotStatus.FAILED.value
            rec.error = "no_runner"
            rec.finished_at = time.time()
            with self._lock:
                self._records.append(rec)
            self._update_target_after(target_name, rec)
            return rec
        # 执行
        try:
            res = t.runner() or {}
            rec.path = str(res.get("path", ""))
            rec.size = int(res.get("size", 0))
            rec.checksum = str(res.get("checksum", ""))
            rec.duration_sec = time.time() - rec.started_at
            rec.status = SnapshotStatus.DONE.value
            # 校验
            if t.verifier is not None:
                ok = t.verifier(res)
                if not ok:
                    rec.status = SnapshotStatus.VERIFY_FAILED.value
                    rec.error = "verifier_returned_false"
            rec.finished_at = time.time()
        except Exception as e:
            rec.status = SnapshotStatus.FAILED.value
            rec.error = f"{type(e).__name__}: {e}"
            rec.finished_at = time.time()
        with self._lock:
            self._records.append(rec)
        self._update_target_after(target_name, rec)
        # 老化
        self._expire_old(target_name)
        return rec

    def _update_target_after(self, target_name: str, rec: SnapshotRecord) -> None:
        with self._lock:
            t = self._targets.get(target_name)
            if t is None:
                return
            t.last_run_at = rec.finished_at
            t.last_status = rec.status
            jitter = random.uniform(0.0, t.jitter_sec) if t.jitter_sec > 0 else 0.0
            t.next_run_at = rec.finished_at + t.interval_sec + jitter

    def _expire_old(self, target_name: str) -> int:
        with self._lock:
            t = self._targets.get(target_name)
            if t is None:
                return 0
            keep = t.retention_count
            done_records = [
                r for r in self._records if r.target == target_name and r.status == SnapshotStatus.DONE.value
            ]
            if len(done_records) <= keep:
                return 0
            # 老的最早的 N 个设为 EXPIRED
            to_expire = done_records[: len(done_records) - keep]
            ids = {r.id for r in to_expire}
            n = 0
            for r in self._records:
                if r.id in ids and r.status == SnapshotStatus.DONE.value:
                    r.status = SnapshotStatus.EXPIRED.value
                    n += 1
            return n

    def list_records(
        self,
        target: str | None = None,
        status: str | None = None,
        limit: int = 100,
    ) -> list[SnapshotRecord]:
        with self._lock:
            arr = list(self._records)
        if target:
            arr = [r for r in arr if r.target == target]
        if status:
            arr = [r for r in arr if r.status == status]
        return arr[-limit:]

    def get_record(self, record_id: str) -> SnapshotRecord | None:
        with self._lock:
            for r in self._records:
                if r.id == record_id:
                    return r
        return None

    def verify_record(self, record_id: str, expected_checksum: str) -> dict[str, object]:
        r = self.get_record(record_id)
        if r is None:
            return {"ok": False, "error": "not_found"}
        return {
            "ok": r.checksum == expected_checksum and r.status in (SnapshotStatus.DONE.value,),
            "record_checksum": r.checksum,
            "expected": expected_checksum,
            "status": r.status,
        }

    def stats(self) -> dict:
        with self._lock:
            by_status: dict[str, int] = {}
            for r in self._records:
                by_status[r.status] = by_status.get(r.status, 0) + 1
            return {
                "target_count": len(self._targets),
                "record_count": len(self._records),
                "by_status": by_status,
            }

    def clear(self) -> None:
        with self._lock:
            self._targets.clear()
            self._records.clear()


# 全局单例
backup_coordinator = BackupCoordinator()
