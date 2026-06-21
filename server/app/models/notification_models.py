"""
通知系统数据模型 (迁移自 ihui-ai-edu-notification-service)
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


class Notification(TimestampMixin, Base):
    """通知(实时推送/邮件/短信/站内统一)"""

    __tablename__ = "notification"
    __table_args__ = (
        Index("idx_notif_user", "user_id"),
        Index("idx_notif_status", "status"),
        Index("idx_notif_type", "type"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=True, comment="用户UUID,空为全体")
    title = Column(String(200), nullable=False, comment="通知标题")
    content = Column(Text, nullable=False, comment="通知内容")
    type = Column(String(20), default="site", comment="site/email/sms/push")
    channel = Column(String(50), nullable=True, comment="通知渠道")
    target_type = Column(String(50), nullable=True, comment="跳转目标类型")
    target_id = Column(String(64), nullable=True, comment="跳转目标ID")
    target_url = Column(String(500), nullable=True, comment="跳转URL")
    status = Column(Integer, default=0, comment="0=待发送 1=已发送 2=失败 3=已读")
    send_time = Column(DateTime, nullable=True, comment="发送时间")
    read_time = Column(DateTime, nullable=True, comment="阅读时间")
    retry_count = Column(Integer, default=0, comment="重试次数")
    error_msg = Column(String(500), nullable=True, comment="失败原因")

class NotificationChannel(TimestampMixin, Base):
    """通知渠道配置"""

    __tablename__ = "notification_channel"
    __table_args__ = (Index("ix_notification_channel_status", "status"),)

    id = id_column(comment="ID")
    name = Column(String(50), nullable=False, comment="渠道名称")
    type = Column(String(20), nullable=False, comment="email/sms/push")
    config = Column(Text, nullable=True, comment="渠道配置JSON")
    is_default = Column(Boolean, default=False, comment="是否默认")
    status = Column(Integer, default=1, comment="0=禁用 1=启用")

class NotificationLog(TimestampMixin, Base):
    """通知发送日志"""

    __tablename__ = "notification_log"
    __table_args__ = (
        Index("idx_nl_notif", "notification_id"),
        Index("idx_nl_time", "send_time"),
        Index("ix_notification_log_user_id", "user_id"),
    )

    id = id_column(comment="ID")
    notification_id = Column(BigInteger, nullable=False)
    user_id = Column(String(64), nullable=True)
    channel = Column(String(50), nullable=True)
    type = Column(String(20), nullable=True)
    success = Column(Boolean, default=False, comment="是否成功")
    response = Column(Text, nullable=True, comment="响应内容")
    error = Column(String(500), nullable=True, comment="错误信息")
    send_time = Column(DateTime, nullable=True)

class NotificationSubscription(TimestampMixin, Base):
    """用户通知订阅偏好"""

    __tablename__ = "notification_subscription"
    __table_args__ = (
        Index("idx_ns_user", "user_id"),)

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False)
    type = Column(String(20), nullable=False, comment="site/email/sms/push")
    category = Column(String(50), nullable=False, comment="订阅分类")
    enabled = Column(Boolean, default=True, comment="是否启用")
