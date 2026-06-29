"""圈子社区扩展数据模型 (分类关系/话题, 迁移自 ihui-ai-edu-circle-service)"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Index,
    String,
    Text,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column

# ---------------------------------------------------------------------------
# 分类关系
# ---------------------------------------------------------------------------


class CircleCategoryRelation(TimestampMixin, Base):
    """圈子分类关系 (历史 circle_category_relation)"""

    __tablename__ = "circle_category_relation"
    __table_args__ = (
        Index("idx_ccr_father", "father_category_id"),
        Index("idx_ccr_child", "child_category_id"),
    )

    id = id_column(comment="主键id")
    child_category_id = Column(BigInteger, nullable=False, comment="子分类id")
    father_category_id = Column(BigInteger, nullable=False, comment="父分类id")
    direct_father_category_id = Column(BigInteger, nullable=False, comment="直属父分类id")
    is_sub = Column(Boolean, nullable=False, comment="是否属于子分类")


class CircleCircleCategoryRelation(TimestampMixin, Base):
    """圈子类目关系 (历史 circle_circle_category_relation)"""

    __tablename__ = "circle_circle_category_relation"
    __table_args__ = (
        Index("idx_cccr_category", "category_id"),
        Index("idx_cccr_circle", "circle_id"),
    )

    id = id_column(comment="主键id")
    category_id = Column(BigInteger, nullable=False, comment="目录id")
    circle_id = Column(BigInteger, nullable=False, comment="圈子id")


# ---------------------------------------------------------------------------
# 圈子主体 (历史命名 circle_circle)
# ---------------------------------------------------------------------------


class CircleCircle(TimestampMixin, Base):
    """圈子 (历史 circle_circle)"""

    __tablename__ = "circle_circle"
    __table_args__ = (Index("idx_cc_member", "member_id"),)

    id = id_column(comment="主键id")
    name = Column(String(100), nullable=False, comment="名称")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    image = Column(String(3000), nullable=True, comment="图片")
    status = Column(String(100), nullable=False, comment="状态")
    introduction = Column(String(200), nullable=False, default="", comment="描述")


class CircleCircleMember(TimestampMixin, Base):
    """圈子会员 (历史 circle_circle_member)"""

    __tablename__ = "circle_circle_member"
    __table_args__ = (
        Index("idx_ccm_member", "member_id"),
        Index("idx_ccm_circle", "circle_id"),
    )

    id = id_column(comment="主键id")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    circle_id = Column(BigInteger, nullable=False, comment="圈子id")


# ---------------------------------------------------------------------------
# 圈子动态/话题
# ---------------------------------------------------------------------------


class CircleDynamic(TimestampMixin, Base):
    """圈子动态 (历史 circle_dynamic)"""

    __tablename__ = "circle_dynamic"
    __table_args__ = (
        Index("idx_cd_circle", "circle_id"),
        Index("idx_cd_member", "member_id"),
    )

    id = id_column(comment="主键id")
    content = Column(Text, nullable=False, comment="内容")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
    image = Column(String(3000), nullable=True, default="", comment="图片，多个逗号隔开")
    status = Column(String(100), nullable=False, comment="状态")
    circle_id = Column(BigInteger, nullable=False, comment="圈子id")
