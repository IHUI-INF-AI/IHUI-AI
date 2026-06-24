"""
圈子社区数据模型 (迁移自 ihui-ai-edu-circle-service)
"""

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


class CircleCategory(TimestampMixin, Base):
    """圈子分类"""

    __tablename__ = "circle_category"

    id = id_column(comment="ID")
    pid = Column(BigInteger, default=0)
    name = Column(String(100), nullable=False)
    sort_order = Column(Integer, default=0)
    is_show = Column(Boolean, default=True)
    icon = Column(String(500), nullable=True)

class Circle(TimestampMixin, Base):
    """圈子"""

    __tablename__ = "circle"
    __table_args__ = (
        Index("idx_circle_category", "category_id"),
        Index("idx_circle_status", "status"),)

    id = id_column(comment="ID")
    name = Column(String(100), nullable=False, comment="圈子名称")
    description = Column(Text, nullable=True, comment="圈子描述")
    avatar = Column(String(500), nullable=True, comment="圈子头像")
    cover = Column(String(500), nullable=True, comment="圈子封面")
    category_id = Column(BigInteger, nullable=True, comment="分类ID")
    owner_id = Column(String(64), nullable=False, comment="圈主UUID")
    owner_name = Column(String(100), nullable=True, comment="圈主昵称")
    member_num = Column(Integer, default=0, comment="成员数")
    post_num = Column(Integer, default=0, comment="帖子数")
    status = Column(Integer, default=1, comment="0=禁用 1=正常 2=审核")
    is_official = Column(Boolean, default=False, comment="是否官方")
    is_top = Column(Boolean, default=False, comment="是否置顶")
    is_essence = Column(Boolean, default=False, comment="是否精华")
    deleted = Column(Boolean, default=False)

class CircleMember(TimestampMixin, Base):
    """圈子成员"""

    __tablename__ = "circle_member"
    __table_args__ = (
        Index("idx_cm_circle", "circle_id"),
        Index("idx_cm_user", "user_id"),
        Index("ix_circle_member_status", "status"),
    )

    id = id_column(comment="ID")
    circle_id = Column(BigInteger, nullable=False, comment="圈子ID")
    user_id = Column(String(64), nullable=False, comment="用户UUID")
    user_name = Column(String(100), nullable=True)
    user_avatar = Column(String(500), nullable=True)
    role = Column(String(20), default="member", comment="owner/admin/member")
    status = Column(Integer, default=1, comment="0=退出 1=正常")

class CirclePost(TimestampMixin, Base):
    """圈子帖子/动态"""

    __tablename__ = "circle_post"
    __table_args__ = (
        Index("idx_cp_circle", "circle_id"),
        Index("idx_cp_user", "user_id"),
        Index("idx_cp_status", "status"),)

    id = id_column(comment="ID")
    circle_id = Column(BigInteger, nullable=False, comment="圈子ID")
    user_id = Column(String(64), nullable=False, comment="发布者UUID")
    user_name = Column(String(100), nullable=True)
    user_avatar = Column(String(500), nullable=True)
    content = Column(Text, nullable=False, comment="帖子内容")
    images = Column(Text, nullable=True, comment="图片JSON数组")
    video = Column(String(500), nullable=True, comment="视频URL")
    status = Column(Integer, default=1, comment="0=隐藏 1=正常 2=审核中 3=拒绝")
    like_num = Column(Integer, default=0)
    comment_num = Column(Integer, default=0)
    share_num = Column(Integer, default=0)
    watch_num = Column(Integer, default=0)
    is_top = Column(Boolean, default=False, comment="是否置顶")
    is_essence = Column(Boolean, default=False, comment="是否精华")
    deleted = Column(Boolean, default=False)

class CirclePostLike(TimestampMixin, Base):
    """帖子点赞"""

    __tablename__ = "circle_post_like"
    __table_args__ = (
        Index("idx_cpl_post", "post_id"),
        Index("idx_cpl_user", "user_id"),)

    id = id_column(comment="ID")
    post_id = Column(BigInteger, nullable=False)
    user_id = Column(String(64), nullable=False)

class CirclePostComment(TimestampMixin, Base):
    """帖子评论"""

    __tablename__ = "circle_post_comment"
    __table_args__ = (
        Index("idx_cpc_post", "post_id"),
        Index("ix_circle_post_comment_user_id", "user_id"),
    )

    id = id_column(comment="ID")
    post_id = Column(BigInteger, nullable=False)
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    content = Column(Text, nullable=False)
    pid = Column(BigInteger, default=0, comment="父评论ID")
    reply_user_id = Column(String(64), nullable=True)
    reply_user_name = Column(String(100), nullable=True)
    like_num = Column(Integer, default=0)


class CircleCategoryRelation(TimestampMixin, Base):
    """圈子分类父子关系表

    - 迁移自 H:\\edu client\\service\\service\\ihui-ai-edu-circle-service\\t_category_relation
    """

    __tablename__ = "circle_category_relation"
    __table_args__ = (
        Index("idx_ccr_child", "child_category_id"),
        Index("idx_ccr_father", "father_category_id"),
    )

    id = id_column(comment="ID")
    child_category_id = Column(BigInteger, nullable=False, comment="子分类ID")
    father_category_id = Column(BigInteger, nullable=False, comment="父分类ID")
    direct_father_category_id = Column(BigInteger, default=0, comment="直接父分类ID")
    is_sub = Column(Integer, default=0, comment="是否子分类")


class CircleCategoryBind(TimestampMixin, Base):
    """圈子-分类多对多关联表

    - 迁移自 H:\\edu client\\service\\service\\ihui-ai-edu-circle-service\\t_circle_category_relation
    """

    __tablename__ = "circle_category_bind"
    __table_args__ = (
        Index("idx_ccb_circle", "circle_id"),
        Index("idx_ccb_category", "category_id"),
    )

    id = id_column(comment="ID")
    circle_id = Column(BigInteger, nullable=False, comment="圈子ID")
    category_id = Column(BigInteger, nullable=False, comment="分类ID")
