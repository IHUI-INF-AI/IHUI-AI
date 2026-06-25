"""Edu order router - /api/v1/edu/order

Migrated from ihui-ai-edu-order-service.
Complete Phase B implementation.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
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


@router.post("/orders", summary="Create order")
def create_order_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_order import create_order
    order_type = payload.get("order_type")
    items = payload.get("items") or []
    extra = {k: v for k, v in payload.items() if k not in ("order_type", "items") and v is not None}
    result = create_order(db, user_id=user_id, order_type=order_type, items=items, **extra)
    return success(data=result)

@router.post("/orders/{order_id}/cancel", summary="Cancel order")
def cancel_order_endpoint(order_id: int, user_id: int = Depends(get_current_user_id), db: Session = Depends(_get_db)):
    from app.services.edu_order import cancel_order
    result = cancel_order(db, order_id=order_id, user_id=user_id)
    return success(data=result)

@router.post("/orders/{order_id}/refund", summary="Refund order")
def refund_order_endpoint(order_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_order import refund_order, get_order
    # 归属校验: service 层也会校验, router 层前置拦截以返回 403
    order = get_order(db, order_id=order_id)
    if str(order.user_id) != str(user_id):
        raise HTTPException(status_code=403, detail="not your order")
    result = refund_order(db, order_id=order_id, user_id=user_id, amount=payload.get("amount"))
    return success(data=result)

@router.get("/orders/{order_id}", summary="Get order")
def get_order_endpoint(order_id: int, user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_order import get_order
    result = get_order(db, order_id=order_id)
    # 归属校验: service 层 get_order 不做归属检查, router 层补
    if str(result.user_id) != str(user_id):
        raise HTTPException(status_code=403, detail="not your order")
    return success(data=result)

@router.get("/orders/me", summary="My orders")
def list_user_orders_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_order import list_user_orders
    result = list_user_orders(db, user_id=user_id, page=page, size=size)
    return success(data=result)
