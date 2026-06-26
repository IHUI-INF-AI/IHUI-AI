"""add del_flag to admin_* tables and developer fields

Revision ID: 053_add_admin_del_flag_and_developer_fields
Revises: 052_add_withdrawal_detail_fields
Create Date: 2026-06-26

修复 P1 加固后模型与 SQLite 本地表的 schema 漂移:

1) 7 个 admin_* 表缺少 del_flag 列 (2026-06-25 P1 加固新增, 但未在 SQLite 同步):
   - admin_menu, admin_dict_type, admin_dict_data, admin_config,
     admin_notice, admin_post, admin_job

   现象: GET /api/v1/system/dict/type/list 等端点 SELECT * 时
        因 del_flag 列不存在抛 OperationalError → 503 数据库连接失败.

2) zhs_agent_developer 缺少 8 列 (模型已扩展, 表未同步):
   - uuid, user_name, creator_id, creator_name, bug_time,
     type, count, expiration_date

   现象: GET /api/v1/agents/developer/list SELECT * 时
        因列缺失抛 OperationalError → 503.

迁移幂等: 用 inspect 检查列是否存在, 跳过已存在列;
        COMMENT 仅 PostgreSQL 执行 (SQLite 不支持).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "053_add_admin_del_flag_and_developer_fields"
down_revision = "052_add_withdrawal_detail_fields"
branch_labels = None
depends_on = None


# (表名, [(列名, 类型, 注释), ...])
ADMIN_TABLES_DEL_FLAG = [
    ("admin_menu", "菜单删除标志 (0存在 2删除)"),
    ("admin_dict_type", "字典类型删除标志 (0存在 2删除)"),
    ("admin_dict_data", "字典数据删除标志 (0存在 2删除)"),
    ("admin_config", "参数配置删除标志 (0存在 2删除)"),
    ("admin_notice", "通知公告删除标志 (0存在 2删除)"),
    ("admin_post", "岗位删除标志 (0存在 2删除)"),
    ("admin_job", "定时任务删除标志 (0存在 2删除)"),
]

DEVELOPER_TABLE = "zhs_agent_developer"
DEVELOPER_NEW_COLUMNS = [
    ("uuid", sa.String(length=64), "开发者唯一标识 UUID"),
    ("user_name", sa.String(length=100), "用户名"),
    ("creator_id", sa.BigInteger(), "创建者用户 ID"),
    ("creator_name", sa.String(length=100), "创建者用户名"),
    ("bug_time", sa.DateTime(), "购买时间 (历史字段名 bug_time, 语义为 buy_time)"),
    ("type", sa.String(length=20), "开发者类型 (如 month/year 等)"),
    ("count", sa.Integer(), "数量 (如购买月数)"),
    ("expiration_date", sa.DateTime(), "到期时间"),
]


def _add_column_if_missing(table: str, col_name: str, col_type, col_comment: str) -> bool:
    """幂等添加列. 返回是否实际添加."""
    bind = op.get_bind()
    inspector = inspect(bind)
    if table not in inspector.get_table_names():
        return False
    existing_cols = [c["name"] for c in inspector.get_columns(table)]
    if col_name in existing_cols:
        return False
    op.add_column(
        table,
        sa.Column(col_name, col_type, nullable=True, comment=col_comment),
    )
    return True


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # 1) admin_* 表补 del_flag
    for table, comment in ADMIN_TABLES_DEL_FLAG:
        added = _add_column_if_missing(table, "del_flag", sa.String(length=1), comment)
        if added and dialect != "sqlite":
            try:
                op.execute(
                    f"COMMENT ON COLUMN {table}.del_flag IS '{comment}'"
                )
            except Exception as e:
                print(f"[053] COMMENT on {table}.del_flag skipped: {e}")

    # 2) zhs_agent_developer 补 8 列
    for col_name, col_type, col_comment in DEVELOPER_NEW_COLUMNS:
        added = _add_column_if_missing(DEVELOPER_TABLE, col_name, col_type, col_comment)
        if added and dialect != "sqlite":
            try:
                op.execute(
                    f"COMMENT ON COLUMN {DEVELOPER_TABLE}.{col_name} IS '{col_comment}'"
                )
            except Exception as e:
                print(f"[053] COMMENT on {DEVELOPER_TABLE}.{col_name} skipped: {e}")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # 2) 先删 developer 列
    if DEVELOPER_TABLE in inspector.get_table_names():
        existing_cols = [c["name"] for c in inspector.get_columns(DEVELOPER_TABLE)]
        for col_name, _, _ in reversed(DEVELOPER_NEW_COLUMNS):
            if col_name in existing_cols:
                op.drop_column(DEVELOPER_TABLE, col_name)

    # 1) 再删 admin_* 的 del_flag
    for table, _ in ADMIN_TABLES_DEL_FLAG:
        if table not in inspector.get_table_names():
            continue
        existing_cols = [c["name"] for c in inspector.get_columns(table)]
        if "del_flag" in existing_cols:
            op.drop_column(table, "del_flag")
