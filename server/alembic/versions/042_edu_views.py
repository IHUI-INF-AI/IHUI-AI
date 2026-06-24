"""Reserved alembic migration for edu business domain tables.

Domain: Edu Views
Revision ID: 042_edu_views
Revises: 041_edu_constraints
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  (reporting materialized views)
"""
import logging

from alembic import op


revision = "042_edu_views"
down_revision = "041_edu_constraints"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.042_edu_views")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("042_edu_views: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
