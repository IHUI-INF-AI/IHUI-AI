"""Commission / finance routes."""

import time
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


@router.get("/list", summary="List commission flows")
async def list_commissions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        from app.models.payment_models import CommissionFlow

        q = db.query(CommissionFlow).filter(CommissionFlow.user_id == user_uuid)
        total = q.count()
        items = q.order_by(CommissionFlow.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": c.id,
                "amount": c.amount,
                "type": c.type,
                "token": c.token,
                "status": c.status,
                "invited_user_id": c.invited_user_id,
                "belongers_open_id": c.belongers_open_id,
                "remark": c.remark,
                "time": c.time,
            }
            for c in items
        ]
        return success(data, total=total)


@router.get("/summary", summary="Get commission summary (today/month/total)")
async def get_summary(user_uuid: str = Depends(require_login)):
    """Mirrors Java getStatistics. Returns day/month/total commission stats
    considering the commissionDay window.
    """
    from sqlalchemy import func

    from app.config import settings
    from app.models.payment_models import CommissionFlow

    with get_session() as db:
        commission_day = settings.AI_COMMISSION_DAY  # default 7

        now_epoch = int(time.time())
        today_start = int(datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).timestamp())
        month_start = int(datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0).timestamp())

        # The Java code calculates stats from (now - commissionDay) onward
        window_start = now_epoch - commission_day * 86400

        # Total commission in the window
        total_amount = (
            db.query(func.sum(CommissionFlow.amount))
            .filter(
                CommissionFlow.user_id == user_uuid,
                CommissionFlow.status == 1,
                CommissionFlow.time >= window_start,
            )
            .scalar()
            or 0
        )
        total_token = (
            db.query(func.sum(CommissionFlow.token))
            .filter(
                CommissionFlow.user_id == user_uuid,
                CommissionFlow.status == 1,
                CommissionFlow.time >= window_start,
            )
            .scalar()
            or 0
        )

        # Today
        today_amount = (
            db.query(func.sum(CommissionFlow.amount))
            .filter(
                CommissionFlow.user_id == user_uuid,
                CommissionFlow.status == 1,
                CommissionFlow.time >= today_start,
            )
            .scalar()
            or 0
        )
        today_token = (
            db.query(func.sum(CommissionFlow.token))
            .filter(
                CommissionFlow.user_id == user_uuid,
                CommissionFlow.status == 1,
                CommissionFlow.time >= today_start,
            )
            .scalar()
            or 0
        )

        # This month
        month_amount = (
            db.query(func.sum(CommissionFlow.amount))
            .filter(
                CommissionFlow.user_id == user_uuid,
                CommissionFlow.status == 1,
                CommissionFlow.time >= month_start,
            )
            .scalar()
            or 0
        )
        month_token = (
            db.query(func.sum(CommissionFlow.token))
            .filter(
                CommissionFlow.user_id == user_uuid,
                CommissionFlow.status == 1,
                CommissionFlow.time >= month_start,
            )
            .scalar()
            or 0
        )

        return success(
            {
                "total_amount": total_amount,
                "total_token": total_token,
                "day": {"amount": today_amount, "token": today_token},
                "month": {"amount": month_amount, "token": month_token},
                "commission_day": commission_day,
            }
        )


@router.get("/orders", summary="我的订单列表(分页+筛选)")
async def list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    order_type: int | None = Query(None, description="订单类型:0=token 1=activity 2=identity 3=agent"),
    status: int | None = Query(None, description="订单状态:0=待支付 1=已支付 2=已退款 3=已取消"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        from app.models.payment_models import Order

        q = db.query(Order).filter(Order.user_id == user_uuid)
        if order_type is not None:
            q = q.filter(Order.order_type == order_type)
        if status is not None:
            q = q.filter(Order.status == status)
        total = q.count()
        items = q.order_by(Order.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": o.id,
                "out_trade_no": o.out_trade_no,
                "amount": o.amount,
                "status": o.status,
                "payment_status": o.payment_status,
                "order_type": o.order_type,
                "product_id": o.product_id,
                "activity_id": o.activity_id,
                "pay_type": o.pay_type,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "paid_at": o.paid_at.isoformat() if o.paid_at else None,
            }
            for o in items
        ]
        return success(data, total=total)


@router.post("/settle/{commission_id}", summary="手动结算佣金流水")
async def settle_commission(
    commission_id: int,
    user_uuid: str = Depends(require_login),
):
    """Mirrors Java updateByIdToSettle: manually mark a commission flow as settled (type=1)."""
    with get_session() as db:
        try:
            from app.models.payment_models import CommissionFlow

            flow = (
                db.query(CommissionFlow)
                .filter(
                    CommissionFlow.id == commission_id,
                    CommissionFlow.user_id == user_uuid,
                )
                .first()
            )
            if not flow:
                return error("佣金流水不存在")
            flow.type = 1
            db.commit()
            return success({"id": flow.id, "type": flow.type})
        except Exception as e:
            logger.error(f"Settle commission error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 接入 commission_service (按订单触发分润 + 比例缓存管理)
# ---------------------------------------------------------------------------

@router.post("/feedback-invite/{out_trade_no}", summary="按订单号触发邀请分润")
async def feedback_invite_by_order(out_trade_no: str, _user: str = Depends(require_login)):
    """按订单号触发邀请分润 (commission_service.feedback_invite_by_order).

    通常由支付成功回调自动调用, 此端点用于:
    1. 补偿: 支付成功但分润失败时手工触发
    2. 调试: 联调环境验证
    """
    try:
        from app.services.commission_service import feedback_invite_by_order as _feedback

        _feedback(out_trade_no)
        return success({"out_trade_no": out_trade_no, "status": "processed"})
    except Exception as e:
        logger.error(f"feedback_invite_by_order failed: {e}")
        return error(str(e))


@router.post("/invalidate-proportion-cache", summary="失效分润比例缓存")
async def invalidate_proportion_cache(_user: str = Depends(require_login)):
    """手动失效 _get_cached_active_proportion 的 lru_cache.

    当运营修改 IdentityProportion 表后, 调用此接口让下次分润生效.
    """
    from app.services.commission_service import invalidate_proportion_cache as _inv

    _inv()
    return success({"status": "invalidated"})


@router.get("/active-proportion", summary="查询当前生效的分润比例")
async def get_active_proportion(_user: str = Depends(require_login)):
    """读取当前生效的 IdentityProportion (含缓存版本)."""
    from app.services.commission_service import _get_cached_active_proportion

    p = _get_cached_active_proportion()
    if not p:
        return error("当前没有生效的分润比例")
    return success(p)
