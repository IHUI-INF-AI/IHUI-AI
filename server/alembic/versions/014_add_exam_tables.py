"""Add exam chapter and chapter section tables if they are missing.

Revision ID: 014_add_exam_tables
Revises: 013_rename_sys_to_admin
Create Date: 2026-06-24
"""
import logging

from alembic import op


revision = "014_add_exam_tables"
down_revision = "013_rename_sys_to_admin"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.014")


def upgrade() -> None:
    """create missing exam chapter and section tables."""
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
        logger.info(f"014_add_exam_tables: created {len(added)} tables: {added}")
    else:
        logger.info("014_add_exam_tables: no new tables created (all exist)")


def downgrade() -> None:
    """do not drop tables on rollback to avoid data loss."""
    pass
