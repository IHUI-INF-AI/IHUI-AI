"""订单明细管理 - 订单商品 / 订单支付 (历史 t_order_item / t_order_payment)"""

from fastapi import APIRouter, Body, Depends, Query
from loguru import logger

from app.database import get_session
from app.models.order_models import OrderItem, OrderPayment
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


def _item_to_dict(it: OrderItem) -> dict:
    return {
        "id": it.id,
        "order_id": it.order_id,
        "item_id": it.item_id,
        "title": it.title,
        "image": it.image,
        "original_price": str(it.original_price) if it.original_price is not None else None,
        "price": str(it.price) if it.price is not None else None,
        "quantity": it.quantity,
        "payment_amount": str(it.payment_amount) if it.payment_amount is not None else None,
        "create_time": it.created_at.isoformat() if it.created_at else None,
        "update_time": it.updated_at.isoformat() if it.updated_at else None,
    }


def _payment_to_dict(p: OrderPayment) -> dict:
    return {
        "id": p.id,
        "order_id": p.order_id,
        "status": p.status,
        "channel": p.channel,
        "amount": str(p.amount) if p.amount is not None else None,
        "create_time": p.created_at.isoformat() if p.created_at else None,
        "update_time": p.updated_at.isoformat() if p.updated_at else None,
    }


# ============ Order item ============


@router.get("/order-items/list", summary="订单商品列表(分页+筛选)")
async def list_order_items(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    order_id: int | None = Query(None, description="按订单id筛选"),
    _user: str = Depends(require_login),
):
    with get_session() as db:
        try:
            q = db.query(OrderItem)
            if order_id is not None:
                q = q.filter(OrderItem.order_id == order_id)
            total = q.count()
            items = (
                q.order_by(OrderItem.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success([_item_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"order item list error: {e}")
            return error(str(e))


@router.get("/order-items/{item_id}", summary="订单商品详情")
async def get_order_item(
    item_id: int,
    _user: str = Depends(require_login),
):
    with get_session() as db:
        try:
            it = db.query(OrderItem).filter(OrderItem.id == item_id).first()
            if not it:
                return error("订单商品不存在", "404")
            return success(_item_to_dict(it))
        except Exception as e:
            logger.error(f"order item get error: {e}")
            return error(str(e))


@router.post("/order-items/create", summary="创建订单商品")
async def create_order_item(
    order_id: int = Body(..., description="订单id(必填)"),
    item_id: str = Body(..., description="商品id"),
    title: str = Body(..., description="标题"),
    image: str = Body(..., description="图片"),
    original_price: float = Body(..., description="原价"),
    price: float = Body(..., description="价格"),
    quantity: int = Body(..., description="数量"),
    payment_amount: float = Body(..., description="付款金额"),
    _user: str = Depends(require_login),
):
    with get_session() as db:
        try:
            it = OrderItem(
                order_id=order_id,
                item_id=item_id,
                title=title,
                image=image,
                original_price=original_price,
                price=price,
                quantity=quantity,
                payment_amount=payment_amount,
            )
            db.add(it)
            db.flush()
            return success(_item_to_dict(it))
        except Exception as e:
            logger.error(f"order item create error: {e}")
            return error(str(e))


@router.delete("/order-items/{item_id}", summary="删除订单商品")
async def delete_order_item(
    item_id: int,
    _user: str = Depends(require_login),
):
    with get_session() as db:
        try:
            it = db.query(OrderItem).filter(OrderItem.id == item_id).first()
            if not it:
                return error("订单商品不存在", "404")
            db.delete(it)
            return success()
        except Exception as e:
            logger.error(f"order item delete error: {e}")
            return error(str(e))


# ============ Order payment ============


@router.get("/order-payments/list", summary="订单支付列表(分页+筛选)")
async def list_order_payments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    order_id: int | None = Query(None, description="按订单id筛选"),
    _user: str = Depends(require_login),
):
    with get_session() as db:
        try:
            q = db.query(OrderPayment)
            if order_id is not None:
                q = q.filter(OrderPayment.order_id == order_id)
            total = q.count()
            items = (
                q.order_by(OrderPayment.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success([_payment_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"order payment list error: {e}")
            return error(str(e))


@router.get("/order-payments/{payment_id}", summary="订单支付详情")
async def get_order_payment(
    payment_id: int,
    _user: str = Depends(require_login),
):
    with get_session() as db:
        try:
            p = db.query(OrderPayment).filter(OrderPayment.id == payment_id).first()
            if not p:
                return error("订单支付不存在", "404")
            return success(_payment_to_dict(p))
        except Exception as e:
            logger.error(f"order payment get error: {e}")
            return error(str(e))


@router.post("/order-payments/create", summary="创建订单支付")
async def create_order_payment(
    order_id: int = Body(..., description="订单id(必填)"),
    status: str = Body(..., description="状态"),
    channel: str = Body(..., description="渠道"),
    amount: float = Body(..., description="金额"),
    _user: str = Depends(require_login),
):
    with get_session() as db:
        try:
            p = OrderPayment(
                order_id=order_id,
                status=status,
                channel=channel,
                amount=amount,
            )
            db.add(p)
            db.flush()
            return success(_payment_to_dict(p))
        except Exception as e:
            logger.error(f"order payment create error: {e}")
            return error(str(e))


@router.put("/order-payments/{payment_id}/status", summary="更新订单支付状态")
async def update_order_payment_status(
    payment_id: int,
    status: str = Body(..., description="状态"),
    _user: str = Depends(require_login),
):
    with get_session() as db:
        try:
            p = db.query(OrderPayment).filter(OrderPayment.id == payment_id).first()
            if not p:
                return error("订单支付不存在", "404")
            p.status = status
            return success(_payment_to_dict(p))
        except Exception as e:
            logger.error(f"order payment update status error: {e}")
            return error(str(e))
