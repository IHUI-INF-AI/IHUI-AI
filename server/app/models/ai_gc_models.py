"""AI generated content models."""

from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, Text, func

from app.database import Base
from app.models.base import TimestampMixin, id_column


class AiGc(TimestampMixin, Base):
    """AI generated content record (zhs_ai_project.ai_gc)."""

    __tablename__ = "ai_gc"
    __table_args__ = (
        Index("ix_ai_gc_status", "status"),
        {
            # 建议 113: 阶段 2 业务表 schema 改造 (第 2 批)
            "schema": "public",
        },
    )

    id = id_column(comment="ID")
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    agent_id = Column(String(64), nullable=True, comment="Agent ID")
    gc_type = Column(String(32), default="text", comment="Generation type: text/image/audio/video")
    content = Column(Text, nullable=True, comment="Generated content")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class AiGcUserLog(TimestampMixin, Base):
    """AI generated content user action log (zhs_ai_project.ai_gc_user_log)."""

    __tablename__ = "ai_gc_user_log"

    id = id_column(comment="ID")
    gc_id = Column(BigInteger, nullable=False, comment="AI GC record ID")
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    action = Column(String(32), nullable=False, comment="Action: view/copy/share/delete")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")
