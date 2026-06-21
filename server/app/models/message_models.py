"""
消息通知数据模型 (迁移自 ihui-ai-edu-message-service)
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


class Message(TimestampMixin, Base):
    """站内信/消息"""

    __tablename__ = "message"
    __table_args__ = (
        Index("idx_msg_user", "user_id"),
        Index("idx_msg_status", "is_read"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False, comment="接收者UUID")
    sender_id = Column(String(64), nullable=True, comment="发送者UUID")
    sender_name = Column(String(100), nullable=True, comment="发送者昵称")
    type = Column(String(20), default="system", comment="system/notice/private")
    title = Column(String(200), nullable=False, comment="消息标题")
    content = Column(Text, nullable=False, comment="消息内容")
    target_type = Column(String(50), nullable=True, comment="跳转目标类型")
    target_id = Column(String(64), nullable=True, comment="跳转目标ID")
    target_url = Column(String(500), nullable=True, comment="跳转URL")
    is_read = Column(Boolean, default=False, comment="是否已读")
    read_time = Column(DateTime, nullable=True, comment="阅读时间")
    is_top = Column(Boolean, default=False, comment="是否置顶")

class MessageAnnouncement(TimestampMixin, Base):
    """公告/通知"""

    __tablename__ = "message_announcement"
    __table_args__ = (
        Index("idx_ann_status", "status"),)

    id = id_column(comment="ID")
    title = Column(String(200), nullable=False, comment="公告标题")
    content = Column(Text, nullable=False, comment="公告内容")
    cover = Column(String(500), nullable=True, comment="封面图")
    type = Column(Integer, default=1, comment="1=系统 2=活动 3=维护 4=升级")
    priority = Column(Integer, default=1, comment="1=普通 2=重要 3=紧急")
    status = Column(Integer, default=1, comment="0=下线 1=上线 2=草稿")
    target_user = Column(String(20), default="all", comment="all/vip/normal")
    target_url = Column(String(500), nullable=True, comment="跳转URL")
    publish_time = Column(DateTime, nullable=True, comment="发布时间")
    expire_time = Column(DateTime, nullable=True, comment="过期时间")
    view_num = Column(Integer, default=0, comment="浏览数")
    is_top = Column(Boolean, default=False, comment="是否置顶")

class MessageTemplate(TimestampMixin, Base):
    """消息模板"""

    __tablename__ = "message_template"
    __table_args__ = (Index("ix_message_template_status", "status"),)

    id = id_column(comment="ID")
    code = Column(String(50), unique=True, nullable=False, comment="模板编码")
    name = Column(String(100), nullable=False, comment="模板名称")
    type = Column(String(20), nullable=False, comment="sms/email/notice/push")
    subject = Column(String(200), nullable=True, comment="标题模板")
    content = Column(Text, nullable=False, comment="内容模板")
    variables = Column(String(500), nullable=True, comment="变量JSON")
    status = Column(Integer, default=1, comment="0=禁用 1=启用")

class MessageReadLog(TimestampMixin, Base):
    """消息阅读日志"""

    __tablename__ = "message_read_log"
    __table_args__ = (
        Index("idx_mrl_user", "user_id"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False)
    message_id = Column(BigInteger, nullable=False)
    message_type = Column(String(20), nullable=False, comment="message/announcement")
