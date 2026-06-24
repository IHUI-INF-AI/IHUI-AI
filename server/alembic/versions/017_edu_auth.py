"""Create edu edu_auth tables.

Revision ID: 017_edu_auth
Revises: 016_add_refund_tables
Create Date: 2026-06-24 (Phase B)

Tables created: edu_auth_user, edu_auth_sso_key, edu_auth_third_party
"""
import logging

from alembic import op

# revision identifiers
revision = "017_edu_auth"
down_revision = "016_add_refund_tables"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.017_edu_auth")


def upgrade() -> None:
    """Create edu_auth tables using SQLAlchemy metadata."""
    from sqlalchemy import inspect

    from app.config import settings
    from app.database import Base
    import app.models  # noqa: F401  - ensure all models registered
    import app.models.edu_models  # noqa: F401  - ensure edu models registered

    bind = op.get_bind()
    inspector = inspect(bind)

    target_tables = ['edu_auth_user', 'edu_auth_sso_key', 'edu_auth_third_party']

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
    """Drop edu_auth tables (Phase B: drops are safe as data is recoverable)."""
    from app.config import settings
    from app.database import Base
    import app.models  # noqa: F401
    import app.models.edu_models  # noqa: F401

    bind = op.get_bind()
    target_tables = ['edu_auth_user', 'edu_auth_sso_key', 'edu_auth_third_party']

    for table_name in target_tables:
        try:
            op.drop_table(table_name)
            logger.info(repr(revision) + ': dropped ' + str(table_name))
        except Exception as e:
            logger.warning(repr(revision) + ': could not drop ' + str(table_name) + ': ' + str(e))
