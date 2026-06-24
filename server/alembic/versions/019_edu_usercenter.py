"""Reserved alembic migration for edu business domain tables.

Domain: Edu Usercenter
Revision ID: 019_edu_usercenter
Revises: 018_edu_member
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_user_profile, edu_user_address, edu_user_preference
"""
import logging

from alembic import op


revision = "019_edu_usercenter"
down_revision = "018_edu_member"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.019_edu_usercenter")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("019_edu_usercenter: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
