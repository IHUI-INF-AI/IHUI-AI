"""Reserved alembic migration for edu business domain tables.

Domain: Edu Point
Revision ID: 030_edu_point
Revises: 029_edu_pay
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_point_account, edu_point_record, edu_point_exchange
"""
import logging

from alembic import op


revision = "030_edu_point"
down_revision = "029_edu_pay"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.030_edu_point")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("030_edu_point: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
