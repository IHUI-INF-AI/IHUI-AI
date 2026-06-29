"""create oauth_scope_meta table

Revision ID: 027_add_oauth_scope_meta
Revises: 026_add_oauth_app_icon
Create Date: 2026-06-28

Round 29-D 新增 OAuth scope 元数据中心表:
- scope: 唯一 scope 标识符 (如 "read:profile")
- name: scope 中文名 (展示用)
- description: scope 详细描述 (授权页展示)
- icon: scope 图标 URL (可空)
- category: scope 分类 (可空, 用于分组)
- is_active: 是否启用
- sort_order: 排序权重 (asc)

用途: 取代前端硬编码的 scope 描述表, admin 后台可配置.
OAuthAuthorize 授权确认页动态读取展示.

幂等设计: 表用 _has_table 检查, 可重复执行不报错.
预置数据: 6 条常见 scope 元数据 (read:profile/write:profile/read:orders/
          write:orders/read:wallet/write:wallet), 仅在表新建时插入.
"""
import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "027_add_oauth_scope_meta"
down_revision = "026_add_oauth_app_icon"
branch_labels = None
depends_on = None


def _has_table(bind, table):
    """幂等检查: 表是否存在."""
    try:
        insp = inspect(bind)
        return table in insp.get_table_names()
    except Exception:
        return False


def _has_scope(bind, scope_value):
    """幂等检查: scope 标识符是否已存在 (避免重复 seed)."""
    try:
        result = bind.execute(
            sa.text("SELECT COUNT(*) FROM oauth_scope_meta WHERE scope = :s"),
            {"s": scope_value},
        )
        return int(result.scalar() or 0) > 0
    except Exception:
        return False


# 预置 scope 元数据 (与前端原硬编码 scopeDescriptions 对齐, 平滑迁移)
_SEED_SCOPES = [
    {
        "scope": "read:profile",
        "name": "读取资料",
        "description": "读取您的资料 (昵称/头像/简介)",
        "category": "profile",
        "sort_order": 10,
    },
    {
        "scope": "write:profile",
        "name": "修改资料",
        "description": "修改您的资料",
        "category": "profile",
        "sort_order": 20,
    },
    {
        "scope": "read:orders",
        "name": "查看订单",
        "description": "查看您的订单列表",
        "category": "orders",
        "sort_order": 30,
    },
    {
        "scope": "write:orders",
        "name": "管理订单",
        "description": "创建/修改您的订单",
        "category": "orders",
        "sort_order": 40,
    },
    {
        "scope": "read:wallet",
        "name": "查看钱包",
        "description": "查看您的钱包余额",
        "category": "wallet",
        "sort_order": 50,
    },
    {
        "scope": "write:wallet",
        "name": "操作钱包",
        "description": "操作您的钱包 (充值/消费)",
        "category": "wallet",
        "sort_order": 60,
    },
]


def upgrade() -> None:
    bind = op.get_bind()

    # 1. 创建 oauth_scope_meta 表 (幂等)
    if not _has_table(bind, "oauth_scope_meta"):
        op.create_table(
            "oauth_scope_meta",
            sa.Column(
                "id",
                sa.Integer().with_variant(sa.BigInteger(), "postgresql"),
                primary_key=True,
                autoincrement=True,
                comment="ID",
            ),
            sa.Column("scope", sa.String(length=100), nullable=False, comment="scope 标识符"),
            sa.Column("name", sa.String(length=100), nullable=False, comment="scope 中文名"),
            sa.Column("description", sa.Text(), nullable=True, comment="scope 详细描述"),
            sa.Column("icon", sa.String(length=512), nullable=True, comment="scope 图标 URL"),
            sa.Column("category", sa.String(length=50), nullable=True, comment="scope 分类"),
            sa.Column("is_active", sa.Integer(), nullable=True, comment="是否启用"),
            sa.Column("sort_order", sa.Integer(), nullable=True, comment="排序权重 (asc)"),
            sa.Column("created_at", sa.DateTime(), nullable=True, comment="创建时间"),
            sa.Column("updated_at", sa.DateTime(), nullable=True, comment="更新时间"),
            sa.UniqueConstraint("scope", name="uq_oauth_scope_meta_scope"),
        )

        # 2. 索引 (提升查询性能)
        op.create_index(
            "ix_oauth_scope_meta_category",
            "oauth_scope_meta",
            ["category"],
        )
        op.create_index(
            "ix_oauth_scope_meta_is_active",
            "oauth_scope_meta",
            ["is_active"],
        )
        op.create_index(
            "ix_oauth_scope_meta_sort_order",
            "oauth_scope_meta",
            ["sort_order"],
        )

    # 3. 预置数据 (幂等: 仅在 scope 不存在时插入)
    import datetime as _dt

    now = _dt.datetime.utcnow()
    for item in _SEED_SCOPES:
        if _has_scope(bind, item["scope"]):
            continue
        bind.execute(
            sa.text(
                "INSERT INTO oauth_scope_meta "
                "(scope, name, description, category, is_active, sort_order, created_at, updated_at) "
                "VALUES (:scope, :name, :description, :category, 1, :sort_order, :now, :now)"
            ),
            {
                "scope": item["scope"],
                "name": item["name"],
                "description": item["description"],
                "category": item["category"],
                "sort_order": item["sort_order"],
                "now": now,
            },
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _has_table(bind, "oauth_scope_meta"):
        op.drop_index("ix_oauth_scope_meta_sort_order", table_name="oauth_scope_meta")
        op.drop_index("ix_oauth_scope_meta_is_active", table_name="oauth_scope_meta")
        op.drop_index("ix_oauth_scope_meta_category", table_name="oauth_scope_meta")
        op.drop_table("oauth_scope_meta")
