"""edu_message service - In-site message (migrated from ihui-ai-edu-message-service).

Source: G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-message-service\\
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import and_, desc, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduMessage
from app.services.edu_base import EduValidationError, paginate, get_or_404


def send_message(
    db: Session, sender_id: Optional[int], receiver_id: int,
    msg_type: str, content: str, title: Optional[str] = None,
) -> EduMessage:
    """Send a message. msg_type: system/private/group."""
    if msg_type not in ("system", "private", "group"):
        raise EduValidationError("msg_type must be system/private/group")
    if not content:
        raise EduValidationError("content required")
    m = EduMessage(
        sender_id=sender_id, receiver_id=receiver_id,
        msg_type=msg_type, title=title, content=content,
        is_read=False,
    )
    db.add(m)
    db.flush()
    db.refresh(m)
    return m


def mark_read(db: Session, message_id: int, user_id: int) -> EduMessage:
    m = get_or_404(db, EduMessage, message_id, "message")
    if m.receiver_id != user_id:
        from app.services.edu_base import EduPermissionError
        raise EduPermissionError("not your message")
    m.is_read = True
    m.read_at = datetime.now(timezone.utc)
    db.flush()
    db.refresh(m)
    return m


def list_inbox(
    db: Session, user_id: int, page: int = 1, size: int = 20,
    is_read: Optional[bool] = None, msg_type: Optional[str] = None,
) -> Tuple[List[EduMessage], int]:
    filters = [EduMessage.receiver_id == user_id]
    if is_read is not None:
        filters.append(EduMessage.is_read == is_read)
    if msg_type:
        filters.append(EduMessage.type == msg_type)
    return paginate(db, EduMessage, page=page, size=size, filters=filters, order_by=desc(EduMessage.id))


def get_unread_count(db: Session, user_id: int) -> int:
    from sqlalchemy import func
    return db.execute(
        select(func.count(EduMessage.id)).where(
            and_(EduMessage.receiver_id == user_id, EduMessage.is_read == False)
        )
    ).scalar() or 0
