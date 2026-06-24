"""Reserved alembic migration for edu business domain tables.

Domain: Edu Resource
Revision ID: 021_edu_resource
Revises: 020_edu_setting
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_resource, edu_resource_category, edu_resource_chapter, edu_resource_attachment
"""
import logging

from alembic import op


revision = "021_edu_resource"
down_revision = "020_edu_setting"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.021_edu_resource")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("021_edu_resource: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
