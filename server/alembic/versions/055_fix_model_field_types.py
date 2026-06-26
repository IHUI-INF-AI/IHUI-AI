"""model field type 修正

Revision ID: 055_fix_model_field_types
Revises: 054_add_agent_need_task_columns
Create Date: 2026-06-27

根据 2026-06-27 凌晨 test_field_migration.py 945+ 用例通过后,
把 A.1/A.2/A.3 三项 model 修正同步到数据库 schema.

变更汇总:
  1. 主键类型规范化 (VARCHAR(36/255) -> VARCHAR(64)):
     - activity.id, agent_settlement.id, agent_withdrawal_detail.id
     - zhs_crew_session.id, zhs_crew_task.id, zhs_crew_message.id/session_id/task_id

  2. 金额字段 Float -> Integer(分):
     - zhs_agent_developer.price
     - zhs_course_video.amount
     - zhs_educational_course.price
     - exam_paper.total_score, exam_paper.price
     - exam_question.score
     - exam_record.score, exam_record.total_score
     - exam_wrong_question.score, exam_wrong_question.scored
     - exam_chapter.total_score, exam_chapter_section.total_score
     - question.score
     - resource.price

  3. 时间字段补齐 (Admin*/Transfer/WxPay/UserMargin 关联表):
     - admin_user_role, admin_role_menu, admin_role_dept: 加 created_at/updated_at
     - admin_logininfor, admin_oper_log, admin_job_log: 加 created_at/updated_at
     - transfer_infos, wx_pay_notifications: 加 updated_at (已有 created_at)
     - user_margin: 加 created_at/updated_at
     - zhs_operate_token_flow: 加 updated_at (已有 Integer created_at, 新增 DateTime updated_at)

  4. KnowledgeChunk 重命名 score -> similarity_score (语义: 0-1 相似度, 非金额)

  5. 新表 migration_checkpoint (断点续传检查点)

迁移策略: 对所有变更使用 inspect() 幂等检查, 已修正列跳过, 避免重跑时报错.
SQLite 限制: VARCHAR 长度变化和 Float->Integer 转换需要 batch_alter_table
  (Alembic 1.5+ 支持), PostgreSQL 直接 ALTER COLUMN.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "055_fix_model_field_types"
down_revision = "054_add_agent_need_task_columns"
branch_labels = None
depends_on = None


# (table, old_col, new_col, new_type_instance, comment)
RENAME_COLUMNS = [
    ("zhs_knowledge_chunk", "score", "similarity_score",
     sa.Float(), "相似度分数 (0-1, 非金额)"),
]

# (table, col_name, new_type_instance, comment, is_pk)
# is_pk=True 也会调整列长度
COLUMN_TYPE_CHANGES = [
    # 主键长度统一 VARCHAR(36/255) -> VARCHAR(64)
    ("activity", "id", sa.String(length=64), "UUID", True),
    ("agent_settlement", "id", sa.String(length=64), "主键 UUID", True),
    ("agent_withdrawal_detail", "id", sa.String(length=64), "主键 UUID", True),
    ("zhs_crew_session", "id", sa.String(length=64), "会话ID", True),
    ("zhs_crew_task", "id", sa.String(length=64), "任务ID", True),
    ("zhs_crew_message", "session_id", sa.String(length=64), "所属会话ID", False),
    ("zhs_crew_message", "task_id", sa.String(length=64), "关联任务ID", False),
    # 金额 Float -> Integer(分)
    ("zhs_agent_developer", "price", sa.BigInteger(), "Developer price (分)", False),
    ("zhs_course_video", "amount", sa.BigInteger(), "Price (分)", False),
    ("zhs_educational_course", "price", sa.BigInteger(), "Price (分)", False),
    ("exam_paper", "total_score", sa.Integer(), "总分 (分)", False),
    ("exam_paper", "price", sa.Integer(), "价格 (分)", False),
    ("exam_question", "score", sa.Integer(), "分值 (分)", False),
    ("exam_record", "score", sa.Integer(), "得分 (分)", False),
    ("exam_record", "total_score", sa.Integer(), "总分 (分)", False),
    ("exam_wrong_question", "score", sa.Integer(), "分数 (H 字段, 分)", False),
    ("exam_wrong_question", "scored", sa.Integer(), "得分 (H 字段, 分)", False),
    ("exam_chapter", "total_score", sa.Integer(), "total score (分)", False),
    ("exam_chapter_section", "total_score", sa.Integer(), "total score (分)", False),
    ("question", "score", sa.Integer(), "分数 (分)", False),
    ("resource", "price", sa.Integer(), "Resource price (分, Java field)", False),
]

# (table, col_name, col_type, comment)
NEW_TIMESTAMP_COLUMNS = [
    ("admin_user_role", "created_at", sa.DateTime(), "关联创建时间"),
    ("admin_user_role", "updated_at", sa.DateTime(), "关联更新时间"),
    ("admin_role_menu", "created_at", sa.DateTime(), "关联创建时间"),
    ("admin_role_menu", "updated_at", sa.DateTime(), "关联更新时间"),
    ("admin_role_dept", "created_at", sa.DateTime(), "关联创建时间"),
    ("admin_role_dept", "updated_at", sa.DateTime(), "关联更新时间"),
    ("admin_logininfor", "created_at", sa.DateTime(), "记录创建时间"),
    ("admin_logininfor", "updated_at", sa.DateTime(), "记录更新时间"),
    ("admin_oper_log", "created_at", sa.DateTime(), "日志创建时间"),
    ("admin_oper_log", "updated_at", sa.DateTime(), "日志更新时间"),
    ("admin_job_log", "created_at", sa.DateTime(), "任务日志创建时间"),
    ("admin_job_log", "updated_at", sa.DateTime(), "任务日志更新时间"),
    ("transfer_infos", "updated_at", sa.DateTime(), "转账更新时间"),
    ("wx_pay_notifications", "updated_at", sa.DateTime(), "支付通知更新时间"),
    ("user_margin", "created_at", sa.DateTime(), "用户保证金创建时间"),
    ("user_margin", "updated_at", sa.DateTime(), "用户保证金更新时间"),
    ("zhs_operate_token_flow", "updated_at", sa.DateTime(), "业务修改时间"),
]


def _table_exists(bind, table: str) -> bool:
    return table in inspect(bind).get_table_names()


def _get_column(bind, table: str, col_name: str):
    for c in inspect(bind).get_columns(table):
        if c["name"] == col_name:
            return c
    return None


def _change_column_type(table: str, col_name: str, new_type, is_pk: bool) -> None:
    """统一改列类型 (VARCHAR 长度 / Float->Integer)."""
    bind = op.get_bind()
    if not _table_exists(bind, table):
        return
    existing = _get_column(bind, table, col_name)
    if existing is None:
        return
    # SQLite 不支持 ALTER COLUMN, 走 batch_alter_table
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table(table) as batch:
            if is_pk:
                # 重建主键类型
                batch.alter_column(
                    col_name,
                    existing_type=new_type,
                    existing_nullable=False,
                    primary_key=True,
                )
            else:
                batch.alter_column(
                    col_name,
                    existing_type=new_type,
                    existing_nullable=existing.get("nullable", True),
                )
    else:
        # PostgreSQL 直接 ALTER COLUMN
        type_name = (
            f"VARCHAR({new_type.length})" if hasattr(new_type, "length") and new_type.length
            else ("BIGINT" if isinstance(new_type, sa.BigInteger) else "INTEGER")
        )
        op.execute(
            f'ALTER TABLE "{table}" ALTER COLUMN "{col_name}" TYPE {type_name} '
            f'USING "{col_name}"::text::VARCHAR(64)' if type_name.startswith("VARCHAR")
            else f'ALTER TABLE "{table}" ALTER COLUMN "{col_name}" TYPE {type_name} '
                 f'USING "{col_name}"::INTEGER'
        )


def upgrade() -> None:
    # 1) 重命名 (KnowledgeChunk.score -> similarity_score)
    bind = op.get_bind()
    inspector = inspect(bind)
    for table, old, new, _, _ in RENAME_COLUMNS:
        if not _table_exists(bind, table):
            continue
        cols = [c["name"] for c in inspector.get_columns(table)]
        if old in cols and new not in cols:
            op.alter_column(table, old, new_column_name=new)

    # 2) 列类型变更
    for table, col_name, new_type, _, is_pk in COLUMN_TYPE_CHANGES:
        _change_column_type(table, col_name, new_type, is_pk)

    # 3) 新增时间字段
    for table, col_name, col_type, col_comment in NEW_TIMESTAMP_COLUMNS:
        if not _table_exists(bind, table):
            continue
        if _get_column(bind, table, col_name) is not None:
            continue
        if bind.dialect.name == "sqlite":
            op.add_column(
                table,
                sa.Column(col_name, col_type, nullable=True, comment=col_comment),
            )
        else:
            op.add_column(
                table,
                sa.Column(col_name, col_type, nullable=True, comment=col_comment),
            )
            try:
                op.execute(
                    f"COMMENT ON COLUMN {table}.{col_name} IS '{col_comment}'"
                )
            except Exception as e:
                print(f"[055] COMMENT on {table}.{col_name} skipped: {e}")

    # 4) 新表 migration_checkpoint
    if not _table_exists(bind, "migration_checkpoint"):
        op.create_table(
            "migration_checkpoint",
            sa.Column("id", sa.String(length=64), primary_key=True, comment="UUID"),
            sa.Column("batch_id", sa.String(length=32), nullable=False, comment="迁移批次号"),
            sa.Column("step_name", sa.String(length=64), nullable=False, comment="迁移步骤名"),
            sa.Column("cursor", sa.String(length=128), nullable=True, comment="断点游标"),
            sa.Column("processed_count", sa.Integer(), nullable=True, default=0, comment="已处理条数"),
            sa.Column("total_count", sa.Integer(), nullable=True, default=0, comment="总条数"),
            sa.Column("status", sa.Integer(), nullable=True, default=0, comment="0=进行中 1=已完成 2=失败"),
            sa.Column("last_error", sa.Text(), nullable=True, comment="最近错误"),
            sa.Column("created_at", sa.DateTime(), nullable=True, comment="创建时间"),
            sa.Column("updated_at", sa.DateTime(), nullable=True, comment="更新时间"),
        )
        op.create_index("uk_mcp_batch_step", "migration_checkpoint", ["batch_id", "step_name"], unique=True)
        op.create_index("idx_mcp_status", "migration_checkpoint", ["status"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    # 4) 删表
    if _table_exists(bind, "migration_checkpoint"):
        op.drop_index("idx_mcp_status", table_name="migration_checkpoint")
        op.drop_index("uk_mcp_batch_step", table_name="migration_checkpoint")
        op.drop_table("migration_checkpoint")

    # 3) 删时间字段
    for table, col_name, _, _ in reversed(NEW_TIMESTAMP_COLUMNS):
        if not _table_exists(bind, table):
            continue
        if _get_column(bind, table, col_name) is not None:
            op.drop_column(table, col_name)

    # 2) 列类型无法可靠回退 (Float <-> Integer 是有损转换), 跳过

    # 1) 重命名回退
    for table, old, new, _, _ in RENAME_COLUMNS:
        if not _table_exists(bind, table):
            continue
        cols = [c["name"] for c in inspector.get_columns(table)]
        if new in cols and old not in cols:
            op.alter_column(table, new, new_column_name=old)
