"""Reserved alembic migration for edu business domain tables.

Domain: Edu Constraints
Revision ID: 041_edu_constraints
Revises: 040_edu_grants
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  (FK and unique constraints tightening)
"""
import logging

from alembic import op


revision = "041_edu_constraints"
down_revision = "040_edu_grants"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.041_edu_constraints")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("041_edu_constraints: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
