"""edu_notification service - Notification (migrated from ihui-ai-edu-notification-service).

Source: G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-notification-service\\
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import and_, desc, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduNotification
from app.services.edu_base import EduValidationError, paginate, get_or_404


def send_notification(
    db: Session, user_id: int, template_code: str, channel: str,
    title: str, content: str, payload: Optional[dict] = None,
) -> EduNotification:
    """Send a notification via specified channel."""
    valid_channels = {"in_app", "sms", "email", "push"}
    if channel not in valid_channels:
        raise EduValidationError(f"channel must be one of {valid_channels}")
    n = EduNotification(
        user_id=user_id, template_code=template_code, channel=channel,
        title=title, content=content,
        payload=json.dumps(payload) if payload else None,
        is_sent=False,
    )
    db.add(n)
    db.flush()
    db.refresh(n)
    # In a real implementation, this would dispatch to a queue
    # For now, mark as sent immediately for in_app
    if channel == "in_app":
        n.is_sent = True
        n.sent_at = datetime.now(timezone.utc)
    db.flush()
    db.refresh(n)
    return n


def batch_send(
    db: Session, user_ids: List[int], template_code: str, channel: str,
    title: str, content: str, payload: Optional[dict] = None,
) -> int:
    """Batch send notifications to multiple users."""
    count = 0
    for uid in user_ids:
        send_notification(db, uid, template_code, channel, title, content, payload)
        count += 1
    return count


def list_user_notifications(
    db: Session, user_id: int, page: int = 1, size: int = 20,
    is_sent: Optional[bool] = None, template_code: Optional[str] = None,
) -> Tuple[List[EduNotification], int]:
    filters = [EduNotification.user_id == user_id]
    if is_sent is not None:
        filters.append(EduNotification.is_send == is_sent)
    if template_code:
        filters.append(EduNotification.tpl_code == template_code)
    return paginate(db, EduNotification, page=page, size=size, filters=filters, order_by=desc(EduNotification.id))
