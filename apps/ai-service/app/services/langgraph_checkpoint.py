"""LangGraph PostgresSaver wrapper(P3 Q1.1)。

替代手写 AgentCheckpointManager,提供节点级 checkpoint + thread_id 隔离 + get_state_history。

设计要点:
- 双层存储:AsyncPostgresSaver(LangGraph 原生表,供 graph.astraem/ainvoke 用)+ 自定义表
  langgraph_checkpoints / langgraph_writes(packages/database/src/schema/p3-deep-layer.ts,
  供 API 查询 / Time Travel / 可观测性用,字段对齐 packages/types/src/langgraph.ts)。
- 依赖未安装时降级:psycopg / langgraph-checkpoint-postgres 缺失 → manager 仍可实例化,
  仅相关方法抛 RuntimeError,保证 typecheck 与导入安全。
- 全 async,配合 FastAPI。

依赖:langgraph>=0.5.0, langgraph-checkpoint-postgres>=2.0.0, psycopg[binary]>=3.2.0
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Optional

logger = logging.getLogger(__name__)

# 软依赖:缺失时降级,保证模块可导入 + typecheck 通过
try:
    import psycopg  # type: ignore[import-not-found]
    from psycopg.rows import dict_row  # type: ignore[import-not-found]
    from psycopg_pool import AsyncConnectionPool  # type: ignore[import-not-found]

    _PSYCOPG_AVAILABLE = True
except ImportError:  # pragma: no cover - 依赖未安装时走降级路径
    psycopg = None  # type: ignore[assignment]
    dict_row = None  # type: ignore[assignment]
    AsyncConnectionPool = None  # type: ignore[assignment]
    _PSYCOPG_AVAILABLE = False

try:
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver  # type: ignore[import-not-found]
    from langgraph.types import Command, interrupt  # type: ignore[import-not-found]

    _LANGGRAPH_AVAILABLE = True
except ImportError:  # pragma: no cover - 依赖未安装时走降级路径
    AsyncPostgresSaver = None  # type: ignore[assignment]
    Command = None  # type: ignore[assignment]
    interrupt = None  # type: ignore[assignment]
    _LANGGRAPH_AVAILABLE = False

if TYPE_CHECKING:  # 仅类型检查时引入,运行时不强依赖
    from langgraph.checkpoint.base import BaseCheckpointSaver  # type: ignore[import-not-found]


def _utcnow_iso() -> str:
    """当前 UTC 时间 ISO8601 字符串。"""
    return datetime.now(timezone.utc).isoformat()


def _json_dumps(value: Any) -> str:
    """安全 JSON 序列化(ensure_ascii=False,支持任意可序列化对象)。"""
    return json.dumps(value, ensure_ascii=False, default=str)


class LangGraphCheckpointManager:
    """PostgresSaver wrapper,对接 packages/database 的 langgraph_checkpoints 表。

    表结构(已在 packages/database/src/schema/p3-deep-layer.ts 定义):
    - langgraph_checkpoints(thread_id, checkpoint_id, parent_id, node_id, state, created_at)
    - langgraph_writes(thread_id, checkpoint_id, task_id, channel, value, created_at)
    """

    def __init__(self, db_url: str):
        self.db_url = db_url
        self._pool: Optional[Any] = None  # AsyncConnectionPool
        self._saver: Optional[Any] = None  # AsyncPostgresSaver

    # ------------------------------------------------------------------
    # 连接池 + AsyncPostgresSaver 生命周期
    # ------------------------------------------------------------------

    async def _get_pool(self) -> Any:
        """获取 / 懒初始化 psycopg AsyncConnectionPool。"""
        if not _PSYCOPG_AVAILABLE:
            raise RuntimeError(
                "psycopg / psycopg_pool 未安装,请安装 psycopg[binary]>=3.2.0"
            )
        if self._pool is None:
            self._pool = AsyncConnectionPool(
                conninfo=self.db_url,
                max_size=20,
                kwargs={"autocommit": True, "prepare_threshold": 0},
                open=False,
            )
            await self._pool.open()
        return self._pool

    async def get_saver(self) -> Any:
        """获取 LangGraph 原生 AsyncPostgresSaver(供 graph.compile(checkpointer=...) 用)。

        首次调用时创建连接池 + AsyncPostgresSaver,并执行 setup() 初始化 LangGraph 内部表。
        返回的 saver 在应用生命周期内复用(单例语义)。
        """
        if not _LANGGRAPH_AVAILABLE:
            raise RuntimeError(
                "langgraph-checkpoint-postgres 未安装,请安装 langgraph-checkpoint-postgres>=2.0.0"
            )
        if self._saver is None:
            pool = await self._get_pool()
            self._saver = AsyncPostgresSaver(pool)
            await self._saver.setup()
        return self._saver

    async def close(self) -> None:
        """关闭连接池(应用停机时调用)。"""
        if self._saver is not None:
            try:
                # AsyncPostgresSaver 无显式 close,依赖连接池关闭
                pass
            except Exception as e:  # pragma: no cover
                logger.warning("LangGraphCheckpointManager saver 关闭异常: %s", e)
            self._saver = None
        if self._pool is not None:
            try:
                await self._pool.close()
            except Exception as e:  # pragma: no cover
                logger.warning("LangGraphCheckpointManager 连接池关闭异常: %s", e)
            self._pool = None

    # ------------------------------------------------------------------
    # 自定义表 langgraph_checkpoints CRUD(对接 TS 类型)
    # ------------------------------------------------------------------

    async def save_checkpoint(
        self,
        thread_id: str,
        checkpoint_id: str,
        node_id: str,
        state: dict[str, Any],
        parent_id: Optional[str] = None,
    ) -> None:
        """保存节点 checkpoint(UPSERT,按 thread_id + checkpoint_id 唯一)。"""
        pool = await self._get_pool()
        sql = (
            "INSERT INTO langgraph_checkpoints "
            "(thread_id, checkpoint_id, parent_id, node_id, state, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (thread_id, checkpoint_id) DO UPDATE SET "
            "parent_id = EXCLUDED.parent_id, node_id = EXCLUDED.node_id, "
            "state = EXCLUDED.state, created_at = EXCLUDED.created_at"
        )
        async with pool.connection() as conn:
            await conn.execute(
                sql,
                thread_id,
                checkpoint_id,
                parent_id,
                node_id,
                _json_dumps(state),
                _utcnow_iso(),
            )
        logger.debug(
            "save_checkpoint thread=%s node=%s checkpoint=%s",
            thread_id,
            node_id,
            checkpoint_id,
        )

    async def get_checkpoint(
        self, thread_id: str, checkpoint_id: str
    ) -> Optional[dict[str, Any]]:
        """获取指定 checkpoint,返回字段对齐 LangGraphCheckpoint TS 类型。"""
        pool = await self._get_pool()
        sql = (
            "SELECT thread_id, checkpoint_id, parent_id, node_id, state, created_at "
            "FROM langgraph_checkpoints "
            "WHERE thread_id = %s AND checkpoint_id = %s"
        )
        async with pool.connection() as conn:
            cur = await conn.execute(sql, thread_id, checkpoint_id)
            row = await cur.fetchone()
        if row is None:
            return None
        return _row_to_checkpoint(row)

    async def get_state_history(
        self, thread_id: str, limit: int = 100
    ) -> list[dict[str, Any]]:
        """获取线程历史(Time Travel 用),按 created_at 升序。"""
        pool = await self._get_pool()
        sql = (
            "SELECT thread_id, checkpoint_id, parent_id, node_id, state, created_at "
            "FROM langgraph_checkpoints "
            "WHERE thread_id = %s "
            "ORDER BY created_at ASC "
            "LIMIT %s"
        )
        async with pool.connection() as conn:
            cur = await conn.execute(sql, thread_id, limit)
            rows = await cur.fetchall()
        return [_row_to_checkpoint(r) for r in rows]

    async def get_latest_checkpoint(self, thread_id: str) -> Optional[dict[str, Any]]:
        """获取线程最新 checkpoint(恢复执行用)。"""
        pool = await self._get_pool()
        sql = (
            "SELECT thread_id, checkpoint_id, parent_id, node_id, state, created_at "
            "FROM langgraph_checkpoints "
            "WHERE thread_id = %s "
            "ORDER BY created_at DESC "
            "LIMIT 1"
        )
        async with pool.connection() as conn:
            cur = await conn.execute(sql, thread_id)
            row = await cur.fetchone()
        return _row_to_checkpoint(row) if row else None

    # ------------------------------------------------------------------
    # 自定义表 langgraph_writes CRUD(channel 写入记录)
    # ------------------------------------------------------------------

    async def save_write(
        self,
        thread_id: str,
        checkpoint_id: str,
        task_id: str,
        channel: str,
        value: Any,
    ) -> None:
        """保存 channel 写入记录(节点输出 channel 快照)。"""
        pool = await self._get_pool()
        sql = (
            "INSERT INTO langgraph_writes "
            "(thread_id, checkpoint_id, task_id, channel, value, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s)"
        )
        async with pool.connection() as conn:
            await conn.execute(
                sql,
                thread_id,
                checkpoint_id,
                task_id,
                channel,
                _json_dumps(value),
                _utcnow_iso(),
            )

    # ------------------------------------------------------------------
    # LangGraph 原生状态查询(委托 AsyncPostgresSaver / graph)
    # ------------------------------------------------------------------

    async def get_graph_state(self, graph: Any, thread_id: str) -> Optional[dict[str, Any]]:
        """通过 LangGraph graph.get_state 读取线程当前状态快照。

        Args:
            graph: 已编译的 LangGraph(compile(checkpointer=...) 返回值)
            thread_id: 线程 id

        Returns:
            {"values": ..., "next": [...], "config": ..., "interrupts": [...]} 或 None
        """
        if not _LANGGRAPH_AVAILABLE:
            raise RuntimeError("langgraph 未安装,无法读取 graph state")
        config = {"configurable": {"thread_id": thread_id}}
        snapshot = await graph.aget_state(config)
        if snapshot is None:
            return None
        return {
            "values": _safe_serialize(snapshot.values),
            "next": list(snapshot.next) if snapshot.next else [],
            "config": snapshot.config,
            "interrupts": _serialize_interrupts(getattr(snapshot, "tasks", ())),
        }


# ----------------------------------------------------------------------
# 辅助函数
# ----------------------------------------------------------------------


def _row_to_checkpoint(row: Any) -> dict[str, Any]:
    """psycopg 行 -> LangGraphCheckpoint dict(对齐 TS 类型字段名 camelCase)。"""
    # psycopg 默认返回 tuple,启用 dict_row 后返回 dict;两者兼容
    if isinstance(row, dict):
        thread_id = row["thread_id"]
        checkpoint_id = row["checkpoint_id"]
        parent_id = row["parent_id"]
        node_id = row["node_id"]
        state_raw = row["state"]
        created_at = row["created_at"]
    else:
        thread_id, checkpoint_id, parent_id, node_id, state_raw, created_at = row
    return {
        "threadId": thread_id,
        "checkpointId": checkpoint_id,
        "parentId": parent_id,
        "nodeId": node_id,
        "state": _safe_json_loads(state_raw, default={}),
        "createdAt": _isoformat(created_at),
    }


def _safe_json_loads(value: Any, default: Any = None) -> Any:
    """安全 JSON 反序列化:字符串 -> 对象,非字符串原样返回。"""
    if value is None:
        return default
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return default
    return value


def _isoformat(value: Any) -> str:
    """把 datetime / str 统一成 ISO 字符串。"""
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _safe_serialize(value: Any) -> Any:
    """把任意值转成 JSON 可序列化形式(失败则 str 兜底)。"""
    try:
        json.dumps(value, ensure_ascii=False, default=str)
        return value
    except (TypeError, ValueError):
        return str(value)


def _serialize_interrupts(tasks: Any) -> list[dict[str, Any]]:
    """从 graph StateSnapshot.tasks 提取 interrupt 信息。"""
    interrupts: list[dict[str, Any]] = []
    for task in tasks or ():
        task_interrupts = getattr(task, "interrupts", ()) or ()
        for intr in task_interrupts:
            interrupts.append(
                {
                    "interrupt_id": getattr(intr, "interrupt_id", None),
                    "value": _safe_serialize(getattr(intr, "value", None)),
                    "resumable": getattr(intr, "resumable", True),
                    "ns": getattr(intr, "ns", None),
                }
            )
    return interrupts


# ----------------------------------------------------------------------
# HITL:interrupt / resume
# ----------------------------------------------------------------------


async def trigger_interrupt(
    thread_id: str,
    node_id: str,
    reason: str,
    payload: Any = None,
) -> dict[str, Any]:
    """触发节点暂停(HITL)。

    在节点函数内部调用 langgraph.types.interrupt(payload) 即可暂停当前图执行,
    等待外部通过 Command(resume=...) 恢复。本函数封装返回 interrupt event,
    供 API 层记录 / 推送给前端。

    Returns:
        InterruptEvent dict(对齐 packages/types/src/langgraph.ts):
        {threadId, nodeId, interruptId, reason, payload, createdAt}
    """
    if not _LANGGRAPH_AVAILABLE:
        raise RuntimeError("langgraph 未安装,无法触发 interrupt")
    interrupt_id = uuid.uuid4().hex
    event = {
        "threadId": thread_id,
        "nodeId": node_id,
        "interruptId": interrupt_id,
        "reason": reason,
        "payload": _safe_serialize(payload),
        "createdAt": _utcnow_iso(),
    }
    # 实际的 interrupt() 调用必须在 graph 节点函数内执行(由调用方负责),
    # 此处只构造 event 用于记录 / 推送。调用方节点内应:
    #     value = interrupt({"reason": reason, "payload": payload})
    #     # 后续 value 为 Command(resume=...) 传入的 resume_value
    logger.info(
        "trigger_interrupt thread=%s node=%s interrupt_id=%s reason=%s",
        thread_id,
        node_id,
        interrupt_id,
        reason,
    )
    return event


async def resume_from_interrupt(
    thread_id: str,
    interrupt_id: str,
    resume_value: Any,
    action: str = "resume",
) -> dict[str, Any]:
    """恢复暂停的节点。

    通过 Command(resume=...) 传入恢复值,LangGraph 会把 resume_value 注入到
    节点函数中 interrupt() 调用的返回值,继续执行。

    Args:
        thread_id: 线程 id
        interrupt_id: 暂停事件 id(由 trigger_interrupt 返回)
        resume_value: 恢复值(任意可 JSON 化对象)
        action: resume / rollback / cancel(对齐 ResumeCommand.action)

    Returns:
        ResumeCommand dict(对齐 TS 类型)
    """
    if not _LANGGRAPH_AVAILABLE:
        raise RuntimeError("langgraph 未安装,无法恢复 interrupt")
    if action not in ("resume", "rollback", "cancel"):
        raise ValueError(f"非法 action: {action},允许 resume/rollback/cancel")

    command = {
        "threadId": thread_id,
        "interruptId": interrupt_id,
        "resumeValue": _safe_serialize(resume_value),
        "action": action,
    }
    logger.info(
        "resume_from_interrupt thread=%s interrupt_id=%s action=%s",
        thread_id,
        interrupt_id,
        action,
    )
    # 实际恢复由调用方执行:
    #     graph.astream(Command(resume=resume_value), config)
    # 当 action == "rollback": 改用 graph.update_state + 重新 astream(None, config)
    # 当 action == "cancel": 调用方标记 thread 状态为 cancelled,不再 astream
    return command


# ----------------------------------------------------------------------
# 全局单例(读取 settings.database_url)
# ----------------------------------------------------------------------

_manager: Optional[LangGraphCheckpointManager] = None


def get_langgraph_checkpoint_manager() -> LangGraphCheckpointManager:
    """获取全局 LangGraphCheckpointManager 单例。

    读取 app.core.config.settings.database_url 作为 Postgres 连接串。
    """
    global _manager
    if _manager is None:
        from ..core.config import settings

        _manager = LangGraphCheckpointManager(db_url=settings.database_url)
    return _manager


__all__ = [
    "LangGraphCheckpointManager",
    "get_langgraph_checkpoint_manager",
    "trigger_interrupt",
    "resume_from_interrupt",
]
