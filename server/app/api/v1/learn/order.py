"""学习模块 - 订单

路径对齐前端 client/src/api/admin.ts:
  - GET  /learn/order/list                 订单列表
  - GET  /learn/order/invoice-title        当前用户发票抬头列表
  - GET  /learn/order/invoice-application  发票申请 (传 order_id + invoice_title 时触发申请, 需 admin)
"""
from fastapi import APIRouter, Depends, Query, Request
from loguru import logger

from app.core.admin_auth import admin_required
from app.core.current_user import get_current_user_id
from app.database import get_session
from app.models.learn_models import LearnOrder
from app.schemas.common import ErrorCode, error, success

router = APIRouter()


def _serialize(o: LearnOrder) -> dict:
    return {
        "id": o.id,
        "order_no": o.order_no,
        "member_id": o.member_id,
        "lesson_id": o.lesson_id,
        "amount": float(o.amount) if o.amount is not None else 0,
        "status": o.status,
        "pay_type": o.pay_type,
        "invoice_title": o.invoice_title,
        "invoice_status": o.invoice_status,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


@router.get("/order/list", summary="订单列表")
async def list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    member_id: str | None = None,
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(LearnOrder)
            if member_id:
                q = q.filter(LearnOrder.member_id == member_id)
            if status:
                q = q.filter(LearnOrder.status == status)
            total = q.count()
            items = q.order_by(LearnOrder.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_serialize(o) for o in items], total=total)
        except Exception as e:
            logger.error(f"learn order list error: {e}")
            return error(str(e))


@router.get("/order/invoice-title", summary="当前用户发票抬头列表")
async def list_invoice_titles(member_id: str = Depends(get_current_user_id)):
    with get_session() as db:
        try:
            rows = (
                db.query(LearnOrder.invoice_title)
                .filter(LearnOrder.member_id == member_id, LearnOrder.invoice_title.isnot(None))
                .distinct()
                .all()
            )
            titles = [r[0] for r in rows if r[0]]
            return success(titles, total=len(titles))
        except Exception as e:
            logger.error(f"learn order invoice title error: {e}")
            return error(str(e))


@router.get("/order/invoice-application", summary="发票申请")
async def invoice_application(
    request: Request,
    order_id: int | None = Query(None, description="订单id, 与 invoice_title 同时传入则触发申请"),
    invoice_title: str | None = Query(None, description="发票抬头, 与 order_id 同时传入则触发申请"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    member_id: str = Depends(get_current_user_id),
):
    # 传入选填参数时: 执行发票申请 (更新订单发票抬头与状态), 需 admin 权限
    if order_id is not None and invoice_title:
        await admin_required(request)
        with get_session() as db:
            try:
                o = db.query(LearnOrder).filter(LearnOrder.id == order_id).first()
                if not o:
                    return error("订单不存在", ErrorCode.NOT_FOUND)
                o.invoice_title = invoice_title
                o.invoice_status = "pending"
                return success({"id": o.id, "invoice_status": o.invoice_status})
            except Exception as e:
                logger.error(f"learn order invoice application error: {e}")
                return error(str(e))

    # 未传申请参数: 返回当前用户的订单发票信息列表
    with get_session() as db:
        try:
            q = db.query(LearnOrder).filter(LearnOrder.member_id == member_id)
            total = q.count()
            items = q.order_by(LearnOrder.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": o.id,
                        "order_no": o.order_no,
                        "invoice_title": o.invoice_title,
                        "invoice_status": o.invoice_status,
                    }
                    for o in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"learn order invoice application list error: {e}")
            return error(str(e))
