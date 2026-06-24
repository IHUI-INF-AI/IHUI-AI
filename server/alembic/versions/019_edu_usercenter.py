"""Create edu edu_usercenter tables.

Revision ID: 019_edu_usercenter
Revises: 018_edu_member
Create Date: 2026-06-24 (Phase B)

Tables created: edu_user_profile, edu_user_address
"""
import logging

from alembic import op

# revision identifiers
revision = "019_edu_usercenter"
down_revision = "018_edu_member"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.019_edu_usercenter")


def upgrade() -> None:
    """Create edu_usercenter tables using SQLAlchemy metadata."""
    from sqlalchemy import inspect

    from app.config import settings
    from app.database import Base
    import app.models  # noqa: F401  - ensure all models registered
    import app.models.edu_models  # noqa: F401  - ensure edu models registered

    bind = op.get_bind()
    inspector = inspect(bind)

    target_tables = ['edu_user_profile', 'edu_user_address']

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
        logger.info(repr(revision) + ': created ' + str(len(created)) + ' tables: ' + str(created))
    else:
        logger.info(repr(revision) + ': no new tables (all ' + str(len(target_tables)) + ' already exist)')


def downgrade() -> None:
    """Drop edu_usercenter tables (Phase B: drops are safe as data is recoverable)."""
    from app.config import settings
    from app.database import Base
    import app.models  # noqa: F401
    import app.models.edu_models  # noqa: F401

    bind = op.get_bind()
    target_tables = ['edu_user_profile', 'edu_user_address']

    for table_name in target_tables:
        try:
            op.drop_table(table_name)
            logger.info(repr(revision) + ': dropped ' + str(table_name))
        except Exception as e:
            logger.warning(repr(revision) + ': could not drop ' + str(table_name) + ': ' + str(e))
