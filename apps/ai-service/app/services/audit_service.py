"""ai-service 统一审计日志服务(2026-07-22 立,补齐 api 端审计的 ai-service 侧空白)。

功能:
- log_agent_action():记录 agent 执行的关键操作(工具调用/文件修改/命令执行)
- log_llm_call():记录 LLM 调用(model/token/latency/stub)
- log_tool_execution():记录工具调用(tool_name/args/result/status/duration)
- 透传 trace_id:从请求头 traceparent 解析,关联 api 端审计
- L5-5(2026-08-12):异步落库 audit_logs 表,错误数据不再重启即丢;DB 不可达/无 event loop 时静默降级,内存保留

与 apps/api 端 plugins/audit.ts 对等,实现跨服务审计链路闭环。
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

# L5-5:持有 fire-and-forget 落库 task 引用,防止 GC 在 task 完成前回收(与 agent_loop_v2 同模式)
_pending_persist_tasks: set[asyncio.Task[Any]] = set()


class AuditEntry:
    """单条审计记录。"""

    def __init__(
        self,
        action: str,
        details: dict[str, Any],
        trace_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        user_id: Optional[str] = None,
        timestamp: Optional[str] = None,
    ):
        self.action = action
        self.details = details
        self.trace_id = trace_id
        self.agent_id = agent_id
        self.user_id = user_id
        self.timestamp = timestamp or datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict[str, Any]:
        """转为字典(用于序列化/展示)。"""
        return {
            "action": self.action,
            "details": self.details,
            "trace_id": self.trace_id,
            "agent_id": self.agent_id,
            "user_id": self.user_id,
            "timestamp": self.timestamp,
        }


class AuditService:
    """审计日志服务(内存缓冲 + 异步落库 DB)。

    缓冲区上限 10000 条,超出丢弃最旧的 10%(避免每次追加都 pop)。
    L5-5(2026-08-12):内存缓冲基础上异步落库 audit_logs 表,
    DB 不可达/无 event loop 时静默降级为纯内存模式(不阻塞主流程)。
    """

    _buffer: list[AuditEntry] = []
    _max_buffer: int = 10000

    def log_agent_action(
        self,
        agent_id: str,
        action: str,
        details: dict[str, Any],
        trace_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> None:
        """记录 agent 执行操作(工具调用/文件修改/命令执行等)。"""
        entry = AuditEntry(
            action=action,
            details=details,
            trace_id=trace_id,
            agent_id=agent_id,
            user_id=user_id,
        )
        self._append(entry)

    def log_llm_call(
        self,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        latency_ms: float,
        stub: bool,
        trace_id: Optional[str] = None,
    ) -> None:
        """记录 LLM 调用(model/token/latency/stub)。"""
        entry = AuditEntry(
            action="llm_call",
            details={
                "model": model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "latency_ms": round(latency_ms, 2),
                "stub": stub,
            },
            trace_id=trace_id,
            agent_id="llm_gateway",
        )
        self._append(entry)

    def log_tool_execution(
        self,
        tool_name: str,
        args: dict[str, Any],
        result: Any,
        status: str,
        duration_ms: float,
        trace_id: Optional[str] = None,
    ) -> None:
        """记录工具调用(tool_name/args/result/status/duration)。"""
        entry = AuditEntry(
            action="tool_execution",
            details={
                "tool_name": tool_name,
                "args": args,
                "result": str(result)[:500],  # 截断防止超大结果撑爆缓冲区
                "status": status,
                "duration_ms": round(duration_ms, 2),
            },
            trace_id=trace_id,
            agent_id="tool_executor",
        )
        self._append(entry)

    def get_recent(
        self,
        limit: int = 100,
        agent_id: Optional[str] = None,
        action: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """查询最近审计记录(用于调试/展示)。

        Args:
            limit: 返回条数上限(默认 100)
            agent_id: 按 agent_id 过滤(可选)
            action: 按 action 过滤(可选)
        """
        records = self._buffer
        if agent_id:
            records = [r for r in records if r.agent_id == agent_id]
        if action:
            records = [r for r in records if r.action == action]
        # 返回最近的 limit 条(倒序取前 limit,再正序返回便于阅读)
        recent = list(reversed(records))[:limit]
        return [r.to_dict() for r in recent]

    def extract_trace_id(self, traceparent_header: Optional[str]) -> Optional[str]:
        """从 W3C traceparent 头解析 trace_id(32 hex)。

        格式:version-trace_id-parent_id-flags
        示例:00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
        """
        if not traceparent_header:
            return None
        parts = traceparent_header.split("-")
        if len(parts) >= 2:
            return parts[1]  # version-trace_id-parent_id-flags
        return None

    def _append(self, entry: AuditEntry) -> None:
        """追加审计记录,超限时丢弃最旧的 10%。"""
        self._buffer.append(entry)
        if len(self._buffer) > self._max_buffer:
            drop_count = self._max_buffer // 10
            del self._buffer[:drop_count]
        # 同时输出到日志(便于日志聚合系统采集)
        logger.info(
            "audit action=%s agent=%s trace=%s",
            entry.action, entry.agent_id, entry.trace_id,
        )
        # L5-5(2026-08-12):异步落库 audit_logs 表,失败静默降级内存保留
        coro = self._persist_entry(entry)
        try:
            task = asyncio.create_task(coro)
            _pending_persist_tasks.add(task)
            task.add_done_callback(_pending_persist_tasks.discard)
        except RuntimeError:
            # 无运行中的 event loop(同步上下文/单元测试),仅内存;关闭 coroutine 防 RuntimeWarning
            coro.close()

    async def _persist_entry(self, entry: AuditEntry) -> None:
        """异步写入 audit_logs 表(失败降级,不阻塞主流程)。

        字段映射: action→action(截断 32), resource_type→agent_id(来源),
        resource_id→trace_id(关联追踪), details→jsonb, created_at→timestamp。
        """
        try:
            from app.core.db import get_db_pool

            pool = await get_db_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO audit_logs
                        (action, resource_type, resource_id, details, created_at)
                    VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz)
                    """,
                    entry.action[:32],
                    entry.agent_id[:64] if entry.agent_id else None,
                    entry.trace_id[:64] if entry.trace_id else None,
                    json.dumps(entry.details, ensure_ascii=False),
                    entry.timestamp,
                )
        except Exception as e:
            logger.warning("audit persist to db failed(降级,内存保留): %s", e)


# 模块级单例
audit_service = AuditService()
