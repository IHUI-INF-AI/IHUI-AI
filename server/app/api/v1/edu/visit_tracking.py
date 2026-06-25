"""Edu visit_tracking router - /api/v1/edu/visit_tracking

Migrated from ihui-ai-edu-visit_tracking-service.
Complete Phase B implementation.
"""

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


@router.post("/visits", summary="Log visit")
def log_visit_endpoint(payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_visit_tracking import log_visit
    result = log_visit(db, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/analytics/daily", summary="Daily visits")
def get_daily_visits_endpoint(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_visit_tracking import get_daily_visits
    result = get_daily_visits(db)
    return success(data=result)

@router.get("/analytics/paths", summary="Top paths")
def get_path_stats_endpoint(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_visit_tracking import get_path_stats
    result = get_path_stats(db)
    return success(data=result)
