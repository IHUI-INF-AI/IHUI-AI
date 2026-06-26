"""Add missing columns to zhs_agent_developer table.

迁移自 coze_zhs_py zhs_agent_developer.sql.
历史 zhs_agent_developer 表含 uuid/user_name/creator_id/creator_name/bug_time/type/count/expiration_date
等 8 个字段, 当前表缺失, 会导致开发者续费功能无法正常工作.

兼容: SQLite (开发) / PostgreSQL (生产). SQLite 不支持 COMMENT, 用方言判断.
      SQLite 的 ALTER TABLE ADD COLUMN 不支持同时指定 NOT NULL 而无 DEFAULT,
      故所有新增字段均使用 nullable.

Revision ID: 050_fix_zhs_agent_developer_fields
Revises: 049_add_agent_category_fields
Create Date: 2026-06-26
"""
import logging

from alembic import op
from sqlalchemy import inspect


revision = "050_fix_zhs_agent_developer_fields"
down_revision = "049_add_agent_category_fields"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.050_fix_zhs_agent_developer_fields")


def upgrade() -> None:
    """给 zhs_agent_developer 表补齐缺失字段 (若不存在)."""
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if "zhs_agent_developer" not in existing_tables:
        logger.info("050_fix_zhs_agent_developer_fields: zhs_agent_developer 表不存在, 跳过")
        return

    existing_columns = [col["name"] for col in inspector.get_columns("zhs_agent_developer")]
    dialect = bind.dialect.name

    # 按历史字段定义逐个补齐 (幂等)
    # 字段名 / 类型 / 注释
    fields_to_add = [
        ("uuid", "VARCHAR(64)", "开发者唯一标识 UUID"),
        ("user_name", "VARCHAR(100)", "用户名"),
        ("creator_id", "BIGINT", "创建者用户 ID"),
        ("creator_name", "VARCHAR(100)", "创建者用户名"),
        ("bug_time", "TIMESTAMP", "购买时间 (历史字段名 bug_time, 语义为 buy_time)"),
        ("type", "VARCHAR(20)", "开发者类型 (如 month/year 等)"),
        ("count", "INTEGER", "数量 (如购买月数)"),
        ("expiration_date", "TIMESTAMP", "到期时间"),
    ]

    for col_name, col_type, comment in fields_to_add:
        if col_name in existing_columns:
            logger.info("050_fix_zhs_agent_developer_fields: %s 字段已存在, 跳过", col_name)
            continue
        logger.info("050_fix_zhs_agent_developer_fields: 添加 %s 字段", col_name)
        op.execute(
            f"ALTER TABLE zhs_agent_developer ADD COLUMN {col_name} {col_type}"
        )
        if dialect != "sqlite":
            # SQLite 不支持 COMMENT ON COLUMN
            op.execute(
                f"COMMENT ON COLUMN zhs_agent_developer.{col_name} IS '{comment}'"
            )

    logger.info("050_fix_zhs_agent_developer_fields: 迁移完成")


def downgrade() -> None:
    """删除 zhs_agent_developer 补齐的字段."""
    bind = op.get_bind()
    inspector = inspect(bind)
    if "zhs_agent_developer" not in inspector.get_table_names():
        return
    existing_columns = [col["name"] for col in inspector.get_columns("zhs_agent_developer")]
    # 反向删除 (避免依赖顺序)
    for col_name in [
        "expiration_date",
        "count",
        "type",
        "bug_time",
        "creator_name",
        "creator_id",
        "user_name",
        "uuid",
    ]:
        if col_name in existing_columns:
            op.execute(f"ALTER TABLE zhs_agent_developer DROP COLUMN {col_name}")
