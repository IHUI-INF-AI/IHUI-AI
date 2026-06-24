"""Reserved alembic migration for edu business domain tables.

Domain: Edu Learn
Revision ID: 023_edu_learn
Revises: 022_edu_content
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_course, edu_course_chapter, edu_course_section, edu_learn_record, edu_homework, edu_certificate, edu_learn_map
"""
import logging

from alembic import op


revision = "023_edu_learn"
down_revision = "022_edu_content"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.023_edu_learn")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("023_edu_learn: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
