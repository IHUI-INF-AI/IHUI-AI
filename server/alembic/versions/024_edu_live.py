"""Create edu edu_live tables.

Revision ID: 024_edu_live
Revises: 023_edu_learn
Create Date: 2026-06-24 (Phase B)

Tables created: edu_live_room, edu_live_attendance
"""
import logging

from alembic import op

# revision identifiers
revision = "024_edu_live"
down_revision = "023_edu_learn"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.024_edu_live")


def upgrade() -> None:
    """Create edu_live tables using SQLAlchemy metadata."""
    from sqlalchemy import inspect

    from app.config import settings
    from app.database import Base
    import app.models  # noqa: F401  - ensure all models registered
    import app.models.edu_models  # noqa: F401  - ensure edu models registered

    bind = op.get_bind()
    inspector = inspect(bind)

    target_tables = ['edu_live_room', 'edu_live_attendance']

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
    """Drop edu_live tables (Phase B: drops are safe as data is recoverable)."""
    from app.config import settings
    from app.database import Base
    import app.models  # noqa: F401
    import app.models.edu_models  # noqa: F401

    bind = op.get_bind()
    target_tables = ['edu_live_room', 'edu_live_attendance']

    for table_name in target_tables:
        try:
            op.drop_table(table_name)
            logger.info(repr(rev) + ': dropped ' + str(table_name))
        except Exception as e:
            logger.warning(repr(rev) + ': could not drop ' + str(table_name) + ': ' + str(e))
