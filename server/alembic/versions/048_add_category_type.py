"""Add type column to t_category for distinguishing business modules.

迁移自 edu server update_live_categories.sql / sync_category_type.sql.
历史 t_category.type 字段用于区分分类归属: live / learn / exam / circle 等业务板块.
当前 t_category 缺失该字段, 会导致分类混淆.

兼容: SQLite (开发) / PostgreSQL (生产). SQLite 不支持 COMMENT, 用方言判断.

Revision ID: 048_add_category_type
Revises: 047_notify_persist
Create Date: 2026-06-26
"""
import logging

from alembic import op
from sqlalchemy import inspect


revision = "048_add_category_type"
down_revision = "047_notify_persist"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.048_add_category_type")


def upgrade() -> None:
    """给 t_category 表添加 type 字段 (若不存在)."""
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if "t_category" not in existing_tables:
        logger.info("048_add_category_type: t_category 表不存在, 跳过")
        return

    existing_columns = [col["name"] for col in inspector.get_columns("t_category")]
    if "type" in existing_columns:
        logger.info("048_add_category_type: type 字段已存在, 跳过")
        return

    logger.info("048_add_category_type: 添加 type 字段到 t_category")
    dialect = bind.dialect.name
    if dialect == "sqlite":
        # SQLite: ADD COLUMN 不支持 COMMENT, 默认值用字符串字面量
        op.execute("ALTER TABLE t_category ADD COLUMN type VARCHAR(20) DEFAULT 'live'")
    else:
        # PostgreSQL: 支持 COMMENT
        op.execute("ALTER TABLE t_category ADD COLUMN type VARCHAR(20) DEFAULT 'live'")
        op.execute(
            "COMMENT ON COLUMN t_category.type IS '分类归属业务板块: live/learn/exam/circle 等'"
        )
    logger.info("048_add_category_type: type 字段添加完成")


def downgrade() -> None:
    """删除 t_category.type 字段."""
    bind = op.get_bind()
    inspector = inspect(bind)
    if "t_category" not in inspector.get_table_names():
        return
    existing_columns = [col["name"] for col in inspector.get_columns("t_category")]
    if "type" in existing_columns:
        # SQLite DROP COLUMN 需要 3.35+, 历史兼容用重建表方式太复杂, 此处直接 DROP
        op.execute("ALTER TABLE t_category DROP COLUMN type")
