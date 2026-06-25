"""TBox 智能体发布相关数据模型.

迁移自 ZHS_Server_java/mcp/domain/TBoxBean.java、
TBoxAgentContentBean.java、TBoxAgentCustomBean.java.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.utils.datetime_helper import utcnow


class TBoxAgentContentBean(BaseModel):
    """TBox 智能体发布事件内容."""

    robot_id: str | None = None
    bot_id: str | None = None
    agent_id: str | None = None
    content: str | None = None
    event_type: str | None = None
    status: str | None = None
    extra: dict[str, Any] | None = None


class TBoxAgentCustomBean(BaseModel):
    """TBox 智能体自定义参数."""

    name: str
    value: Any = None
    type: str | None = None
    required: bool = False
    description: str | None = None
    options: list[Any] | None = None


class TBoxBean(BaseModel):
    """百宝箱事件通知顶层."""

    event: str | None = None
    timestamp: int | None = None
    event_id: str | None = None
    robot_id: str | None = None
    bot_id: str | None = None
    content: TBoxAgentContentBean | None = None
    custom: list[TBoxAgentCustomBean] | None = None
    payload: dict[str, Any] | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(arbitrary_types_allowed=True)


class TBoxEventLog:
    """TBox 事件日志(内存存储,可对接数据库)."""

    def __init__(self):
        self._events: list[dict[str, Any]] = []

    def add(self, event: TBoxBean) -> None:
        self._events.append({
            "event": event.event,
            "event_id": event.event_id,
            "robot_id": event.robot_id,
            "bot_id": event.bot_id,
            "content": event.content.dict() if event.content else None,
            "custom": [c.dict() for c in event.custom] if event.custom else None,
            "received_at": utcnow().isoformat(),
        })

    def recent(self, limit: int = 50) -> list[dict[str, Any]]:
        return self._events[-limit:]

    def clear(self) -> None:
        self._events.clear()


_tbox_log: TBoxEventLog | None = None


def get_tbox_event_log() -> TBoxEventLog:
    global _tbox_log
    if _tbox_log is None:
        _tbox_log = TBoxEventLog()
    return _tbox_log
