"""Reserved alembic migration for edu business domain tables.

Domain: Edu Exam
Revision ID: 025_edu_exam
Revises: 024_edu_live
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_paper, edu_question, edu_question_option, edu_exam_record, edu_wrong_book, edu_exam_paper_question
"""
import logging

from alembic import op


revision = "025_edu_exam"
down_revision = "024_edu_live"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.025_edu_exam")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("025_edu_exam: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
