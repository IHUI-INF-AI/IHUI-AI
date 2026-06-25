"""News Legacy Routes - 1:1 兼容 Java 历史项目.

完整迁移自 H:\\ihui-ai-edu-content-service:
  - NewsController (12 端点)
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.security import get_current_user_id_flexible, require_login
from app.services import news_business

router = APIRouter(prefix="", tags=["News-Legacy"])


def _ok(data: Any = None, msg: str = "ok") -> dict[str, Any]:
    return {"code": 0, "data": data, "msg": msg}


def _err(status: int, msg: str) -> HTTPException:
    return HTTPException(status_code=status, detail=msg)


class NewsCreateReq(BaseModel):
    title: str
    content: str | None = None
    summary: str | None = None
    cover: str | None = None


class NewsUpdateReq(BaseModel):
    id: int
    title: str | None = None
    content: str | None = None
    summary: str | None = None
    cover: str | None = None
    status: int | None = None


class NewsIdReq(BaseModel):
    id: int


@router.get("/news", summary="[News]获取新闻详情")
def news_get(id: int | None = None):
    if id is not None:
        return _ok(news_business.get_news(id))
    return _ok({})


@router.get("/public-api/news", summary="[News]获取新闻详情(公开)")
def news_get_public(id: int | None = None):
    if id is not None:
        return _ok(news_business.get_news(id))
    return _ok({})


@router.get("/news/list", summary="[News]获取新闻列表")
def news_list(
    page: int = 1,
    pageSize: int = 20,
    title: str | None = None,
    status: int | None = None,
):
    return _ok(news_business.list_news(
        page=page, page_size=pageSize, title=title, status=status,
    ))


@router.get("/public-api/news/list", summary="[News]获取新闻列表(公开)")
def news_public_list(
    page: int = 1,
    pageSize: int = 20,
    title: str | None = None,
    status: int | None = 1,
):
    return _ok(news_business.list_news(
        page=page, page_size=pageSize, title=title, status=status,
    ))


@router.get("/public-api/news/list/by-ids", summary="[News]根据ID获取新闻")
def news_public_list_by_ids(ids: str | None = None):
    items = []
    if ids:
        for sid in ids.split(","):
            try:
                obj = news_business.get_news(int(sid))
                if obj:
                    items.append(obj)
            except (ValueError, TypeError):
                continue
    return _ok(items)


@router.post("/news", summary="[News]发布新闻")
def news_create(req: NewsCreateReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(news_business.create_news(
            title=req.title, content=req.content, summary=req.summary, cover=req.cover,
            member_id=member_id,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/news", summary="[News]修改新闻")
def news_update(req: NewsUpdateReq):
    return _ok(news_business.update_news(
        news_id=req.id, title=req.title, content=req.content,
        summary=req.summary, cover=req.cover, status=req.status,
    ))


@router.delete("/news", summary="[News]删除新闻")
def news_delete(req: NewsIdReq):
    news_business.delete_news(req.id)
    return _ok()


@router.post("/news/recommend", summary="[News]推荐新闻")
def news_recommend(req: NewsIdReq):
    news_business.recommend_news(req.id)
    return _ok()


@router.delete("/news/recommend", summary="[News]取消推荐")
def news_unrecommend(req: NewsIdReq):
    news_business.unrecommend_news(req.id)
    return _ok()


@router.get("/public-api/news/recommend/list", summary="[News]推荐新闻列表")
def news_recommend_list(page: int = 1, pageSize: int = 20):
    return _ok(news_business.list_news(
        page=page, page_size=pageSize, status=1, is_recommend=True,
    ))


@router.post("/news/top", summary="[News]置顶新闻")
def news_top(req: NewsIdReq):
    news_business.top_news(req.id)
    return _ok()


@router.delete("/news/top", summary="[News]取消置顶")
def news_untop(req: NewsIdReq):
    news_business.untop_news(req.id)
    return _ok()


@router.get("/public-api/news/top/list", summary="[News]置顶新闻列表")
def news_top_list(page: int = 1, pageSize: int = 20):
    return _ok(news_business.list_news(
        page=page, page_size=pageSize, status=1, is_top=True,
    ))
