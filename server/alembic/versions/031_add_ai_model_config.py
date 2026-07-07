"""add ai_model_config table for custom model provider configurations

Revision ID: 031_add_ai_model_config
Revises: 030_add_ai_feed_tables
Create Date: 2026-07-07

Custom model provider config table — stores user-defined AI model
provider credentials (API Key encrypted, Base URL, API format, etc.)
for the "Model Settings" page (inspired by zcode / cc-switch / echobird).

Migration is idempotent (inspect checks existence), compatible with
SQLite (dev) and PostgreSQL (production).
"""
import sqlalchemy as sa
from alembic import op

revision = "031_add_ai_model_config"
down_revision = "030_add_ai_feed_tables"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _index_exists(bind, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(bind)
    try:
        return any(i["name"] == index_name for i in inspector.get_indexes(table_name))
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "ai_model_config"):
        op.create_table(
            "ai_model_config",
            sa.Column(
                "id",
                sa.Integer().with_variant(sa.BigInteger(), "postgresql"),
                primary_key=True,
                autoincrement=True,
                comment="Provider config ID",
            ),
            sa.Column("name", sa.String(100), nullable=False, comment="Display name"),
            sa.Column("provider_code", sa.String(64), nullable=False, comment="Provider identifier"),
            sa.Column(
                "is_builtin",
                sa.Boolean,
                nullable=False,
                server_default=sa.text("0"),
                comment="Built-in provider (read-only)",
            ),
            sa.Column("base_url", sa.String(500), nullable=False, comment="API base URL"),
            sa.Column(
                "api_format",
                sa.String(32),
                nullable=False,
                server_default="openai_chat",
                comment="API format enum",
            ),
            sa.Column("api_key_enc", sa.Text, nullable=True, comment="Encrypted API key"),
            sa.Column("model_id_for_test", sa.String(100), nullable=True, comment="Test model ID"),
            sa.Column(
                "enabled",
                sa.Boolean,
                nullable=False,
                server_default=sa.text("1"),
                comment="Enabled flag",
            ),
            sa.Column("description", sa.Text, nullable=True, comment="Description"),
            sa.Column(
                "sort_order",
                sa.Integer,
                nullable=False,
                server_default="0",
                comment="Sort order",
            ),
            sa.Column("owner_uuid", sa.String(64), nullable=True, comment="Owner user UUID"),
            sa.Column("last_test_status", sa.String(16), nullable=True, comment="Last test status"),
            sa.Column("last_test_response_ms", sa.Integer, nullable=True, comment="Last test response ms"),
            sa.Column("last_tested_at", sa.String(32), nullable=True, comment="Last test timestamp"),
            sa.Column("last_test_error", sa.Text, nullable=True, comment="Last test error"),
            sa.Column("extra_config", sa.Text, nullable=True, comment="JSON extra config"),
            sa.Column("created_at", sa.DateTime, nullable=True, comment="Created at"),
            sa.Column("updated_at", sa.DateTime, nullable=True, comment="Updated at"),
            comment="Custom model provider configurations",
        )
        logger_msg = "Created ai_model_config table"
    else:
        logger_msg = "ai_model_config table already exists, skipped"

    # Indexes
    if _table_exists(bind, "ai_model_config"):
        if not _index_exists(bind, "ai_model_config", "ix_ai_model_config_owner"):
            op.create_index("ix_ai_model_config_owner", "ai_model_config", ["owner_uuid"])
        if not _index_exists(bind, "ai_model_config", "ix_ai_model_config_enabled"):
            op.create_index("ix_ai_model_config_enabled", "ai_model_config", ["enabled"])
        if not _index_exists(bind, "ai_model_config", "ix_ai_model_config_provider"):
            op.create_index("ix_ai_model_config_provider", "ai_model_config", ["provider_code"])

    print(f"[alembic 031] {logger_msg}")


def downgrade() -> None:
    bind = op.get_bind()
    if _table_exists(bind, "ai_model_config"):
        op.drop_table("ai_model_config")
        print("[alembic 031] Dropped ai_model_config table")
