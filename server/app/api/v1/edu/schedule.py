"""Edu schedule router - /api/v1/edu/schedule

Migrated from ihui-ai-edu-schedule-service.
Complete Phase B implementation.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_session


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session (contextmanager)."""
    with get_session() as db:
        yield db


from app.core.current_user import get_current_user_id

from app.schemas.common import success

router = APIRouter()

# 封版阶段：edu_schedule service 字段全部漂移、功能不可用，路由暂时禁用，统一返回 501。
_DISABLED_MSG = {"code": 501, "msg": "此功能暂未开放，请联系管理员"}


@router.post("/schedules", summary="Create schedule")
def create_schedule_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    return _DISABLED_MSG

@router.get("/teachers/{teacher_id}/schedule", summary="Get schedule")
def list_teacher_schedule_endpoint(teacher_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    return _DISABLED_MSG

@router.post("/check-conflict", summary="Check conflict")
def check_conflict_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    return _DISABLED_MSG

@router.delete("/schedules/{schedule_id}", summary="Delete schedule")
def delete_schedule_endpoint(schedule_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    return _DISABLED_MSG
