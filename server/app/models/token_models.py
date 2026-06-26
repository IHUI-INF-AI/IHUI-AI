"""Token and user SK models."""

import time
from typing import Optional

from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, Text, func

from app.database import Base
from app.models.base import TimestampMixin, id_column
from app.orm.tenant_base import TenantBase
from app.utils.datetime_helper import utcnow


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


class ZhsOperateTokenFlow(Base):
    """Token 操作流水表 (zhs_ai_project.zhs_operate_token_flow).

    记录用户 token 的充值与消耗明细.
    type 字段: 0=充值, 1=消耗.
    created_at 字段为 Unix 时间戳 (Integer), 适配 PostgreSQL.
    """

    __tablename__ = "zhs_operate_token_flow"
    # NOTE: user_uuid 列已用 index=True 自动生成 ix_zhs_operate_token_flow_user_uuid,
    # 不再在 __table_args__ 重复定义同名显式 Index (会导致 create_all 时 "index already exists").

    id = id_column(comment="Token flow ID")
    user_id = Column(Integer, nullable=True, comment="用户ID")
    user_uuid = Column(String(255), nullable=True, index=True, comment="用户UUID")
    token_quantity = Column(BigInteger, nullable=True, comment="token数量")
    token_free = Column(Integer, nullable=False, default=0, comment="是否免费token: 0=否")
    type = Column(Integer, nullable=True, comment="操作类型: 0=充值, 1=消耗")
    operate_desc = Column(String(255), nullable=True, comment="操作描述")
    created_at = Column(Integer, nullable=True, default=lambda: int(time.time()), comment="创建时间戳")
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, comment="更新时间 (DateTime, 与 created_at 区别: 业务修改时间)")

    @classmethod
    def create_flow_record(
        cls,
        db,
        user_uuid: str,
        token_quantity: int,
        type: int,
        user_id: Optional[int] = None,
        operate_desc: Optional[str] = None,
        token_free: int = 0,
    ):
        """创建一条 token 流水记录.

        Args:
            db: SQLAlchemy 会话
            user_uuid: 用户 UUID
            token_quantity: token 数量
            type: 操作类型 (0=充值, 1=消耗)
            user_id: 用户 ID (可空)
            operate_desc: 操作描述 (可空)
            token_free: 是否免费 token, 默认 0

        Returns:
            ZhsOperateTokenFlow 实例
        """
        flow = cls(
            user_id=user_id,
            user_uuid=user_uuid,
            token_quantity=token_quantity,
            token_free=token_free,
            type=type,
            operate_desc=operate_desc,
            created_at=int(time.time()),
        )
        db.add(flow)
        db.flush()
        return flow

    def to_dict(self) -> dict:
        """转为字典."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_uuid": self.user_uuid,
            "token_quantity": self.token_quantity,
            "token_free": self.token_free,
            "type": self.type,
            "operate_desc": self.operate_desc,
            "created_at": self.created_at,
        }
