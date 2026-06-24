"""Reserved alembic migration for edu business domain tables.

Domain: Edu Setting
Revision ID: 020_edu_setting
Revises: 019_edu_usercenter
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_setting_dict, edu_setting_category, edu_setting_term
"""
import logging

from alembic import op


revision = "020_edu_setting"
down_revision = "019_edu_usercenter"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.020_edu_setting")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("020_edu_setting: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
