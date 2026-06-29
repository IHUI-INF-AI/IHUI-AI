"""资源体系扩展数据模型 (分类/标签/访问日志, 迁移自 ihui-ai-edu-resource-service)"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Index,
    Integer,
    String,
    Text,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column

# ---------------------------------------------------------------------------
# 资源分类
# ---------------------------------------------------------------------------


class ResourceCategory(TimestampMixin, Base):
    """资源分类 (历史 resource_category)"""

    __tablename__ = "resource_category"
    __table_args__ = (
        Index("idx_res_cat_level", "level"),
        Index("idx_res_cat_show", "is_show"),
    )

    id = id_column(comment="主键id")
    name = Column(String(50), nullable=False, comment="类目名称")
    sort_order = Column(Integer, nullable=False, default=1, comment="排列序号，表示同级类目的展现次序，如数值相等则按名称次序排列。取值范围:大于零的整数")
    is_show = Column(Boolean, nullable=False, default=True, comment="是否显示")
    is_show_index = Column(Boolean, nullable=False, default=True, comment="是否在首页显示")
    level = Column(Integer, nullable=False, comment="目录等级")
    image = Column(String(500), nullable=False, comment="分类图片")


class ResourceCategoryRelation(TimestampMixin, Base):
    """资源分类关系 (历史 resource_category_relation)"""

    __tablename__ = "resource_category_relation"
    __table_args__ = (
        Index("idx_rescr_father", "father_category_id"),
        Index("idx_rescr_child", "child_category_id"),
    )

    id = id_column(comment="主键id")
    child_category_id = Column(BigInteger, nullable=False, comment="子类目id")
    father_category_id = Column(BigInteger, nullable=False, comment="父类目id")
    direct_father_category_id = Column(BigInteger, nullable=False, comment="直属父类目id")
    is_sub = Column(Boolean, nullable=False, comment="是否属于子类目")


# ---------------------------------------------------------------------------
# 资源主体 (历史命名 resource_resource)
# ---------------------------------------------------------------------------


class ResourceResource(TimestampMixin, Base):
    """资源 (历史 resource_resource)"""

    __tablename__ = "resource_resource"
    __table_args__ = (
        Index("idx_rr_member", "member_id"),
        Index("idx_rr_status", "status"),
    )

    id = id_column(comment="主键id")
    title = Column(String(100), nullable=False, comment="标题")
    member_id = Column(BigInteger, nullable=False, comment="用户id")
    introduction = Column(Text, nullable=False, comment="内容")
    image = Column(String(3000), nullable=True, comment="海报图片")
    url = Column(String(3000), nullable=True, comment="标签")
    status = Column(String(100), nullable=False, comment="状态")
    type = Column(String(200), nullable=False, comment="类型")


class ResourceResourceCategoryRelation(TimestampMixin, Base):
    """资源类目关系 (历史 resource_resource_category_relation)"""

    __tablename__ = "resource_resource_category_relation"
    __table_args__ = (
        Index("idx_rrcr_category", "category_id"),
        Index("idx_rrcr_resource", "resource_id"),
    )

    id = id_column(comment="主键id")
    category_id = Column(BigInteger, nullable=False, comment="目录id")
    resource_id = Column(BigInteger, nullable=False, comment="资源id")


# ---------------------------------------------------------------------------
# 资源访问/下载/搜索日志
# ---------------------------------------------------------------------------


class ResourceResourceDownload(TimestampMixin, Base):
    """会员下载记录 (历史 resource_resource_download)"""

    __tablename__ = "resource_resource_download"
    __table_args__ = (
        Index("idx_rrd_member", "member_id"),
        Index("idx_rrd_resource", "resource_id"),
    )

    id = id_column(comment="主键id")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    resource_id = Column(BigInteger, nullable=False, comment="资源id")


class ResourceResourceSearchRecord(TimestampMixin, Base):
    """会员搜索记录 (历史 resource_resource_search_record)"""

    __tablename__ = "resource_resource_search_record"
    __table_args__ = (Index("idx_rrsr_member", "member_id"),)

    id = id_column(comment="主键id")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    search_condition = Column(Text, nullable=False, comment="搜索条件")


# ---------------------------------------------------------------------------
# GitHub 开源项目库 (历史 resource_github_projects, 仅 service 主库存在)
# ---------------------------------------------------------------------------


class ResourceGithubProject(TimestampMixin, Base):
    """GitHub开源项目库 (历史 resource_github_projects)"""

    __tablename__ = "resource_github_projects"
    __table_args__ = (
        Index("idx_rgp_category", "category"),
        Index("idx_rgp_language", "language"),
    )

    id = id_column(comment="主键id")
    name = Column(String(200), nullable=False, comment="项目名称")
    url = Column(String(500), nullable=False, comment="GitHub链接")
    stars = Column(Integer, nullable=True, comment="Star数")
    category = Column(String(100), nullable=True, comment="分类")
    description = Column(Text, nullable=True, comment="描述")
    language = Column(String(50), nullable=True, comment="主要语言")
