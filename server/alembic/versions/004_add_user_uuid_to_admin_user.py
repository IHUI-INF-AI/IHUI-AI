"""add user_uuid to sys_user

Revision ID: 004_add_user_uuid
Revises: 003_add_indexes
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "004_add_user_uuid"
down_revision = "003_add_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add user_uuid column to sys_user table for mapping to users.uuid."""
    try:
        # Add user_uuid column (nullable for existing records)
        op.add_column(
            "sys_user",
            sa.Column("user_uuid", sa.String(36), nullable=True, comment="关联 users.uuid"),
        )
    except Exception:
        pass
    try:
        op.create_unique_constraint("uq_sys_user_uuid", "sys_user", ["user_uuid"])
    except Exception:
        pass
    try:
        op.create_index("idx_sys_user_uuid", "sys_user", ["user_uuid"])
    except Exception:
        pass


def downgrade() -> None:
    """Remove user_uuid column from sys_user table."""
    try:
        op.drop_index("idx_sys_user_uuid", table_name="sys_user")
    except Exception:
        pass
    try:
        op.drop_constraint("uq_sys_user_uuid", "sys_user", type_="unique")
    except Exception:
        pass
    try:
        op.drop_column("sys_user", "user_uuid")
    except Exception:
        pass
