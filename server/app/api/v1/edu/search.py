"""Edu search router - /api/v1/edu/search

Migrated from ihui-ai-edu-search-service.
Complete Phase B implementation.
"""

from typing import List, Optional, Tuple

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


@router.post("/index", summary="Index entity")
def index_entity_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_search import index_entity
    result = index_entity(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/search", summary="Search")
def search_endpoint(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    entity_type: Optional[str] = Query(None, description="实体类型过滤"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(_get_db),
):
    # 2026-06-26 H5 修复: 补齐搜索词参数并透传 service (之前 search(db) 不传 q 导致功能失效)
    from app.services.edu_search import search
    items, total = search(db, q=q, entity_type=entity_type, page=page, size=size)
    return success(data={
        "items": [
            {
                "id": getattr(it, "id", None),
                "entity_type": getattr(it, "target_type", None),
                "entity_id": getattr(it, "target_id", None),
                "title": getattr(it, "title", None),
                "content": getattr(it, "content", None),
                "tags": getattr(it, "tags", None),
                "weight": getattr(it, "weight", None),
            }
            for it in (items or [])
        ],
        "total": total,
        "page": page,
        "size": size,
    })

@router.delete("/index/{entity_type}/{entity_id}", summary="Delete index")
def delete_index_endpoint(entity_type: str, entity_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_search import delete_index
    result = delete_index(db, entity_type=entity_type, entity_id=entity_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)
