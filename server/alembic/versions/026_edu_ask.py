"""Reserved alembic migration for edu business domain tables.

Domain: Edu Ask
Revision ID: 026_edu_ask
Revises: 025_edu_exam
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_ask_question, edu_ask_answer, edu_ask_comment, edu_ask_adoption
"""
import logging

from alembic import op


revision = "026_edu_ask"
down_revision = "025_edu_exam"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.026_edu_ask")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("026_edu_ask: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
