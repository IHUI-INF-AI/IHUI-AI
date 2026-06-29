"""补建迁移阶段新增的表 (simple_bot_configs/ai_bot_sites/payment_callbacks 等 60+ 表).

Revision ID: 009_migrate_phase3_misc_tables
Revises: 008_add_missing_tables
Create Date: 2026-06-18

说明:
  Phase 1-6 迁移补齐了 50+ 个新表 (small_models, java_missing_models,
  simple_bot_config, tbox_models, user_extended_models 等).
  008 已用 create_all 触发 Base.metadata 已注册的表, 但 008 之后又
  新增/重写了一些表 (Phase 1-6 的补齐). 本迁移用同样的逐表策略
  补建剩余缺失的表.
"""
import logging

from alembic import op
from sqlalchemy import inspect

revision = "009_migrate_phase3_misc_tables"
down_revision = "008_add_missing_tables"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.009")


def upgrade() -> None:
    """逐表补建 Phase 1-6 迁移后剩余缺失的表."""
    # 触发全部模型 import, 收集 Base.metadata
    import app.models  # noqa: F401
    import app.models.simple_bot_config  # noqa: F401
    import app.models.java_missing_models  # noqa: F401
    import app.models.tbox_models  # noqa: F401
    from app.database import Base
    from app.config import settings
    from sqlalchemy.exc import OperationalError, ProgrammingError

    bind = op.get_bind()

    # 单租户模式: strip 所有表的 schema
    if not settings.MULTI_TENANT_ENABLED:
        for table in Base.metadata.tables.values():
            if table.schema:
                table.schema = None

    # 退出 alembic 事务
    try:
        op.execute("COMMIT")
    except Exception:  # noqa: BLE001
        pass

    if hasattr(bind, "engine"):
        engine = bind.engine
    else:
        engine = bind

    try:
        inspector = inspect(engine)
        existing = set(inspector.get_table_names())
    except Exception:  # noqa: BLE001
        existing = set()

    seen: set[str] = set()
    created: list[str] = []
    skipped: list[str] = []
    failed: list[tuple[str, str]] = []

    for table in Base.metadata.sorted_tables:
        if table.name in seen:
            continue
        seen.add(table.name)
        if table.name in existing:
            skipped.append(table.name)
            continue
        try:
            table.create(bind=engine, checkfirst=True)
            created.append(table.name)
        except (OperationalError, ProgrammingError) as exc:
            failed.append((table.name, str(exc)[:120]))
            logger.warning(f"  skip table {table.name}: {exc}")

    logger.info(
        f"009_migrate_phase3_misc_tables: created={len(created)} skipped={len(skipped)} failed={len(failed)}"
    )
    if created:
        logger.info(f"  created: {sorted(created)[:30]}{' ...' if len(created) > 30 else ''}")
    if failed:
        for name, err in failed[:10]:
            logger.info(f"  failed {name}: {err}")


def downgrade() -> None:
    """降级: 不删除表 (避免数据丢失)."""
    pass
