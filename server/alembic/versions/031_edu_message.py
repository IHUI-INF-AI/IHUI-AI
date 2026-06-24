"""Create edu edu_message tables.

Revision ID: 031_edu_message
Revises: 030_edu_point
Create Date: 2026-06-24 (Phase B)

Tables created: edu_message
"""
import logging

from alembic import op

# revision identifiers
revision = "031_edu_message"
down_revision = "030_edu_point"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.031_edu_message")


def upgrade() -> None:
    """Create edu_message tables using SQLAlchemy metadata."""
    from sqlalchemy import inspect

    from app.config import settings
    from app.database import Base
    import app.models  # noqa: F401  - ensure all models registered
    import app.models.edu_models  # noqa: F401  - ensure edu models registered

    bind = op.get_bind()
    inspector = inspect(bind)

    target_tables = ['edu_message']

    # For single-tenant mode, strip schema
    if not settings.MULTI_TENANT_ENABLED:
        for table in Base.metadata.tables.values():
            if table.schema:
                table.schema = None

    before = set(inspector.get_table_names())
    Base.metadata.create_all(bind=bind, checkfirst=True)
    after = set(inspector.get_table_names())
    added = sorted(after - before)

    created = [t for t in added if t in target_tables]
    if created:
        logger.info(repr(rev) + ': created ' + str(len(created)) + ' tables: ' + str(created))
    else:
        logger.info(repr(rev) + ': no new tables (all ' + str(len(target_tables)) + ' already exist)')


def downgrade() -> None:
    """Drop edu_message tables (Phase B: drops are safe as data is recoverable)."""
    from app.config import settings
    from app.database import Base
    import app.models  # noqa: F401
    import app.models.edu_models  # noqa: F401

    bind = op.get_bind()
    target_tables = ['edu_message']

    for table_name in target_tables:
        try:
            op.drop_table(table_name)
            logger.info(repr(rev) + ': dropped ' + str(table_name))
        except Exception as e:
            logger.warning(repr(rev) + ': could not drop ' + str(table_name) + ': ' + str(e))
