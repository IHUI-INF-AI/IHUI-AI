"""Edu behavior router - /api/v1/edu/behavior

Migrated from ihui-ai-edu-behavior-service.
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


from app.core.current_user import get_current_user_id

from app.schemas.common import success

router = APIRouter()

# 封版阶段：edu_behavior service 字段全部漂移、功能不可用，路由暂时禁用，统一返回 501。
_DISABLED_MSG = {"code": 501, "msg": "此功能暂未开放，请联系管理员"}


@router.post("/events", summary="Track event")
def track_event_endpoint(payload: dict = {}, db: Session = Depends(_get_db)):
    return _DISABLED_MSG

@router.get("/users/{user_id}/metrics", summary="User metrics")
def get_user_study_metrics_endpoint(user_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    return _DISABLED_MSG

@router.get("/entities/{entity_type}/{entity_id}/views", summary="Entity views")
def get_entity_view_count_endpoint(entity_type: str, entity_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    return _DISABLED_MSG

@router.get("/events/me", summary="My events")
def list_user_events_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    return _DISABLED_MSG
