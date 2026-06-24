"""Reserved alembic migration for edu business domain tables.

Domain: Edu Auth
Revision ID: 017_edu_auth
Revises: 016_add_refund_tables
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_auth_user, edu_auth_role, edu_auth_permission, edu_auth_sso_key, edu_auth_third_party
"""
import logging

from alembic import op


revision = "017_edu_auth"
down_revision = "016_add_refund_tables"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.017_edu_auth")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("017_edu_auth: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
