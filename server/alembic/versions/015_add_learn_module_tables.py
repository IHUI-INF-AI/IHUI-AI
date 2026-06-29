"""add learn module tables (迁移自 ihui-ai-edu-learn-service, 18 张表)

Revision ID: 015_add_learn_module_tables
Revises: 014_rename_sys_indexes
Create Date: 2026-06-28

涵盖: 课程分类/课程/章节/小节/专题/学习地图/作业/学习记录/报名 等完整学习闭环.
来源: H:\\历史项目存档\\ljd-交接文件\\service_2\\init_database.sql learn_* 表 DDL.
"""
import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "015_add_learn_module_tables"
down_revision = "014_rename_sys_indexes"
branch_labels = None
depends_on = None


def _bigint_pk():
    """PostgreSQL BIGINT 主键, SQLite 用 INTEGER 走 rowid."""
    return sa.Integer().with_variant(sa.BigInteger(), "postgresql")


def upgrade() -> None:
    # 008_add_missing_tables 的 Base.metadata.create_all(checkfirst=True) 会按
    # 当前 metadata 预建 learn 表 (learn_models 已注册), 导致本迁移 op.create_table
    # 报 "already exists". 这里对已存在的表跳过建表与建索引, 兼容 SQLite 开发环境
    # 与全新 PostgreSQL 环境, 不影响已有生产环境 (008 早于 learn_models 落库时表不存在).
    _pre = set(inspect(op.get_bind()).get_table_names())

    def _ct(name, *cols, **kw):
        if name not in _pre:
            op.create_table(name, *cols, **kw)

    def _ci(name, table, cols, **kw):
        # 表若已预存在 (008 create_all 连同索引一起建), 跳过索引创建
        if table not in _pre:
            op.create_index(name, table, cols, **kw)

    # learn_category
    _ct(
        "learn_category",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("name", sa.String(50), nullable=False, comment="类目名称"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="1", comment="排列序号"),
        sa.Column("is_show", sa.Boolean, nullable=False, server_default=sa.text("true"), comment="是否显示"),
        sa.Column("is_show_index", sa.Boolean, nullable=False, server_default=sa.text("true"), comment="是否在首页显示"),
        sa.Column("level", sa.Integer, nullable=False, comment="目录等级"),
        sa.Column("image", sa.String(500), nullable=False, comment="分类图片"),
        sa.Column("company_id", sa.BigInteger, nullable=False, server_default="0", comment="公司id"),
        sa.Column("department_id", sa.BigInteger, nullable=False, server_default="0", comment="部门id"),
        sa.Column("create_user_id", sa.BigInteger, nullable=False, server_default="0", comment="创建用户id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_learn_cat_level", "learn_category", ["level"])
    _ci("idx_learn_cat_company", "learn_category", ["company_id"])

    # learn_category_relation
    _ct(
        "learn_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("child_category_id", sa.BigInteger, nullable=False, comment="子类目id"),
        sa.Column("father_category_id", sa.BigInteger, nullable=False, comment="父类目id"),
        sa.Column("direct_father_category_id", sa.BigInteger, nullable=False, comment="直属父类目id"),
        sa.Column("is_sub", sa.Boolean, nullable=False, server_default=sa.text("false"), comment="是否属于子类目"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # learn_lesson_category_relation
    _ct(
        "learn_lesson_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("category_id", sa.BigInteger, nullable=False, comment="目录id"),
        sa.Column("lesson_id", sa.BigInteger, nullable=False, comment="课程id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_llcr_category", "learn_lesson_category_relation", ["category_id"])
    _ci("idx_llcr_lesson", "learn_lesson_category_relation", ["lesson_id"])

    # learn_lesson
    _ct(
        "learn_lesson",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("name", sa.String(100), nullable=False, comment="课程名称"),
        sa.Column("code", sa.String(100), nullable=False, comment="编号"),
        sa.Column("start_time", sa.DateTime, nullable=False, comment="开始时间"),
        sa.Column("end_time", sa.DateTime, nullable=False, comment="结束时间"),
        sa.Column("image", sa.String(1000), nullable=False, comment="封面图片(海报)"),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft", comment="状态"),
        sa.Column("phrase", sa.String(255), nullable=False, server_default="", comment="短语介绍"),
        sa.Column("introduction", sa.String(3000), nullable=False, server_default="", comment="详情"),
        sa.Column("company_id", sa.BigInteger, nullable=True, comment="公司id"),
        sa.Column("department_id", sa.BigInteger, nullable=True, comment="部门id"),
        sa.Column("create_user_id", sa.BigInteger, nullable=True, comment="创建用户id"),
        sa.Column("price", sa.Numeric(14, 2), nullable=True, server_default="0", comment="价格"),
        sa.Column("original_price", sa.Numeric(14, 2), nullable=True, server_default="0", comment="原价"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_learn_lesson_status", "learn_lesson", ["status"])
    _ci("idx_learn_lesson_code", "learn_lesson", ["code"])

    # learn_lesson_chapter
    _ct(
        "learn_lesson_chapter",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("lesson_id", sa.BigInteger, nullable=True, comment="课程id"),
        sa.Column("title", sa.String(100), nullable=False, comment="章标题"),
        sa.Column("phrase", sa.String(255), nullable=False, server_default="", comment="介绍"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0", comment="排序"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_llc_lesson", "learn_lesson_chapter", ["lesson_id"])

    # learn_lesson_chapter_section
    _ct(
        "learn_lesson_chapter_section",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("lesson_chapter_id", sa.BigInteger, nullable=True, comment="课程章id"),
        sa.Column("title", sa.String(100), nullable=False, comment="章节标题"),
        sa.Column("url", sa.String(1000), nullable=False, comment="内容地址"),
        sa.Column("phrase", sa.String(255), nullable=False, server_default="", comment="介绍"),
        sa.Column("total_time", sa.BigInteger, nullable=False, server_default="0", comment="内容总时长(秒)"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0", comment="排序"),
        sa.Column("type", sa.String(20), nullable=False, server_default="upload", comment="内容类型(upload/link)"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_llcs_chapter", "learn_lesson_chapter_section", ["lesson_chapter_id"])

    # learn_topic
    _ct(
        "learn_topic",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("title", sa.String(100), nullable=False, comment="标题"),
        sa.Column("image", sa.String(1000), nullable=False, comment="封面图片(海报)"),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft", comment="状态"),
        sa.Column("description", sa.String(3000), nullable=False, server_default="", comment="详情"),
        sa.Column("company_id", sa.BigInteger, nullable=True, comment="公司id"),
        sa.Column("department_id", sa.BigInteger, nullable=True, comment="部门id"),
        sa.Column("create_user_id", sa.BigInteger, nullable=True, comment="创建用户id"),
        sa.Column("price", sa.Numeric(14, 2), nullable=True, server_default="0", comment="价格"),
        sa.Column("original_price", sa.Numeric(14, 2), nullable=True, server_default="0", comment="原价"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_learn_topic_status", "learn_topic", ["status"])

    # learn_topic_category
    _ct(
        "learn_topic_category",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("name", sa.String(50), nullable=False, comment="类目名称"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="1", comment="排列序号"),
        sa.Column("is_show", sa.Boolean, nullable=False, server_default=sa.text("true"), comment="是否显示"),
        sa.Column("is_show_index", sa.Boolean, nullable=False, server_default=sa.text("true"), comment="是否在首页显示"),
        sa.Column("level", sa.Integer, nullable=False, comment="目录等级"),
        sa.Column("image", sa.String(500), nullable=False, comment="分类图片"),
        sa.Column("company_id", sa.BigInteger, nullable=False, server_default="0", comment="公司id"),
        sa.Column("department_id", sa.BigInteger, nullable=False, server_default="0", comment="部门id"),
        sa.Column("create_user_id", sa.BigInteger, nullable=False, server_default="0", comment="创建用户id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # learn_topic_category_relation
    _ct(
        "learn_topic_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("child_category_id", sa.BigInteger, nullable=False, comment="子类目id"),
        sa.Column("father_category_id", sa.BigInteger, nullable=False, comment="父类目id"),
        sa.Column("direct_father_category_id", sa.BigInteger, nullable=False, comment="直属父类目id"),
        sa.Column("is_sub", sa.Boolean, nullable=False, server_default=sa.text("false"), comment="是否属于子类目"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # learn_topic_lesson
    _ct(
        "learn_topic_lesson",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("lesson_id", sa.BigInteger, nullable=False, comment="课程id"),
        sa.Column("topic_id", sa.BigInteger, nullable=False, comment="专题id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_ltl_topic", "learn_topic_lesson", ["topic_id"])
    _ci("idx_ltl_lesson", "learn_topic_lesson", ["lesson_id"])

    # learn_topic_topic_category_relation
    _ct(
        "learn_topic_topic_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("category_id", sa.BigInteger, nullable=False, comment="目录id"),
        sa.Column("topic_id", sa.BigInteger, nullable=False, comment="专题id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_ltcr_category", "learn_topic_topic_category_relation", ["category_id"])
    _ci("idx_ltcr_topic", "learn_topic_topic_category_relation", ["topic_id"])

    # learn_learn_map
    _ct(
        "learn_learn_map",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("title", sa.String(100), nullable=False, comment="标题"),
        sa.Column("image", sa.String(1000), nullable=False, comment="封面图片(海报)"),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft", comment="状态"),
        sa.Column("description", sa.String(3000), nullable=False, server_default="", comment="详情"),
        sa.Column("company_id", sa.BigInteger, nullable=True, comment="公司id"),
        sa.Column("department_id", sa.BigInteger, nullable=True, comment="部门id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_learn_map_status", "learn_learn_map", ["status"])

    # learn_learn_map_topic
    _ct(
        "learn_learn_map_topic",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("learn_map_id", sa.BigInteger, nullable=False, comment="学习地图id"),
        sa.Column("topic_id", sa.BigInteger, nullable=False, comment="专题id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_llmt_map", "learn_learn_map_topic", ["learn_map_id"])
    _ci("idx_llmt_topic", "learn_learn_map_topic", ["topic_id"])

    # learn_homework
    _ct(
        "learn_homework",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("lesson_id", sa.BigInteger, nullable=False, comment="课程id"),
        sa.Column("url", sa.String(3000), nullable=False, server_default="", comment="附件地址"),
        sa.Column("content", sa.Text, nullable=False, comment="作业内容"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_learn_hw_lesson", "learn_homework", ["lesson_id"])

    # learn_homework_record
    _ct(
        "learn_homework_record",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="会员id"),
        sa.Column("lesson_id", sa.BigInteger, nullable=False, comment="课程id"),
        sa.Column("url", sa.String(3000), nullable=False, comment="作业提交内容的地址"),
        sa.Column("status", sa.String(200), nullable=False, server_default="pending", comment="状态"),
        sa.Column("sign_up_id", sa.BigInteger, nullable=False, comment="报名id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_learn_hwr_member", "learn_homework_record", ["member_id"])
    _ci("idx_learn_hwr_lesson", "learn_homework_record", ["lesson_id"])
    _ci("idx_learn_hwr_signup", "learn_homework_record", ["sign_up_id"])

    # learn_record
    _ct(
        "learn_record",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="会员id"),
        sa.Column("lesson_id", sa.BigInteger, nullable=False, comment="课程id"),
        sa.Column("lesson_chapter_section_id", sa.BigInteger, nullable=False, comment="章节id"),
        sa.Column("sign_up_id", sa.BigInteger, nullable=False, comment="报名id"),
        sa.Column("learn_time", sa.BigInteger, nullable=False, server_default="0", comment="学习时长(秒)"),
        sa.Column("max_progress_time", sa.BigInteger, nullable=False, server_default="0", comment="最大的学习进度时间"),
        sa.Column("status", sa.String(200), nullable=False, server_default="progressing", comment="状态"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_learn_record_member", "learn_record", ["member_id"])
    _ci("idx_learn_record_lesson", "learn_record", ["lesson_id"])
    _ci("idx_learn_record_signup", "learn_record", ["sign_up_id"])

    # learn_record_log
    _ct(
        "learn_record_log",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="会员id"),
        sa.Column("lesson_id", sa.BigInteger, nullable=False, comment="课程id"),
        sa.Column("lesson_chapter_section_id", sa.BigInteger, nullable=False, comment="章节id"),
        sa.Column("sign_up_id", sa.BigInteger, nullable=False, comment="报名id"),
        sa.Column("learn_time", sa.BigInteger, nullable=False, server_default="0", comment="学习时长(秒)"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_learn_rlog_member", "learn_record_log", ["member_id"])
    _ci("idx_learn_rlog_lesson", "learn_record_log", ["lesson_id"])

    # learn_sign_up
    _ct(
        "learn_sign_up",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="会员id"),
        sa.Column("lesson_id", sa.BigInteger, nullable=False, comment="课程id"),
        sa.Column("status", sa.String(50), nullable=False, server_default="enrolled", comment="状态"),
        sa.Column("completed_time", sa.DateTime, nullable=True, comment="完成时间"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_learn_su_member", "learn_sign_up", ["member_id"])
    _ci("idx_learn_su_lesson", "learn_sign_up", ["lesson_id"])
    _ci("idx_learn_su_status", "learn_sign_up", ["status"])


def downgrade() -> None:
    for tbl in (
        "learn_sign_up",
        "learn_record_log",
        "learn_record",
        "learn_homework_record",
        "learn_homework",
        "learn_learn_map_topic",
        "learn_learn_map",
        "learn_topic_topic_category_relation",
        "learn_topic_lesson",
        "learn_topic_category_relation",
        "learn_topic_category",
        "learn_topic",
        "learn_lesson_chapter_section",
        "learn_lesson_chapter",
        "learn_lesson",
        "learn_lesson_category_relation",
        "learn_category_relation",
        "learn_category",
    ):
        op.drop_table(tbl)
