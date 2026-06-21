"""VIP management routes."""

import json
from datetime import datetime, timedelta

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
    """Create a new VIP subscription for the current user.

    If the user already has an active subscription that hasn't expired,
    the new subscription starts after the existing one ends.
    """
    db = SessionFactory2()
    try:
        from app.models.user_models import UserVip, VipLevel

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

        # Determine start time: extend existing active subscription or start now
        now = datetime.utcnow()
        existing = (
            db.query(UserVip)
            .filter(
                UserVip.user_uuid == user_uuid,
                UserVip.status == 1,
                UserVip.end_time > now,
            )
            .order_by(UserVip.end_time.desc())
            .first()
        )
        start_time = existing.end_time if existing else now
        end_time = start_time + timedelta(days=level.duration_days)

        # Build a simple order ID
        import uuid as _uuid

        order_id = f"VIP-{_uuid.uuid4().hex[:16].upper()}"

        record = UserVip(
            user_uuid=user_uuid,
            vip_level_id=level.id,
            level_value=level.level_value,
            start_time=start_time,
            end_time=end_time,
            status=1,
            order_id=order_id,
        )
        db.add(record)

        # Update User.is_vip flag
        from app.models.user_models import User

        db.query(User).filter(User.uuid == user_uuid).update({"is_vip": 1})

        db.commit()
        db.refresh(record)

        return success(
            {
                "order_id": order_id,
                "vip_level_id": level.id,
                "level_name": level.level_name,
                "start_time": str(start_time),
                "end_time": str(end_time),
                "price": level.price,
                "duration_days": level.duration_days,
            },
            msg="VIP subscription created",
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

        now = datetime.utcnow()
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
