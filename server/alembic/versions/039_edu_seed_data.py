"""Reserved alembic migration for edu business domain tables.

Domain: Edu Seed Data
Revision ID: 039_edu_seed_data
Revises: 038_edu_indexes
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  (seed/reference data only, no schema)
"""
import logging

from alembic import op


revision = "039_edu_seed_data"
down_revision = "038_edu_indexes"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.039_edu_seed_data")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("039_edu_seed_data: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
