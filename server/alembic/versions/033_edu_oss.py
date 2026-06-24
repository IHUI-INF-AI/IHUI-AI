"""Reserved alembic migration for edu business domain tables.

Domain: Edu Oss
Revision ID: 033_edu_oss
Revises: 032_edu_notification
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_oss_file, edu_oss_chunk, edu_oss_upload_session
"""
import logging

from alembic import op


revision = "033_edu_oss"
down_revision = "032_edu_notification"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.033_edu_oss")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("033_edu_oss: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
