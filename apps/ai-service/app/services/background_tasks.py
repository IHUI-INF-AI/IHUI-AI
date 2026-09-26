# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""后台任务服务(通用「run_in_background」语义 + 完成通知)。

提供模块级单例 `background_task_manager`(`BackgroundTaskManager`),负责:
- 以 uuid4 hex 为 task_id 注册后台任务:`asyncio.create_task` 立即返回,不阻塞调用方
- 跟踪任务生命周期状态:pending → running → succeeded / failed / timeout / cancelled
- 任务完成后(若 `notify_on_done`)经 `message_bus` 的 IM 通道给 `user_id` 推送完成通知
- 并发上限 `MAX_CONCURRENT`,超限直接拒绝(返回 `{error: "too_many_background_tasks"}`)
- 注册表为进程内存字典,不做 redis 持久化(登记遗留,后续批次补齐)

V3 #51(2026-09-26)新增的三格(病根:「run_in_background 只有 sleep/echo」= 提交后什么都不跑):
- `submit_typed(...)` / `run_in_background(arguments)`:按 `task_type` 分派到
  `task_executors.TASK_EXECUTORS` 的 6 类真实 executor(sleep/echo 保留但**自证 stub**)。
- **幂等键**:`task_type + 规范化 arguments` 派生;同一键重复提交命中同一记录、不重复执行。
- **断点续跑**:失败/超时/取消后再提交(或 `resume(task_id)`)复用同一 `Checkpoint`,
  已完成单元不再重跑。
- 每条记录带 `executed` / `stub` / `analysis_depth` 自证字段 —— 桩不得伪装成执行成功。

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
from typing import Any, Final

from .message_bus import ChannelType, Message, message_bus
from .task_executors import (
    IMPLEMENTED_TASK_TYPES,
    HttpGetter,
    LlmCall,
    TaskExecutionError,
    compute_idempotency_key,
    execute_task,
    get_spec,
    kill_processes_for,
    supported_task_types,
)

logger = logging.getLogger(__name__)

# run_in_background 工具对模型可见的**声明面**(字面量)。
# 与 task_executors.TASK_EXECUTORS(实现面)必须由
# scripts/check-background-task-type-parity.mjs 判"双向等值" ——
# 声明了没实现、或实现了没声明,都要红(V3 #51 判据 6)。
RUN_IN_BACKGROUND_TASK_TYPES: Final[tuple[str, ...]] = IMPLEMENTED_TASK_TYPES


def _bg_model_tools_enabled_from_env() -> bool:
    """批58 接线(对标 codex model_tools.rs):完成通知附 host 侧 async 投递载荷。

    默认 off:Message.metadata 仅含既有两键(逐字节等价);设为 on/1/true/yes 时
    额外附加 build_async_user_notification 产出的 async_notification 投影。
    """
    return os.environ.get("MCP_MODEL_TOOLS_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )

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
    CANCELLED = "cancelled"  # V3 #51:被显式取消(长跑命令连带 kill 子进程)


# V3 #51:允许"从断点重跑"的终态(命中同一记录、复用同一 checkpoint)
_RESUMABLE_STATES: Final[frozenset[TaskState]] = frozenset(
    {TaskState.FAILED, TaskState.TIMEOUT, TaskState.CANCELLED}
)
_TERMINAL_STATES: Final[frozenset[TaskState]] = frozenset(
    {TaskState.SUCCEEDED, TaskState.FAILED, TaskState.TIMEOUT, TaskState.CANCELLED}
)


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
    # ---- V3 #51:真实执行自证 + 幂等 + 断点续跑 ----
    task_type: str | None = None
    idempotency_key: str | None = None
    executed: bool = False        # 真实 executor 是否被调起过(stub 档恒 False)
    stub: bool = False            # 该类型是否刻意是演示档(sleep/echo)
    analysis_depth: str = "none"  # real | stub | none
    attempt_count: int = 0        # 同一记录被跑了几次(含 resume)
    checkpoint_key: str | None = None
    progress: dict[str, Any] = field(default_factory=dict)
    arguments: dict[str, Any] = field(default_factory=dict)
    # 传输层注入缝(测试/离线部署用):只替换 socket 那一层,executor 判据不复制。
    llm_call: LlmCall | None = field(default=None, repr=False)
    http_get: HttpGetter | None = field(default=None, repr=False)

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
            "task_type": self.task_type,
            "idempotency_key": self.idempotency_key,
            "executed": self.executed,
            "stub": self.stub,
            "analysis_depth": self.analysis_depth,
            "attempt_count": self.attempt_count,
            "checkpoint_key": self.checkpoint_key,
            "progress": dict(self.progress),
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
        # V3 #51:幂等键 -> task_id(同一逻辑任务重复提交命中同一记录)
        self._idempotency: dict[str, str] = {}
        # V3 #51:task_id -> 取消信号(长跑任务协作式中断)
        self._cancel_events: dict[str, asyncio.Event] = {}
        # V3 #51:task_id -> 在跑的 asyncio.Task(供 cancel)
        self._handles: dict[str, asyncio.Task[None]] = {}

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
        handle = asyncio.create_task(self._run(task_id, coro_factory))
        self._handles[task_id] = handle
        handle.add_done_callback(lambda _t: self._handles.pop(task_id, None))
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
            # 任务被取消:cancel() 已把状态写成 CANCELLED;其余情况(进程关闭)
            # 保留原状态不写终态,允许安静退出。
            if record.state is not TaskState.CANCELLED:
                record.state = TaskState.CANCELLED
                record.error = record.error or "任务被取消"
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
                record.state in _TERMINAL_STATES
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
            metadata: dict[str, Any] = {
                "to_user_id": record.user_id,
                "task_id": record.task_id,
            }
            # 批58:MCP_MODEL_TOOLS_ENABLED on 时附加 async 投递投影(失败降级不带)
            if _bg_model_tools_enabled_from_env():
                try:
                    from app.core.model_tools_57 import build_async_user_notification

                    metadata["async_notification"] = build_async_user_notification(content)
                except Exception as e:  # noqa: BLE001 - 投影失败降级不附加
                    logger.warning("[BackgroundTask] async 通知投影失败(降级不附加): %s", e)
            msg = Message(
                id=uuid.uuid4().hex,
                content=content,
                metadata=metadata,
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
        elif record.state == TaskState.CANCELLED:
            summary = f"已取消(进度 {record.progress.get('completed_units', '?')} 单元已落 checkpoint,可 resume)"
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
    # V3 #51:按 task_type 分派的真实执行(幂等键 + 断点续跑 + 取消)
    # ------------------------------------------------------------------

    def find_by_idempotency_key(self, key: str) -> dict[str, Any] | None:
        """幂等键命中哪条任务记录(没有则 None)。"""
        task_id = self._idempotency.get(key)
        if not task_id:
            return None
        record = self._tasks.get(task_id)
        return record.to_dict() if record else None

    def _typed_factory(
        self,
        record: TaskRecord,
        cancel_event: asyncio.Event,
    ) -> Callable[[], Awaitable[Any]]:
        """把 TaskRecord 折成 `submit()` 认识的协程工厂(单一分派出口 = execute_task)。"""

        async def _runner() -> Any:
            # executed 在真正调起 executor 之前翻 True:哪怕中途抛异常,
            # "这一格确实跑过业务"也是事实,不把它写成从未执行。
            record.executed = True
            result = await execute_task(
                str(record.task_type),
                record.arguments,
                task_id=record.task_id,
                checkpoint_key=record.checkpoint_key,
                user_id=record.user_id,
                session_id=record.session_id,
                cancel_event=cancel_event,
                llm_call=record.llm_call,
                http_get=record.http_get,
            )
            if isinstance(result, dict):
                record.progress = {
                    "checkpoint_key": result.get("checkpoint_key"),
                    "completed_units": result.get("checkpoint_completed_units"),
                    "resumable": result.get("resumable"),
                }
            return result

        return _runner

    def _launch(
        self,
        record: TaskRecord,
        *,
        cancel_event: asyncio.Event,
    ) -> dict[str, Any]:
        """在**无 await** 的临界区内建任务并登记 —— 幂等去重的前提。"""
        handle = asyncio.create_task(self._run(record.task_id, self._typed_factory(record, cancel_event)))
        self._handles[record.task_id] = handle
        handle.add_done_callback(lambda _t: self._handles.pop(record.task_id, None))
        return {
            "ok": True,
            "tool": "run_in_background",
            "task_id": record.task_id,
            "name": record.name,
            "task_type": record.task_type,
            "attempt_count": record.attempt_count,
            "deduplicated": False,
            "resumed": record.attempt_count > 1,
            "stub": record.stub,
            "executed_so_far": record.executed,
            "analysis_depth": record.analysis_depth,
            "idempotency_key": record.idempotency_key,
            "message": "后台任务已提交,用 bg_task_status 凭 task_id 查询结果",
        }

    def _ack_existing(self, record: TaskRecord, reason: str) -> dict[str, Any]:
        """命中已有记录:原样返回该 task_id,**不再起第二次执行**。"""
        return {
            "ok": True,
            "tool": "run_in_background",
            "task_id": record.task_id,
            "name": record.name,
            "task_type": record.task_type,
            "attempt_count": record.attempt_count,
            "deduplicated": True,
            "resumed": False,
            "dedup_reason": reason,
            "state": record.state.value,
            "stub": record.stub,
            "executed_so_far": record.executed,
            "analysis_depth": record.analysis_depth,
            "idempotency_key": record.idempotency_key,
            "message": f"命中同一幂等键的既有任务({reason}),未重复执行",
        }

    async def submit_typed(
        self,
        task_type: str,
        arguments: dict[str, Any] | None = None,
        *,
        name: str | None = None,
        user_id: str | None,
        session_id: str | None = None,
        notify_on_done: bool = True,
        timeout_s: float = 300.0,
        idempotency_key: str | None = None,
        llm_call: LlmCall | None = None,
        http_get: HttpGetter | None = None,
    ) -> dict[str, Any]:
        """提交**真实类型**的后台任务(判据 1/3/4 的落点)。

        - 未知 task_type ⇒ `TaskExecutionError`(由 `run_in_background` 折成 `ok:False`),
          绝不静默退化成 sleep/echo,也绝不返回 `executed: True`。
        - `idempotency_key` 缺省由 `task_type + 规范化 arguments` 派生;
          同一键的重复提交命中同一记录:进行中/已成功 ⇒ 直接回原 task_id 不重跑;
          已失败/超时/取消 ⇒ 复用同一记录与同一 checkpoint 从断点续跑。
        """
        spec = get_spec(str(task_type))  # 未知类型在此抛 TaskExecutionError
        args = arguments if isinstance(arguments, dict) else {}
        key = str(idempotency_key or compute_idempotency_key(spec.task_type, args))

        # ---- 以下到 create_task 之间不得出现 await(去重必须原子) ----
        existing_id = self._idempotency.get(key)
        if existing_id:
            existing = self._tasks.get(existing_id)
            if existing is not None:
                if existing.state in _RESUMABLE_STATES:
                    existing.attempt_count += 1
                    existing.state = TaskState.PENDING
                    existing.error = None
                    existing.finished_at = None
                    existing.started_at = None
                    existing.duration_ms = None
                    ev = self._cancel_events.setdefault(existing.task_id, asyncio.Event())
                    ev.clear()
                    ack = self._launch(existing, cancel_event=ev)
                    ack["deduplicated"] = True
                    ack["resumed"] = True
                    ack["dedup_reason"] = "从断点续跑(复用同一 checkpoint)"
                    logger.info(
                        "[BackgroundTask] resume task_id=%s key=%s attempt=%d",
                        existing.task_id, key, existing.attempt_count,
                    )
                    return ack
                return self._ack_existing(existing, f"状态 {existing.state.value}")

        if self._active_count >= MAX_CONCURRENT:
            return {
                "ok": False,
                "error": "too_many_background_tasks",
                "active": self._active_count,
                "max": MAX_CONCURRENT,
                "executed": False,
                "stub": False,
                "analysis_depth": "none",
            }

        task_id = uuid.uuid4().hex
        cancel_event = asyncio.Event()
        self._cancel_events[task_id] = cancel_event
        record = TaskRecord(
            task_id=task_id,
            name=str(name or spec.task_type),
            user_id=user_id,
            session_id=session_id,
            state=TaskState.PENDING,
            notify_on_done=notify_on_done,
            timeout_s=max(1.0, float(timeout_s)),
            task_type=spec.task_type,
            idempotency_key=key,
            stub=spec.stub,
            executed=False,
            analysis_depth="stub" if spec.stub else "real",
            attempt_count=1,
            checkpoint_key=key,
            arguments=dict(args),
            llm_call=llm_call,
            http_get=http_get,
        )
        self._tasks[task_id] = record
        self._idempotency[key] = task_id
        logger.info(
            "[BackgroundTask] 已提交(typed) task_id=%s type=%s stub=%s key=%s active=%d/%d",
            task_id, spec.task_type, spec.stub, key, self._active_count, MAX_CONCURRENT,
        )
        return self._launch(record, cancel_event=cancel_event)

    async def resume(self, task_id: str) -> dict[str, Any]:
        """显式从断点续跑(等价于用同一幂等键重复提交一条已失败的任务)。"""
        record = self._tasks.get(task_id)
        if record is None:
            return {"ok": False, "error": f"任务不存在: {task_id}", "executed": False, "analysis_depth": "none"}
        if not record.task_type:
            return {
                "ok": False,
                "error": "该任务不是 typed 任务(无 checkpoint),不能续跑",
                "executed": False,
                "analysis_depth": "none",
            }
        if record.state not in _RESUMABLE_STATES:
            return {
                "ok": False,
                "error": f"当前状态 {record.state.value} 不可续跑(仅 failed/timeout/cancelled 可)",
                "executed": record.executed,
                "analysis_depth": record.analysis_depth,
            }
        record.attempt_count += 1
        record.state = TaskState.PENDING
        record.error = None
        record.started_at = None
        record.finished_at = None
        record.duration_ms = None
        ev = self._cancel_events.setdefault(record.task_id, asyncio.Event())
        ev.clear()
        ack = self._launch(record, cancel_event=ev)
        ack["resumed"] = True
        return ack

    async def cancel(self, task_id: str) -> dict[str, Any]:
        """取消:置协作信号 → kill 子进程 → cancel asyncio 任务。已落 checkpoint 不丢。"""
        record = self._tasks.get(task_id)
        if record is None:
            return {"ok": False, "error": f"任务不存在: {task_id}"}
        ev = self._cancel_events.get(task_id)
        if ev is not None:
            ev.set()
        killed = kill_processes_for(task_id)
        record.state = TaskState.CANCELLED
        record.error = record.error or "任务被取消"
        handle = self._handles.get(task_id)
        if handle is not None and not handle.done():
            handle.cancel()
        logger.info("[BackgroundTask] 取消 task_id=%s killed_procs=%d", task_id, killed)
        return {
            "ok": True,
            "task_id": task_id,
            "state": record.state.value,
            "killed_processes": killed,
            "checkpoint_key": record.checkpoint_key,
            "message": "已取消;已完成的单元保留在 checkpoint,resume 时不再重跑",
        }

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


async def run_in_background(arguments: dict[str, Any]) -> dict[str, Any]:
    """`run_in_background` 工具的**唯一实现体**(V3 #51 判据 1)。

    与旧 mcp_server 内联实现的区别:
    - 不再自带 `_BG_TASK_IMPLS` 白名单(那份只有 sleep/echo),而是分派到
      `task_executors.TASK_EXECUTORS` 的 6 类真实 executor + 2 类自证 stub;
    - 未知类型返回 `ok:False` + `analysis_depth:"none"` + `executed:False` +
      `supported_task_types`,不把桩伪装成执行成功;
    - 支持 `idempotency_key`(缺省按 task_type+arguments 派生)与 `resume` 语义。

    调用者身份(`__user_id` / `__session_id`)由 MCP 层注入,LLM 不可控。
    """
    task = str(arguments.get("task", "")).strip()
    raw_args = arguments.get("arguments")
    task_args: dict[str, Any] = raw_args if isinstance(raw_args, dict) else {}
    notify = bool(arguments.get("notify_on_done", True))
    raw_timeout = arguments.get("timeout_s")
    timeout_s = max(1, int(raw_timeout)) if raw_timeout is not None else 300
    name = str(arguments.get("name") or task or "background_task")
    raw_key = arguments.get("idempotency_key")
    idempotency_key = str(raw_key).strip() if isinstance(raw_key, str) and raw_key.strip() else None

    try:
        spec = get_spec(task)
    except TaskExecutionError as e:
        return {
            "ok": False,
            "tool": "run_in_background",
            "error": str(e),
            "task_type": task,
            "executed": False,
            "stub": False,
            "analysis_depth": "none",
            "supported_task_types": supported_task_types(),
        }

    submit_result = await background_task_manager.submit_typed(
        spec.task_type,
        task_args,
        name=name,
        user_id=arguments.get("__user_id"),
        session_id=arguments.get("__session_id"),
        notify_on_done=notify,
        timeout_s=timeout_s,
        idempotency_key=idempotency_key,
    )
    if isinstance(submit_result, dict) and not submit_result.get("ok"):
        submit_result.setdefault("tool", "run_in_background")
        submit_result.setdefault("task_type", spec.task_type)
        submit_result.setdefault("executed", False)
        submit_result.setdefault("analysis_depth", "stub" if spec.stub else "real")
    return submit_result

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
