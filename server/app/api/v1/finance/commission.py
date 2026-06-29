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
