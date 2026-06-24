"""Reserved alembic migration for edu business domain tables.

Domain: Edu Order
Revision ID: 037_edu_order
Revises: 036_edu_visit_tracking
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_order, edu_order_item, edu_order_log
"""
import logging

from alembic import op


revision = "037_edu_order"
down_revision = "036_edu_visit_tracking"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.037_edu_order")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("037_edu_order: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
