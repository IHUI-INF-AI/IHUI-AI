"""Reserved alembic migration for edu business domain tables.

Domain: Edu Message
Revision ID: 031_edu_message
Revises: 030_edu_point
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_message, edu_message_template, edu_message_recipient
"""
import logging

from alembic import op


revision = "031_edu_message"
down_revision = "030_edu_point"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.031_edu_message")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("031_edu_message: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
