"""ai-service 统一审计日志服务(2026-07-22 立,补齐 api 端审计的 ai-service 侧空白)。

功能:
- log_agent_action():记录 agent 执行的关键操作(工具调用/文件修改/命令执行)
- log_llm_call():记录 LLM 调用(model/token/latency/stub)
- log_tool_execution():记录工具调用(tool_name/args/result/status/duration)
- 透传 trace_id:从请求头 traceparent 解析,关联 api 端审计

与 apps/api 端 plugins/audit.ts 对等,实现跨服务审计链路闭环。
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


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
    """审计日志服务(内存缓冲 + 异步落库,生产环境接 DB)。

    缓冲区上限 10000 条,超出丢弃最旧的 10%(避免每次追加都 pop)。
    生产环境应替换为 DB 持久化(asyncpg 写 audit_log 表)。
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


# 模块级单例
audit_service = AuditService()
