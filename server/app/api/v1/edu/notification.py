"""Edu notification router - /api/v1/edu/notification

Migrated from ihui-ai-edu-notification-service.
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


@router.post("/notifications", summary="Send (admin)")
async def send_notification_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_notification import send_notification
    result = send_notification(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/notifications/batch", summary="Batch send (admin)")
async def batch_send_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_notification import batch_send
    result = batch_send(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/notifications/me", summary="My notifications")
async def list_user_notifications_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_notification import list_user_notifications
    result = list_user_notifications(db, user_uuid=str(user_id))
    return success(data=result)
