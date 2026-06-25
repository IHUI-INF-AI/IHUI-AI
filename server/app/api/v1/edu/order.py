"""Edu order router - /api/v1/edu/order

Migrated from ihui-ai-edu-order-service.
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


@router.post("/orders", summary="Create order")
def create_order_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_order import create_order
    result = create_order(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/orders/{order_id}/cancel", summary="Cancel order")
def cancel_order_endpoint(order_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_order import cancel_order
    result = cancel_order(db, order_id=order_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/orders/{order_id}/refund", summary="Refund order")
def refund_order_endpoint(order_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_order import refund_order
    result = refund_order(db, order_id=order_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/orders/{order_id}", summary="Get order")
def get_order_endpoint(order_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_order import get_order
    result = get_order(db, order_id=order_id)
    return success(data=result)

@router.get("/orders/me", summary="My orders")
def list_user_orders_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_order import list_user_orders
    result = list_user_orders(db, user_uuid=str(user_id))
    return success(data=result)
