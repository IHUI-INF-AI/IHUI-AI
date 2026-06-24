"""Reserved alembic migration for edu business domain tables.

Domain: Edu Indexes
Revision ID: 038_edu_indexes
Revises: 037_edu_order
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  (composite indexes across edu_*)
"""
import logging

from alembic import op


revision = "038_edu_indexes"
down_revision = "037_edu_order"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.038_edu_indexes")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("038_edu_indexes: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
