"""add ai education and github tables (迁移自历史 service 主库)

Revision ID: 017_add_ai_education_and_github_tables
Revises: 016_add_historical_module_tables
Create Date: 2026-06-28

涵盖: AI教育定制(5) + GitHub开源项目库(1) = 6 张表.
来源: H:\\历史项目存档\\ljd-交接文件\\service\\init_database.sql
  - ai_education_policy / ai_teacher_certification / aigc_tool_detail
  - k12_ai_curriculum / university_ai_course
  - resource_github_projects (仅 service 主库, service_2 已删)
"""
import sqlalchemy as sa

from alembic import op

revision = "017_add_ai_education_and_github_tables"
down_revision = "016_add_historical_module_tables"
branch_labels = None
depends_on = None


def _bigint_pk():
    """PostgreSQL BIGINT 主键, SQLite 用 INTEGER 走 rowid."""
    return sa.Integer().with_variant(sa.BigInteger(), "postgresql")


def upgrade() -> None:
    # 幂等建表: 008 通过 Base.metadata.create_all(checkfirst=True) 已创建所有 ORM 模型表,
    # 017 再用 op.create_table 重复创建会冲突 (table already exists), 所以加表存在性检查.
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
    # AI 教育定制 (5 张)
    # =====================================================================

    # ai_education_policy
    _ct(
        "ai_education_policy",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键ID"),
        sa.Column("policy_name", sa.String(300), nullable=False, comment="政策名称"),
        sa.Column("issuing_authority", sa.String(200), nullable=False, comment="发布机构"),
        sa.Column("issue_date", sa.Date, nullable=True, comment="发布日期"),
        sa.Column("effective_date", sa.Date, nullable=True, comment="生效日期"),
        sa.Column("policy_level", sa.String(50), nullable=True, comment="政策级别"),
        sa.Column("target_group", sa.String(200), nullable=True, comment="适用对象"),
        sa.Column("summary", sa.Text, nullable=True, comment="政策摘要"),
        sa.Column("key_points", sa.Text, nullable=True, comment="核心要点"),
        sa.Column("implementation", sa.Text, nullable=True, comment="实施要求"),
        sa.Column("goals", sa.Text, nullable=True, comment="目标"),
        sa.Column("supporting_measures", sa.Text, nullable=True, comment="保障措施"),
        sa.Column("related_policies", sa.Text, nullable=True, comment="相关政策"),
        sa.Column("source_url", sa.String(500), nullable=True, comment="来源链接"),
        sa.Column("status", sa.String(20), nullable=True, server_default="active", comment="状态"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("deleted_at", sa.DateTime, nullable=True, comment="软删除时间"),
    )

    # ai_teacher_certification
    _ct(
        "ai_teacher_certification",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键ID"),
        sa.Column("cert_name", sa.String(200), nullable=False, comment="认证名称"),
        sa.Column("issuing_authority", sa.String(200), nullable=False, comment="颁发机构"),
        sa.Column("target_teachers", sa.String(200), nullable=True, comment="面向教师"),
        sa.Column("level", sa.String(50), nullable=True, comment="级别"),
        sa.Column("training_hours", sa.Integer, nullable=True, comment="培训学时"),
        sa.Column("training_content", sa.Text, nullable=True, comment="培训内容"),
        sa.Column("assessment_method", sa.Text, nullable=True, comment="考核方式"),
        sa.Column("certification_requirements", sa.Text, nullable=True, comment="认证要求"),
        sa.Column("validity", sa.String(50), nullable=True, comment="有效期"),
        sa.Column("benefits", sa.Text, nullable=True, comment="认证价值"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("deleted_at", sa.DateTime, nullable=True, comment="软删除时间"),
    )

    # aigc_tool_detail
    _ct(
        "aigc_tool_detail",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键ID"),
        sa.Column("name", sa.String(100), nullable=False, comment="工具名称"),
        sa.Column("name_cn", sa.String(100), nullable=True, comment="中文名"),
        sa.Column("category", sa.String(50), nullable=False, comment="分类: video/image/audio/design/3d/writing"),
        sa.Column("subcategory", sa.String(50), nullable=True, comment="子分类"),
        sa.Column("provider", sa.String(100), nullable=True, comment="提供商"),
        sa.Column("url", sa.String(500), nullable=True, comment="官网"),
        sa.Column("description", sa.Text, nullable=True, comment="详细描述"),
        sa.Column("core_features", sa.Text, nullable=True, comment="核心功能"),
        sa.Column("use_cases", sa.Text, nullable=True, comment="使用场景"),
        sa.Column("pricing_model", sa.String(100), nullable=True, comment="定价模式"),
        sa.Column("pricing_detail", sa.Text, nullable=True, comment="具体价格"),
        sa.Column("free_tier", sa.Text, nullable=True, comment="免费额度详情"),
        sa.Column("generation_speed", sa.String(100), nullable=True, comment="生成速度"),
        sa.Column("output_quality", sa.String(20), nullable=True, comment="输出质量: excellent/good/medium"),
        sa.Column("chinese_support", sa.String(20), nullable=True, comment="中文支持: excellent/good/limited/none"),
        sa.Column("learning_curve", sa.String(20), nullable=True, comment="学习难度"),
        sa.Column("api_available", sa.Boolean, nullable=True, server_default=sa.text("false"), comment="是否提供API"),
        sa.Column("mobile_app", sa.Boolean, nullable=True, server_default=sa.text("false"), comment="是否有移动端App"),
        sa.Column("pros", sa.Text, nullable=True, comment="优点"),
        sa.Column("cons", sa.Text, nullable=True, comment="缺点"),
        sa.Column("tips", sa.Text, nullable=True, comment="使用技巧"),
        sa.Column("alternatives", sa.String(500), nullable=True, comment="替代工具"),
        sa.Column("rating", sa.Numeric(2, 1), nullable=True, server_default="0.0", comment="评分"),
        sa.Column("user_count", sa.String(50), nullable=True, comment="用户量级"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("deleted_at", sa.DateTime, nullable=True, comment="软删除时间"),
    )

    # k12_ai_curriculum
    _ct(
        "k12_ai_curriculum",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键ID"),
        sa.Column("stage", sa.String(50), nullable=False, comment="学段"),
        sa.Column("grade_range", sa.String(50), nullable=True, comment="年级范围"),
        sa.Column("course_name", sa.String(200), nullable=True, comment="课程名称"),
        sa.Column("hours_per_year", sa.Integer, nullable=True, comment="每学年课时"),
        sa.Column("course_type", sa.String(50), nullable=True, comment="课程类型"),
        sa.Column("learning_objectives", sa.Text, nullable=True, comment="学习目标"),
        sa.Column("content_modules", sa.Text, nullable=True, comment="内容模块"),
        sa.Column("key_concepts", sa.Text, nullable=True, comment="核心概念"),
        sa.Column("skill_requirements", sa.Text, nullable=True, comment="技能要求"),
        sa.Column("teaching_methods", sa.Text, nullable=True, comment="教学方法"),
        sa.Column("assessment_methods", sa.Text, nullable=True, comment="评价方式"),
        sa.Column("tools_resources", sa.Text, nullable=True, comment="工具资源"),
        sa.Column("integration_subjects", sa.Text, nullable=True, comment="融合学科"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("deleted_at", sa.DateTime, nullable=True, comment="软删除时间"),
    )

    # university_ai_course
    _ct(
        "university_ai_course",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键ID"),
        sa.Column("course_name", sa.String(200), nullable=False, comment="课程名称"),
        sa.Column("course_type", sa.String(50), nullable=True, comment="课程类型"),
        sa.Column("target_major", sa.String(200), nullable=True, comment="面向专业"),
        sa.Column("credits", sa.Numeric(3, 1), nullable=True, comment="学分"),
        sa.Column("hours", sa.Integer, nullable=True, comment="学时"),
        sa.Column("university", sa.String(200), nullable=True, comment="开设高校"),
        sa.Column("description", sa.Text, nullable=True, comment="课程描述"),
        sa.Column("modules", sa.Text, nullable=True, comment="课程模块"),
        sa.Column("prerequisites", sa.Text, nullable=True, comment="先修要求"),
        sa.Column("textbooks", sa.Text, nullable=True, comment="教材资源"),
        sa.Column("teaching_team", sa.Text, nullable=True, comment="教学团队"),
        sa.Column("assessment", sa.Text, nullable=True, comment="考核方式"),
        sa.Column("is_required", sa.Boolean, nullable=True, server_default=sa.text("false"), comment="是否必修"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("deleted_at", sa.DateTime, nullable=True, comment="软删除时间"),
    )

    # =====================================================================
    # GitHub 开源项目库 (1 张)
    # =====================================================================

    # resource_github_projects
    _ct(
        "resource_github_projects",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("name", sa.String(200), nullable=False, comment="项目名称"),
        sa.Column("url", sa.String(500), nullable=False, comment="GitHub链接"),
        sa.Column("stars", sa.Integer, nullable=True, comment="Star数"),
        sa.Column("category", sa.String(100), nullable=True, comment="分类"),
        sa.Column("description", sa.Text, nullable=True, comment="描述"),
        sa.Column("language", sa.String(50), nullable=True, comment="主要语言"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_rgp_category", "resource_github_projects", ["category"])
    _ci("idx_rgp_language", "resource_github_projects", ["language"])


def downgrade() -> None:
    for tbl in (
        # GitHub 开源项目库
        "resource_github_projects",
        # AI 教育定制 (反序)
        "university_ai_course",
        "k12_ai_curriculum",
        "aigc_tool_detail",
        "ai_teacher_certification",
        "ai_education_policy",
    ):
        op.drop_table(tbl)
