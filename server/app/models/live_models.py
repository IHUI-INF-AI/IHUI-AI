"""
直播功能数据模型 (迁移自 ihui-ai-edu-live-service)
"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    String,
    Text,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column


class LiveChannel(TimestampMixin, Base):
    """直播频道"""

    __tablename__ = "live_channel"
    __table_args__ = (
        Index("idx_lc_status", "status"),
        Index("idx_lc_start", "start_time"),)

    id = id_column(comment="ID")
    title = Column(String(200), nullable=False, comment="直播标题")
    description = Column(Text, nullable=True, comment="直播简介")
    cover = Column(String(500), nullable=True, comment="封面图")
    host_id = Column(String(64), nullable=False, comment="主播UUID")
    host_name = Column(String(100), nullable=True)
    host_avatar = Column(String(500), nullable=True)
    category_id = Column(BigInteger, nullable=True, comment="分类ID")
    push_url = Column(String(500), nullable=True, comment="推流地址")
    pull_url = Column(String(500), nullable=True, comment="拉流地址(播放地址)")
    play_url_hls = Column(String(500), nullable=True, comment="HLS播放地址")
    play_url_rtmp = Column(String(500), nullable=True, comment="RTMP播放地址")
    play_url_flv = Column(String(500), nullable=True, comment="FLV播放地址")
    status = Column(Integer, default=0, comment="0=未开始 1=直播中 2=已结束 3=禁播 4=回放")
    type = Column(Integer, default=1, comment="1=公开 2=密码 3=付费 4=会员")
    password = Column(String(50), nullable=True, comment="密码")
    price = Column(Integer, default=0, comment="价格(分)")
    is_record = Column(Boolean, default=True, comment="是否录制")
    record_url = Column(String(500), nullable=True, comment="回放地址")
    start_time = Column(DateTime, nullable=True, comment="开播时间")
    end_time = Column(DateTime, nullable=True, comment="结束时间")
    plan_start_time = Column(DateTime, nullable=True, comment="计划开播时间")
    plan_duration = Column(Integer, default=60, comment="计划时长(分钟)")
    online_num = Column(Integer, default=0, comment="在线人数")
    view_num = Column(Integer, default=0, comment="累计观看")
    like_num = Column(Integer, default=0, comment="点赞数")
    comment_num = Column(Integer, default=0, comment="评论数")
    share_num = Column(Integer, default=0, comment="分享数")
    is_top = Column(Boolean, default=False, comment="是否置顶")
    is_essence = Column(Boolean, default=False, comment="是否精华")
    deleted = Column(Boolean, default=False)

class LiveChannelCategory(TimestampMixin, Base):
    """直播分类"""

    __tablename__ = "live_channel_category"

    id = id_column(comment="ID")
    name = Column(String(100), nullable=False)
    sort_order = Column(Integer, default=0)
    is_show = Column(Boolean, default=True)
    icon = Column(String(500), nullable=True)

class LiveSubscribe(TimestampMixin, Base):
    """直播订阅"""

    __tablename__ = "live_subscribe"
    __table_args__ = (
        Index("idx_ls_user", "user_id"),
        Index("idx_ls_channel", "channel_id"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False)
    channel_id = Column(BigInteger, nullable=False)
    is_notify = Column(Boolean, default=True, comment="开播通知")

class LiveComment(TimestampMixin, Base):
    """直播评论/弹幕"""

    __tablename__ = "live_comment"
    __table_args__ = (
        Index("idx_lcm_channel", "channel_id"),
        Index("ix_live_comment_user_id", "user_id"),
    )

    id = id_column(comment="ID")
    channel_id = Column(BigInteger, nullable=False)
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    user_avatar = Column(String(500), nullable=True)
    content = Column(Text, nullable=False)
    type = Column(Integer, default=1, comment="1=评论 2=弹幕 3=系统")

class LiveGift(TimestampMixin, Base):
    """直播礼物记录"""

    __tablename__ = "live_gift"
    __table_args__ = (
        Index("idx_lg_channel", "channel_id"),
        Index("ix_live_gift_user_id", "user_id"),
    )

    id = id_column(comment="ID")
    channel_id = Column(BigInteger, nullable=False)
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    gift_id = Column(BigInteger, nullable=True, comment="礼物ID")
    gift_name = Column(String(100), nullable=True, comment="礼物名称")
    gift_count = Column(Integer, default=1, comment="礼物数量")
    total_price = Column(Integer, default=0, comment="总价值(分)")
