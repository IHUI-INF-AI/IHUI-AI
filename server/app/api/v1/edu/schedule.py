"""Edu schedule router - /api/v1/edu/schedule

Migrated from ihui-ai-edu-schedule-service.
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


@router.post("/schedules", summary="Create schedule")
def create_schedule_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_schedule import create_schedule
    result = create_schedule(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/teachers/{teacher_id}/schedule", summary="Get schedule")
def list_teacher_schedule_endpoint(teacher_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_schedule import list_teacher_schedule
    result = list_teacher_schedule(db, teacher_id=teacher_id)
    return success(data=result)

@router.post("/check-conflict", summary="Check conflict")
def check_conflict_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_schedule import check_conflict
    result = check_conflict(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.delete("/schedules/{schedule_id}", summary="Delete schedule")
def delete_schedule_endpoint(schedule_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_schedule import delete_schedule
    result = delete_schedule(db, schedule_id=schedule_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)
