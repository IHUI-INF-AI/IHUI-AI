"""ZHS_Server_java 中无对应 Python 实现的 Domain 模型补齐.

迁移自 ZHS_Server_java/small/domain/:
- AiBotSites
- PaymentCallback
- TransferInfo
- UserAgentFreeTimes
- WxPayNotification
"""

from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.database import Base
from app.models.base import id_column


class AiBotSites(Base):
    """AI 工具站点信息表."""

    __tablename__ = "ai_bot_sites"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    url = Column(String(512))
    category = Column(String(64))
    description = Column(Text)
    icon = Column(String(512))
    sort = Column(Integer, default=0)
    is_use = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "url": self.url,
            "category": self.category,
            "description": self.description,
            "icon": self.icon,
            "sort": self.sort,
            "is_use": self.is_use,
        }


class PaymentCallback(Base):
    """支付回调记录表."""

    __tablename__ = "payment_callbacks"

    id = id_column()
    order_id = Column(String(64), index=True)
    payment_method = Column(String(32))
    callback_type = Column(String(32))
    raw_data = Column(Text)
    status = Column(Integer, default=0)
    amount = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "order_id": self.order_id,
            "payment_method": self.payment_method,
            "callback_type": self.callback_type,
            "raw_data": self.raw_data,
            "status": self.status,
            "amount": self.amount,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class TransferInfo(Base):
    """转账信息表."""

    __tablename__ = "transfer_infos"

    id = id_column()
    transfer_no = Column(String(64), unique=True, index=True)
    from_user = Column(String(64))
    to_user = Column(String(64))
    amount = Column(Integer, default=0)
    status = Column(Integer, default=0)
    remark = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "transfer_no": self.transfer_no,
            "from_user": self.from_user,
            "to_user": self.to_user,
            "amount": self.amount,
            "status": self.status,
            "remark": self.remark,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class UserAgentFreeTimes(Base):
    """用户 Agent 免费次数表."""

    __tablename__ = "user_agent_free_times"

    id = id_column()
    user_uuid = Column(String(64), index=True, nullable=False)
    agent_id = Column(String(64), index=True, nullable=False)
    free_times = Column(Integer, default=0)
    used_times = Column(Integer, default=0)
    last_reset_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "user_uuid": self.user_uuid,
            "agent_id": self.agent_id,
            "free_times": self.free_times,
            "used_times": self.used_times,
            "remaining": max(0, (self.free_times or 0) - (self.used_times or 0)),
            "last_reset_at": self.last_reset_at.isoformat() if self.last_reset_at else None,
        }


class WxPayNotification(Base):
    """微信支付通知表."""

    __tablename__ = "wx_pay_notifications"

    id = id_column()
    out_trade_no = Column(String(64), index=True)
    transaction_id = Column(String(64), index=True)
    openid = Column(String(128))
    trade_type = Column(String(32))
    bank_type = Column(String(32))
    total_fee = Column(Integer, default=0)
    cash_fee = Column(Integer, default=0)
    refund_no = Column(String(64))
    notification_type = Column(String(32))
    result_code = Column(String(16))
    raw_xml = Column(Text)
    status = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "out_trade_no": self.out_trade_no,
            "transaction_id": self.transaction_id,
            "openid": self.openid,
            "trade_type": self.trade_type,
            "bank_type": self.bank_type,
            "total_fee": self.total_fee,
            "cash_fee": self.cash_fee,
            "refund_no": self.refund_no,
            "notification_type": self.notification_type,
            "result_code": self.result_code,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
