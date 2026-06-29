"""AI 教育定制数据模型 (迁移自历史 service 主库)

来源: H:\\历史项目存档\\ljd-交接文件\\service\\init_database.sql
涵盖 5 张表:
  - ai_education_policy       AI教育改革政策法规
  - ai_teacher_certification  AI教育师资认证
  - aigc_tool_detail          AIGC工具详细库
  - k12_ai_curriculum         中小学AI教育课程标准
  - university_ai_course      高校AI通识课程

注: 字段名/类型/注释对齐历史 SQL; 软删除字段 deleted_at 由 SoftDeleteMixin 提供
    (历史表仅有 create_time, 迁移时统一补齐 created_at/updated_at/deleted_at)。
"""

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    Integer,
    Numeric,
    String,
    Text,
)

from app.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, id_column


class AiEducationPolicy(TimestampMixin, SoftDeleteMixin, Base):
    """AI教育改革政策法规 (历史 ai_education_policy)"""

    __tablename__ = "ai_education_policy"

    id = id_column(comment="主键ID")
    policy_name = Column(String(300), nullable=False, comment="政策名称")
    issuing_authority = Column(String(200), nullable=False, comment="发布机构")
    issue_date = Column(Date, nullable=True, comment="发布日期")
    effective_date = Column(Date, nullable=True, comment="生效日期")
    policy_level = Column(String(50), nullable=True, comment="政策级别")
    target_group = Column(String(200), nullable=True, comment="适用对象")
    summary = Column(Text, nullable=True, comment="政策摘要")
    key_points = Column(Text, nullable=True, comment="核心要点")
    implementation = Column(Text, nullable=True, comment="实施要求")
    goals = Column(Text, nullable=True, comment="目标")
    supporting_measures = Column(Text, nullable=True, comment="保障措施")
    related_policies = Column(Text, nullable=True, comment="相关政策")
    source_url = Column(String(500), nullable=True, comment="来源链接")
    status = Column(String(20), nullable=True, default="active", comment="状态")


class AiTeacherCertification(TimestampMixin, SoftDeleteMixin, Base):
    """AI教育师资认证 (历史 ai_teacher_certification)"""

    __tablename__ = "ai_teacher_certification"

    id = id_column(comment="主键ID")
    cert_name = Column(String(200), nullable=False, comment="认证名称")
    issuing_authority = Column(String(200), nullable=False, comment="颁发机构")
    target_teachers = Column(String(200), nullable=True, comment="面向教师")
    level = Column(String(50), nullable=True, comment="级别")
    training_hours = Column(Integer, nullable=True, comment="培训学时")
    training_content = Column(Text, nullable=True, comment="培训内容")
    assessment_method = Column(Text, nullable=True, comment="考核方式")
    certification_requirements = Column(Text, nullable=True, comment="认证要求")
    validity = Column(String(50), nullable=True, comment="有效期")
    benefits = Column(Text, nullable=True, comment="认证价值")


class AigcToolDetail(TimestampMixin, SoftDeleteMixin, Base):
    """AIGC工具详细库 (历史 aigc_tool_detail)"""

    __tablename__ = "aigc_tool_detail"

    id = id_column(comment="主键ID")
    name = Column(String(100), nullable=False, comment="工具名称")
    name_cn = Column(String(100), nullable=True, comment="中文名")
    category = Column(String(50), nullable=False, comment="分类: video/image/audio/design/3d/writing")
    subcategory = Column(String(50), nullable=True, comment="子分类")
    provider = Column(String(100), nullable=True, comment="提供商")
    url = Column(String(500), nullable=True, comment="官网")
    description = Column(Text, nullable=True, comment="详细描述")
    core_features = Column(Text, nullable=True, comment="核心功能")
    use_cases = Column(Text, nullable=True, comment="使用场景")
    pricing_model = Column(String(100), nullable=True, comment="定价模式")
    pricing_detail = Column(Text, nullable=True, comment="具体价格")
    free_tier = Column(Text, nullable=True, comment="免费额度详情")
    generation_speed = Column(String(100), nullable=True, comment="生成速度")
    output_quality = Column(String(20), nullable=True, comment="输出质量: excellent/good/medium")
    chinese_support = Column(String(20), nullable=True, comment="中文支持: excellent/good/limited/none")
    learning_curve = Column(String(20), nullable=True, comment="学习难度")
    api_available = Column(Boolean, nullable=True, default=False, comment="是否提供API")
    mobile_app = Column(Boolean, nullable=True, default=False, comment="是否有移动端App")
    pros = Column(Text, nullable=True, comment="优点")
    cons = Column(Text, nullable=True, comment="缺点")
    tips = Column(Text, nullable=True, comment="使用技巧")
    alternatives = Column(String(500), nullable=True, comment="替代工具")
    rating = Column(Numeric(2, 1), nullable=True, default=0.0, comment="评分")
    user_count = Column(String(50), nullable=True, comment="用户量级")


class K12AiCurriculum(TimestampMixin, SoftDeleteMixin, Base):
    """中小学AI教育课程标准 (历史 k12_ai_curriculum)"""

    __tablename__ = "k12_ai_curriculum"

    id = id_column(comment="主键ID")
    stage = Column(String(50), nullable=False, comment="学段")
    grade_range = Column(String(50), nullable=True, comment="年级范围")
    course_name = Column(String(200), nullable=True, comment="课程名称")
    hours_per_year = Column(Integer, nullable=True, comment="每学年课时")
    course_type = Column(String(50), nullable=True, comment="课程类型")
    learning_objectives = Column(Text, nullable=True, comment="学习目标")
    content_modules = Column(Text, nullable=True, comment="内容模块")
    key_concepts = Column(Text, nullable=True, comment="核心概念")
    skill_requirements = Column(Text, nullable=True, comment="技能要求")
    teaching_methods = Column(Text, nullable=True, comment="教学方法")
    assessment_methods = Column(Text, nullable=True, comment="评价方式")
    tools_resources = Column(Text, nullable=True, comment="工具资源")
    integration_subjects = Column(Text, nullable=True, comment="融合学科")


class UniversityAiCourse(TimestampMixin, SoftDeleteMixin, Base):
    """高校AI通识课程 (历史 university_ai_course)"""

    __tablename__ = "university_ai_course"

    id = id_column(comment="主键ID")
    course_name = Column(String(200), nullable=False, comment="课程名称")
    course_type = Column(String(50), nullable=True, comment="课程类型")
    target_major = Column(String(200), nullable=True, comment="面向专业")
    credits = Column(Numeric(3, 1), nullable=True, comment="学分")
    hours = Column(Integer, nullable=True, comment="学时")
    university = Column(String(200), nullable=True, comment="开设高校")
    description = Column(Text, nullable=True, comment="课程描述")
    modules = Column(Text, nullable=True, comment="课程模块")
    prerequisites = Column(Text, nullable=True, comment="先修要求")
    textbooks = Column(Text, nullable=True, comment="教材资源")
    teaching_team = Column(Text, nullable=True, comment="教学团队")
    assessment = Column(Text, nullable=True, comment="考核方式")
    is_required = Column(Boolean, nullable=True, default=False, comment="是否必修")
