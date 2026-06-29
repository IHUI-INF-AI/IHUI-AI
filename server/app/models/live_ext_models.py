"""直播扩展数据模型 (分类/讲师/腾讯云直播, 迁移自 ihui-ai-edu-live-service)"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Index,
    Integer,
    String,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column

# ---------------------------------------------------------------------------
# Live category system
# ---------------------------------------------------------------------------


class LiveCategory(TimestampMixin, Base):
    """直播分类 (历史 live_category)"""

    __tablename__ = "live_category"

    id = id_column(comment="主键id")
    name = Column(String(50), nullable=False, comment="分类名称")
    sort_order = Column(Integer, nullable=False, default=1, comment="排列序号")
    is_show = Column(Boolean, nullable=False, default=True, comment="是否显示")
    is_show_index = Column(Boolean, nullable=False, default=True, comment="是否在首页显示")
    level = Column(Integer, nullable=False, comment="目录等级")
    image = Column(String(500), nullable=False, comment="分类图片")


class LiveCategoryRelation(TimestampMixin, Base):
    """直播分类关系 (历史 live_category_relation)"""

    __tablename__ = "live_category_relation"

    id = id_column(comment="主键id")
    child_category_id = Column(BigInteger, nullable=False, comment="子分类id")
    father_category_id = Column(BigInteger, nullable=False, comment="父分类id")
    direct_father_category_id = Column(BigInteger, nullable=False, comment="直属父分类id")
    is_sub = Column(Boolean, nullable=False, comment="是否属于子分类")


class LiveChannelCategoryRelation(TimestampMixin, Base):
    """频道分类关系 (历史 live_channel_category_relation)"""

    __tablename__ = "live_channel_category_relation"
    __table_args__ = (
        Index("idx_lccr_category", "category_id"),
        Index("idx_lccr_channel", "channel_id"),
    )

    id = id_column(comment="主键id")
    category_id = Column(BigInteger, nullable=False, comment="目录id")
    channel_id = Column(BigInteger, nullable=False, comment="频道id")


# ---------------------------------------------------------------------------
# Channel lecturer
# ---------------------------------------------------------------------------


class LiveChannelLecturer(TimestampMixin, Base):
    """频道讲师 (历史 live_channel_lecturer)"""

    __tablename__ = "live_channel_lecturer"
    __table_args__ = (
        Index("idx_lcl_lecturer", "lecturer_id"),
        Index("idx_lcl_channel", "channel_id"),
    )

    id = id_column(comment="主键id")
    lecturer_id = Column(BigInteger, nullable=False, comment="讲师id")
    channel_id = Column(BigInteger, nullable=False, comment="频道id")


# ---------------------------------------------------------------------------
# Tencent Cloud live stream
# ---------------------------------------------------------------------------


class LiveTencentCloudLiveStream(TimestampMixin, Base):
    """腾讯云直播流信息 (历史 live_tencent_cloud_live_stream)"""

    __tablename__ = "live_tencent_cloud_live_stream"
    __table_args__ = (Index("idx_ltcls_channel", "channel_id"),)

    id = id_column(comment="主键id")
    channel_id = Column(BigInteger, nullable=False, comment="频道id")
    stream_name = Column(String(200), nullable=False, comment="流名称")
    app_name = Column(String(200), nullable=False, default="live", comment="应用名称")


# ---------------------------------------------------------------------------
# Lecturer (独立讲师实体, 历史 t_lecturer)
# ---------------------------------------------------------------------------


class Lecturer(TimestampMixin, Base):
    """讲师实体 (历史 t_lecturer)"""

    __tablename__ = "t_lecturer"
    __table_args__ = (Index("idx_lecturer_user", "user_id"),)

    id = id_column(comment="主键id")
    user_id = Column(BigInteger, nullable=False, comment="用户id")
    title = Column(String(100), nullable=False, default="", comment="头衔")
    introduction = Column(String(2000), nullable=False, default="", comment="介绍")
