"""Bug-97: 异步任务幂等 (job_id 持久化去重 + 崩溃可恢复).

设计:
  - 任务执行前: 写 pending 状态
  - 执行中: 写 running
  - 执行后: 写 success / failed
  - 同 job_id 再次提交: 拒绝 (返回上次结果)
  - 崩溃恢复: 启动时把所有 stale(running 超时) 重置为 pending
  - 后端持久化: JSONL 文件 (可替换为 DB)

使用:
    from app.utils.job_idempotent import job_runner, JobStatus

    if job_runner.begin("job-1", payload={"k": "v"}):
        try:
            result = do_work()
            job_runner.finish("job-1", result=result)
        except Exception as e:
            job_runner.fail("job-1", error=str(e))
    else:
        cached = job_runner.get_cached_result("job-1")
"""

import json
import logging
import os
import threading
import time
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_LOG_PATH = os.environ.get("ZHS_AUDIT_DIR", "audit") + "/jobs.jsonl"
DEFAULT_STALE_AFTER_SEC = 600.0


class JobStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class JobRecord:
    job_id: str
    status: JobStatus
    payload: Any
    result: Any
    error: str
    started_at: float
    finished_at: float
    attempts: int

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "status": self.status.value,
            "payload": self.payload,
            "result": self.result,
            "error": self.error,
            "started_at": round(self.started_at, 3),
            "finished_at": round(self.finished_at, 3) if self.finished_at else 0.0,
            "attempts": self.attempts,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "JobRecord":
        return cls(
            job_id=d["job_id"],
            status=JobStatus(d.get("status", "pending")),
            payload=d.get("payload"),
            result=d.get("result"),
            error=d.get("error", ""),
            started_at=d.get("started_at", 0.0),
            finished_at=d.get("finished_at", 0.0),
            attempts=d.get("attempts", 0),
        )


class JobRunner:
    """幂等任务执行器."""

    def __init__(self, log_path: str = DEFAULT_LOG_PATH, stale_after_sec: float = DEFAULT_STALE_AFTER_SEC):
        self._lock = threading.RLock()
        self._log_path = log_path
        self._stale_after = stale_after_sec
        self._jobs: dict[str, JobRecord] = {}
        self._total_begin = 0
        self._total_skip = 0
        self._total_finish = 0
        self._total_fail = 0
        self._total_recover = 0
        self._load_from_disk()
        self._recover_stale()

    def _load_from_disk(self) -> None:
        if not os.path.exists(self._log_path):
            return
        try:
            with open(self._log_path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        d = json.loads(line)
                        rec = JobRecord.from_dict(d)
                        self._jobs[rec.job_id] = rec
                    except Exception:
                        continue
        except Exception as e:
            logger.debug(f"job_runner load fail: {e!r}")

    def _persist(self, rec: JobRecord) -> None:
        try:
            os.makedirs(os.path.dirname(self._log_path) or ".", exist_ok=True)
            with open(self._log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec.to_dict(), ensure_ascii=False) + "\n")
        except Exception as e:
            logger.debug(f"job_runner persist fail: {e!r}")

    def _recover_stale(self) -> None:
        """恢复超时未完成的 running 任务."""
        now = time.time()
        with self._lock:
            for rec in self._jobs.values():
                if rec.status == JobStatus.RUNNING and (now - rec.started_at) > self._stale_after:
                    rec.status = JobStatus.PENDING
                    rec.attempts = max(0, rec.attempts - 1)
                    self._total_recover += 1

    def set_stale_after(self, sec: float) -> None:
        with self._lock:
            self._stale_after = max(60.0, float(sec))

    def begin(self, job_id: str, payload: Any = None) -> bool:
        """开始执行. True=新开始, False=已存在 (应跳过)."""
        with self._lock:
            self._total_begin += 1
            existing = self._jobs.get(job_id)
            if existing is not None and existing.status in (JobStatus.SUCCESS, JobStatus.RUNNING, JobStatus.PENDING):
                self._total_skip += 1
                return False
            # FAILED -> 允许重试
            rec = JobRecord(
                job_id=job_id,
                status=JobStatus.RUNNING,
                payload=payload,
                result=None,
                error="",
                started_at=time.time(),
                finished_at=0.0,
                attempts=1 if existing is None else existing.attempts + 1,
            )
            self._jobs[job_id] = rec
        self._persist(rec)
        return True

    def finish(self, job_id: str, result: Any = None) -> None:
        with self._lock:
            rec = self._jobs.get(job_id)
            if rec is None:
                rec = JobRecord(
                    job_id=job_id,
                    status=JobStatus.SUCCESS,
                    payload=None,
                    result=result,
                    error="",
                    started_at=time.time(),
                    finished_at=time.time(),
                    attempts=1,
                )
                self._jobs[job_id] = rec
            else:
                rec.status = JobStatus.SUCCESS
                rec.result = result
                rec.error = ""
                rec.finished_at = time.time()
            self._total_finish += 1
        self._persist(rec)

    def fail(self, job_id: str, error: str = "") -> None:
        with self._lock:
            rec = self._jobs.get(job_id)
            if rec is None:
                rec = JobRecord(
                    job_id=job_id,
                    status=JobStatus.FAILED,
                    payload=None,
                    result=None,
                    error=error,
                    started_at=time.time(),
                    finished_at=time.time(),
                    attempts=1,
                )
                self._jobs[job_id] = rec
            else:
                rec.status = JobStatus.FAILED
                rec.error = error
                rec.finished_at = time.time()
            self._total_fail += 1
        self._persist(rec)

    def cancel(self, job_id: str) -> None:
        with self._lock:
            rec = self._jobs.get(job_id)
            if rec is not None and rec.status in (JobStatus.PENDING, JobStatus.RUNNING):
                rec.status = JobStatus.CANCELLED
                rec.finished_at = time.time()
                self._persist(rec)

    def get_status(self, job_id: str) -> JobStatus | None:
        with self._lock:
            rec = self._jobs.get(job_id)
            return rec.status if rec else None

    def get_cached_result(self, job_id: str) -> Any:
        with self._lock:
            rec = self._jobs.get(job_id)
            if rec is None or rec.status != JobStatus.SUCCESS:
                return None
            return rec.result

    def get_record(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            rec = self._jobs.get(job_id)
            return rec.to_dict() if rec else None

    def list_records(self, status: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            arr = list(self._jobs.values())
        if status is not None:
            arr = [r for r in arr if r.status.value == status]
        arr.sort(key=lambda r: r.started_at, reverse=True)
        return [r.to_dict() for r in arr[:limit]]

    def stats(self) -> dict:
        with self._lock:
            by_status: dict[str, int] = {}
            for r in self._jobs.values():
                by_status[r.status.value] = by_status.get(r.status.value, 0) + 1
            return {
                "tracked": len(self._jobs),
                "by_status": by_status,
                "total_begin": self._total_begin,
                "total_skip": self._total_skip,
                "total_finish": self._total_finish,
                "total_fail": self._total_fail,
                "total_recover": self._total_recover,
                "stale_after_sec": self._stale_after,
            }


# 全局单例
job_runner = JobRunner()
