"""通知系统 - 邮件/短信/站内推送统一管理"""

from datetime import datetime

from fastapi import APIRouter, Query
from loguru import logger

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.notification_models import (
    Notification,
    NotificationChannel,
    NotificationLog,
    NotificationSubscription,
)
from app.schemas.common import error, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

@router.post("/send", summary="发送通知")
async def send_notification(
    user_id: str | None = None,
    title: str = Query(..., min_length=1, max_length=200),
    content: str = Query(..., min_length=1),
    type: str = "site",
    channel: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    target_url: str | None = None,
    user_ids: str | None = None,
):
    """发送通知: user_id(单用户) 或 user_ids(逗号分隔多用户)"""
    with get_session() as db:
        try:
            targets = []
            if user_ids:
                targets = [i.strip() for i in user_ids.split(",") if i.strip()]
            elif user_id:
                targets = [user_id]
            if not targets:
                n = Notification(
                    user_id=None,
                    title=title,
                    content=content,
                    type=type,
                    channel=channel,
                    target_type=target_type,
                    target_id=target_id,
                    target_url=target_url,
                    status=1,
                    send_time=datetime.utcnow(),
                )
                db.add(n)
                return success({"id": n.id, "scope": "all"})
            ids = []
            for uid in targets:
                n = Notification(
                    user_id=uid,
                    title=title,
                    content=content,
                    type=type,
                    channel=channel,
                    target_type=target_type,
                    target_id=target_id,
                    target_url=target_url,
                    status=1,
                    send_time=datetime.utcnow(),
                )
                db.add(n)
                db.flush()
                db.add(
                    NotificationLog(
                        notification_id=n.id,
                        user_id=uid,
                        channel=channel,
                        type=type,
                        success=True,
                        send_time=datetime.utcnow(),
                    )
                )
                ids.append(n.id)
            return success({"ids": ids, "count": len(ids)})
        except Exception as e:
            logger.error(f"notification send error: {e}")
            return error(str(e))


@router.get("/list", summary="我的通知列表")
async def list_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: str | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(Notification).filter((Notification.user_id == _uid()) | (Notification.user_id.is_(None)))
            if type:
                q = q.filter(Notification.type == type)
            if status is not None:
                q = q.filter(Notification.status == status)
            total = q.count()
            items = q.order_by(Notification.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": n.id,
                        "user_id": n.user_id,
                        "title": n.title,
                        "content": n.content,
                        "type": n.type,
                        "channel": n.channel,
                        "target_type": n.target_type,
                        "target_id": n.target_id,
                        "target_url": n.target_url,
                        "status": n.status,
                        "send_time": n.send_time.isoformat() if n.send_time else None,
                        "read_time": n.read_time.isoformat() if n.read_time else None,
                    }
                    for n in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"notification list error: {e}")
            return error(str(e))


@router.get("/unread-count", operation_id="notification_unread_count", summary="未读通知数")
async def unread_count():
    with get_session() as db:
        try:
            count = (
                db.query(Notification)
                .filter(
                    (Notification.user_id == _uid()) | (Notification.user_id.is_(None)),
                    Notification.status.in_([0, 1]),
                )
                .count()
            )
            return success({"count": count})
        except Exception as e:
            logger.error(f"notification unread count error: {e}")
            return error(str(e))


@router.post("/{nid}/read", summary="标记已读")
async def mark_read(nid: int):
    with get_session() as db:
        try:
            n = db.query(Notification).filter(Notification.id == nid).first()
            if not n:
                return error("通知不存在", "404")
            n.status = 3
            n.read_time = datetime.utcnow()
            return success()
        except Exception as e:
            logger.error(f"notification read error: {e}")
            return error(str(e))


@router.post("/read-all", operation_id="notification_mark_all_read", summary="全部标记已读")
async def mark_all_read():
    with get_session() as db:
        try:
            db.query(Notification).filter(
                (Notification.user_id == _uid()) | (Notification.user_id.is_(None)),
                Notification.status.in_([0, 1]),
            ).update({Notification.status: 3, Notification.read_time: datetime.utcnow()})
            return success()
        except Exception as e:
            logger.error(f"notification read all error: {e}")
            return error(str(e))


@router.delete("/{nid}", summary="删除通知")
async def delete_notification(nid: int):
    with get_session() as db:
        try:
            n = db.query(Notification).filter(Notification.id == nid).first()
            if not n:
                return error("通知不存在", "404")
            db.delete(n)
            return success()
        except Exception as e:
            logger.error(f"notification delete error: {e}")
            return error(str(e))


# ============ 渠道 ============


@router.get("/channel/list", summary="通知渠道列表")
async def channel_list(type: str | None = None):
    with get_session() as db:
        try:
            q = db.query(NotificationChannel).filter(NotificationChannel.status == 1)
            if type:
                q = q.filter(NotificationChannel.type == type)
            items = q.all()
            return success(
                [
                    {
                        "id": c.id,
                        "name": c.name,
                        "type": c.type,
                        "config": c.config,
                        "is_default": c.is_default,
                    }
                    for c in items
                ]
            )
        except Exception as e:
            logger.error(f"channel list error: {e}")
            return error(str(e))


@router.post("/channel", operation_id="notification_create_channel", summary="添加渠道")
async def create_channel(
    name: str = Query(...), type: str = Query(...), config: str | None = None, is_default: bool = False
):
    with get_session() as db:
        try:
            c = NotificationChannel(name=name, type=type, config=config, is_default=is_default, status=1)
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"channel create error: {e}")
            return error(str(e))


@router.put("/channel/{cid}", operation_id="notification_update_channel", summary="修改渠道")
async def update_channel(
    cid: int,
    name: str | None = None,
    config: str | None = None,
    is_default: bool | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            c = db.query(NotificationChannel).filter(NotificationChannel.id == cid).first()
            if not c:
                return error("渠道不存在", "404")
            if name:
                c.name = name
            if config:
                c.config = config
            if is_default is not None:
                c.is_default = is_default
            if status is not None:
                c.status = status
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"channel update error: {e}")
            return error(str(e))


@router.delete("/channel/{cid}", operation_id="notification_delete_channel", summary="删除渠道")
async def delete_channel(cid: int):
    with get_session() as db:
        try:
            c = db.query(NotificationChannel).filter(NotificationChannel.id == cid).first()
            if not c:
                return error("渠道不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"channel delete error: {e}")
            return error(str(e))


# ============ 订阅偏好 ============


@router.get("/subscription/list", summary="我的订阅偏好")
async def subscription_list():
    with get_session() as db:
        try:
            items = db.query(NotificationSubscription).filter(NotificationSubscription.user_id == _uid()).all()
            return success(
                [
                    {
                        "id": s.id,
                        "type": s.type,
                        "category": s.category,
                        "enabled": s.enabled,
                    }
                    for s in items
                ]
            )
        except Exception as e:
            logger.error(f"subscription list error: {e}")
            return error(str(e))


@router.post("/subscription", summary="设置订阅")
async def set_subscription(type: str = Query(...), category: str = Query(...), enabled: bool = True):
    with get_session() as db:
        try:
            uid = _uid()
            s = (
                db.query(NotificationSubscription)
                .filter(
                    NotificationSubscription.user_id == uid,
                    NotificationSubscription.type == type,
                    NotificationSubscription.category == category,
                )
                .first()
            )
            if s:
                s.enabled = enabled
            else:
                db.add(NotificationSubscription(user_id=uid, type=type, category=category, enabled=enabled))
            return success()
        except Exception as e:
            logger.error(f"subscription set error: {e}")
            return error(str(e))


# ============ 日志 ============


@router.get("/log/list", operation_id="notification_log_list", summary="通知发送日志")
async def log_list(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), success_flag: bool | None = None
):
    with get_session() as db:
        try:
            q = db.query(NotificationLog)
            if success_flag is not None:
                q = q.filter(NotificationLog.success == success_flag)
            total = q.count()
            items = q.order_by(NotificationLog.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": l.id,
                        "notification_id": l.notification_id,
                        "user_id": l.user_id,
                        "channel": l.channel,
                        "type": l.type,
                        "success": l.success,
                        "response": l.response,
                        "error": l.error,
                        "send_time": l.send_time.isoformat() if l.send_time else None,
                    }
                    for l in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"notification log error: {e}")
            return error(str(e))
