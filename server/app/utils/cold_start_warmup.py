"""Bug-100: 冷启动预热.

设计:
  - 注册"预热任务" (name + 优先级 + loader callable + 依赖)
  - 启动时按优先级 + 依赖图执行, 失败可降级
  - 支持同步 / 异步 loader
  - 健康检查间隔 + 周期再预热
  - 状态机: PENDING -> RUNNING -> READY / FAILED
"""

import asyncio
import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Union

logger = logging.getLogger(__name__)


class WarmupStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    READY = "ready"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class WarmupTask:
    name: str
    loader: Callable[[], Union[object, "asyncio.Future"]]
    priority: int = 0  # 数字越大越先跑
    deps: list[str] = field(default_factory=list)
    timeout_sec: float = 30.0
    required: bool = True  # 失败是否阻塞启动
    status: WarmupStatus = WarmupStatus.PENDING
    error: str = ""
    duration_sec: float = 0.0
    last_run_ts: float = 0.0
    run_count: int = 0
    fail_count: int = 0

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "priority": self.priority,
            "deps": self.deps,
            "status": self.status.value,
            "error": self.error,
            "duration_sec": round(self.duration_sec, 4),
            "last_run_ts": self.last_run_ts,
            "run_count": self.run_count,
            "fail_count": self.fail_count,
            "required": self.required,
        }


class ColdStartWarmup:
    """冷启动预热器.

    使用:
        warmup = ColdStartWarmup()
        warmup.register("config", lambda: load_config(), priority=100)
        warmup.register("db_pool", lambda: init_pool(), deps=["config"], priority=90)
        warmup.run_all()  # 同步
        # 或 await warmup.run_all_async()
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._tasks: dict[str, WarmupTask] = {}
        self._started = False
        self._started_ts = 0.0
        self._ready: set[str] = set()
        self._failed: set[str] = set()

    def register(
        self,
        name: str,
        loader: Callable,
        priority: int = 0,
        deps: list[str] | None = None,
        timeout_sec: float = 30.0,
        required: bool = True,
    ) -> None:
        with self._lock:
            if name in self._tasks:
                raise ValueError(f"task {name} already registered")
            self._tasks[name] = WarmupTask(
                name=name,
                loader=loader,
                priority=priority,
                deps=deps or [],
                timeout_sec=timeout_sec,
                required=required,
            )

    def unregister(self, name: str) -> bool:
        with self._lock:
            return self._tasks.pop(name, None) is not None

    def list_tasks(self) -> list[WarmupTask]:
        with self._lock:
            return list(self._tasks.values())

    def get_task(self, name: str) -> WarmupTask | None:
        with self._lock:
            return self._tasks.get(name)

    def _topological_order(self) -> list[WarmupTask]:
        """依赖图 + 优先级排序."""
        with self._lock:
            tasks = dict(self._tasks)

        # 检查依赖
        for name, t in tasks.items():
            for d in t.deps:
                if d not in tasks:
                    raise ValueError(f"task {name} 依赖 {d} 不存在")

        visited: set[str] = set()
        order: list[str] = []

        def visit(n: str, path: set[str]) -> None:
            if n in visited:
                return
            if n in path:
                raise ValueError(f"循环依赖: {n}")
            path.add(n)
            for d in tasks[n].deps:
                visit(d, path)
            path.discard(n)
            visited.add(n)
            order.append(n)

        for name in tasks:
            visit(name, set())

        # 按优先级降序
        order.sort(key=lambda n: -tasks[n].priority)
        return [tasks[n] for n in order]

    def run_all(self) -> dict[str, object]:
        """同步执行所有任务, 返回汇总."""
        with self._lock:
            if self._started:
                return {"started": True, "elapsed": time.time() - self._started_ts}
        order = self._topological_order()
        start = time.time()
        results: list[dict[str, object]] = []
        for t in order:
            if any(d in self._failed for d in t.deps):
                # 依赖失败, 跳过
                t.status = WarmupStatus.SKIPPED
                results.append({"name": t.name, "status": t.status.value, "reason": "dep_failed"})
                continue
            self._run_one(t)
            results.append(
                {
                    "name": t.name,
                    "status": t.status.value,
                    "duration_sec": round(t.duration_sec, 4),
                    "error": t.error,
                }
            )
        with self._lock:
            self._started = True
            self._started_ts = start
        return {
            "elapsed": round(time.time() - start, 4),
            "ready": sorted(self._ready),
            "failed": sorted(self._failed),
            "results": results,
        }

    async def run_all_async(self) -> dict[str, object]:
        order = self._topological_order()
        start = time.time()
        results: list[dict[str, object]] = []
        for t in order:
            if any(d in self._failed for d in t.deps):
                t.status = WarmupStatus.SKIPPED
                results.append({"name": t.name, "status": t.status.value, "reason": "dep_failed"})
                continue
            await self._run_one_async(t)
            results.append(
                {
                    "name": t.name,
                    "status": t.status.value,
                    "duration_sec": round(t.duration_sec, 4),
                    "error": t.error,
                }
            )
        with self._lock:
            self._started = True
            self._started_ts = start
        return {
            "elapsed": round(time.time() - start, 4),
            "ready": sorted(self._ready),
            "failed": sorted(self._failed),
            "results": results,
        }

    def _run_one(self, t: WarmupTask) -> None:
        t.status = WarmupStatus.RUNNING
        t.last_run_ts = time.time()
        t.run_count += 1
        ts = time.time()
        try:
            res = t.loader()
            if asyncio.iscoroutine(res):
                # 异步 loader 不允许在同步路径下跑, 标记失败
                t.status = WarmupStatus.FAILED
                t.error = "async loader in sync run"
                t.fail_count += 1
                self._failed.add(t.name)
                return
            t.status = WarmupStatus.READY
            self._ready.add(t.name)
        except Exception as e:
            t.status = WarmupStatus.FAILED
            t.error = f"{type(e).__name__}: {e}"
            t.fail_count += 1
            if t.required:
                self._failed.add(t.name)
            logger.warning("warmup failed: %s err=%s", t.name, t.error)
        t.duration_sec = time.time() - ts

    async def _run_one_async(self, t: WarmupTask) -> None:
        t.status = WarmupStatus.RUNNING
        t.last_run_ts = time.time()
        t.run_count += 1
        ts = time.time()
        try:
            res = t.loader()
            if asyncio.iscoroutine(res):
                res = await asyncio.wait_for(res, timeout=t.timeout_sec)
            t.status = WarmupStatus.READY
            self._ready.add(t.name)
        except Exception as e:
            t.status = WarmupStatus.FAILED
            t.error = f"{type(e).__name__}: {e}"
            t.fail_count += 1
            if t.required:
                self._failed.add(t.name)
            logger.warning("warmup failed: %s err=%s", t.name, t.error)
        t.duration_sec = time.time() - ts

    def rerun(self, name: str) -> bool:
        with self._lock:
            t = self._tasks.get(name)
        if t is None:
            return False
        self._failed.discard(name)
        self._ready.discard(name)
        self._run_one(t)
        return t.status == WarmupStatus.READY

    def is_ready(self, name: str) -> bool:
        return name in self._ready

    def is_failed(self, name: str) -> bool:
        return name in self._failed

    def stats(self) -> dict:
        with self._lock:
            by_status: dict[str, int] = {}
            for t in self._tasks.values():
                by_status[t.status.value] = by_status.get(t.status.value, 0) + 1
            return {
                "task_count": len(self._tasks),
                "by_status": by_status,
                "started": self._started,
                "started_ts": self._started_ts,
                "ready": sorted(self._ready),
                "failed": sorted(self._failed),
            }

    def clear(self) -> None:
        with self._lock:
            self._tasks.clear()
            self._ready.clear()
            self._failed.clear()
            self._started = False
            self._started_ts = 0.0


# 全局单例
cold_warmup = ColdStartWarmup()
