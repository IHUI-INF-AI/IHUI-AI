"""Reserved alembic migration for edu business domain tables.

Domain: Edu Schedule
Revision ID: 035_edu_schedule
Revises: 034_edu_search
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_schedule_course, edu_schedule_class, edu_schedule_teacher
"""
import logging

from alembic import op


revision = "035_edu_schedule"
down_revision = "034_edu_search"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.035_edu_schedule")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("035_edu_schedule: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
