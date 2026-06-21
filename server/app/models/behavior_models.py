"""
行为分析数据模型 (迁移自 ihui-ai-edu-behavior-service)
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


class BehaviorLike(TimestampMixin, Base):
    """通用点赞表"""

    __tablename__ = "behavior_like"
    __table_args__ = (
        Index("idx_bl_user", "user_id"),
        Index("idx_bl_target", "target_type", "target_id"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    target_type = Column(String(50), nullable=False)
    target_id = Column(BigInteger, nullable=False)

class BehaviorFavorite(TimestampMixin, Base):
    """通用收藏表"""

    __tablename__ = "behavior_favorite"
    __table_args__ = (
        Index("idx_bf_user", "user_id"),
        Index("idx_bf_target", "target_type", "target_id"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    target_type = Column(String(50), nullable=False)
    target_id = Column(BigInteger, nullable=False)
    folder = Column(String(50), default="default", comment="收藏夹")

class BehaviorComment(TimestampMixin, Base):
    """通用评论表"""

    __tablename__ = "behavior_comment"
    __table_args__ = (
        Index("idx_bc_target", "target_type", "target_id"),
        Index("ix_behavior_comment_user_id", "user_id"),
        Index("ix_behavior_comment_status", "status"),
    )

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    user_avatar = Column(String(500), nullable=True)
    target_type = Column(String(50), nullable=False)
    target_id = Column(BigInteger, nullable=False)
    content = Column(Text, nullable=False)
    pid = Column(BigInteger, default=0, comment="父评论ID")
    reply_user_id = Column(String(64), nullable=True)
    reply_user_name = Column(String(100), nullable=True)
    like_num = Column(Integer, default=0)
    status = Column(Integer, default=1, comment="0=隐藏 1=正常 2=审核中 3=拒绝")

class BehaviorShare(TimestampMixin, Base):
    """分享记录"""

    __tablename__ = "behavior_share"
    __table_args__ = (
        Index("idx_bs_user", "user_id"),
        Index("idx_bs_target", "target_type", "target_id"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False)
    target_type = Column(String(50), nullable=False)
    target_id = Column(BigInteger, nullable=False)
    platform = Column(String(50), nullable=True, comment="wechat/weibo/qq/link")
    ip = Column(String(50), nullable=True)

class BehaviorReport(TimestampMixin, Base):
    """举报"""

    __tablename__ = "behavior_report"
    __table_args__ = (
        Index("idx_br_target", "target_type", "target_id"),
        Index("ix_behavior_report_user_id", "user_id"),
        Index("ix_behavior_report_status", "status"),
    )

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False)
    target_type = Column(String(50), nullable=False)
    target_id = Column(BigInteger, nullable=False)
    reason = Column(String(500), nullable=True, comment="举报原因")
    category = Column(String(50), nullable=True, comment="举报分类")
    status = Column(Integer, default=0, comment="0=待处理 1=已处理 2=已忽略")
    handle_user = Column(String(64), nullable=True)
    handle_remark = Column(String(500), nullable=True)

class BehaviorSensitive(TimestampMixin, Base):
    """敏感词"""

    __tablename__ = "behavior_sensitive"
    __table_args__ = (Index("ix_behavior_sensitive_status", "status"),)

    id = id_column(comment="ID")
    word = Column(String(100), unique=True, nullable=False, comment="敏感词")
    category = Column(String(50), nullable=True, comment="分类: 政治/色情/广告/... ")
    level = Column(Integer, default=1, comment="1=低 2=中 3=高")
    action = Column(String(20), default="replace", comment="replace/block/warn")
    replacement = Column(String(50), nullable=True, comment="替换词")
    status = Column(Integer, default=1, comment="0=禁用 1=启用")

class BehaviorFollow(TimestampMixin, Base):
    """关注关系"""

    __tablename__ = "behavior_follow"
    __table_args__ = (
        Index("idx_bf2_user", "user_id"),
        Index("idx_bf2_target", "target_user_id"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False, comment="关注者")
    target_user_id = Column(String(64), nullable=False, comment="被关注者")
    is_mutual = Column(Boolean, default=False, comment="是否互相关注")
