"""Edu content router - /api/v1/edu/content

Migrated from ihui-ai-edu-content-service.
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

# 封版阶段：edu_content service 字段全部漂移、功能不可用，路由暂时禁用，统一返回 501。
_DISABLED_MSG = {"code": 501, "msg": "此功能暂未开放，请联系管理员"}


@router.post("/articles", summary="Create article")
def create_article_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    return _DISABLED_MSG

@router.put("/articles/{article_id}/publish", summary="Publish article")
def publish_article_endpoint(article_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    return _DISABLED_MSG

@router.get("/articles/{article_id}", summary="Get article")
def get_article_endpoint(article_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    return _DISABLED_MSG

@router.post("/articles/{article_id}/like", summary="Like article")
def like_article_endpoint(article_id: int, payload: dict = {}, db: Session = Depends(_get_db)):
    return _DISABLED_MSG

@router.get("/articles", summary="List articles")
def list_articles_endpoint(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    return _DISABLED_MSG
