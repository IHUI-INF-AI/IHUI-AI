"""News Business Service.

完整迁移自 ihui-ai-edu-content-service:
  - NewsController
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy import or_

from app.database import get_session
from app.models.article_invoice_models import Article

logger = logging.getLogger(__name__)


def _to_dict(obj: Any) -> dict[str, Any]:
    if obj is None:
        return {}
    out: dict[str, Any] = {}
    for col in obj.__table__.columns:
        v = getattr(obj, col.name, None)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        out[col.name] = v
    return out


def _to_dict_list(items: list[Any]) -> list[dict[str, Any]]:
    return [_to_dict(i) for i in (items or [])]


# News 复用 Article 表 (因为 schema 类似)
def list_news(
    page: int = 1,
    page_size: int = 20,
    title: str | None = None,
    status: int | None = None,
    member_id: int | None = None,
    is_recommend: bool | None = None,
    is_top: bool | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        q = db.query(Article)
        if title:
            q = q.filter(Article.title.like(f"%{title}%"))
        if status is not None:
            q = q.filter(Article.status == status)
        if member_id is not None:
            q = q.filter(Article.member_id == member_id)
        if is_recommend is not None:
            q = q.filter(Article.is_recommend == is_recommend)
        if is_top is not None:
            q = q.filter(Article.is_top == is_top)
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total}


def get_news(news_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(Article).filter(Article.id == news_id).first()
        if obj:
            obj.view_count = (obj.view_count or 0) + 1
        return _to_dict(obj)


def create_news(
    title: str,
    content: str | None = None,
    summary: str | None = None,
    cover: str | None = None,
    member_id: int | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = Article(
            title=title, content=content, summary=summary, cover=cover,
            member_id=member_id, status=0,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_news(
    news_id: int,
    title: str | None = None,
    content: str | None = None,
    summary: str | None = None,
    cover: str | None = None,
    status: int | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(Article).filter(Article.id == news_id).first()
        if not obj:
            return {}
        if title is not None:
            obj.title = title
        if content is not None:
            obj.content = content
        if summary is not None:
            obj.summary = summary
        if cover is not None:
            obj.cover = cover
        if status is not None:
            obj.status = status
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_news(news_id: int) -> None:
    with get_session() as db:
        obj = db.query(Article).filter(Article.id == news_id).first()
        if obj:
            db.delete(obj)


def recommend_news(news_id: int) -> None:
    with get_session() as db:
        obj = db.query(Article).filter(Article.id == news_id).first()
        if obj:
            obj.is_recommend = True


def unrecommend_news(news_id: int) -> None:
    with get_session() as db:
        obj = db.query(Article).filter(Article.id == news_id).first()
        if obj:
            obj.is_recommend = False


def top_news(news_id: int) -> None:
    with get_session() as db:
        obj = db.query(Article).filter(Article.id == news_id).first()
        if obj:
            obj.is_top = True


def untop_news(news_id: int) -> None:
    with get_session() as db:
        obj = db.query(Article).filter(Article.id == news_id).first()
        if obj:
            obj.is_top = False
