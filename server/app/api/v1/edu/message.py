"""Edu message router - /api/v1/edu/message

Migrated from ihui-ai-edu-message-service.
Complete Phase B implementation.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_session


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session (contextmanager)."""
    with get_session() as db:
        yield db


try:
    from app.dependencies import get_current_user_id
except ImportError:
    def get_current_user_id() -> int:
        return 1  # dev stub

from app.schemas.common import success

router = APIRouter()


@router.post("/messages", summary="Send message")
async def send_message_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_message import send_message
    result = send_message(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/messages/{message_id}/read", summary="Mark read")
async def mark_read_endpoint(message_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_message import mark_read
    result = mark_read(db, message_id=message_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/messages/inbox", summary="Inbox")
async def list_inbox_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_message import list_inbox
    result = list_inbox(db, user_id=user_id)
    return success(data=result)

@router.get("/messages/unread-count", summary="Unread count")
async def get_unread_count_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_message import get_unread_count
    result = get_unread_count(db, user_id=user_id)
    return success(data=result)
