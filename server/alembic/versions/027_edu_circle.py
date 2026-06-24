"""Reserved alembic migration for edu business domain tables.

Domain: Edu Circle
Revision ID: 027_edu_circle
Revises: 026_edu_ask
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_circle, edu_circle_post, edu_circle_member, edu_circle_comment, edu_circle_like
"""
import logging

from alembic import op


revision = "027_edu_circle"
down_revision = "026_edu_ask"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.027_edu_circle")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("027_edu_circle: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
