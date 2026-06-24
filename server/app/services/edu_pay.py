"""edu_pay service - Payment (migrated from ihui-ai-edu-pay-service).

Source: G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-pay-service\\
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import and_, desc, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduOrder, EduPayOrder
from app.services.edu_base import EduValidationError, get_or_404, paginate


def create_pay_order(
    db: Session, order_id: int, pay_channel: str, pay_amount: float,
    installment_count: Optional[int] = None,
) -> EduPayOrder:
    """Create a payment record for an order."""
    valid_channels = {"wechat", "alipay", "installment", "balance"}
    if pay_channel not in valid_channels:
        raise EduValidationError(f"pay_channel must be one of {valid_channels}")
    order = get_or_404(db, EduOrder, order_id, "order")
    if order.status != "pending":
        raise EduValidationError(f"order not in pending status: {order.status}")
    po = EduPayOrder(
        order_id=order_id, pay_channel=pay_channel,
        pay_amount=pay_amount, pay_status="pending",
    )
    db.add(po)
    db.flush()
    db.refresh(po)
    return po


def mark_paid(
    db: Session, pay_order_id: int, transaction_id: str
) -> EduPayOrder:
    """Mark payment as paid (called by payment webhook)."""
    po = get_or_404(db, EduPayOrder, pay_order_id, "pay_order")
    if po.pay_status == "paid":
        return po
    po.pay_status = "paid"
    po.transaction_id = transaction_id
    po.paid_at = datetime.now(timezone.utc)
    # Also update the order
    order = db.get(EduOrder, po.order_id)
    if order:
        order.status = "paid"
        order.pay_method = po.pay_channel
        order.paid_at = po.paid_at
    db.flush()
    db.refresh(po)
    return po


def list_user_payments(
    db: Session, user_id: int, page: int = 1, size: int = 20,
    pay_status: Optional[str] = None,
):
    return paginate(
        db, EduPayOrder, page=page, size=size,
        filters=[
            EduPayOrder.order_id.in_(
                select(EduOrder.id).where(EduOrder.user_id == user_id)
            ),
            pay_status and EduPayOrder.pay_status == pay_status,
        ],
    )
