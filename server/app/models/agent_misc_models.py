"""Agent miscellaneous models (billings, scheduled tasks, uploads)."""

from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, func

from app.database import Base
from app.models.base import TimestampMixin, id_column


class AgentBillings(TimestampMixin, Base):
    """Agent billing record (zhs_ai_project.agent_billings)."""

    __tablename__ = "agent_billings"
    __table_args__ = (Index("ix_agent_billings_status", "status"),)

    id = id_column(comment="ID")
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    agent_id = Column(String(64), nullable=False, comment="Agent ID")
    billing_type = Column(String(32), default="token", comment="Billing type: token/time/count")
    amount = Column(BigInteger, default=0, comment="Amount in cents")
    tokens = Column(BigInteger, default=0, comment="Token consumption")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class AgentBuyScheduledTask(TimestampMixin, Base):
    """Agent buy scheduled task (zhs_ai_project.agent_buy_scheduled_tasks)."""

    __tablename__ = "agent_buy_scheduled_tasks"
    __table_args__ = (Index("ix_agent_buy_scheduled_tasks_status", "status"),)

    id = id_column(comment="ID")
    buy_id = Column(BigInteger, nullable=False, comment="Agent buy record ID")
    task_type = Column(String(32), default="renewal", comment="Task type: renewal/expire/notify")
    scheduled_time = Column(DateTime, nullable=True, comment="Scheduled execution time")
    status = Column(Integer, default=0, comment="0=pending, 1=executed, 2=failed")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")


class AgentUpload(TimestampMixin, Base):
    """Agent file upload record (zhs_ai_project.agent_upload)."""

    __tablename__ = "agent_upload"
    __table_args__ = (Index("ix_agent_upload_status", "status"), {"extend_existing": True})  # noqa: RUF012

    id = id_column(comment="ID")
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    user_id = Column(String(64), nullable=True, comment="User ID (兼容字段)")
    user_name = Column(String(100), nullable=True, comment="User Name (兼容字段)")
    agent_id = Column(String(64), nullable=False, comment="Agent ID")
    agent_name = Column(String(200), nullable=True, comment="Agent name (兼容)")
    file_url = Column(String(500), nullable=False, comment="File URL")
    file_name = Column(String(200), nullable=True, comment="File name (兼容)")
    file_size = Column(BigInteger, nullable=True, comment="File size (兼容)")
    mime_type = Column(String(100), nullable=True, comment="Mime type (兼容)")
    ext = Column(String(20), nullable=True, comment="File extension (兼容)")
    file_type = Column(String(50), nullable=True, comment="File type: image/audio/document")
    biz_type = Column(String(50), nullable=True, comment="Biz type (兼容)")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    create_time = Column(DateTime, server_default=func.now(), comment="Creation time")
