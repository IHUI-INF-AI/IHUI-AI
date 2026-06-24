"""Add refund and refund timeline tables.

Revision ID: 016_add_refund_tables
Revises: None (migration chain root; 013-015 were removed/merged)
Create Date: 2026-06-24

This migration is the root of the 017-044 placeholder chain. It uses
Base.metadata.create_all(checkfirst=True) to create all model tables that
do not yet exist, including zhs_refund and zhs_refund_timeline.
"""
import logging

from alembic import op


revision = "016_add_refund_tables"
down_revision = None
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.016")


def upgrade() -> None:
    """create zhs_refund and zhs_refund_timeline tables (and any missing model tables)."""
    import app.models  # noqa: F401
    from app.database import Base
    from app.config import settings

    bind = op.get_bind()

    if not settings.MULTI_TENANT_ENABLED:
        for table in Base.metadata.tables.values():
            if table.schema:
                table.schema = None

    before = set(bind.dialect.get_table_names(bind)) if hasattr(bind.dialect, "get_table_names") else set()
    Base.metadata.create_all(bind=bind, checkfirst=True)
    after = set(bind.dialect.get_table_names(bind)) if hasattr(bind.dialect, "get_table_names") else set()
    added = sorted(after - before)
    if added:
        logger.info(f"016_add_refund_tables: created {len(added)} tables: {added}")
    else:
        logger.info("016_add_refund_tables: no new tables created (all exist)")


def downgrade() -> None:
    """drop refund tables on rollback."""
    from sqlalchemy import text

    bind = op.get_bind()
    bind.execute(text("DROP TABLE IF EXISTS zhs_refund_timeline"))
    bind.execute(text("DROP TABLE IF EXISTS zhs_refund"))
    logger.info("016_add_refund_tables: dropped zhs_refund and zhs_refund_timeline")
