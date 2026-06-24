"""edu_order service - Order (migrated from ihui-ai-edu-order-service).

Source: G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-order-service\\
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy import and_, desc, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduOrder
from app.services.edu_base import EduPermissionError, EduValidationError, get_or_404, paginate


def create_order(
    db: Session, user_id: int, order_type: str, items: list, **fields
) -> EduOrder:
    """Create a new order. items: [{entity_id, quantity, price}, ...]"""
    valid_types = {"course", "card", "package"}
    if order_type not in valid_types:
        raise EduValidationError(f"order_type must be one of {valid_types}")
    if not items:
        raise EduValidationError("items required")
    total = sum(i.get("price", 0) * i.get("quantity", 1) for i in items)
    discount = fields.get("discount_amount", 0)
    order = EduOrder(
        order_no=f"ORD{datetime.now().strftime('%Y%m%d%H%M%S')}{secrets.token_hex(3).upper()}",
        user_id=user_id, order_type=order_type,
        total_amount=total, paid_amount=0, discount_amount=discount,
        status="pending",
        expire_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        remark=fields.get("remark"),
    )
    db.add(order)
    db.flush()
    db.refresh(order)
    return order


def cancel_order(db: Session, order_id: int, user_id: int) -> EduOrder:
    o = get_or_404(db, EduOrder, order_id, "order")
    if o.user_id != user_id:
        raise EduPermissionError("not your order")
    if o.status not in ("pending",):
        raise EduValidationError(f"cannot cancel order in status: {o.status}")
    o.status = "cancelled"
    db.flush()
    db.refresh(o)
    return o


def refund_order(db: Session, order_id: int, user_id: int, amount: float) -> EduOrder:
    o = get_or_404(db, EduOrder, order_id, "order")
    if o.user_id != user_id:
        raise EduPermissionError("not your order")
    if o.status != "paid":
        raise EduValidationError(f"cannot refund order in status: {o.status}")
    if amount > float(o.paid_amount):
        raise EduValidationError("refund amount exceeds paid amount")
    o.status = "refunded"
    db.flush()
    db.refresh(o)
    return o


def list_user_orders(
    db: Session, user_id: int, page: int = 1, size: int = 20,
    status: Optional[str] = None, order_type: Optional[str] = None,
) -> Tuple[List[EduOrder], int]:
    filters = [EduOrder.user_id == user_id]
    if status:
        filters.append(EduOrder.status == status)
    if order_type:
        filters.append(EduOrder.order_type == order_type)
    return paginate(db, EduOrder, page=page, size=size, filters=filters, order_by=desc(EduOrder.created_at))


def get_order(db: Session, order_id: int) -> EduOrder:
    return get_or_404(db, EduOrder, order_id, "order")


def get_order_by_no(db: Session, order_no: str) -> EduOrder:
    o = db.execute(select(EduOrder).where(EduOrder.order_no == order_no)).scalar_one_or_none()
    if not o:
        from app.services.edu_base import EduNotFoundError
        raise EduNotFoundError("order", 0)
    return o
