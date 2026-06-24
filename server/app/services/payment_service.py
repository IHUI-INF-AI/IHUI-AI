"""支付服务 - Payment / PaymentConfig 业务逻辑 (P0 修复).

- create_payment: 创建支付订单
- query_payment_by_order_no: 按订单号查询
- update_payment_status: 更新支付状态
- get_payment_config / upsert_payment_config: 支付平台配置
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database import get_session
from app.models.payment_models import Payment, PaymentConfig

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Payment 业务方法
# ---------------------------------------------------------------------------

def create_payment(
    order_no: str,
    total_amount: int,
    platform: str = "wechatpay",
    user_id: str | None = None,
    subject: str | None = None,
    callback_url: str | None = None,
    return_url: str | None = None,
    terminal: str = "H5",
    open_id: str | None = None,
    **kwargs: Any,
) -> Payment:
    """创建支付订单. amount 单位为分."""
    with get_session() as db:
        payment = Payment(
            order_no=order_no,
            total_amount=total_amount,
            platform=platform,
            terminal=terminal,
            user_id=user_id,
            subject=subject,
            callback_url=callback_url,
            return_url=return_url,
            open_id=open_id,
            status=0,  # 待支付
            **{k: v for k, v in kwargs.items() if k in {c.name for c in Payment.__table__.columns}},
        )
        db.add(payment)
        try:
            db.flush()
        except IntegrityError as e:
            logger.error(f"create_payment 唯一约束冲突: {e}")
            raise
        db.refresh(payment)
        return payment


def query_payment_by_order_no(order_no: str) -> Payment | None:
    """按订单号查询支付记录."""
    with get_session() as db:
        return db.query(Payment).filter(Payment.order_no == order_no).first()


def update_payment_status(
    payment_id: str,
    status: int,
    pay_no: str | None = None,
    transaction_id: str | None = None,
) -> bool:
    """更新支付状态. status: 0=待支付 1=已支付 2=已退款 3=已关闭 4=失败."""
    with get_session() as db:
        p = db.query(Payment).filter(Payment.id == payment_id).first()
        if not p:
            return False
        p.status = status
        if pay_no is not None:
            p.pay_no = pay_no
        if transaction_id is not None:
            p.transaction_id = transaction_id
        return True


def list_payments_by_user(
    user_id: str,
    status: int | None = None,
    page: int = 1,
    page_size: int = 20,
) -> list[Payment]:
    """查询某用户的支付记录."""
    with get_session() as db:
        q = db.query(Payment).filter(Payment.user_id == user_id)
        if status is not None:
            q = q.filter(Payment.status == status)
        return q.order_by(Payment.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()


# ---------------------------------------------------------------------------
# PaymentConfig 业务方法
# ---------------------------------------------------------------------------

def get_payment_config(platform_code: str, config_key: str) -> str | None:
    """读取某平台某配置项."""
    with get_session() as db:
        c = (
            db.query(PaymentConfig)
            .filter(
                PaymentConfig.platform_code == platform_code,
                PaymentConfig.config_key == config_key,
                PaymentConfig.status == 1,
            )
            .first()
        )
        return c.config_value if c else None


def upsert_payment_config(
    platform_code: str,
    config_key: str,
    config_value: str,
    platform_name: str | None = None,
    description: str | None = None,
) -> PaymentConfig:
    """新增或更新配置项."""
    with get_session() as db:
        c = (
            db.query(PaymentConfig)
            .filter(
                PaymentConfig.platform_code == platform_code,
                PaymentConfig.config_key == config_key,
            )
            .first()
        )
        if c is None:
            c = PaymentConfig(
                platform_code=platform_code,
                config_key=config_key,
                config_value=config_value,
                platform_name=platform_name,
                description=description,
                status=1,
            )
            db.add(c)
        else:
            c.config_value = config_value
            if platform_name is not None:
                c.platform_name = platform_name
            if description is not None:
                c.description = description
        return c
