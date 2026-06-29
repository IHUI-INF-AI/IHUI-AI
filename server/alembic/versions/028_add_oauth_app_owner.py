"""add OAuthApp.owner_uuid column

Revision ID: 028_add_oauth_app_owner
Revises: 027_add_oauth_scope_meta
Create Date: 2026-06-28

Round 31-B 扩展 OAuth 应用多租户隔离:
1. oauth_apps 新增 owner_uuid VARCHAR(64) 列 (创建者 user_uuid, 可空)

向后兼容: 历史应用 owner_uuid 为 NULL, 视为 "无主" 应用, 任何登录用户可管理.
新增应用创建时自动写入 owner_uuid = 当前登录用户.

幂等设计: 列用 _has_column 检查, 可重复执行不报错.
"""
import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "028_add_oauth_app_owner"
down_revision = "027_add_oauth_scope_meta"
branch_labels = None
depends_on = None


def _has_column(bind, table, column):
    """幂等检查: 列是否已存在."""
    try:
        insp = inspect(bind)
        if table not in insp.get_table_names():
            return False
        return column in {c["name"] for c in insp.get_columns(table)}
    except Exception:
        return False


def _has_table(bind, table):
    """幂等检查: 表是否存在."""
    try:
        insp = inspect(bind)
        return table in insp.get_table_names()
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()

    # 1. oauth_apps 新增 owner_uuid VARCHAR(64) 列 + 索引
    if _has_table(bind, "oauth_apps") and not _has_column(
        bind, "oauth_apps", "owner_uuid"
    ):
        op.add_column(
            "oauth_apps",
            sa.Column(
                "owner_uuid",
                sa.String(length=64),
                nullable=True,
                comment="创建者 user_uuid",
            ),
        )
        # 索引加速 list 查询 (按 owner 过滤)
        op.create_index(
            "ix_oauth_apps_owner_uuid",
            "oauth_apps",
            ["owner_uuid"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _has_column(bind, "oauth_apps", "owner_uuid"):
        # 先删索引再删列
        try:
            op.drop_index("ix_oauth_apps_owner_uuid", table_name="oauth_apps")
        except Exception:
            pass
        op.drop_column("oauth_apps", "owner_uuid")
