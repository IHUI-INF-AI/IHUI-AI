"""消息扩展数据模型 (私信/系统通知/会话, 迁移自 ihui-ai-edu-message-service)"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Index,
    String,
    Text,
)

from app.database import Base
from app.models.base import TimestampMixin, id_column

# ---------------------------------------------------------------------------
# 私信
# ---------------------------------------------------------------------------


class MessagePrivateLetter(TimestampMixin, Base):
    """私信 (历史 message_private_letter)"""

    __tablename__ = "message_private_letter"
    __table_args__ = (
        Index("idx_mpl_sender", "sender_id"),
        Index("idx_mpl_receiver", "receiver_id"),
    )

    id = id_column(comment="主键id")
    sender_id = Column(String(100), nullable=False, comment="发送者id")
    receiver_id = Column(String(100), nullable=False, comment="接受者id")
    content = Column(Text, nullable=False, comment="内容")
    read_time = Column(DateTime, nullable=True, comment="读信息时间")
    is_read = Column(Boolean, nullable=False, default=False, comment="是否已读")
    status = Column(String(30), nullable=False, comment="状态")


# ---------------------------------------------------------------------------
# 系统通知
# ---------------------------------------------------------------------------


class MessageSystemNotice(TimestampMixin, Base):
    """系统通知 (历史 message_system_notice)"""

    __tablename__ = "message_system_notice"

    id = id_column(comment="主键id")
    content = Column(Text, nullable=False, comment="通知内容")


# ---------------------------------------------------------------------------
# 通知 (主题级通知, 历史 message_notice)
# ---------------------------------------------------------------------------


class MessageNotice(TimestampMixin, Base):
    """通知 (历史 message_notice)"""

    __tablename__ = "message_notice"
    __table_args__ = (
        Index("idx_mn_member", "member_id"),
        Index("idx_mn_to_member", "to_member_id"),
    )

    id = id_column(comment="主键id")
    topic_id = Column(BigInteger, nullable=False, comment="主题id")
    topic_type = Column(String(100), nullable=False, comment="主题类型")
    to_member_id = Column(BigInteger, nullable=False, comment="主题会员")
    status = Column(String(100), nullable=True, comment="状态")
    type = Column(String(100), nullable=False, comment="类型")
    browsed = Column(Boolean, nullable=False, default=False, comment="是否已读")
    member_id = Column(BigInteger, nullable=False, comment="会员")


# ---------------------------------------------------------------------------
# 公告阅读记录
# ---------------------------------------------------------------------------


class MessageAnnouncementReadRecord(TimestampMixin, Base):
    """公告阅读记录 (历史 message_announcement_read_record)"""

    __tablename__ = "message_announcement_read_record"
    __table_args__ = (
        Index("idx_marr_announcement", "announcement_id"),
        Index("idx_marr_member", "member_id"),
    )

    id = id_column(comment="主键id")
    announcement_id = Column(BigInteger, nullable=False, comment="公告id")
    member_id = Column(BigInteger, nullable=False, comment="会员id")
