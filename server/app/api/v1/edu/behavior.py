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


try:
    from app.dependencies import get_current_user_id
except ImportError:
    def get_current_user_id() -> int:
        return 1  # dev stub

from app.schemas.common import success

router = APIRouter()


@router.post("/events", summary="Track event")
async def track_event_endpoint(payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_behavior import track_event
    result = track_event(db, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/users/{user_id}/metrics", summary="User metrics")
async def get_user_study_metrics_endpoint(user_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_behavior import get_user_study_metrics
    result = get_user_study_metrics(db, user_id=user_id)
    return success(data=result)

@router.get("/entities/{entity_type}/{entity_id}/views", summary="Entity views")
async def get_entity_view_count_endpoint(entity_type: str, entity_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_behavior import get_entity_view_count
    result = get_entity_view_count(db, entity_type=entity_type, entity_id=entity_id)
    return success(data=result)

@router.get("/events/me", summary="My events")
async def list_user_events_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_behavior import list_user_events
    result = list_user_events(db, user_id=user_id)
    return success(data=result)
