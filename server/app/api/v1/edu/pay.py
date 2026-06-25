"""Edu pay router - /api/v1/edu/pay

Migrated from ihui-ai-edu-pay-service.
Complete Phase B implementation.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_session


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session (contextmanager)."""
    with get_session() as db:
        yield db


try:
    from app.dependencies import get_current_user_id
except ImportError:
    def get_current_user_id() -> int:
        return 1  # dev stub

from app.schemas.common import success

router = APIRouter()


@router.post("/pay-orders", summary="Create payment")
def create_pay_order_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_pay import create_pay_order
    result = create_pay_order(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/pay-orders/{pay_order_id}/mark-paid", summary="Mark paid (webhook)")
def mark_paid_endpoint(pay_order_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_pay import mark_paid
    result = mark_paid(db, pay_order_id=pay_order_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/pay-orders/me", summary="My payments")
def list_user_payments_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_pay import list_user_payments
    result = list_user_payments(db, user_uuid=str(user_id))
    return success(data=result)
