"""VIP management routes."""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.database import SessionFactory2
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / response helpers
# ---------------------------------------------------------------------------


class SubscribeRequest(BaseModel):
    """Subscribe VIP request body."""

    vip_level_id: int


def _serialize_level(level) -> dict:
    """Serialize a VipLevel row to dict."""
    benefits = None
    if level.benefits:
        try:
            benefits = json.loads(level.benefits)
        except (json.JSONDecodeError, TypeError):
            benefits = level.benefits
    return {
        "id": level.id,
        "level_name": level.level_name,
        "level_value": level.level_value,
        "price": level.price,
        "duration_days": level.duration_days,
        "benefits": benefits,
        "status": level.status,
        "sort_order": level.sort_order,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/levels", summary="Get all VIP levels")
async def get_vip_levels(user_uuid: str = Depends(require_login)):
    """Return the list of all active VIP levels."""
    db = SessionFactory2()
    try:
        from app.models.user_models import VipLevel

        levels = (
            db.query(VipLevel)
            .filter(VipLevel.status == 1)
            .order_by(VipLevel.sort_order.asc(), VipLevel.level_value.asc())
            .all()
        )
        data = [_serialize_level(lv) for lv in levels]
        return success(data, total=len(data))
    finally:
        db.close()


@router.get("/level/{vip_id}", summary="Get VIP level detail")
async def get_vip_level_detail(vip_id: int, user_uuid: str = Depends(require_login)):
    """Return details of a single VIP level by its ID."""
    db = SessionFactory2()
    try:
        from app.models.user_models import VipLevel

        level = db.query(VipLevel).filter(VipLevel.id == vip_id).first()
        if not level:
            return error("VIP level not found", "404")
        return success(_serialize_level(level))
    finally:
        db.close()


@router.get("/my", summary="Get current user VIP info")
async def get_my_vip(user_uuid: str = Depends(require_login)):
    """Return the current user's VIP subscription: level, expiration, and benefits."""
    db = SessionFactory2()
    try:
        from app.models.user_models import UserVip, VipLevel

        record = (
            db.query(UserVip)
            .filter(UserVip.user_uuid == user_uuid, UserVip.status == 1)
            .order_by(UserVip.end_time.desc())
            .first()
        )
        if not record:
            return success(
                {
                    "is_vip": False,
                    "vip_level_id": None,
                    "level_name": None,
                    "level_value": None,
                    "start_time": None,
                    "end_time": None,
                    "benefits": None,
                }
            )

        level = db.query(VipLevel).filter(VipLevel.id == record.vip_level_id).first()
        benefits = None
        if level and level.benefits:
            try:
                benefits = json.loads(level.benefits)
            except (json.JSONDecodeError, TypeError):
                benefits = level.benefits

        return success(
            {
                "is_vip": True,
                "vip_level_id": record.vip_level_id,
                "level_name": level.level_name if level else None,
                "level_value": record.level_value,
                "start_time": str(record.start_time) if record.start_time else None,
                "end_time": str(record.end_time) if record.end_time else None,
                "benefits": benefits,
            }
        )
    finally:
        db.close()


@router.post("/subscribe", summary="Subscribe VIP (create order)")
async def subscribe_vip(
    body: SubscribeRequest,
    user_uuid: str = Depends(require_login),
):
    """Create a pending VIP subscription order for the current user.

    安全修复: 不再直接激活 VIP, 仅创建待支付订单 (status=0, payment_status=0).
    VIP 状态在支付回调 /api/v1/orders/pay_callback 成功后激活.
    前端拿到返回的 out_trade_no / amount 后发起支付.
    """
    db = SessionFactory2()
    try:
        from app.models.payment_models import Order
        from app.models.user_models import VipLevel
        from app.utils.order_generator import order_generator

        level = (
            db.query(VipLevel)
            .filter(
                VipLevel.id == body.vip_level_id,
                VipLevel.status == 1,
            )
            .first()
        )
        if not level:
            return error("VIP level not found or disabled", "404")

        # 生成商户订单号并创建待支付订单 (status=0 pending, payment_status=0 unpaid)
        # order_type=2 (identity) 表示 VIP 身份订单, product_id 记录 vip_level_id
        out_trade_no = order_generator.generate()
        order = Order(
            user_id=user_uuid,
            out_trade_no=out_trade_no,
            amount=level.price,
            status=0,
            payment_status=0,
            product_id=str(level.id),
            order_type=2,
            pay_type="wechat",
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        # 注意: 此处不创建 UserVip 记录, 也不设置 user.is_vip=1.
        # VIP 状态在支付回调 /api/v1/orders/pay_callback 成功后激活:
        #   - 创建 UserVip 记录 (status=1, start_time/end_time 按 duration_days 计算)
        #   - 更新 User.is_vip=1

        return success(
            {
                "order_id": order.id,
                "out_trade_no": out_trade_no,
                "vip_level_id": level.id,
                "level_name": level.level_name,
                "amount": level.price,
                "price": level.price,
                "duration_days": level.duration_days,
                "status": order.status,
                "payment_status": order.payment_status,
            },
            msg="VIP 订单已创建, 请完成支付后激活 VIP",
        )
    except Exception as e:
        db.rollback()
        return error(f"Subscription failed: {e}")
    finally:
        db.close()


@router.get("/check", summary="Check current user VIP status")
async def check_vip(user_uuid: str = Depends(require_login)):
    """Quickly check whether the current user is an active VIP and what level."""
    db = SessionFactory2()
    try:
        from app.models.user_models import UserVip, VipLevel

        now = datetime.now(timezone.utc)
        record = (
            db.query(UserVip)
            .filter(
                UserVip.user_uuid == user_uuid,
                UserVip.status == 1,
                UserVip.end_time > now,
            )
            .order_by(UserVip.level_value.desc())
            .first()
        )
        if not record:
            return success(
                {
                    "is_vip": False,
                    "vip_level_id": None,
                    "level_name": None,
                    "level_value": 0,
                }
            )

        level = db.query(VipLevel).filter(VipLevel.id == record.vip_level_id).first()

        return success(
            {
                "is_vip": True,
                "vip_level_id": record.vip_level_id,
                "level_name": level.level_name if level else None,
                "level_value": record.level_value,
            }
        )
    finally:
        db.close()
