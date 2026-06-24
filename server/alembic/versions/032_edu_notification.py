"""Reserved alembic migration for edu business domain tables.

Domain: Edu Notification
Revision ID: 032_edu_notification
Revises: 031_edu_message
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_notification, edu_notification_template, edu_notification_channel
"""
import logging

from alembic import op


revision = "032_edu_notification"
down_revision = "031_edu_message"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.032_edu_notification")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("032_edu_notification: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
