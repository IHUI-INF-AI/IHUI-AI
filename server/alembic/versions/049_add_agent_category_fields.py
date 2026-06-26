"""Add agent_main_category and agent_category columns to agents table.

迁移自 coze_zhs_py add_category_fields_to_agents.sql.
历史 agents 表含 agent_main_category / agent_category 冗余字段 (VARCHAR 500),
用于 agent 列表按分类筛选的性能优化 (避免 JOIN zhs_agent_category).
当前 agents 表仅有 category VARCHAR(100), 缺失这两个冗余字段.

注意: agents 表发布状态字段为 publish_status (Integer: 0=draft, 1=published),
      非 published (boolean). 部分索引需用 WHERE publish_status = 1.

兼容: SQLite (开发) / PostgreSQL (生产). SQLite 部分索引用 WHERE publish_status = 1.

Revision ID: 049_add_agent_category_fields
Revises: 048_add_category_type
Create Date: 2026-06-26
"""
import logging

from alembic import op
from sqlalchemy import inspect


revision = "049_add_agent_category_fields"
down_revision = "048_add_category_type"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.049_add_agent_category_fields")


def upgrade() -> None:
    """给 agents 表添加 agent_main_category / agent_category 字段 (若不存在)."""
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if "agents" not in existing_tables:
        logger.info("049_add_agent_category_fields: agents 表不存在, 跳过")
        return

    existing_columns = [col["name"] for col in inspector.get_columns("agents")]
    dialect = bind.dialect.name
    added = False

    if "agent_main_category" not in existing_columns:
        logger.info("049_add_agent_category_fields: 添加 agent_main_category 字段")
        op.execute("ALTER TABLE agents ADD COLUMN agent_main_category VARCHAR(500)")
        if dialect != "sqlite":
            op.execute(
                "COMMENT ON COLUMN agents.agent_main_category IS "
                "'智能体主分类 (冗余字段, 同步自 zhs_agent_category, 用于列表筛选加速)'"
            )
        added = True

    if "agent_category" not in existing_columns:
        logger.info("049_add_agent_category_fields: 添加 agent_category 字段")
        op.execute("ALTER TABLE agents ADD COLUMN agent_category VARCHAR(500)")
        if dialect != "sqlite":
            op.execute(
                "COMMENT ON COLUMN agents.agent_category IS "
                "'智能体分类 (冗余字段, 同步自 zhs_agent_category, 用于列表筛选加速)'"
            )
        added = True

    if added:
        # 补建复合索引 (历史 add_category_fields_to_agents.sql 含此索引)
        existing_indexes = [idx["name"] for idx in inspector.get_indexes("agents")]
        if "idx_agents_categories" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS idx_agents_categories "
                "ON agents (agent_main_category, agent_category)"
            )
            logger.info("049_add_agent_category_fields: 创建索引 idx_agents_categories")
        # 部分索引: 仅对已发布的 agent. SQLite/PG 都支持部分索引,
        # 但条件需用 publish_status = 1 (agents 表无 published bool 字段)
        if "idx_agents_publish_categories" not in existing_indexes:
            try:
                op.execute(
                    "CREATE INDEX IF NOT EXISTS idx_agents_publish_categories "
                    "ON agents (agent_main_category, agent_category) WHERE publish_status = 1"
                )
                logger.info("049_add_agent_category_fields: 创建索引 idx_agents_publish_categories")
            except Exception as e:  # noqa: BLE001
                # 个别老版本 SQLite 不支持部分索引, 失败不阻断主流程
                logger.warning("049_add_agent_category_fields: 部分索引创建失败 (可忽略): %s", e)

    logger.info("049_add_agent_category_fields: 迁移完成")


def downgrade() -> None:
    """删除 agents.agent_main_category / agent_category 字段."""
    bind = op.get_bind()
    inspector = inspect(bind)
    if "agents" not in inspector.get_table_names():
        return
    existing_columns = [col["name"] for col in inspector.get_columns("agents")]
    existing_indexes = [idx["name"] for idx in inspector.get_indexes("agents")]
    if "idx_agents_publish_categories" in existing_indexes:
        op.execute("DROP INDEX IF EXISTS idx_agents_publish_categories")
    if "idx_agents_categories" in existing_indexes:
        op.execute("DROP INDEX IF EXISTS idx_agents_categories")
    if "agent_category" in existing_columns:
        op.execute("ALTER TABLE agents DROP COLUMN agent_category")
    if "agent_main_category" in existing_columns:
        op.execute("ALTER TABLE agents DROP COLUMN agent_main_category")
