"""Create edu edu_ask tables.

Revision ID: 026_edu_ask
Revises: 025_edu_exam
Create Date: 2026-06-24 (Phase B)

Tables created: edu_ask_question, edu_ask_answer
"""
import logging

from alembic import op

# revision identifiers
revision = "026_edu_ask"
down_revision = "025_edu_exam"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.026_edu_ask")


def upgrade() -> None:
    """Create edu_ask tables using SQLAlchemy metadata."""
    from sqlalchemy import inspect

    from app.config import settings
    from app.database import Base
    import app.models  # noqa: F401  - ensure all models registered
    import app.models.edu_models  # noqa: F401  - ensure edu models registered

    bind = op.get_bind()
    inspector = inspect(bind)

    target_tables = ['edu_ask_question', 'edu_ask_answer']

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
    """Drop edu_ask tables (Phase B: drops are safe as data is recoverable)."""
    from app.config import settings
    from app.database import Base
    import app.models  # noqa: F401
    import app.models.edu_models  # noqa: F401

    bind = op.get_bind()
    target_tables = ['edu_ask_question', 'edu_ask_answer']

    for table_name in target_tables:
        try:
            op.drop_table(table_name)
            logger.info(repr(rev) + ': dropped ' + str(table_name))
        except Exception as e:
            logger.warning(repr(rev) + ': could not drop ' + str(table_name) + ': ' + str(e))
