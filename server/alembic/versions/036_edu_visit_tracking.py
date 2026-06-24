"""Reserved alembic migration for edu business domain tables.

Domain: Edu Visit Tracking
Revision ID: 036_edu_visit_tracking
Revises: 035_edu_schedule
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_visit_log, edu_visit_path, edu_visit_metric
"""
import logging

from alembic import op


revision = "036_edu_visit_tracking"
down_revision = "035_edu_schedule"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.036_edu_visit_tracking")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("036_edu_visit_tracking: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
