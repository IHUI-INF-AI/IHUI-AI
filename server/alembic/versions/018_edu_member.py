"""Reserved alembic migration for edu business domain tables.

Domain: Edu Member
Revision ID: 018_edu_member
Revises: 017_edu_auth
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_member, edu_member_student, edu_member_parent, edu_member_school, edu_member_profile
"""
import logging

from alembic import op


revision = "018_edu_member"
down_revision = "017_edu_auth"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.018_edu_member")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("018_edu_member: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
