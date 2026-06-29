"""add historical module tables (迁移自历史项目 9 个服务)

Revision ID: 016_add_historical_module_tables
Revises: 015_add_learn_module_tables
Create Date: 2026-06-28

涵盖: exam扩展(14) + live扩展(5) + circle扩展(5) + resource扩展(6) + message扩展(4) + 证书(2) + 签到(2) + 会员(3) + 资讯(2) + 发票(2) = 45 张表.
来源: H:\\历史项目存档\\ljd-交接文件\\service_2\\init_database.sql + ihui-ai-edu-order-service change.sql
"""
from alembic import op
import sqlalchemy as sa


revision = "016_add_historical_module_tables"
down_revision = "015_add_learn_module_tables"
branch_labels = None
depends_on = None


def _bigint_pk():
    """PostgreSQL BIGINT 主键, SQLite 用 INTEGER 走 rowid."""
    return sa.Integer().with_variant(sa.BigInteger(), "postgresql")


def upgrade() -> None:
    # 幂等建表: 008 通过 Base.metadata.create_all(checkfirst=True) 已创建所有 ORM 模型表,
    # 016 再用 op.create_table 重复创建会冲突 (table already exists), 所以加表存在性检查.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    _orig_create_table = op.create_table
    _orig_create_index = op.create_index

    def _ct(name, *columns, **kwargs):
        """create_table 幂等版: 表已存在则跳过."""
        if name in inspector.get_table_names():
            return
        _orig_create_table(name, *columns, **kwargs)

    def _ci(index_name, table_name, columns, **kwargs):
        """create_index 幂等版: 索引已存在则跳过."""
        if table_name in inspector.get_table_names():
            existing = {idx["name"] for idx in inspector.get_indexes(table_name)}
            if index_name in existing:
                return
        _orig_create_index(index_name, table_name, columns, **kwargs)

    # =====================================================================
    # exam 扩展 (14 张)
    # =====================================================================

    # exam_exam
    _ct(
        "exam_exam",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("name", sa.String(100), nullable=False, comment="名称"),
        sa.Column("code", sa.String(100), nullable=False, comment="编号"),
        sa.Column("start_time", sa.DateTime, nullable=False, comment="开始时间"),
        sa.Column("end_time", sa.DateTime, nullable=False, comment="结束时间"),
        sa.Column("image", sa.String(1000), nullable=False, comment="封面图片(海报)"),
        sa.Column("status", sa.String(50), nullable=False, comment="状态"),
        sa.Column("phrase", sa.String(255), nullable=False, server_default="", comment="短语介绍"),
        sa.Column("introduction", sa.String(3000), nullable=False, server_default="", comment="详情"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_exam_exam_status", "exam_exam", ["status"])

    # exam_exam_category_relation
    _ct(
        "exam_exam_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("category_id", sa.BigInteger, nullable=False, comment="目录id"),
        sa.Column("exam_id", sa.BigInteger, nullable=False, comment="考试id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_eecr_category", "exam_exam_category_relation", ["category_id"])
    _ci("idx_eecr_exam", "exam_exam_category_relation", ["exam_id"])

    # exam_exam_chapter
    _ct(
        "exam_exam_chapter",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("exam_id", sa.BigInteger, nullable=True, comment="考试id"),
        sa.Column("title", sa.String(100), nullable=False, comment="章标题"),
        sa.Column("phrase", sa.String(255), nullable=False, server_default="", comment="介绍"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_eec_exam", "exam_exam_chapter", ["exam_id"])

    # exam_exam_chapter_section
    _ct(
        "exam_exam_chapter_section",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("exam_chapter_id", sa.BigInteger, nullable=True, comment="考试章id"),
        sa.Column("title", sa.String(100), nullable=False, comment="章节标题"),
        sa.Column("paper_id", sa.BigInteger, nullable=False, comment="试卷id"),
        sa.Column("phrase", sa.String(255), nullable=False, server_default="", comment="介绍"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_eecs_chapter", "exam_exam_chapter_section", ["exam_chapter_id"])
    _ci("idx_eecs_paper", "exam_exam_chapter_section", ["paper_id"])

    # exam_category_relation
    _ct(
        "exam_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("child_category_id", sa.BigInteger, nullable=False, comment="子分类id"),
        sa.Column("father_category_id", sa.BigInteger, nullable=False, comment="父分类id"),
        sa.Column("direct_father_category_id", sa.BigInteger, nullable=False, comment="直属父分类id"),
        sa.Column("is_sub", sa.Boolean, nullable=False, comment="是否属于子分类"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # exam_paper_category
    _ct(
        "exam_paper_category",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("name", sa.String(50), nullable=False, comment="分类名称"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="1", comment="排列序号"),
        sa.Column("is_show", sa.Boolean, nullable=False, server_default=sa.text("true"), comment="是否显示"),
        sa.Column("is_show_index", sa.Boolean, nullable=False, server_default=sa.text("true"), comment="是否在首页显示"),
        sa.Column("level", sa.Integer, nullable=False, comment="目录等级"),
        sa.Column("image", sa.String(500), nullable=False, comment="分类图片"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # exam_paper_category_relation
    _ct(
        "exam_paper_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("child_category_id", sa.BigInteger, nullable=False, comment="子分类id"),
        sa.Column("father_category_id", sa.BigInteger, nullable=False, comment="父分类id"),
        sa.Column("direct_father_category_id", sa.BigInteger, nullable=False, comment="直属父分类id"),
        sa.Column("is_sub", sa.Boolean, nullable=False, comment="是否属于子分类"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # exam_paper_paper_category_relation
    _ct(
        "exam_paper_paper_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("category_id", sa.BigInteger, nullable=False, comment="目录id"),
        sa.Column("paper_id", sa.BigInteger, nullable=False, comment="试卷id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_eppcr_category", "exam_paper_paper_category_relation", ["category_id"])
    _ci("idx_eppcr_paper", "exam_paper_paper_category_relation", ["paper_id"])

    # exam_paper_question
    _ct(
        "exam_paper_question",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("question_id", sa.BigInteger, nullable=False, comment="题目id"),
        sa.Column("paper_id", sa.BigInteger, nullable=False, comment="试卷id"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="1", comment="排列序号"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_epq_paper", "exam_paper_question", ["paper_id"])
    _ci("idx_epq_question", "exam_paper_question", ["question_id"])

    # exam_paper_question_rule
    _ct(
        "exam_paper_question_rule",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("paper_id", sa.BigInteger, nullable=False, comment="试卷id"),
        sa.Column("rule_json", sa.JSON, nullable=False, comment="抽题规则"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_epqr_paper", "exam_paper_question_rule", ["paper_id"])

    # exam_question_category
    _ct(
        "exam_question_category",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("name", sa.String(50), nullable=False, comment="分类名称"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="1", comment="排列序号"),
        sa.Column("is_show", sa.Boolean, nullable=False, server_default=sa.text("true"), comment="是否显示"),
        sa.Column("is_show_index", sa.Boolean, nullable=False, server_default=sa.text("true"), comment="是否在首页显示"),
        sa.Column("level", sa.Integer, nullable=False, comment="目录等级"),
        sa.Column("image", sa.String(500), nullable=False, comment="分类图片"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # exam_question_category_relation
    _ct(
        "exam_question_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("child_category_id", sa.BigInteger, nullable=False, comment="子分类id"),
        sa.Column("father_category_id", sa.BigInteger, nullable=False, comment="父分类id"),
        sa.Column("direct_father_category_id", sa.BigInteger, nullable=False, comment="直属父分类id"),
        sa.Column("is_sub", sa.Boolean, nullable=False, comment="是否属于子分类"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # exam_question_and_category_relation
    _ct(
        "exam_question_and_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("category_id", sa.BigInteger, nullable=False, comment="目录id"),
        sa.Column("question_id", sa.BigInteger, nullable=False, comment="题目id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_eqacr_category", "exam_question_and_category_relation", ["category_id"])
    _ci("idx_eqacr_question", "exam_question_and_category_relation", ["question_id"])

    # exam_sign_up
    _ct(
        "exam_sign_up",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="会员id"),
        sa.Column("exam_id", sa.BigInteger, nullable=False, comment="考试id"),
        sa.Column("status", sa.String(50), nullable=False, comment="状态"),
        sa.Column("completed_time", sa.DateTime, nullable=True, comment="完成时间"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_esu_member", "exam_sign_up", ["member_id"])
    _ci("idx_esu_exam", "exam_sign_up", ["exam_id"])
    _ci("idx_esu_status", "exam_sign_up", ["status"])

    # =====================================================================
    # live 扩展 (5 张)
    # =====================================================================

    # live_category
    _ct(
        "live_category",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("name", sa.String(50), nullable=False, comment="分类名称"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="1", comment="排列序号"),
        sa.Column("is_show", sa.Boolean, nullable=False, server_default=sa.text("true"), comment="是否显示"),
        sa.Column("is_show_index", sa.Boolean, nullable=False, server_default=sa.text("true"), comment="是否在首页显示"),
        sa.Column("level", sa.Integer, nullable=False, comment="目录等级"),
        sa.Column("image", sa.String(500), nullable=False, comment="分类图片"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # live_category_relation
    _ct(
        "live_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("child_category_id", sa.BigInteger, nullable=False, comment="子分类id"),
        sa.Column("father_category_id", sa.BigInteger, nullable=False, comment="父分类id"),
        sa.Column("direct_father_category_id", sa.BigInteger, nullable=False, comment="直属父分类id"),
        sa.Column("is_sub", sa.Boolean, nullable=False, comment="是否属于子分类"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # live_channel_category_relation
    _ct(
        "live_channel_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("category_id", sa.BigInteger, nullable=False, comment="目录id"),
        sa.Column("channel_id", sa.BigInteger, nullable=False, comment="频道id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_lccr_category", "live_channel_category_relation", ["category_id"])
    _ci("idx_lccr_channel", "live_channel_category_relation", ["channel_id"])

    # live_channel_lecturer
    _ct(
        "live_channel_lecturer",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("lecturer_id", sa.BigInteger, nullable=False, comment="讲师id"),
        sa.Column("channel_id", sa.BigInteger, nullable=False, comment="频道id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_lcl_lecturer", "live_channel_lecturer", ["lecturer_id"])
    _ci("idx_lcl_channel", "live_channel_lecturer", ["channel_id"])

    # live_tencent_cloud_live_stream
    _ct(
        "live_tencent_cloud_live_stream",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("channel_id", sa.BigInteger, nullable=False, comment="频道id"),
        sa.Column("stream_name", sa.String(200), nullable=False, comment="流名称"),
        sa.Column("app_name", sa.String(200), nullable=False, server_default="live", comment="应用名称"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_ltcls_channel", "live_tencent_cloud_live_stream", ["channel_id"])

    # =====================================================================
    # circle 扩展 (5 张)
    # =====================================================================

    # circle_category_relation
    _ct(
        "circle_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("child_category_id", sa.BigInteger, nullable=False, comment="子分类id"),
        sa.Column("father_category_id", sa.BigInteger, nullable=False, comment="父分类id"),
        sa.Column("direct_father_category_id", sa.BigInteger, nullable=False, comment="直属父分类id"),
        sa.Column("is_sub", sa.Boolean, nullable=False, comment="是否属于子分类"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_ccr_father", "circle_category_relation", ["father_category_id"])
    _ci("idx_ccr_child", "circle_category_relation", ["child_category_id"])

    # circle_circle_category_relation
    _ct(
        "circle_circle_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("category_id", sa.BigInteger, nullable=False, comment="目录id"),
        sa.Column("circle_id", sa.BigInteger, nullable=False, comment="圈子id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_cccr_category", "circle_circle_category_relation", ["category_id"])
    _ci("idx_cccr_circle", "circle_circle_category_relation", ["circle_id"])

    # circle_circle
    _ct(
        "circle_circle",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("name", sa.String(100), nullable=False, comment="名称"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="会员id"),
        sa.Column("image", sa.String(3000), nullable=True, comment="图片"),
        sa.Column("status", sa.String(100), nullable=False, comment="状态"),
        sa.Column("introduction", sa.String(200), nullable=False, server_default="", comment="描述"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_cc_member", "circle_circle", ["member_id"])

    # circle_circle_member
    _ct(
        "circle_circle_member",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="会员id"),
        sa.Column("circle_id", sa.BigInteger, nullable=False, comment="圈子id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_ccm_member", "circle_circle_member", ["member_id"])
    _ci("idx_ccm_circle", "circle_circle_member", ["circle_id"])

    # circle_dynamic
    _ct(
        "circle_dynamic",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("content", sa.Text, nullable=False, comment="内容"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="会员id"),
        sa.Column("image", sa.String(3000), nullable=True, server_default="", comment="图片，多个逗号隔开"),
        sa.Column("status", sa.String(100), nullable=False, comment="状态"),
        sa.Column("circle_id", sa.BigInteger, nullable=False, comment="圈子id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_cd_circle", "circle_dynamic", ["circle_id"])
    _ci("idx_cd_member", "circle_dynamic", ["member_id"])

    # =====================================================================
    # resource 扩展 (6 张)
    # =====================================================================

    # resource_category
    _ct(
        "resource_category",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("name", sa.String(50), nullable=False, comment="类目名称"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="1", comment="排列序号，表示同级类目的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数"),
        sa.Column("is_show", sa.Boolean, nullable=False, server_default=sa.text("true"), comment="是否显示"),
        sa.Column("is_show_index", sa.Boolean, nullable=False, server_default=sa.text("true"), comment="是否在首页显示"),
        sa.Column("level", sa.Integer, nullable=False, comment="目录等级"),
        sa.Column("image", sa.String(500), nullable=False, comment="分类图片"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_res_cat_level", "resource_category", ["level"])
    _ci("idx_res_cat_show", "resource_category", ["is_show"])

    # resource_category_relation
    _ct(
        "resource_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("child_category_id", sa.BigInteger, nullable=False, comment="子类目id"),
        sa.Column("father_category_id", sa.BigInteger, nullable=False, comment="父类目id"),
        sa.Column("direct_father_category_id", sa.BigInteger, nullable=False, comment="直属父类目id"),
        sa.Column("is_sub", sa.Boolean, nullable=False, comment="是否属于子类目"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_rescr_father", "resource_category_relation", ["father_category_id"])
    _ci("idx_rescr_child", "resource_category_relation", ["child_category_id"])

    # resource_resource
    _ct(
        "resource_resource",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("title", sa.String(100), nullable=False, comment="标题"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="用户id"),
        sa.Column("introduction", sa.Text, nullable=False, comment="内容"),
        sa.Column("image", sa.String(3000), nullable=True, comment="海报图片"),
        sa.Column("url", sa.String(3000), nullable=True, comment="标签"),
        sa.Column("status", sa.String(100), nullable=False, comment="状态"),
        sa.Column("type", sa.String(200), nullable=False, comment="类型"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_rr_member", "resource_resource", ["member_id"])
    _ci("idx_rr_status", "resource_resource", ["status"])

    # resource_resource_category_relation
    _ct(
        "resource_resource_category_relation",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("category_id", sa.BigInteger, nullable=False, comment="目录id"),
        sa.Column("resource_id", sa.BigInteger, nullable=False, comment="资源id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_rrcr_category", "resource_resource_category_relation", ["category_id"])
    _ci("idx_rrcr_resource", "resource_resource_category_relation", ["resource_id"])

    # resource_resource_download
    _ct(
        "resource_resource_download",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="会员id"),
        sa.Column("resource_id", sa.BigInteger, nullable=False, comment="资源id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_rrd_member", "resource_resource_download", ["member_id"])
    _ci("idx_rrd_resource", "resource_resource_download", ["resource_id"])

    # resource_resource_search_record
    _ct(
        "resource_resource_search_record",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="会员id"),
        sa.Column("search_condition", sa.Text, nullable=False, comment="搜索条件"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_rrsr_member", "resource_resource_search_record", ["member_id"])

    # =====================================================================
    # message 扩展 (4 张)
    # =====================================================================

    # message_private_letter
    _ct(
        "message_private_letter",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("sender_id", sa.String(100), nullable=False, comment="发送者id"),
        sa.Column("receiver_id", sa.String(100), nullable=False, comment="接受者id"),
        sa.Column("content", sa.Text, nullable=False, comment="内容"),
        sa.Column("read_time", sa.DateTime, nullable=True, comment="读信息时间"),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default=sa.text("false"), comment="是否已读"),
        sa.Column("status", sa.String(30), nullable=False, comment="状态"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_mpl_sender", "message_private_letter", ["sender_id"])
    _ci("idx_mpl_receiver", "message_private_letter", ["receiver_id"])

    # message_system_notice
    _ct(
        "message_system_notice",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("content", sa.Text, nullable=False, comment="通知内容"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # message_notice
    _ct(
        "message_notice",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("topic_id", sa.BigInteger, nullable=False, comment="主题id"),
        sa.Column("topic_type", sa.String(100), nullable=False, comment="主题类型"),
        sa.Column("to_member_id", sa.BigInteger, nullable=False, comment="主题会员"),
        sa.Column("status", sa.String(100), nullable=True, comment="状态"),
        sa.Column("type", sa.String(100), nullable=False, comment="类型"),
        sa.Column("browsed", sa.Boolean, nullable=False, server_default=sa.text("false"), comment="是否已读"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="会员"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_mn_member", "message_notice", ["member_id"])
    _ci("idx_mn_to_member", "message_notice", ["to_member_id"])

    # message_announcement_read_record
    _ct(
        "message_announcement_read_record",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("announcement_id", sa.BigInteger, nullable=False, comment="公告id"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="会员id"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_marr_announcement", "message_announcement_read_record", ["announcement_id"])
    _ci("idx_marr_member", "message_announcement_read_record", ["member_id"])

    # =====================================================================
    # 证书 (2 张)
    # =====================================================================

    # t_certificate
    _ct(
        "t_certificate",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键ID"),
        sa.Column("deleted", sa.Boolean, nullable=False, server_default=sa.text("false"), comment="逻辑删除（0-未删除，1-已删除）"),
        sa.Column("version", sa.Integer, nullable=False, server_default="1", comment="乐观锁版本号"),
        sa.Column("certificate_id", sa.BigInteger, nullable=True, comment="证书Id"),
        sa.Column("code", sa.String(64), nullable=True, comment="证书编号"),
        sa.Column("name", sa.String(128), nullable=True, comment="证书的名称"),
        sa.Column("description", sa.String(2000), nullable=True, comment="证书的描述"),
        sa.Column("awarding_organization", sa.String(128), nullable=True, comment="颁发证书的机构"),
        sa.Column("awarder_name", sa.String(64), nullable=True, comment="颁发证书的人员或代表的名称"),
        sa.Column("awarder_position", sa.String(64), nullable=True, comment="颁发证书的人员或代表的职位或职称"),
        sa.Column("design", sa.String(512), nullable=True, comment="证书模板的设计图片或样式文件（存储URL/路径）"),
        sa.Column("award_conditions", sa.String(2000), nullable=True, comment="证书的颁发条件或要求"),
        sa.Column("validity_policy", sa.String(1024), nullable=True, comment="证书的有效期限或到期策略"),
        sa.Column("award_date", sa.DateTime, nullable=True, comment="证书的颁发日期"),
        sa.Column("validity", sa.DateTime, nullable=True, comment="证书的有效期限"),
        sa.Column("status", sa.String(32), nullable=True, comment="证书的状态（例如：有效、已过期、作废等）"),
        sa.Column("member_id", sa.BigInteger, nullable=True, comment="获证人员的唯一标识符"),
        sa.Column("lesson_id", sa.BigInteger, nullable=True, comment="相关课程的唯一标识符"),
        sa.Column("lesson_sign_id", sa.BigInteger, nullable=True, comment="课程报名Id"),
        sa.Column("lesson_sign_time", sa.DateTime, nullable=True, comment="课程报名时间"),
        sa.Column("lesson_complete_time", sa.DateTime, nullable=True, comment="课程报名学习完成时间"),
        sa.Column("score", sa.String(32), nullable=True, comment="获证人员的成绩（支持分数/等级，如95/优秀）"),
        sa.Column("company_id", sa.BigInteger, nullable=True, comment="公司Id"),
        sa.Column("create_user_id", sa.BigInteger, nullable=True, comment="创建人Id"),
        sa.Column("create_user_name", sa.String(64), nullable=True, comment="创建人名称"),
        sa.Column("update_user_id", sa.BigInteger, nullable=True, comment="修改人Id"),
        sa.Column("update_user_name", sa.String(64), nullable=True, comment="修改人名称"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_cert_certificate_id", "t_certificate", ["certificate_id"])
    _ci("idx_cert_member_id", "t_certificate", ["member_id"])
    _ci("idx_cert_lesson_id", "t_certificate", ["lesson_id"])
    _ci("idx_cert_status", "t_certificate", ["status"])
    _ci("idx_cert_company_id", "t_certificate", ["company_id"])

    # t_certificate_template
    _ct(
        "t_certificate_template",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("name", sa.String(200), nullable=False, server_default="", comment="证书模板的名称"),
        sa.Column("description", sa.String(1000), nullable=True, server_default="", comment="证书模板的描述"),
        sa.Column("awarding_organization", sa.String(200), nullable=True, server_default="", comment="颁发证书的机构"),
        sa.Column("awarder_name", sa.String(100), nullable=True, server_default="", comment="颁发证书的人员或代表的名称"),
        sa.Column("awarder_position", sa.String(100), nullable=True, server_default="", comment="颁发证书的人员或代表的职位或职称"),
        sa.Column("design", sa.String(1000), nullable=True, server_default="", comment="证书模板的设计图片或样式文件（图片URL）"),
        sa.Column("award_conditions", sa.String(500), nullable=True, server_default="", comment="证书的颁发条件或要求"),
        sa.Column("validity_policy", sa.String(500), nullable=True, server_default="", comment="证书的有效期限或到期策略"),
        sa.Column("status", sa.String(30), nullable=False, server_default="inactive", comment="状态：active-启用, inactive-禁用, deleted-已删除"),
        sa.Column("company_id", sa.BigInteger, nullable=True, comment="公司Id"),
        sa.Column("create_user_id", sa.BigInteger, nullable=True, comment="创建人Id"),
        sa.Column("create_user_name", sa.String(100), nullable=True, server_default="", comment="创建人名称"),
        sa.Column("update_user_id", sa.BigInteger, nullable=True, comment="修改人Id"),
        sa.Column("update_user_name", sa.String(100), nullable=True, server_default="", comment="修改人名称"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_cert_tpl_status", "t_certificate_template", ["status"])
    _ci("idx_cert_tpl_company_id", "t_certificate_template", ["company_id"])
    _ci("idx_cert_tpl_create_time", "t_certificate_template", ["created_at"])

    # =====================================================================
    # 签到 (2 张)
    # =====================================================================

    # t_check_in
    _ct(
        "t_check_in",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="会员id"),
        sa.Column("continuous_num", sa.BigInteger, nullable=False, comment="连续签到天数"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_checkin_member_id", "t_check_in", ["member_id"])

    # t_check_in_record
    _ct(
        "t_check_in_record",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="会员id"),
        sa.Column("type", sa.String(20), nullable=False, comment="签到类型"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_checkin_rec_member_id", "t_check_in_record", ["member_id"])
    _ci("idx_checkin_rec_type", "t_check_in_record", ["type"])

    # =====================================================================
    # 会员 (3 张)
    # =====================================================================

    # t_member_company
    _ct(
        "t_member_company",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("name", sa.String(100), nullable=False, server_default="", comment="公司名称"),
        sa.Column("image", sa.String(1000), nullable=True, server_default="", comment="公司logo（图片URL）"),
        sa.Column("mobile", sa.String(20), nullable=False, server_default="", comment="联系电话"),
        sa.Column("email", sa.String(100), nullable=False, server_default="", comment="邮箱地址"),
        sa.Column("status", sa.String(30), nullable=False, server_default="normal", comment="状态：normal-正常, invalid-无效, deleted-已删除"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0", comment="排序，数值越大越靠前"),
        sa.Column("company_type_id", sa.BigInteger, nullable=True, comment="公司类型id（关联 t_member_company_type 表）"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_member_company_type_id", "t_member_company", ["company_type_id"])
    _ci("idx_member_company_status", "t_member_company", ["status"])
    _ci("idx_member_company_sort_order", "t_member_company", ["sort_order"])
    _ci("idx_member_company_create_time", "t_member_company", ["created_at"])

    # t_member_group
    _ct(
        "t_member_group",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("name", sa.String(100), nullable=False, server_default="", comment="分组名称"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0", comment="排序，数值越大越靠前"),
        sa.Column("status", sa.String(30), nullable=False, server_default="enable", comment="状态：enable-启用, disable-禁用"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_member_group_status", "t_member_group", ["status"])
    _ci("idx_member_group_sort_order", "t_member_group", ["sort_order"])
    _ci("idx_member_group_create_time", "t_member_group", ["created_at"])

    # t_member_level
    _ct(
        "t_member_level",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("name", sa.String(100), nullable=False, comment="名称"),
        sa.Column("description", sa.String(2000), nullable=False, comment="描述"),
        sa.Column("conditions", sa.BigInteger, nullable=False, comment="状态"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )

    # =====================================================================
    # 资讯 (2 张)
    # =====================================================================

    # t_news
    _ct(
        "t_news",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("title", sa.String(100), nullable=False, comment="标题"),
        sa.Column("type", sa.String(100), nullable=False, comment="类型"),
        sa.Column("user_id", sa.BigInteger, nullable=False, comment="用户id"),
        sa.Column("content", sa.Text, nullable=False, comment="内容"),
        sa.Column("image", sa.String(3000), nullable=True, comment="海报图片"),
        sa.Column("tags", sa.String(3000), nullable=True, comment="标签"),
        sa.Column("keywords", sa.String(3000), nullable=True, comment="关键字"),
        sa.Column("status", sa.String(100), nullable=False, comment="状态"),
        sa.Column("recommend", sa.Boolean, nullable=False, server_default=sa.text("false"), comment="推荐"),
        sa.Column("top", sa.Boolean, nullable=False, server_default=sa.text("false"), comment="置顶"),
        sa.Column("description", sa.String(3000), nullable=False, server_default="", comment="简介"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_news_status", "t_news", ["status"])
    _ci("idx_news_user_id", "t_news", ["user_id"])

    # t_article
    _ct(
        "t_article",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("title", sa.String(100), nullable=False, comment="标题"),
        sa.Column("member_id", sa.BigInteger, nullable=False, comment="用户id"),
        sa.Column("content", sa.Text, nullable=False, comment="内容"),
        sa.Column("image", sa.String(3000), nullable=True, comment="海报图片"),
        sa.Column("tags", sa.String(3000), nullable=True, comment="标签"),
        sa.Column("keywords", sa.String(3000), nullable=True, comment="关键字"),
        sa.Column("status", sa.String(100), nullable=False, comment="状态"),
        sa.Column("introduction", sa.String(200), nullable=False, server_default="", comment="描述"),
        sa.Column("recommend", sa.Boolean, nullable=False, server_default=sa.text("false"), comment="推荐"),
        sa.Column("top", sa.Boolean, nullable=False, server_default=sa.text("false"), comment="置顶"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_article_status", "t_article", ["status"])
    _ci("idx_article_member_id", "t_article", ["member_id"])

    # =====================================================================
    # 发票 (2 张)
    # =====================================================================

    # t_invoice_title
    _ct(
        "t_invoice_title",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("user_id", sa.BigInteger, nullable=False, comment="用户ID"),
        sa.Column("company_id", sa.BigInteger, nullable=True, comment="公司ID"),
        sa.Column("title_type", sa.Integer, nullable=False, comment="抬头类型(1-企业/2-个人)"),
        sa.Column("company_name", sa.String(200), nullable=False, comment="公司名称/个人姓名"),
        sa.Column("company_tax_number", sa.String(50), nullable=True, comment="公司税号"),
        sa.Column("company_address", sa.String(500), nullable=True, comment="公司地址"),
        sa.Column("company_phone", sa.String(50), nullable=True, comment="公司电话"),
        sa.Column("bank_name", sa.String(200), nullable=True, comment="开户银行"),
        sa.Column("bank_account", sa.String(100), nullable=True, comment="银行账号"),
        sa.Column("email", sa.String(200), nullable=True, comment="电子邮箱(接收电子发票)"),
        sa.Column("mobile_phone", sa.String(50), nullable=True, comment="手机号码"),
        sa.Column("default_flag", sa.Boolean, nullable=False, server_default=sa.text("false"), comment="是否默认发票抬头(0:否,1:是)"),
        sa.Column("create_user_id", sa.BigInteger, nullable=True, comment="创建人ID"),
        sa.Column("update_user_id", sa.BigInteger, nullable=True, comment="更新人ID"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_inv_title_user", "t_invoice_title", ["user_id"])

    # t_invoice_application
    _ct(
        "t_invoice_application",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("user_id", sa.BigInteger, nullable=False, comment="用户ID"),
        sa.Column("company_id", sa.BigInteger, nullable=True, comment="公司ID"),
        sa.Column("order_id", sa.BigInteger, nullable=False, comment="订单ID"),
        sa.Column("order_no", sa.String(50), nullable=False, comment="订单号"),
        sa.Column("invoice_title_id", sa.BigInteger, nullable=True, comment="发票抬头ID"),
        sa.Column("title_type", sa.Integer, nullable=False, comment="抬头类型(1-企业/2-个人)"),
        sa.Column("company_name", sa.String(200), nullable=False, comment="公司名称/个人姓名"),
        sa.Column("company_tax_number", sa.String(50), nullable=True, comment="公司税号"),
        sa.Column("company_address", sa.String(500), nullable=True, comment="公司地址"),
        sa.Column("company_phone", sa.String(50), nullable=True, comment="公司电话"),
        sa.Column("bank_name", sa.String(200), nullable=True, comment="开户银行"),
        sa.Column("bank_account", sa.String(100), nullable=True, comment="银行账号"),
        sa.Column("email", sa.String(200), nullable=True, comment="电子邮箱"),
        sa.Column("mobile_phone", sa.String(50), nullable=True, comment="手机号码"),
        sa.Column("invoice_amount", sa.Numeric(14, 2), nullable=False, comment="开票金额"),
        sa.Column("invoice_content", sa.String(500), nullable=True, comment="发票内容"),
        sa.Column("status", sa.Integer, nullable=False, server_default="0", comment="状态(0-待开票/1-开票中/2-已开票/3-已拒绝/4-已取消)"),
        sa.Column("invoice_no", sa.String(100), nullable=True, comment="发票号码"),
        sa.Column("invoice_url", sa.String(500), nullable=True, comment="发票URL"),
        sa.Column("reject_reason", sa.String(500), nullable=True, comment="拒绝原因"),
        sa.Column("create_user_id", sa.BigInteger, nullable=True, comment="创建人ID"),
        sa.Column("update_user_id", sa.BigInteger, nullable=True, comment="更新人ID"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_inv_app_user", "t_invoice_application", ["user_id"])
    _ci("idx_inv_app_order", "t_invoice_application", ["order_id"])
    _ci("idx_inv_app_status", "t_invoice_application", ["status"])


def downgrade() -> None:
    for tbl in (
        # 发票
        "t_invoice_application",
        "t_invoice_title",
        # 资讯
        "t_article",
        "t_news",
        # 会员
        "t_member_level",
        "t_member_group",
        "t_member_company",
        # 签到
        "t_check_in_record",
        "t_check_in",
        # 证书
        "t_certificate_template",
        "t_certificate",
        # message
        "message_announcement_read_record",
        "message_notice",
        "message_system_notice",
        "message_private_letter",
        # resource
        "resource_resource_search_record",
        "resource_resource_download",
        "resource_resource_category_relation",
        "resource_resource",
        "resource_category_relation",
        "resource_category",
        # circle
        "circle_dynamic",
        "circle_circle_member",
        "circle_circle",
        "circle_circle_category_relation",
        "circle_category_relation",
        # live
        "live_tencent_cloud_live_stream",
        "live_channel_lecturer",
        "live_channel_category_relation",
        "live_category_relation",
        "live_category",
        # exam
        "exam_sign_up",
        "exam_question_and_category_relation",
        "exam_question_category_relation",
        "exam_question_category",
        "exam_paper_question_rule",
        "exam_paper_question",
        "exam_paper_paper_category_relation",
        "exam_paper_category_relation",
        "exam_paper_category",
        "exam_category_relation",
        "exam_exam_chapter_section",
        "exam_exam_chapter",
        "exam_exam_category_relation",
        "exam_exam",
    ):
        op.drop_table(tbl)
