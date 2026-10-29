# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D14② 沙箱任务队列(G-17 拆票子项,2026-10-23 落地)。

票面三条硬判据(逐条可测,不依赖 docker):
- **同一镜像 N 个任务串行度可配**:按镜像分道(lane),每道并发度可配,
  1 = 全串行;不同镜像互不阻塞,跨项目并行由此天然成立。
- **失败可重放一次**:failed 任务可 replay() 重放入队,每任务仅一次,
  第二次重放(或重放非 failed 任务)明确拒绝。
- **队列满时明确拒绝而不是静默排队**:镜像道等待队列达 max_pending 时
  enqueue/replay 抛 SandboxQueueFullError(HTTP 侧映射 429),
  调用方拿到可读拒绝原因,任务绝不落库、绝不静默丢弃。

执行器可注入(async callable(SandboxTask) -> dict),默认执行器委托
container_runtime.start_run + wait_run:本机无 docker 时,G-212 严档的
fail-closed 拒绝会以"任务失败(可重放一次)"的形式如实穿透队列,
队列本身不降级、不假装成功 —— ① 容器隔离与 ③ 镜像缓存的验收仍归"等环境"。
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# 队列缺省档:全串行(票面"串行度可配"的最保守档)+ 每镜像道等待上限
DEFAULT_QUEUE_CONCURRENCY = 1
DEFAULT_QUEUE_MAX_PENDING = 100

# 任务终态
TASK_STATUS = ("queued", "running", "succeeded", "failed")


class SandboxQueueFullError(RuntimeError):
    """镜像道等待队列已满:显式拒绝,不静默排队(票面判据③)。"""


def _now_iso() -> str:
    """当前 UTC 时间 ISO8601(秒级),与 container_runtime 格式一致。"""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


@dataclass
class SandboxTask:
    """队列内任务记录(进程内可见;执行落库由 container_runtime 侧负责)。"""

    task_id: str
    image: str
    payload: dict[str, Any] = field(default_factory=dict)
    status: str = "queued"  # queued / running / succeeded / failed
    attempts: int = 0
    replayed: bool = False  # 重放名额(票面判据②:仅一次)
    result: dict[str, Any] | None = None
    error: str = ""
    user_id: str = ""
    enqueued_at: str = field(default_factory=_now_iso)
    started_at: str = ""
    ended_at: str = ""


@dataclass
class _Lane:
    """镜像执行道:并发信号量(串行度)+ 等待计数(队列满判定)。"""

    semaphore: asyncio.Semaphore
    waiting: int = 0


class SandboxTaskQueue:
    """按镜像分道的沙箱任务队列(票 D14② 验收面)。"""

    def __init__(
        self,
        *,
        executor: Callable[[SandboxTask], Any] | None = None,
        concurrency: int = DEFAULT_QUEUE_CONCURRENCY,
        max_pending: int = DEFAULT_QUEUE_MAX_PENDING,
    ) -> None:
        if concurrency < 1:
            raise ValueError(f"concurrency 必须 >= 1,得到 {concurrency!r}")
        if max_pending < 1:
            raise ValueError(f"max_pending 必须 >= 1,得到 {max_pending!r}")
        self._executor = executor
        self._concurrency = concurrency
        self._max_pending = max_pending
        self._tasks: dict[str, SandboxTask] = {}
        self._lanes: dict[str, _Lane] = {}
        self._handles: dict[str, asyncio.Task[None]] = {}

    # ---------------- 对外 API ----------------

    async def enqueue(
        self,
        payload: dict[str, Any],
        *,
        image: str | None = None,
        user_id: str = "",
    ) -> dict[str, Any]:
        """任务入队(按镜像道排队,串行度受控)。

        队列满 → 抛 SandboxQueueFullError(明确拒绝,任务不落库)。
        返回入队时刻的任务快照。
        """
        resolved_image = image or os.getenv("CONTAINER_IMAGE") or "python:3.12-slim"
        lane = self._get_lane(resolved_image)
        self._reject_if_full(lane, resolved_image)
        record = SandboxTask(
            task_id=uuid.uuid4().hex,
            image=resolved_image,
            payload=dict(payload),
            user_id=user_id,
        )
        self._tasks[record.task_id] = record
        self._dispatch(record, lane)
        return asdict(record)

    async def replay(self, task_id: str) -> dict[str, Any]:
        """重放一个 failed 任务(票面判据:每任务仅一次)。

        - 非 failed 状态 → ValueError(不可重放);
        - 重放名额已用 → ValueError(仅允许一次);
        - 队列满 → SandboxQueueFullError(与首次入队同判据,不静默排队)。
        """
        record = self._tasks.get(task_id)
        if record is None:
            raise ValueError(f"任务不存在: {task_id}")
        if record.status != "failed":
            raise ValueError(f"仅 failed 任务可重放,当前状态 {record.status!r}")
        if record.replayed:
            raise ValueError("重放名额已用尽(失败仅允许重放一次)")
        lane = self._get_lane(record.image)
        self._reject_if_full(lane, record.image)
        record.replayed = True
        record.status = "queued"
        record.error = ""
        record.result = None
        record.started_at = ""
        record.ended_at = ""
        self._dispatch(record, lane)
        return asdict(record)

    def snapshot(self, task_id: str) -> dict[str, Any] | None:
        """取任务快照;不存在返回 None。"""
        record = self._tasks.get(task_id)
        return asdict(record) if record else None

    def list_tasks(
        self,
        *,
        limit: int = 50,
        user_id: str | None = None,
        image: str | None = None,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        """列出任务快照(新→旧)。user_id 非空时按属主过滤,判据与
        container_runtime.list_runs 同用 owner_scoped_allows,不在此重写。"""
        items = list(self._tasks.values())
        if user_id is not None:
            from .session_store import owner_scoped_allows

            items = [r for r in items if owner_scoped_allows(user_id, r.user_id)]
        if image is not None:
            items = [r for r in items if r.image == image]
        if status is not None:
            items = [r for r in items if r.status == status]
        items.sort(key=lambda r: r.enqueued_at, reverse=True)
        return [asdict(r) for r in items[: max(1, limit)]]

    def stats(self) -> dict[str, Any]:
        """队列面快照(看板/运维用):各镜像道 等待/并发度/上限 + 状态计数。"""
        by_status: dict[str, int] = {}
        for r in self._tasks.values():
            by_status[r.status] = by_status.get(r.status, 0) + 1
        return {
            "concurrency": self._concurrency,
            "max_pending": self._max_pending,
            "total_tasks": len(self._tasks),
            "by_status": by_status,
            "lanes": {
                img: {"waiting": lane.waiting} for img, lane in self._lanes.items()
            },
        }

    async def drain(self, timeout: float = 30.0) -> None:
        """等待所有在途任务终结(测试辅助);超时抛 TimeoutError。"""
        pending = [t for t in self._handles.values() if not t.done()]
        if not pending:
            return
        _, still = await asyncio.wait(pending, timeout=timeout)
        if still:
            raise TimeoutError(f"队列 {len(still)} 个任务在 {timeout}s 内未终结")

    async def shutdown(self, timeout: float = 10.0) -> None:
        """尽力回收所有后台派发任务(取消等待中的派发)。"""
        tasks = [t for t in self._handles.values() if not t.done()]
        if tasks:
            _, still = await asyncio.wait(tasks, timeout=timeout)
            for t in still:
                t.cancel()
            if still:
                await asyncio.gather(*still, return_exceptions=True)

    # ---------------- 内部 ----------------

    def _get_lane(self, image: str) -> _Lane:
        lane = self._lanes.get(image)
        if lane is None:
            lane = _Lane(semaphore=asyncio.Semaphore(self._concurrency))
            self._lanes[image] = lane
        return lane

    def _reject_if_full(self, lane: _Lane, image: str) -> None:
        if lane.waiting >= self._max_pending:
            raise SandboxQueueFullError(
                f"镜像道 {image!r} 等待队列已满({lane.waiting}/{self._max_pending}),"
                "本次提交被明确拒绝;请待队列消化后重试(不静默排队、不丢弃)。"
            )

    def _dispatch(self, record: SandboxTask, lane: _Lane) -> None:
        lane.waiting += 1
        self._handles[record.task_id] = asyncio.create_task(
            self._run_one(record, lane)
        )

    async def _run_one(self, record: SandboxTask, lane: _Lane) -> None:
        await lane.semaphore.acquire()
        lane.waiting -= 1
        record.status = "running"
        record.started_at = _now_iso()
        record.attempts += 1
        try:
            executor = self._executor or _default_executor
            result = await executor(record)
            record.result = result if isinstance(result, dict) else {"value": result}
            record.status = "succeeded"
        except asyncio.CancelledError:
            record.status = "failed"
            record.error = "任务被取消(shutdown)"
            raise
        except Exception as e:  # noqa: BLE001 - 执行器异常是队列的正常失败面
            record.status = "failed"
            record.error = str(e)[:5000]
            logger.warning(
                "[sandbox_task_queue] 任务失败 task=%s image=%s err=%s",
                record.task_id, record.image, record.error,
            )
        finally:
            record.ended_at = _now_iso()
            lane.semaphore.release()


async def _default_executor(record: SandboxTask) -> dict[str, Any]:
    """默认执行器:委托 container_runtime 真执行(严档 fail-closed 如实穿透)。"""
    from .container_runtime import container_runtime

    payload = record.payload
    task = str(payload.get("task") or record.task_id)
    command: str | list[str] = payload.get("command") or "python --version"
    timeout_sec = payload.get("timeout_sec")
    run = await container_runtime.start_run(
        task,
        command,
        files=payload.get("files") or None,
        image=record.image,
        timeout_sec=timeout_sec,
        user_id=record.user_id,
    )
    run_id = run["run_id"]
    wait_limit = float(timeout_sec or 300.0) + 60.0
    final = await container_runtime.wait_run(run_id, timeout=wait_limit)
    if final is None:
        raise RuntimeError(f"运行记录消失: run={run_id}")
    if final["status"] != "done":
        raise RuntimeError(
            f"容器运行未成功 status={final['status']} error={final.get('error') or ''}"
        )
    return final


# 进程内单例(路由消费点见 app/routers/agent_runtime.py 的 /agent-runtime/queue/*)
sandbox_task_queue = SandboxTaskQueue()

__all__ = [
    "SandboxQueueFullError",
    "SandboxTask",
    "SandboxTaskQueue",
    "sandbox_task_queue",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
