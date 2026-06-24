"""
聊天室数据模型 (迁移自 coze_zhs_py/api/chat_room_socket.py)

三张表:
- zhs_station_room: 聊天房间
- zhs_station_user: 用户-房间关系
- zhs_station_letter: 消息记录
"""

from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, Text

from app.database import Base
from app.models.base import TimestampMixin, id_column


class ChatRoom(TimestampMixin, Base):
    """聊天房间"""

    __tablename__ = "zhs_station_room"
    __table_args__ = (
        Index("idx_zsr_type", "type"),
        {"extend_existing": True},
    )

    id = id_column(comment="房间ID")
    room_name = Column(String(200), nullable=False, comment="房间名称")
    type = Column(Integer, default=1, comment="房间类型: 0=系统房间 1=对话房间")


class ChatRoomUser(TimestampMixin, Base):
    """用户-房间关系"""

    __tablename__ = "zhs_station_user"
    __table_args__ = (
        Index("idx_zsu_user", "user_uuid"),
        Index("idx_zsu_room", "room_id"),
        Index("idx_zsu_status", "is_leave", "is_del"),
        {"extend_existing": True},
    )

    id = id_column(comment="主键ID")
    user_uuid = Column(String(64), nullable=False, comment="用户UUID")
    room_id = Column(BigInteger, nullable=False, comment="房间ID")
    is_leave = Column(Integer, default=0, comment="是否离开: 0=在房间 1=已离开")
    is_del = Column(Integer, default=0, comment="是否删除: 0=正常 1=已删除")
    leave_at = Column(DateTime, nullable=True, comment="离开时间")


class ChatLetter(TimestampMixin, Base):
    """聊天消息"""

    __tablename__ = "zhs_station_letter"
    __table_args__ = (
        Index("idx_zsl_receiver", "receiver_uuid"),
        Index("idx_zsl_chat", "chat_id"),
        Index("idx_zsl_read", "is_read", "is_del"),
        Index("idx_zsl_sendtime", "send_time"),
        {"extend_existing": True},
    )

    id = id_column(comment="消息ID")
    user_uuid = Column(String(64), nullable=False, comment="发送者UUID(系统消息为system)")
    receiver_uuid = Column(String(64), nullable=True, comment="接收者UUID")
    type = Column(Integer, default=1, comment="消息类型: 0=系统消息 1=对话消息 2=完成消息")
    content = Column(Text, nullable=False, comment="消息内容")
    chat_id = Column(String(64), nullable=False, comment="房间ID/聊天ID")
    send_time = Column(DateTime, default=datetime.utcnow, comment="发送时间")
    is_del = Column(Integer, default=0, comment="是否删除: 0=正常 1=已删除")
    is_read = Column(Integer, default=0, comment="是否已读: 0=未读 1=已读")
