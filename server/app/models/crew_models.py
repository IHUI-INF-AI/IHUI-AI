"""多智能体协作数据模型.

定义三张表:
  - zhs_crew_session  多智能体会话
  - zhs_crew_task     任务分解记录
  - zhs_crew_message  智能体间消息日志
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, Float, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import TypeDecorator

from app.database import Base
from app.models.base import TimestampMixin, id_column


class GUID(TypeDecorator):
    """平台无关的 GUID 类型.

    PostgreSQL 使用原生 UUID, SQLite 使用 String(36).
    """

    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(UUID(as_uuid=True))
        return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            if isinstance(value, str):
                return value
            return str(value)
        if isinstance(value, str):
            return value
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            return value
        return str(value)


def _uuid_str() -> str:
    return str(uuid4())


class CrewSession(TimestampMixin, Base):
    """多智能体会话."""

    __tablename__ = "zhs_crew_session"
    __table_args__ = (
        Index("ix_crew_session_user_id", "user_id"),
        Index("ix_crew_session_status", "status"),
    )

    id = Column(GUID(), primary_key=True, default=_uuid_str, comment="会话ID")
    user_id = Column(String(64), nullable=False, comment="用户ID")
    title = Column(String(255), nullable=True, comment="会话标题")
    status = Column(
        String(20),
        nullable=False,
        default="pending",
        comment="pending/running/completed/failed/cancelled",
    )
    input_message = Column(Text, nullable=True, comment="用户输入")
    output_message = Column(Text, nullable=True, comment="最终输出")
    shared_memory = Column(Text, nullable=True, comment="共享记忆JSON")
    config = Column(Text, nullable=True, comment="会话配置JSON")
    total_tokens = Column(Integer, default=0, comment="总token消耗")
    total_cost = Column(Float, default=0.0, comment="总费用")
    completed_at = Column(DateTime, nullable=True, comment="完成时间")


class CrewTask(TimestampMixin, Base):
    """多智能体任务."""

    __tablename__ = "zhs_crew_task"
    __table_args__ = (
        Index("ix_crew_task_session_id", "session_id"),
        Index("ix_crew_task_status", "status"),
    )

    id = Column(GUID(), primary_key=True, default=_uuid_str, comment="任务ID")
    session_id = Column(
        GUID(),
        nullable=False,
        comment="所属会话ID",
    )
    task_index = Column(Integer, nullable=False, comment="任务序号")
    agent_role = Column(String(50), nullable=False, comment="执行角色")
    description = Column(Text, nullable=False, comment="任务描述")
    status = Column(
        String(20),
        nullable=False,
        default="pending",
        comment="pending/running/completed/failed/skipped",
    )
    input_data = Column(Text, nullable=True, comment="输入数据JSON")
    output_data = Column(Text, nullable=True, comment="输出数据JSON")
    dependencies = Column(Text, nullable=True, comment="依赖任务ID列表JSON")
    retry_count = Column(Integer, default=0, comment="重试次数")
    max_retries = Column(Integer, default=3, comment="最大重试次数")
    tokens_used = Column(Integer, default=0, comment="token消耗")
    error_message = Column(Text, nullable=True, comment="错误信息")
    started_at = Column(DateTime, nullable=True, comment="开始时间")
    completed_at = Column(DateTime, nullable=True, comment="完成时间")


class CrewMessage(TimestampMixin, Base):
    """多智能体消息日志."""

    __tablename__ = "zhs_crew_message"
    __table_args__ = (
        Index("ix_crew_message_session_id", "session_id"),
    )

    id = id_column(comment="消息ID")
    session_id = Column(String(36), nullable=False, comment="所属会话ID")
    task_id = Column(String(36), nullable=True, comment="关联任务ID")
    from_role = Column(String(50), nullable=False, comment="发送方角色")
    to_role = Column(String(50), nullable=True, comment="接收方角色")
    content = Column(Text, nullable=False, comment="消息内容")
    message_type = Column(
        String(20),
        nullable=True,
        default="text",
        comment="text/system/error/result",
    )
