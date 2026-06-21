"""
Order and payment models (from zhs_ai_project).
"""
from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, func

from app.database import Base
from app.models.base import TimestampMixin, id_column


class Order(TimestampMixin, Base):
    """Payment order (zhs_ai_project.zhs_order)."""

    __tablename__ = "zhs_order"
    __table_args__ = (
        Index("ix_zhs_order_user_id", "user_id"),
        Index("ix_zhs_order_status", "status"),
        {
            # 建议 108: 多租户阶段 2, schema 占位 (默认 public, 多租户模式时动态改为 tenant_{tid})
            "schema": "public",
        },
    )

    id = id_column(comment="Order ID")
    user_id = Column(String(64), nullable=True, comment="User UUID")
    out_trade_no = Column(String(64), nullable=True, comment="Merchant order number")
    open_id = Column(String(100), nullable=True, comment="WeChat open ID")
    amount = Column(BigInteger, nullable=True, comment="Amount in cents")
    status = Column(Integer, default=0, comment="0=pending, 1=paid, 2=refunded, 3=cancelled")
    payment_status = Column(Integer, default=0, comment="0=unpaid, 1=paid, 2=refunded")
    created_at = Column(DateTime, default=func.now(), comment="Created")
    paid_at = Column(DateTime, nullable=True, comment="Payment time")
    product_id = Column(String(64), nullable=True, comment="Product ID")
    order_type = Column(Integer, default=0, comment="0=token, 1=activity, 2=identity, 3=agent")
    activity_id = Column(String(64), nullable=True, comment="Activity ID")
    product_identity_id = Column(String(64), nullable=True, comment="Product identity ID")
    pay_type = Column(String(20), nullable=True, comment="wechat, alipay")
    refund_time = Column(DateTime, nullable=True, comment="Refund time")
    refund_reason = Column(String(255), nullable=True, comment="Refund reason")


class CommissionFlow(TimestampMixin, Base):
    """Commission/referral flow (zhs_ai_project.zhs_commission_flow)."""

    __tablename__ = "zhs_commission_flow"
    __table_args__ = (
        Index("ix_zhs_commission_flow_user_id", "user_id"),
        Index("ix_zhs_commission_flow_status", "status"),
        {
            # 建议 113: 阶段 2 业务表 schema 改造 (第 2 批)
            "schema": "public",
        },
    )

    id = id_column(comment="Commission flow ID")
    user_id = Column(String(64), nullable=True, comment="User UUID")
    order_id = Column(BigInteger, nullable=True, comment="Order ID")
    open_id = Column(String(100), nullable=True, comment="Open ID")
    amount = Column(BigInteger, nullable=True, comment="Commission amount")
    type = Column(Integer, nullable=True, comment="0=regular, 1=VIP, 2=trader")
    status = Column(Integer, default=1, comment="0=invalid, 1=active")
    token = Column(BigInteger, nullable=True, comment="Token earned")
    time = Column(BigInteger, nullable=True, comment="Unix timestamp")
    remark = Column(String(255), nullable=True)
    belongers_open_id = Column(String(100), nullable=True, comment="Direct referrer open ID")
    order_status = Column(Integer, nullable=True)
    invited_user_id = Column(String(64), nullable=True, comment="Invited user ID")


class WithdrawalFlow(TimestampMixin, Base):
    """Withdrawal flow (zhs_ai_project.zhs_withdrawal_flow)."""

    __tablename__ = "zhs_withdrawal_flow"
    __table_args__ = (
        Index("ix_zhs_withdrawal_flow_user_id", "user_id"),
        Index("ix_zhs_withdrawal_flow_status", "status"),
        {
            # 建议 113: 阶段 2 业务表 schema 改造 (第 2 批)
            "schema": "public",
        },
    )

    id = id_column(comment="Withdrawal ID")
    user_id = Column(String(64), nullable=False, comment="User UUID")
    amount = Column(BigInteger, nullable=False, comment="Withdrawal amount")
    status = Column(Integer, default=0, comment="0=pending, 1=processing, 2=completed, 3=failed")
    partner_trade_no = Column(String(64), nullable=True, comment="WeChat transfer number")
    payment_no = Column(String(64), nullable=True, comment="Payment number")


class IdentityProportion(TimestampMixin, Base):
    """Commission ratio configuration (zhs_ai_project.zhs_identity_proportion).

    Controls how much commission each user role earns from referrals.
    All proportion fields are integer percentages (e.g. 5 means 5%).
    """

    __tablename__ = "zhs_identity_proportion"
    __table_args__ = (Index("ix_zhs_identity_proportion_status", "status"), {"extend_existing": True})  # noqa: RUF012

    id = Column(String(64), primary_key=True, comment="UUID")
    begin_time = Column(DateTime, nullable=True, comment="Effective start time")
    end_time = Column(DateTime, nullable=True, comment="Effective end time")
    status = Column(Integer, default=0, comment="0=stopped, 1=active")
    gift = Column(BigInteger, default=0, comment="Token gift for inviting new user (normal)")
    token_proportion = Column(Integer, default=0, comment="Normal user token commission %")
    vip_gift = Column(BigInteger, default=0, comment="Token gift for VIP inviting new user")
    routine_proportion = Column(Integer, default=0, comment="VIP -> routine order commission %")
    vip_proportion = Column(Integer, default=0, comment="VIP -> VIP order commission %")
    trader_proportion = Column(Integer, default=0, comment="VIP -> trader order commission %")
    trader_gift = Column(BigInteger, default=0, comment="Token gift for trader inviting new user")
    trader_routine_proportion = Column(Integer, default=0, comment="Trader -> routine order commission %")
    trader_vip_proportion = Column(Integer, default=0, comment="Trader -> VIP order commission %")
    trader_trader_proportion = Column(Integer, default=0, comment="Trader -> trader order commission %")
    grand_routine_proportion = Column(Integer, default=0, comment="Grandparent -> routine order commission %")
    grand_vip_proportion = Column(Integer, default=0, comment="Grandparent -> VIP order commission %")
    grand_trader_proportion = Column(Integer, default=0, comment="Grandparent -> trader order commission %")
    creator = Column(String(64), nullable=True)
    created_time = Column(DateTime, nullable=True)
    updator = Column(String(64), nullable=True)
    updated_time = Column(DateTime, nullable=True)


class OperateTokenFlow(TimestampMixin, Base):
    """Token operation audit log (zhs_ai_project.zhs_operate_token_flow)."""

    __tablename__ = "zhs_operate_token_flow"
    __table_args__ = (Index("ix_zhs_operate_token_flow_user_id", "user_id"),)

    id = id_column(comment="Token flow ID")
    user_id = Column(String(64), nullable=False, comment="User UUID")
    token_quantity = Column(BigInteger, default=0, comment="Token quantity")
    type = Column(Integer, nullable=True, comment="Operation type")
    operate_desc = Column(String(255), nullable=True, comment="Operation description")
    token_free = Column(BigInteger, default=0, comment="Free token balance")
    user_uuid = Column(String(64), nullable=True, comment="User UUID reference")
