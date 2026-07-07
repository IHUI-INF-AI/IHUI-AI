"""
Developer module models — custom model provider configurations.

Stores user/admin-defined AI model provider credentials (API Key, Base URL,
API format, etc.) in the ``ai_model_config`` table. API Keys are encrypted
at rest via Fernet (see ``app.utils.crypto_util``).
"""

from sqlalchemy import Boolean, Column, Index, Integer, String, Text

from app.database import Base
from app.models.base import TimestampMixin, id_column


class AiModelConfig(TimestampMixin, Base):
    """Custom model provider configuration (table: ``ai_model_config``).

    Each row represents one user-configured model provider with its API
    credentials and connection settings. Built-in providers (``is_builtin=True``)
    are seeded defaults that can be enabled/filled but not deleted.
    """

    __tablename__ = "ai_model_config"
    __table_args__ = (
        Index("ix_ai_model_config_owner", "owner_uuid"),
        Index("ix_ai_model_config_enabled", "enabled"),
        Index("ix_ai_model_config_provider", "provider_code"),
        {"extend_existing": True},
    )

    id = id_column(comment="Provider config ID")

    # --- Identity ---
    name = Column(String(100), nullable=False, comment="Display name (e.g. 智谱/BigModel)")
    provider_code = Column(
        String(64),
        nullable=False,
        comment="Provider identifier (zhipu/openai/anthropic/custom...)",
    )
    is_builtin = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
        comment="Built-in provider (read-only, cannot delete)",
    )

    # --- Connection ---
    base_url = Column(String(500), nullable=False, comment="API base URL")
    api_format = Column(
        String(32),
        nullable=False,
        default="openai_chat",
        server_default="openai_chat",
        comment="API format: openai_chat / anthropic_messages / openai_responses",
    )
    api_key_enc = Column(Text, nullable=True, comment="Fernet-encrypted API key")
    model_id_for_test = Column(
        String(100),
        nullable=True,
        comment="Model ID used for connection testing (e.g. glm-4, gpt-4o-mini)",
    )

    # --- State ---
    enabled = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
        comment="Whether this provider is enabled",
    )
    description = Column(Text, nullable=True, comment="Optional description")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0", comment="Sort order")

    # --- Ownership (multi-tenant) ---
    owner_uuid = Column(
        String(64),
        nullable=True,
        index=True,
        comment="Owner user UUID (NULL = global/admin-level config)",
    )

    # --- Last test result cache ---
    last_test_status = Column(
        String(16),
        nullable=True,
        comment="Last test status: operational / degraded / failed / unknown",
    )
    last_test_response_ms = Column(Integer, nullable=True, comment="Last test response time (ms)")
    last_tested_at = Column(
        String(32),
        nullable=True,
        comment="Last test timestamp (ISO string)",
    )
    last_test_error = Column(Text, nullable=True, comment="Last test error summary (sanitized)")

    # --- Extension ---
    extra_config = Column(
        Text,
        nullable=True,
        comment="JSON string for pricing/proxy/headers etc.",
    )
