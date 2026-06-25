"""edu_notification service - Notification (migrated from ihui-ai-edu-notification-service).

Source: G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-notification-service\\
"""

from __future__ import annotations

from sqlalchemy import desc

from app.models.edu_models import EduNotification
from app.services.edu_base import EduValidationError, paginate
from app.utils.datetime_helper import utcnow

# Notification model 字段映射 (service 旧字段名 -> model 实际字段名):
#   template_code -> type      (通知类型: site/email/sms/push)
#   is_sent       -> status    (0=待发送 1=已发送 2=失败 3=已读)
#   sent_at       -> send_time (发送时间)
#   payload       -> 丢弃      (model 无对应字段, 序列化后无法存储)


def send_notification(
    db: Session, user_id, template_code: str, channel: str,
    title: str, content: str, payload: Optional[dict] = None,
) -> EduNotification:
    """Send a notification via specified channel."""
    valid_channels = {"in_app", "sms", "email", "push"}
    if channel not in valid_channels:
        raise EduValidationError(f"channel must be one of {valid_channels}")
    is_in_app = channel == "in_app"
    n = EduNotification(
        user_id=str(user_id),
        type=template_code,
        channel=channel,
        title=title,
        content=content,
        status=1 if is_in_app else 0,
        send_time=utcnow() if is_in_app else None,
    )
    db.add(n)
    db.flush()
    return n


def batch_send(
    db: Session, user_ids: List, template_code: str, channel: str,
    title: str, content: str, payload: Optional[dict] = None,
) -> int:
    """Batch send notifications to multiple users (单次 flush, 避免 N+1)."""
    valid_channels = {"in_app", "sms", "email", "push"}
    if channel not in valid_channels:
        raise EduValidationError(f"channel must be one of {valid_channels}")
    is_in_app = channel == "in_app"
    now = utcnow() if is_in_app else None
    status_val = 1 if is_in_app else 0
    for uid in user_ids:
        n = EduNotification(
            user_id=str(uid),
            type=template_code,
            channel=channel,
            title=title,
            content=content,
            status=status_val,
            send_time=now,
        )
        db.add(n)
    db.flush()
    return len(user_ids)


def list_user_notifications(
    db: Session, user_id, page: int = 1, size: int = 20,
    is_sent: Optional[bool] = None, template_code: Optional[str] = None,
) -> Tuple[List[EduNotification], int]:
    filters = [EduNotification.user_id == str(user_id)]
    if is_sent is not None:
        filters.append(EduNotification.status == (1 if is_sent else 0))
    if template_code:
        filters.append(EduNotification.type == template_code)
    return paginate(db, EduNotification, page=page, size=size, filters=filters, order_by=desc(EduNotification.id))
