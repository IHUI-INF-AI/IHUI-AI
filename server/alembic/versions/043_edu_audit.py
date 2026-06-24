"""Reserved alembic migration for edu business domain tables.

Domain: Edu Audit
Revision ID: 043_edu_audit
Revises: 042_edu_views
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  (audit triggers on critical tables)
"""
import logging

from alembic import op


revision = "043_edu_audit"
down_revision = "042_edu_views"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.043_edu_audit")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("043_edu_audit: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
