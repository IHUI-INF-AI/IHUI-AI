"""Agent settlement and withdrawal models."""

from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, Text

from app.database import Base
from app.models.base import TimestampMixin


class AgentSettlement(TimestampMixin, Base):
    """Agent settlement records (zhs_agent_settlement).

    Linked to AgentBuy via order_no.  settlement=0/1, withdrawal=0/1.
    """

    __tablename__ = "zhs_agent_settlement"
    __table_args__ = (
        Index("idx_s_order", "order_no"),
        Index("idx_s_status", "settlement"),
        {
            # 建议 113: 阶段 2 业务表 schema 改造 (第 2 批)
            "schema": "public",
        },
    )
    id = Column(String(36), primary_key=True)
    uuid = Column(String(36), nullable=True, comment="Developer UUID (agent owner)")
    order_no = Column(String(64), nullable=True, comment="Order number from zhs_agent_buy")
    create_time = Column(DateTime, nullable=True, comment="Record creation time")
    buy_uuid = Column(String(64), nullable=True, comment="Buyer UUID")
    agent_id = Column(String(64), nullable=True, comment="Agent ID")
    agent_name = Column(String(128), nullable=True, comment="Agent name")
    prologue = Column(Text, nullable=True, comment="Agent prologue")
    agent_avatar = Column(String(500), nullable=True, comment="Agent avatar URL")
    expiration_date = Column(DateTime, nullable=True, comment="Expiration date")
    settlement = Column(String(2), nullable=True, comment="0=unsettled, 1=settled")
    withdrawal = Column(String(2), nullable=True, comment="Withdrawal column (capitalized in DB)")
    withdrawal_id = Column(String(36), nullable=True, comment="Linked withdrawal work order ID")
    issue_no = Column(String(32), nullable=True, comment="Issue number")


class AgentWithdrawalDetail(TimestampMixin, Base):
    """Agent withdrawal details."""

    __tablename__ = "zhs_agent_withdrawal_detail"
    __table_args__ = (
        Index("idx_w_user", "user_id"),
        Index("idx_w_bill", "out_bill_no"),
        Index("ix_zhs_agent_withdrawal_detail_status", "status"),
    )
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=True)
    amount = Column(BigInteger, nullable=True)
    type = Column(Integer, nullable=True)
    initiate_at = Column(BigInteger, nullable=True)
    status = Column(Integer, default=0)
    reviewer = Column(String(36), nullable=True)
    reviewer_time = Column(BigInteger, nullable=True)
    payment_time = Column(BigInteger, nullable=True)
    out_bill_no = Column(String(255), nullable=True)
    user_name = Column(String(50), nullable=True)
    open_id = Column(String(255), nullable=True)
    order_ids = Column(Text, nullable=True)
    wechat_msg = Column(Text, nullable=True)
