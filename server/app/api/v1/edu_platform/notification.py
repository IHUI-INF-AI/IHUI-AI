"""通知模块路由 - 迁移自旧 Java Spring Boot notification-service (2026-07-06).

包含: 站内信(发送/批量发送/我的列表/标记已读/全部已读/未读数/删除) +
设备管理(注册/删除/我的设备列表).
"""
from datetime import datetime

from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import EduNotification, EduNotificationDevice
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 站内信
# ---------------------------------------------------------------------------


def _notification_to_dict(n: EduNotification) -> dict:
    return {
        "id": n.id,
        "member_id": n.member_id,
        "sender_id": n.sender_id,
        "title": n.title,
        "content": n.content,
        "notif_type": n.notif_type,
        "channel": n.channel,
        "is_read": n.is_read,
        "ref_id": n.ref_id,
        "ref_type": n.ref_type,
        "read_time": n.read_time.isoformat() if n.read_time else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.post("/notifications", summary="发送通知")
async def send_notification(
    member_id: int = Body(..., description="接收会员id"),
    title: str | None = Body(None, max_length=200),
    content: str | None = Body(None),
    sender_id: int | None = Body(None, description="发送者id"),
    notif_type: str = Body("system", description="类型: system/announcement/private/order/comment/like"),
    channel: str = Body("letter", description="渠道: letter/email/sms/push"),
    ref_id: int | None = Body(None),
    ref_type: str | None = Body(None, max_length=50),
):
    with get_session() as db:
        try:
            n = EduNotification(
                member_id=member_id,
                sender_id=sender_id,
                title=title,
                content=content,
                notif_type=notif_type,
                channel=channel,
                ref_id=ref_id,
                ref_type=ref_type,
            )
            db.add(n)
            db.flush()
            return success({"id": n.id})
        except Exception as e:
            logger.error(f"[edu notification] send notification error: {e}")
            return error(str(e))


@router.post("/notifications/batch", summary="批量发送通知")
async def batch_send_notification(
    member_ids: list[int] = Body(..., description="接收会员id列表"),
    title: str | None = Body(None, max_length=200),
    content: str | None = Body(None),
    sender_id: int | None = Body(None),
    notif_type: str = Body("system"),
    channel: str = Body("letter"),
    ref_id: int | None = Body(None),
    ref_type: str | None = Body(None, max_length=50),
):
    with get_session() as db:
        try:
            if not member_ids:
                return error("会员id列表不能为空")
            created_ids: list[int] = []
            for mid in member_ids:
                n = EduNotification(
                    member_id=mid,
                    sender_id=sender_id,
                    title=title,
                    content=content,
                    notif_type=notif_type,
                    channel=channel,
                    ref_id=ref_id,
                    ref_type=ref_type,
                )
                db.add(n)
                db.flush()
                created_ids.append(n.id)
            return success({"ids": created_ids, "count": len(created_ids)})
        except Exception as e:
            logger.error(f"[edu notification] batch send notification error: {e}")
            return error(str(e))


@router.get("/notifications/unread-count", summary="未读通知数量")
async def unread_count(member_id: int = Query(..., description="会员id")):
    with get_session() as db:
        try:
            count = (
                db.query(EduNotification)
                .filter(
                    EduNotification.member_id == member_id,
                    EduNotification.is_read == False,  # noqa: E712
                )
                .count()
            )
            return success({"count": count})
        except Exception as e:
            logger.error(f"[edu notification] unread count error: {e}")
            return error(str(e))


@router.get("/notifications/me", summary="我的通知列表")
async def my_notifications(
    member_id: int = Query(..., description="会员id"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    is_read: bool | None = Query(None, description="是否已读筛选"),
):
    with get_session() as db:
        try:
            q = db.query(EduNotification).filter(EduNotification.member_id == member_id)
            if is_read is not None:
                q = q.filter(EduNotification.is_read == is_read)
            total = q.count()
            items = (
                q.order_by(EduNotification.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_notification_to_dict(n) for n in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu notification] my notifications error: {e}")
            return error(str(e))


@router.put("/notifications/read-all", summary="全部标记已读")
async def read_all_notifications(member_id: int = Body(..., embed=True, description="会员id")):
    with get_session() as db:
        try:
            now = datetime.utcnow()
            updated = (
                db.query(EduNotification)
                .filter(
                    EduNotification.member_id == member_id,
                    EduNotification.is_read == False,  # noqa: E712
                )
                .update({EduNotification.is_read: True, EduNotification.read_time: now})
            )
            return success({"updated": updated})
        except Exception as e:
            logger.error(f"[edu notification] read all error: {e}")
            return error(str(e))


@router.put("/notifications/{id}/read", summary="标记通知已读")
async def mark_notification_read(id: int):
    with get_session() as db:
        try:
            n = db.query(EduNotification).filter(EduNotification.id == id).first()
            if not n:
                return error("通知不存在", "404")
            if not n.is_read:
                n.is_read = True
                n.read_time = datetime.utcnow()
            return success({"id": n.id, "is_read": n.is_read})
        except Exception as e:
            logger.error(f"[edu notification] mark read error: {e}")
            return error(str(e))


@router.delete("/notifications/{id}", summary="删除通知")
async def delete_notification(id: int):
    with get_session() as db:
        try:
            n = db.query(EduNotification).filter(EduNotification.id == id).first()
            if not n:
                return error("通知不存在", "404")
            db.delete(n)
            return success()
        except Exception as e:
            logger.error(f"[edu notification] delete error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 设备管理
# ---------------------------------------------------------------------------


def _device_to_dict(d: EduNotificationDevice) -> dict:
    return {
        "id": d.id,
        "member_id": d.member_id,
        "device_type": d.device_type,
        "device_token": d.device_token,
        "is_active": d.is_active,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


@router.get("/devices/me", summary="我的设备列表")
async def my_devices(member_id: int = Query(..., description="会员id")):
    with get_session() as db:
        try:
            items = (
                db.query(EduNotificationDevice)
                .filter(EduNotificationDevice.member_id == member_id)
                .order_by(EduNotificationDevice.id.desc())
                .all()
            )
            return success([_device_to_dict(d) for d in items])
        except Exception as e:
            logger.error(f"[edu notification] my devices error: {e}")
            return error(str(e))


@router.post("/devices", summary="注册设备")
async def register_device(
    member_id: int = Body(..., description="会员id"),
    device_type: str | None = Body(None, max_length=50, description="设备类型: ios/android/web"),
    device_token: str | None = Body(None, max_length=500, description="设备token"),
    is_active: bool = Body(True),
):
    with get_session() as db:
        try:
            # 若同一 token 已存在则更新, 避免重复注册
            if device_token:
                existing = (
                    db.query(EduNotificationDevice)
                    .filter(
                        EduNotificationDevice.member_id == member_id,
                        EduNotificationDevice.device_token == device_token,
                    )
                    .first()
                )
                if existing:
                    existing.device_type = device_type or existing.device_type
                    existing.is_active = is_active
                    return success({"id": existing.id})
            d = EduNotificationDevice(
                member_id=member_id,
                device_type=device_type,
                device_token=device_token,
                is_active=is_active,
            )
            db.add(d)
            db.flush()
            return success({"id": d.id})
        except Exception as e:
            logger.error(f"[edu notification] register device error: {e}")
            return error(str(e))


@router.delete("/devices/{id}", summary="删除设备")
async def delete_device(id: int):
    with get_session() as db:
        try:
            d = db.query(EduNotificationDevice).filter(EduNotificationDevice.id == id).first()
            if not d:
                return error("设备不存在", "404")
            db.delete(d)
            return success()
        except Exception as e:
            logger.error(f"[edu notification] delete device error: {e}")
            return error(str(e))
