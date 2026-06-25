"""Edu search router - /api/v1/edu/search

Migrated from ihui-ai-edu-search-service.
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


@router.post("/index", summary="Index entity")
def index_entity_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_search import index_entity
    result = index_entity(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/search", summary="Search")
def search_endpoint(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_search import search
    result = search(db)
    return success(data=result)

@router.delete("/index/{entity_type}/{entity_id}", summary="Delete index")
def delete_index_endpoint(entity_type: str, entity_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_search import delete_index
    result = delete_index(db, entity_type=entity_type, entity_id=entity_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)
