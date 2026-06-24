"""Reserved alembic migration for edu business domain tables.

Domain: Edu Pay
Revision ID: 029_edu_pay
Revises: 028_edu_behavior
Create Date: 2026-06-24 (Phase A reserved)

NOTE: This is a Phase A placeholder migration. It does NOT yet create any
tables. The actual table DDL is ported from edu Java MySQL schema during
Phase B, one domain per PR.

Tables reserved for this migration:
  edu_pay_order, edu_pay_refund, edu_pay_installment, edu_pay_installment_plan
"""
import logging

from alembic import op


revision = "029_edu_pay"
down_revision = "028_edu_behavior"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.029_edu_pay")


def upgrade() -> None:
    """Phase A placeholder: no schema changes yet."""
    logger.info("029_edu_pay: placeholder migration, no changes applied")
    pass


def downgrade() -> None:
    """Phase A placeholder: no schema changes to revert."""
    pass
