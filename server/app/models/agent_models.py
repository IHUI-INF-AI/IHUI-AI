"""
Agent models (from zhs_ai_project).

Merged from P1 (ZhsAgent) and P3 (Agent).
"""

from sqlalchemy import BigInteger, Column, DateTime, Float, Index, Integer, String, Text

from app.database import Base
from app.models.base import TimestampMixin, id_column


class Agent(TimestampMixin, Base):
    """Agent marketplace entry (zhs_ai_project.agents)."""

    __tablename__ = "agents"
    __table_args__ = (
        Index("ix_agents_user_id", "user_id"),
        {
            # 建议 113: 阶段 2 业务表 schema 改造 (第 2 批)
            "schema": "public",
        },
    )

    agent_id = Column(String(64), primary_key=True, comment="Agent ID")
    agent_name = Column(String(200), nullable=False, comment="Agent name")
    agent_description = Column(Text, nullable=True, comment="Description")
    agent_avatar = Column(String(500), nullable=True, comment="Avatar URL")
    agent_version = Column(String(32), nullable=True, comment="Version")
    bot_id = Column(String(64), nullable=True, comment="Coze bot ID")
    bot_id_str = Column(String(64), nullable=True, comment="Bot ID string")
    bot_name = Column(String(200), nullable=True, comment="Bot name")
    connector_id = Column(Integer, nullable=True, comment="Connector ID")
    connector_user_id = Column(String(64), nullable=True, comment="Connector user ID")
    user_id = Column(String(64), nullable=True, comment="Developer user ID")
    user_id_str = Column(String(64), nullable=True, comment="User ID string")
    user_name = Column(String(100), nullable=True, comment="Developer name")
    agent_prompt = Column(Text, nullable=True, comment="System prompt")
    agent_model = Column(String(100), nullable=True, comment="Model")
    agent_temperature = Column(Float, nullable=True, comment="Temperature")
    agent_max_tokens = Column(Integer, nullable=True, comment="Max tokens")
    agent_variables = Column(Text, nullable=True, comment="Variables JSON")
    publish_status = Column(Integer, default=0, comment="Publish status: 0=draft, 1=published")
    publish_channel = Column(String(50), nullable=True, comment="Publish channel")
    publish_time = Column(DateTime, nullable=True, comment="Publish time")
    category = Column(String(100), nullable=True, comment="Category")
    tags = Column(String(500), nullable=True, comment="Tags")
    is_public = Column(Integer, default=1, comment="Is public")
    access_level = Column(String(50), nullable=True, comment="Access level")
    usage_count = Column(BigInteger, default=0, comment="Usage count")
    like_count = Column(BigInteger, default=0, comment="Like count")
    share_count = Column(BigInteger, default=0, comment="Share count")
    creator_id = Column(String(64), nullable=True, comment="Creator ID")
    creator_name = Column(String(100), nullable=True, comment="Creator name")
    callback_data_1 = Column(String(500), nullable=True)
    callback_data_2 = Column(String(500), nullable=True)
    callback_data_3 = Column(String(500), nullable=True)
    prologue = Column(Text, nullable=True, comment="Prologue")
    all_token = Column(BigInteger, default=0, comment="Total tokens used")
    sort = Column(Integer, default=0, comment="Sort order")
    coze_account_id = Column(String(64), nullable=True)
    type = Column(Integer, default=0, comment="Agent type")


class AgentHeatStats(TimestampMixin, Base):
    """Agent heat/traffic statistics."""

    __tablename__ = "agent_heat_stats"

    id = id_column(comment="ID")
    agent_id = Column(String(64), nullable=False, comment="Agent ID")
    hit_count = Column(BigInteger, default=0, comment="Hit count")
    date_str = Column(String(10), nullable=True, comment="Date YYYY-MM-DD")


class AgentCallback(TimestampMixin, Base):
    """Agent webhook/callback config."""

    __tablename__ = "agent_callbacks"

    id = id_column(comment="ID")
    agent_id = Column(String(64), nullable=False, comment="Agent ID")
    callback_url = Column(Text, nullable=True, comment="Callback URL")
    callback_data_1 = Column(String(500), nullable=True)
    callback_data_2 = Column(String(500), nullable=True)
    callback_data_3 = Column(String(500), nullable=True)


class AgentConfig(TimestampMixin, Base):
    """Agent configuration."""

    __tablename__ = "agent_configs"

    id = id_column(comment="ID")
    agent_id = Column(String(64), nullable=False, comment="Agent ID")
    config_key = Column(String(100), nullable=False, comment="Config key")
    config_value = Column(Text, nullable=True, comment="Config value")
    is_deleted = Column(Integer, default=0, comment="Soft delete")
