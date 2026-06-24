"""Reserved alembic migration for edu business domain tables.

Domain: Edu Live
Revision ID: 024_edu_live
Revises: 023_edu_learn
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_live_room, edu_live_session, edu_live_attendance, edu_live_replay
"""
import logging

from alembic import op


revision = "024_edu_live"
down_revision = "023_edu_learn"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.024_edu_live")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("024_edu_live: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
