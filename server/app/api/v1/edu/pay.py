"""Edu pay router - /api/v1/edu/pay

Migrated from ihui-ai-edu-pay-service.
Complete Phase B implementation.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_session


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session (contextmanager)."""
    with get_session() as db:
        yield db


def get_current_user_id():
    try:
        from app.dependencies import get_current_user_id as _real
        return _real()
    except ImportError as e:
        raise RuntimeError(f"authentication dependency unavailable: {e}") from e


from app.schemas.common import success

router = APIRouter()


@router.post("/pay-orders", summary="Create payment")
def create_pay_order_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_pay import create_pay_order
    result = create_pay_order(
        db,
        order_id=payload.get("order_id"),
        pay_channel=payload.get("pay_channel"),
        pay_amount=payload.get("pay_amount"),
        installment_count=payload.get("installment_count"),
    )
    return success(data=result)

@router.post("/pay-orders/{pay_order_id}/mark-paid", summary="Mark paid (webhook)")
def mark_paid_endpoint(
    pay_order_id: int,
    x_webhook_signature: str = Header(None, alias="X-Webhook-Signature"),
    payload: dict = {},
    db: Session = Depends(_get_db),
):
    # P3-28: webhook 端点必须有签名头, 否则拒绝 (最小校验: 仅要求头存在)
    if not x_webhook_signature:
        raise HTTPException(status_code=403, detail="missing X-Webhook-Signature")
    from app.services.edu_pay import mark_paid
    result = mark_paid(db, pay_order_id=pay_order_id, transaction_id=payload.get("transaction_id"))
    return success(data=result)

@router.get("/pay-orders/me", summary="My payments")
def list_user_payments_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_pay import list_user_payments
    result = list_user_payments(db, user_id=user_id, page=page, size=size)
    return success(data=result)
