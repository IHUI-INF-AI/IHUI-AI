"""add UNIQUE constraint on admin_user.phone and admin_user.email

Revision ID: 029_add_unique_admin_user_phone_email
Revises: 028_add_oauth_app_owner
Create Date: 2026-07-06

背景 (2026-07-06 立):
  最高管理员账号 admin 同时支持 user_name / phone=18643389808 / email=502319984@qq.com
  三种方式登录. login_by_password 的 sys_user 表查询是 OR 一次性查
  (user_name / phonenumber / email 任一匹配), 如果 phone/email 不加唯一约束, 多个 user
  可注册同一手机号或邮箱, login_by_password 会命中第一个匹配的 user, admin 登录时可能
  走错 user (例如另一个普通用户也用 18643389808 注册, 登录后拿到的不是最高管理员).

  修复:
    1. admin_models.py:AdminUser 给 email / phonenumber (DB 列 phone) 加 unique=True
    2. 本迁移: 在已存在的 admin_user 表上用 CREATE UNIQUE INDEX 补齐唯一约束
       (SQLite 和 PostgreSQL 都支持, 幂等: 索引已存在时跳过)
    3. 迁移前先检查重复数据, 有重复则 abort 失败 (需要人工先清理)

兼容性:
  - NULL 允许多个 (PG/SQLite UNIQUE 语义一致)
  - 空字符串 (NULL != '') 在不同 user 上重复会冲突, 视为业务禁止
    (RuoYi 设计: 普通用户也应填有效手机/邮箱)
"""
import sqlalchemy as sa
from sqlalchemy import inspect, text

from alembic import op

revision = "029_add_unique_admin_user_phone_email"
down_revision = "028_add_oauth_app_owner"
branch_labels = None
depends_on = None


def _has_table(bind, table: str) -> bool:
    try:
        insp = inspect(bind)
        return table in insp.get_table_names()
    except Exception:
        return False


def _has_index(bind, table: str, index_name: str) -> bool:
    try:
        insp = inspect(bind)
        if table not in insp.get_table_names():
            return False
        return index_name in {i["name"] for i in insp.get_indexes(table)}
    except Exception:
        return False


def _has_unique_index(bind, table: str, column: str) -> bool:
    """检查列上是否已存在 UNIQUE INDEX (兼容不同数据库的索引命名风格)."""
    try:
        insp = inspect(bind)
        if table not in insp.get_table_names():
            return False
        for idx in insp.get_indexes(table):
            if idx.get("unique") and column in idx.get("column_names", []):
                return True
        # 也看 unique_constraints
        for uc in insp.get_unique_constraints(table):
            if column in uc.get("column_names", []):
                return True
        return False
    except Exception:
        return False


def _check_duplicates(bind, table: str, column: str) -> int:
    """返回该列上有多少个重复值 (>1 的视为冲突). 0 = 无冲突."""
    try:
        # PG 和 SQLite 都支持: GROUP BY + HAVING COUNT(*) > 1
        rows = bind.execute(
            text(
                f"SELECT {column}, COUNT(*) AS cnt FROM {table} "
                f"WHERE {column} IS NOT NULL AND {column} != '' "
                f"GROUP BY {column} HAVING COUNT(*) > 1"
            )
        ).fetchall()
        return len(rows)
    except Exception:
        return 0


def upgrade() -> None:
    bind = op.get_bind()

    if not _has_table(bind, "admin_user"):
        print(f"[029] admin_user 表不存在, 跳过")
        return

    # 1. 检查 phone (DB 列名) 是否已有 UNIQUE INDEX
    if not _has_unique_index(bind, "admin_user", "phone"):
        # 先查重复, 有重复则 abort
        dupes = _check_duplicates(bind, "admin_user", "phone")
        if dupes > 0:
            raise RuntimeError(
                f"[029] admin_user.phone 存在 {dupes} 个重复值, "
                f"无法添加 UNIQUE 约束. 请先人工清理: "
                f"SELECT phone, COUNT(*) FROM admin_user "
                f"WHERE phone IS NOT NULL AND phone != '' "
                f"GROUP BY phone HAVING COUNT(*) > 1"
            )
        op.create_index(
            "uq_admin_user_phone",
            "admin_user",
            ["phone"],
            unique=True,
        )
        print(f"[029] + UNIQUE INDEX uq_admin_user_phone")
    else:
        print(f"[029] - uq_admin_user_phone 已存在, 跳过")

    # 2. 检查 email 是否已有 UNIQUE INDEX
    if not _has_unique_index(bind, "admin_user", "email"):
        dupes = _check_duplicates(bind, "admin_user", "email")
        if dupes > 0:
            raise RuntimeError(
                f"[029] admin_user.email 存在 {dupes} 个重复值, "
                f"无法添加 UNIQUE 约束. 请先人工清理: "
                f"SELECT email, COUNT(*) FROM admin_user "
                f"WHERE email IS NOT NULL AND email != '' "
                f"GROUP BY email HAVING COUNT(*) > 1"
            )
        op.create_index(
            "uq_admin_user_email",
            "admin_user",
            ["email"],
            unique=True,
        )
        print(f"[029] + UNIQUE INDEX uq_admin_user_email")
    else:
        print(f"[029] - uq_admin_user_email 已存在, 跳过")


def downgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, "admin_user"):
        return
    if _has_index(bind, "admin_user", "uq_admin_user_phone"):
        op.drop_index("uq_admin_user_phone", table_name="admin_user")
    if _has_index(bind, "admin_user", "uq_admin_user_email"):
        op.drop_index("uq_admin_user_email", table_name="admin_user")
