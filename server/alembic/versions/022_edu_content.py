"""Reserved alembic migration for edu business domain tables.

Domain: Edu Content
Revision ID: 022_edu_content
Revises: 021_edu_resource
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_content_article, edu_content_topic, edu_content_tag, edu_content_comment
"""
import logging

from alembic import op


revision = "022_edu_content"
down_revision = "021_edu_resource"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.022_edu_content")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("022_edu_content: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
