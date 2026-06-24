"""Reserved alembic migration for edu business domain tables.

Domain: Edu Behavior
Revision ID: 028_edu_behavior
Revises: 027_edu_circle
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_behavior_view, edu_behavior_answer_path, edu_behavior_study_metric
"""
import logging

from alembic import op


revision = "028_edu_behavior"
down_revision = "027_edu_circle"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.028_edu_behavior")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("028_edu_behavior: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
