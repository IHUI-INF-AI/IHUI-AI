"""User Agent Context models (zhs_ai_project)."""

from typing import ClassVar

from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.database import Base
from app.models.base import TimestampMixin, id_column


class UserAgentContext(TimestampMixin, Base):
    """User agent context key-value store."""

    __tablename__ = "zhs_user_agent_context"
    __table_args__: ClassVar[dict] = {"extend_existing": True}

    id = id_column(comment="ID")
    user_uuid = Column(String(64), nullable=False, index=True, comment="User UUID")
    user_id = Column(String(64), nullable=True, index=True, comment="User ID (兼容)")
    agent_id = Column(String(64), nullable=False, index=True, comment="Agent ID")
    session_id = Column(String(64), nullable=True, comment="Session ID (兼容)")
    role = Column(String(20), nullable=True, comment="Role (兼容)")
    content = Column(Text, nullable=True, comment="Content (兼容)")
    content_type = Column(String(20), default="text", comment="Content type (兼容)")
    tokens = Column(Integer, default=0, comment="Tokens (兼容)")
    context_key = Column(String(200), nullable=True, comment="Context key")
    context_value = Column(Text, nullable=True, comment="Context value")
    field_name = Column(String(200), nullable=True, comment="Field name")
    create_time = Column(DateTime, server_default=func.now(), comment="Created")
    update_time = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="Updated")


class UserAgentAudio(TimestampMixin, Base):
    """User agent audio records."""

    __tablename__ = "zhs_user_agent_audio"
    __table_args__: ClassVar[dict] = {"extend_existing": True}

    id = id_column(comment="ID")
    user_uuid = Column(String(64), nullable=False, index=True, comment="User UUID")
    agent_id = Column(String(64), nullable=False, index=True, comment="Agent ID")
    audio_url = Column(String(500), nullable=True, comment="Audio URL")
    duration = Column(Integer, nullable=True, comment="Duration in seconds")
    create_time = Column(DateTime, server_default=func.now(), comment="Created")


class UserAgentImage(TimestampMixin, Base):
    """User agent image records."""

    __tablename__ = "zhs_user_agent_image"
    __table_args__: ClassVar[dict] = {"extend_existing": True}

    id = id_column(comment="ID")
    user_uuid = Column(String(64), nullable=False, index=True, comment="User UUID")
    user_id = Column(String(64), nullable=True, index=True, comment="User ID (兼容)")
    user_name = Column(String(100), nullable=True, comment="User Name (兼容)")
    agent_id = Column(String(64), nullable=True, index=True, comment="Agent ID")
    agent_name = Column(String(200), nullable=True, comment="Agent name (兼容)")
    image_url = Column(String(500), nullable=False, comment="Image URL")
    image_type = Column(String(20), default="input", comment="input=输入 output=输出")
    prompt = Column(Text, nullable=True, comment="Image description / prompt")
    model = Column(String(50), nullable=True, comment="Model used (兼容)")
    task_id = Column(String(100), nullable=True, comment="Task ID (兼容)")
    status = Column(Integer, default=1, comment="Status (兼容)")
    cost = Column(Integer, default=0, comment="Cost (兼容)")
    width = Column(Integer, nullable=True, comment="Width (兼容)")
    height = Column(Integer, nullable=True, comment="Height (兼容)")
    size = Column(Integer, nullable=True, comment="Size (兼容)")
    create_time = Column(DateTime, server_default=func.now(), comment="Created")
