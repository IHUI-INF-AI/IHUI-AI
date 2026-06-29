"""补建缺失的表 (visit/point/circle/ask/behavior/message/notification/live/exam 等 50 张表).

Revision ID: 008_add_missing_tables
Revises: 007_migrate_phase2_tables_to_tenant_schema
Create Date: 2026-06-18

说明:
  001_init.sql 仅覆盖 100 张表, 实际模型有 150 张表.
  本迁移用 Base.metadata.create_all(checkfirst=True) 补建缺失的表,
  避免生产环境依赖 AUTO_CREATE_SCHEMA.
"""
import logging

from alembic import op

revision = "008_add_missing_tables"
down_revision = "007_migrate_phase2_tables_to_tenant_schema"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.008")


def upgrade() -> None:
    """补建所有缺失的表 (checkfirst=True 跳过已存在的表)."""
    # 触发模型导入, 收集 Base.metadata
    import app.models  # noqa: F401
    from app.database import Base
    from app.config import settings

    bind = op.get_bind()

    # 单租户模式: strip 所有表的 schema (SQLite 不支持 public. 前缀)
    if not settings.MULTI_TENANT_ENABLED:
        for table in Base.metadata.tables.values():
            if table.schema:
                table.schema = None

    before = set(bind.dialect.get_table_names(bind)) if hasattr(bind.dialect, "get_table_names") else set()

    Base.metadata.create_all(bind=bind, checkfirst=True)

    after = set(bind.dialect.get_table_names(bind)) if hasattr(bind.dialect, "get_table_names") else set()
    added = after - before
    if added:
        logger.info(f"008_add_missing_tables: created {len(added)} tables: {sorted(added)}")
    else:
        logger.info("008_add_missing_tables: no new tables created (all exist)")


def downgrade() -> None:
    """降级: 不删除表 (避免数据丢失)."""
    pass
