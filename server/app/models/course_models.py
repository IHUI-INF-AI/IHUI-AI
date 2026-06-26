"""
Course models (from zhs_educational_training).
"""

from sqlalchemy import BigInteger, Column, DateTime, Float, Index, Integer, String, Text

from app.database import Base
from app.models.base import TimestampMixin, id_column


class Course(TimestampMixin, Base):
    """Course (zhs_educational_training.zhs_course)."""

    __tablename__ = "zhs_course"
    __table_args__ = (
        {
            # 建议 113: 阶段 2 业务表 schema 改造 (第 2 批)
            "schema": "public",
        },
    )

    id = id_column(comment="ID")
    title = Column(String(200), nullable=False, comment="Course title")
    subtitle = Column(Text, nullable=True, comment="Subtitle")
    content = Column(Text, nullable=True, comment="Content/HTML")
    remark = Column(Text, nullable=True)
    remark_file = Column(String(500), nullable=True, comment="Attachment URL")
    binding = Column(String(500), nullable=True, comment="Binding URL")
    stage = Column(String(50), nullable=True, comment="Stage/level")
    is_hidden = Column(Integer, default=0, comment="Hidden flag")
    is_del = Column(Integer, default=0, comment="Soft delete")
    sort = Column(Integer, default=0, comment="Sort order")
    creator = Column(String(100), nullable=True, comment="Creator")
    label = Column(String(100), nullable=True, comment="Label/tag")
    audit_status = Column(Integer, default=0, comment="0=not audited, 1=approved, 2=rejected")


class CourseVideo(TimestampMixin, Base):
    """Course video (zhs_educational_training.zhs_course_video)."""

    __tablename__ = "zhs_course_video"
    __table_args__ = (Index("ix_zhs_course_video_status", "status"),)

    id = id_column(comment="ID")
    course_id = Column(BigInteger, nullable=False, comment="Course ID")
    binding = Column(String(500), nullable=True, comment="Binding URL")
    video_path = Column(String(500), nullable=False, comment="Video URL/path")
    title = Column(String(200), nullable=True, comment="Video title")
    subtitle = Column(Text, nullable=True, comment="Subtitle")
    content = Column(Text, nullable=True, comment="Content")
    remark = Column(Text, nullable=True)
    duration = Column(Integer, nullable=True, comment="Duration in seconds")
    adjunct_url = Column(String(500), nullable=True, comment="Adjunct/attachment URL")
    is_pay = Column(Integer, default=0, comment="0=free, 1=paid")
    amount = Column(BigInteger, nullable=True, comment="Price (分)")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    sort = Column(Integer, default=0, comment="Sort order")
    creator = Column(String(100), nullable=True, comment="Creator")
    lecturer = Column(String(100), nullable=True, comment="Lecturer")
    label = Column(String(100), nullable=True, comment="Label")
    audit_status = Column(Integer, default=0, comment="0=not audited, 1=approved")
    stage = Column(String(50), nullable=True, comment="Stage/level")


class EducationalCourse(TimestampMixin, Base):
    """Educational course (zhs_educational_training.zhs_educational_course)."""

    __tablename__ = "zhs_educational_course"
    __table_args__ = (Index("ix_zhs_educational_course_status", "status"),)

    id = id_column(comment="ID")
    title = Column(String(200), nullable=False, comment="Course title")
    subtitle = Column(Text, nullable=True, comment="Subtitle")
    cover = Column(String(500), nullable=True, comment="Cover image URL")
    content = Column(Text, nullable=True, comment="Content/HTML")
    price = Column(BigInteger, nullable=True, comment="Price (分)")
    category = Column(String(100), nullable=True, comment="Category")
    stage = Column(String(50), nullable=True, comment="Stage/level")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    is_hidden = Column(Integer, default=0, comment="Hidden flag")
    is_del = Column(Integer, default=0, comment="Soft delete")
    sort = Column(Integer, default=0, comment="Sort order")
    creator = Column(String(64), nullable=True, comment="Creator UUID")
    label = Column(String(100), nullable=True, comment="Label/tag")
    audit_status = Column(Integer, default=0, comment="0=not audited, 1=approved, 2=rejected")


class EducationPlatform(TimestampMixin, Base):
    """Education platform (zhs_educational_training.zhs_education_platform)."""

    __tablename__ = "zhs_education_platform"
    __table_args__ = (Index("ix_zhs_education_platform_status", "status"),)

    id = id_column(comment="ID")
    code = Column(String(50), unique=True, nullable=False, comment="Platform code")
    name = Column(String(100), nullable=False, comment="Platform name")
    domain = Column(String(200), nullable=True, comment="Domain")
    remark = Column(Text, nullable=True)
    binding = Column(String(500), nullable=True)
    file_path = Column(String(500), nullable=True, comment="Logo/attachment")
    type = Column(Integer, nullable=True, comment="Type")
    status = Column(Integer, default=1, comment="0=disabled, 1=active")
    sort = Column(Integer, default=0, comment="Sort order")
    is_hidden = Column(Integer, default=0)
    is_del = Column(Integer, default=0)


# 别名兼容 (ZHS_Server_java 中为 ZhsEducationPlatform)
ZhsEducationPlatform = EducationPlatform


# =============================================================================
# 以下为 ZHS_Server_java course 模块的 SQLAlchemy 迁移模型
# 源: com.ai.manager.course.domain.* (共 14 个 Java 实体)
# 迁移时间: 2026-06-18
# =============================================================================


class ZhsCourseNew(TimestampMixin, Base):
    """课程主表 (zhs_course)."""

    __tablename__ = "zhs_course_new"
    __table_args__ = ({"schema": "public"},)

    id = Column(String(64), primary_key=True, comment="唯一标识")
    title = Column(String(200), nullable=True, comment="标题")
    subtitle = Column(Text, nullable=True, comment="副标题")
    content = Column(Text, nullable=True, comment="正文")
    remark_file = Column(String(500), nullable=True, comment="描述附件")
    binding = Column(String(500), nullable=True, comment="封面")
    stage = Column(Integer, nullable=True, comment="阶段 0入门 | 1进阶 | 2精通")
    is_hidden = Column(Integer, default=0, comment="0可用 | 1隐藏")
    is_del = Column(Integer, default=0, comment="0可用 | 1删除")
    sort = Column(Integer, default=0, comment="排序")
    creator = Column(String(64), nullable=True, comment="创建人")
    updator = Column(String(64), nullable=True, comment="修改人")
    remark = Column(Text, nullable=True, comment="备注")
    label = Column(String(100), nullable=True, comment="自定义标签")
    types = Column(String(500), nullable=True, comment="种类")
    categorys = Column(String(500), nullable=True, comment="赛道")
    platform = Column(String(64), nullable=True, comment="平台")
    audit_status = Column(Integer, default=0, comment="0未审 | 1通过 | 2驳回")
    nickname = Column(String(100), nullable=True, comment="昵称")
    avatar = Column(String(500), nullable=True, comment="头像")


class ZhsIdentityExtended(TimestampMixin, Base):
    """平台身份 (zhs_identity) - 扩展字段定义 (从 Java 迁移)."""

    __tablename__ = "zhs_identity_ext"
    __table_args__ = ({"schema": "public"},)

    id = Column(Integer, primary_key=True, autoincrement=True, comment="身份id")
    uuid = Column(String(64), nullable=True, comment="唯一标识")
    name = Column(String(100), nullable=True, comment="身份名称")
    platform_id = Column(String(64), nullable=True, comment="归属平台id")
    organization_id = Column(String(64), nullable=True, comment="归属机构id")
    parent_id = Column(String(64), nullable=True, comment="上级身份id")
    binding = Column(String(500), nullable=True, comment="封面logo")
    is_hidden = Column(Integer, default=0, comment="0显示 | 1隐藏")
    is_del = Column(Integer, default=0, comment="0保留 | 1删除")
    is_cross = Column(Integer, default=0, comment="0否 | 1是")
    creator = Column(String(64), nullable=True, comment="创建人")
    updator = Column(String(64), nullable=True, comment="修改人")


class ZhsOrganizationExtended(TimestampMixin, Base):
    """平台机构 (zhs_organization) - 扩展字段定义 (从 Java 迁移)."""

    __tablename__ = "zhs_organization_ext"
    __table_args__ = ({"schema": "public"},)

    id = Column(Integer, primary_key=True, autoincrement=True, comment="机构id")
    uuid = Column(String(64), nullable=True, comment="唯一标识")
    platform_id = Column(String(64), nullable=True, comment="平台id")
    name = Column(String(200), nullable=True, comment="机构名称")
    file_path = Column(Text, nullable=True, comment="文件存储路径(逗号分割)")
    binding = Column(String(500), nullable=True, comment="封面logo")
    is_hidden = Column(Integer, default=0, comment="0显示 | 1隐藏")
    is_del = Column(Integer, default=0, comment="0使用 | 1删除")
    creator = Column(String(64), nullable=True, comment="创建者")
    updator = Column(String(64), nullable=True, comment="修改者")
