"""edu_order service - Order (migrated from ihui-ai-edu-order-service).

Phase F: Order (IHUI-AI) uses user_id, out_trade_no, amount, status.
"""
from __future__ import annotations

import secrets
from datetime import datetime

from sqlalchemy import desc

from app.models.edu_models import EduOrder
from app.services.edu_base import EduPermissionError, EduValidationError, get_or_404, paginate


def create_order(
    db: Session, user_id: str, order_type: str, items: list, **fields
) -> EduOrder:
    """Create a new order. Phase F: stores in IHUI-AI Order table."""
    if not items:
        raise EduValidationError("items required")
    total = sum(i.get("price", 0) * i.get("quantity", 1) for i in items)
    o = EduOrder(
        user_id=str(user_id),
        out_trade_no=f"ORD{datetime.now().strftime('%Y%m%d%H%M%S')}{secrets.token_hex(3).upper()}",
        amount=total,
        status="pending",
    )
    db.add(o)
    db.flush()
    db.refresh(o)
    return o


def cancel_order(db: Session, order_id: int, user_id: str) -> EduOrder:
    o = get_or_404(db, EduOrder, order_id, "order")
    if o.user_id != str(user_id):
        raise EduPermissionError("not your order")
    if o.status not in ("pending",):
        raise EduValidationError(f"cannot cancel order in status: {o.status}")
    o.status = "cancelled"
    db.flush()
    db.refresh(o)
    return o


def refund_order(db: Session, order_id: int, user_id: str, amount: float) -> EduOrder:
    o = get_or_404(db, EduOrder, order_id, "order")
    if o.user_id != str(user_id):
        raise EduPermissionError("not your order")
    if o.status != "paid":
        raise EduValidationError(f"cannot refund order in status: {o.status}")
    o.status = "refunded"
    db.flush()
    db.refresh(o)
    return o


def list_user_orders(
    db: Session, user_id: str, page: int = 1, size: int = 20,
    status: Optional[str] = None,
) -> Tuple[List[EduOrder], int]:
    filters = [EduOrder.user_id == str(user_id)]
    if status:
        filters.append(EduOrder.status == status)
    return paginate(db, EduOrder, page=page, size=size, filters=filters, order_by=desc(EduOrder.created_at))


def get_order(db: Session, order_id: int) -> EduOrder:
    return get_or_404(db, EduOrder, order_id, "order")
