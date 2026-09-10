# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""后台任务服务(通用「run_in_background」语义 + 完成通知)。

提供模块级单例 `background_task_manager`(`BackgroundTaskManager`),负责:
- 以 uuid4 hex 为 task_id 注册后台任务:`asyncio.create_task` 立即返回,不阻塞调用方
- 跟踪任务生命周期状态:pending → running → succeeded / failed / timeout
- 任务完成后(若 `notify_on_done`)经 `message_bus` 的 IM 通道给 `user_id` 推送完成通知
- 并发上限 `MAX_CONCURRENT`,超限直接拒绝(返回 `{error: "too_many_background_tasks"}`)
- 注册表为进程内存字典,不做 redis 持久化(登记遗留,后续批次补齐)

与 agent 主循环解耦:本模块是独立服务,通过 mcp_server 的 `run_in_background` /
`bg_task_status` 工具暴露,工具由 MCP 层调用,天然在循环内可用。

设计参考:`im_bridge.py`(单例 + 后台任务 + 降级 no-op)、`mcp_server.py` 的
`_SUBAGENT_SEMAPHORE` 并发治理。
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from .message_bus import ChannelType, Message, message_bus

logger = logging.getLogger(__name__)

# 模块级并发上限(env 可配,默认 10)。超限直接拒绝,不排队,保持简单。
MAX_CONCURRENT = max(1, int(os.environ.get("BACKGROUND_TASK_MAX_CONCURRENT", "10")))

# 结果/错误摘要截断长度(防大对象撑爆内存与通知内容)
_RESULT_TRUNCATE = 2000
_ERROR_TRUNCATE = 1000


class TaskState(StrEnum):
    """后台任务状态机。"""

    PENDING = "pending"      # 已注册,尚未开始执行
    RUNNING = "running"      # 执行中
    SUCCEEDED = "succeeded"  # 成功完成
    FAILED = "failed"        # 执行抛出异常
    TIMEOUT = "timeout"      # 超过 timeout_s 未完成


def _now() -> datetime:
    """当前 UTC 时间(带时区,用于 started_at/finished_at)。"""
    return datetime.now(UTC)


def _truncate(text: str, limit: int) -> str:
    """截断字符串到 limit 长度,超出追加省略号。"""
    if len(text) <= limit:
        return text
    return text[:limit] + "...(truncated)"


@dataclass
class TaskRecord:
    """单个后台任务的状态记录。"""

    task_id: str
    name: str
    user_id: str | None
    state: TaskState = TaskState.PENDING
    created_at: datetime = field(default_factory=_now)
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: float | None = None
    result: Any | None = None
    error: str | None = None
    session_id: str | None = None
    notify_on_done: bool = True
    timeout_s: float = 300.0

    def to_dict(self) -> dict[str, Any]:
        """序列化为可 JSON 化的状态字典。"""
        return {
            "task_id": self.task_id,
            "name": self.name,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "state": self.state.value,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "duration_ms": self.duration_ms,
            "result": self.result,
            "error": self.error,
            "notify_on_done": self.notify_on_done,
            "timeout_s": self.timeout_s,
        }


class BackgroundTaskManager:
    """后台任务注册表 + 生命周期 + 完成通知。

    线程/协程安全:单事件循环内,`submit` 在首个 await 前完成原子检查与建任务,
    不会在检查与 create_task 之间被其他协程插入(单线程事件循环保证)。
    """

    def __init__(self) -> None:
        # task_id -> 状态记录。已完成记录保留以支持 get_status 查询,
        # 不计入并发上限(见 _active_count)。
        self._tasks: dict[str, TaskRecord] = {}

    # ------------------------------------------------------------------
    # 并发计量(仅统计进行中任务)
    # ------------------------------------------------------------------

    @property
    def _active_count(self) -> int:
        return sum(
            1 for r in self._tasks.values() if r.state in (TaskState.PENDING, TaskState.RUNNING)
        )

    @property
    def active_count(self) -> int:
        """当前进行中(pending/running)任务数。"""
        return self._active_count

    # ------------------------------------------------------------------
    # 提交
    # ------------------------------------------------------------------

    async def submit(
        self,
        coro_factory: Callable[[], Awaitable[Any]],
        *,
        name: str,
        user_id: str | None,
        session_id: str | None = None,
        notify_on_done: bool = True,
        timeout_s: float = 300.0,
    ) -> str | dict[str, Any]:
        """提交一个后台任务,立即返回 task_id,不阻塞等待完成。

        Args:
            coro_factory: 无参可调用对象,调用后返回要执行的协程(便于延迟构造,
                          避免闭包过早绑定)。例如 `lambda: my_coro(args)`。
            name: 任务显示名(用于通知与列表展示)。
            user_id: 归属用户 ID(完成通知按此推送;None 则不推送)。
            session_id: 会话 ID(可选,仅用于记录/查询)。
            notify_on_done: 完成后是否经 message_bus 推送 IM 通知(默认 True)。
            timeout_s: 任务执行超时秒数(默认 300,最小 1)。

        Returns:
            str: 成功时的 task_id。
            dict: 拒绝时 `{"error": "too_many_background_tasks", "active": int, "max": int}`。
        """
        # 原子检查(此前无 await,保证单线程下检查与建任务不被插入)
        if self._active_count >= MAX_CONCURRENT:
            return {
                "error": "too_many_background_tasks",
                "active": self._active_count,
                "max": MAX_CONCURRENT,
            }

        task_id = uuid.uuid4().hex
        timeout_s = max(1.0, float(timeout_s))
        record = TaskRecord(
            task_id=task_id,
            name=name,
            user_id=user_id,
            session_id=session_id,
            state=TaskState.PENDING,
            notify_on_done=notify_on_done,
            timeout_s=timeout_s,
        )
        self._tasks[task_id] = record
        # 立即建任务,不 await 完成 —— 这是「后台」语义的核心
        asyncio.create_task(self._run(task_id, coro_factory))
        logger.info(
            "[BackgroundTask] 已提交 task_id=%s name=%s user_id=%s active=%d/%d",
            task_id, name, user_id, self._active_count, MAX_CONCURRENT,
        )
        return task_id

    # ------------------------------------------------------------------
    # 执行包装
    # ------------------------------------------------------------------

    async def _run(self, task_id: str, coro_factory: Callable[[], Awaitable[Any]]) -> None:
        """后台执行包装:状态机 + 超时 + 异常捕获 + 完成通知。"""
        record = self._tasks.get(task_id)
        if record is None:
            return
        record.state = TaskState.RUNNING
        record.started_at = _now()
        try:
            coro = coro_factory()
            result = await asyncio.wait_for(coro, timeout=record.timeout_s)
            record.result = self._summarize(result)
            record.state = TaskState.SUCCEEDED
        except TimeoutError:
            record.state = TaskState.TIMEOUT
            logger.warning(
                "[BackgroundTask] 超时 task_id=%s timeout_s=%s", task_id, record.timeout_s
            )
        except asyncio.CancelledError:
            # 任务被取消(进程关闭等):保留 pending/running,不写终态,允许安静退出
            raise
        except Exception as e:  # noqa: BLE001 — 必须兜底,否则后台任务异常会污染事件循环
            record.state = TaskState.FAILED
            record.error = _truncate(str(e), _ERROR_TRUNCATE)
            logger.warning("[BackgroundTask] 执行异常 task_id=%s error=%s", task_id, record.error)
        finally:
            record.finished_at = _now()
            if record.started_at is not None and record.finished_at is not None:
                record.duration_ms = (
                    record.finished_at - record.started_at
                ).total_seconds() * 1000.0
            if (
                record.state in (TaskState.SUCCEEDED, TaskState.FAILED, TaskState.TIMEOUT)
                and record.notify_on_done
            ):
                await self._notify(record)

    @staticmethod
    def _summarize(result: Any) -> Any:
        """把任务结果规整为可 JSON 化的摘要(string/dict 截断,其他转 str)。"""
        if result is None:
            return None
        if isinstance(result, (str, int, float, bool, list, dict)):
            if isinstance(result, (str, list, dict)):
                return _truncate(str(result), _RESULT_TRUNCATE)
            return result
        return _truncate(str(result), _RESULT_TRUNCATE)

    # ------------------------------------------------------------------
    # 完成通知(经 message_bus 的 IM 通道)
    # ------------------------------------------------------------------

    async def _notify(self, record: TaskRecord) -> None:
        """经 message_bus 的 IM 通道推送完成通知;失败仅降级 log,不抛异常。"""
        if not record.user_id:
            return
        try:
            content = self._format_notification(record)
            msg = Message(
                id=uuid.uuid4().hex,
                content=content,
                metadata={"to_user_id": record.user_id, "task_id": record.task_id},
            )
            publish_result = await message_bus.publish(
                msg, channels=[ChannelType.IM], priority="normal"
            )
            if not publish_result.delivered_channels:
                logger.warning(
                    "[BackgroundTask] 完成通知发送失败 task_id=%s user_id=%s error=%s",
                    record.task_id, record.user_id, publish_result.error,
                )
        except Exception as e:  # noqa: BLE001 — 通知失败绝不能反噬主任务
            logger.warning(
                "[BackgroundTask] 完成通知异常 task_id=%s user_id=%s: %s",
                record.task_id, record.user_id, e,
            )

    def _format_notification(self, record: TaskRecord) -> str:
        """渲染完成通知文本(含 task_id 前缀 / 状态 / 耗时 / 结果摘要)。"""
        dur = record.duration_ms if record.duration_ms is not None else 0.0
        if record.state == TaskState.SUCCEEDED:
            summary = _truncate(str(record.result), 300)
        elif record.state == TaskState.FAILED:
            summary = f"错误: {record.error}"
        elif record.state == TaskState.TIMEOUT:
            summary = f"超时(>{record.timeout_s:.0f}s 未完成)"
        else:
            summary = ""
        return (
            "【后台任务完成通知】\n"
            f"任务: {record.name}\n"
            f"ID: {record.task_id[:8]}…\n"
            f"状态: {record.state.value}\n"
            f"耗时: {dur:.0f}ms\n"
            f"结果: {summary}"
        )

    # ------------------------------------------------------------------
    # 查询
    # ------------------------------------------------------------------

    async def get_status(self, task_id: str) -> dict[str, Any] | None:
        """查询单个任务状态;不存在返回 None。"""
        record = self._tasks.get(task_id)
        if record is None:
            return None
        return record.to_dict()

    async def list_tasks(
        self, user_id: str | None = None, limit: int = 20
    ) -> list[dict[str, Any]]:
        """列出任务(按创建时间倒序)。user_id 为 None 时列出全部。"""
        items = [
            r for r in self._tasks.values() if user_id is None or r.user_id == user_id
        ]
        items.sort(key=lambda r: r.created_at, reverse=True)
        return [r.to_dict() for r in items[: max(0, limit)]]


# 模块级单例
background_task_manager = BackgroundTaskManager()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
