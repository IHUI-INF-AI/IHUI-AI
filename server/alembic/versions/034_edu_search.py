"""Reserved alembic migration for edu business domain tables.

Domain: Edu Search
Revision ID: 034_edu_search
Revises: 033_edu_oss
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_search_index, edu_search_hot_keyword, edu_search_history
"""
import logging

from alembic import op


revision = "034_edu_search"
down_revision = "033_edu_oss"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.034_edu_search")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("034_edu_search: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
