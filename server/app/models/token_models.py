"""Token and user SK models."""

from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, Text, func

from app.database import Base
from app.models.base import TimestampMixin
from app.orm.tenant_base import TenantBase


class UserSKInfo(TimestampMixin, Base):
    """User API key info (zhs_center_project.user_sk_info)."""

    __tablename__ = "user_sk_info"
    __table_args__ = (Index("ix_user_sk_info_status", "status"),)

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_uuid = Column(String(255), nullable=True, index=True)
    key = Column(String(255), nullable=True)
    status = Column(Integer, nullable=True)
    type = Column(Integer, nullable=True)
    max = Column(BigInteger, nullable=True)
    out_time = Column(DateTime, nullable=True)
    created_time = Column(DateTime, server_default=func.now())
    updated_time = Column(DateTime, server_default=func.now(), onupdate=func.now())


class VideoGenerationTask(TenantBase):
    """Video generation task queue (建议 127: 第一个迁移到 TenantBase 的业务表)."""

    __abstract__ = False  # SQLAlchemy 1.x 必须显式声明
    __tablename__ = "video_generation_tasks"
    # 建议 127: 透明化: 不再手工写 "schema": "public", 改用 __tenant_schema__
    __tenant_schema__ = "public"
    __table_args__ = (Index("ix_video_generation_tasks_status", "status"), {})

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    task_id = Column(String(36), unique=True, index=True, nullable=False)
    user_uuid = Column(String(255), nullable=False, index=True)
    chat_id = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="accepted")
    message = Column(String(512), nullable=True)
    result = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now(), server_default=func.now())
