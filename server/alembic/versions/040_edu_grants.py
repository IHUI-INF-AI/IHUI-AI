"""Reserved alembic migration for edu business domain tables.

Domain: Edu Grants
Revision ID: 040_edu_grants
Revises: 039_edu_seed_data
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  (row-level security policies for multi-tenant)
"""
import logging

from alembic import op


revision = "040_edu_grants"
down_revision = "039_edu_seed_data"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.040_edu_grants")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("040_edu_grants: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
