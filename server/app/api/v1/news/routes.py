"""资讯文章模块 - 资讯/文章 CRUD"""

from fastapi import APIRouter, Depends, Query
from loguru import logger
from pydantic import BaseModel, Field

from app.core.current_user import get_member_id_int
from app.database import get_session
from app.models.news_models import Article, News
from app.schemas.common import error, success


class NewsCreateRequest(BaseModel):
    content: str = Field(...)


class ArticleCreateRequest(BaseModel):
    content: str = Field(...)


router = APIRouter()


def _news_to_dict(n: News) -> dict:
    return {
        "id": n.id,
        "title": n.title,
        "type": n.type,
        "user_id": n.user_id,
        "content": n.content,
        "image": n.image,
        "tags": n.tags,
        "keywords": n.keywords,
        "status": n.status,
        "recommend": n.recommend,
        "top": n.top,
        "description": n.description,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


def _article_to_dict(a: Article) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "member_id": a.member_id,
        "content": a.content,
        "image": a.image,
        "tags": a.tags,
        "keywords": a.keywords,
        "status": a.status,
        "introduction": a.introduction,
        "recommend": a.recommend,
        "top": a.top,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


# ============ 资讯 ============


@router.get("/list", summary="资讯列表")
async def list_news(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
    type: str | None = None,
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(News)
            if keyword:
                q = q.filter(News.title.like(f"%{keyword}%"))
            if type:
                q = q.filter(News.type == type)
            if status:
                q = q.filter(News.status == status)
            total = q.count()
            items = q.order_by(News.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_news_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"news list error: {e}")
            return error(str(e))


@router.get("/{nid}", summary="资讯详情")
async def get_news(nid: int):
    with get_session() as db:
        try:
            n = db.query(News).filter(News.id == nid).first()
            if not n:
                return error("资讯不存在", "404")
            return success(_news_to_dict(n))
        except Exception as e:
            logger.error(f"news get error: {e}")
            return error(str(e))


@router.post("", summary="创建资讯")
async def create_news(
    title: str = Query(..., min_length=1, max_length=100),
    type: str = Query(..., max_length=100),
    payload: NewsCreateRequest = Depends(),
    image: str | None = None,
    tags: str | None = None,
    keywords: str | None = None,
    status: str = "draft",
    recommend: bool = False,
    top: bool = False,
    description: str = "",
    user_id: int = Depends(get_member_id_int),
):
    with get_session() as db:
        try:
            n = News(
                title=title,
                type=type,
                user_id=user_id,
                content=payload.content,
                image=image,
                tags=tags,
                keywords=keywords,
                status=status,
                recommend=recommend,
                top=top,
                description=description,
            )
            db.add(n)
            db.flush()
            return success({"id": n.id})
        except Exception as e:
            logger.error(f"news create error: {e}")
            return error(str(e))


@router.put("/{nid}", summary="修改资讯")
async def update_news(
    nid: int,
    title: str | None = None,
    type: str | None = None,
    content: str | None = None,
    image: str | None = None,
    tags: str | None = None,
    keywords: str | None = None,
    status: str | None = None,
    recommend: bool | None = None,
    top: bool | None = None,
    description: str | None = None,
):
    with get_session() as db:
        try:
            n = db.query(News).filter(News.id == nid).first()
            if not n:
                return error("资讯不存在", "404")
            if title is not None:
                n.title = title
            if type is not None:
                n.type = type
            if content is not None:
                n.content = content
            if image is not None:
                n.image = image
            if tags is not None:
                n.tags = tags
            if keywords is not None:
                n.keywords = keywords
            if status is not None:
                n.status = status
            if recommend is not None:
                n.recommend = recommend
            if top is not None:
                n.top = top
            if description is not None:
                n.description = description
            return success({"id": n.id})
        except Exception as e:
            logger.error(f"news update error: {e}")
            return error(str(e))


@router.delete("/{nid}", summary="删除资讯")
async def delete_news(nid: int):
    with get_session() as db:
        try:
            n = db.query(News).filter(News.id == nid).first()
            if not n:
                return error("资讯不存在", "404")
            db.delete(n)
            return success()
        except Exception as e:
            logger.error(f"news delete error: {e}")
            return error(str(e))


# ============ 文章 ============


@router.get("/article/list", summary="文章列表")
async def list_articles(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
    member_id: int | None = None,
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(Article)
            if keyword:
                q = q.filter(Article.title.like(f"%{keyword}%"))
            if member_id:
                q = q.filter(Article.member_id == member_id)
            if status:
                q = q.filter(Article.status == status)
            total = q.count()
            items = q.order_by(Article.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_article_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"article list error: {e}")
            return error(str(e))


@router.get("/article/{aid}", summary="文章详情")
async def get_article(aid: int):
    with get_session() as db:
        try:
            a = db.query(Article).filter(Article.id == aid).first()
            if not a:
                return error("文章不存在", "404")
            return success(_article_to_dict(a))
        except Exception as e:
            logger.error(f"article get error: {e}")
            return error(str(e))


@router.post("/article", summary="创建文章")
async def create_article(
    title: str = Query(..., min_length=1, max_length=100),
    payload: ArticleCreateRequest = Depends(),
    image: str | None = None,
    tags: str | None = None,
    keywords: str | None = None,
    status: str = "draft",
    introduction: str = "",
    recommend: bool = False,
    top: bool = False,
    member_id: int = Depends(get_member_id_int),
):
    with get_session() as db:
        try:
            a = Article(
                title=title,
                member_id=member_id,
                content=payload.content,
                image=image,
                tags=tags,
                keywords=keywords,
                status=status,
                introduction=introduction,
                recommend=recommend,
                top=top,
            )
            db.add(a)
            db.flush()
            return success({"id": a.id})
        except Exception as e:
            logger.error(f"article create error: {e}")
            return error(str(e))


@router.put("/article/{aid}", summary="修改文章")
async def update_article(
    aid: int,
    title: str | None = None,
    content: str | None = None,
    image: str | None = None,
    tags: str | None = None,
    keywords: str | None = None,
    status: str | None = None,
    introduction: str | None = None,
    recommend: bool | None = None,
    top: bool | None = None,
):
    with get_session() as db:
        try:
            a = db.query(Article).filter(Article.id == aid).first()
            if not a:
                return error("文章不存在", "404")
            if title is not None:
                a.title = title
            if content is not None:
                a.content = content
            if image is not None:
                a.image = image
            if tags is not None:
                a.tags = tags
            if keywords is not None:
                a.keywords = keywords
            if status is not None:
                a.status = status
            if introduction is not None:
                a.introduction = introduction
            if recommend is not None:
                a.recommend = recommend
            if top is not None:
                a.top = top
            return success({"id": a.id})
        except Exception as e:
            logger.error(f"article update error: {e}")
            return error(str(e))


@router.delete("/article/{aid}", summary="删除文章")
async def delete_article(aid: int):
    with get_session() as db:
        try:
            a = db.query(Article).filter(Article.id == aid).first()
            if not a:
                return error("文章不存在", "404")
            db.delete(a)
            return success()
        except Exception as e:
            logger.error(f"article delete error: {e}")
            return error(str(e))


# ============ 资讯推荐/置顶 ============


@router.post("/{nid}/recommend", summary="推荐资讯")
async def recommend_news(nid: int):
    with get_session() as db:
        try:
            n = db.query(News).filter(News.id == nid).first()
            if not n:
                return error("资讯不存在", "404")
            n.recommend = True
            return success({"id": n.id, "recommend": n.recommend})
        except Exception as e:
            logger.error(f"news recommend error: {e}")
            return error(str(e))


@router.post("/{nid}/top", summary="置顶资讯")
async def top_news(nid: int):
    with get_session() as db:
        try:
            n = db.query(News).filter(News.id == nid).first()
            if not n:
                return error("资讯不存在", "404")
            n.top = True
            return success({"id": n.id, "top": n.top})
        except Exception as e:
            logger.error(f"news top error: {e}")
            return error(str(e))


# ============ 文章评论 ============
# 2026-06-29: 新增, 为 miniapp pagesA/news/detail.vue 评论功能提供后端支持
# 使用内存存储 (与 customer_service 一致), 后续可迁移到数据库表


_article_comments: dict[int, list[dict]] = {}


@router.get("/article/{aid}/comments", summary="文章评论列表")
async def list_article_comments(
    aid: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """获取文章评论列表."""
    comments = _article_comments.get(aid, [])
    total = len(comments)
    start = (page - 1) * limit
    items = comments[start : start + limit]
    return success(items, total=total)


@router.post("/article/{aid}/comments", summary="发表文章评论")
async def create_article_comment(
    aid: int,
    content: str = Query(..., min_length=1, max_length=500),
    user_id: int = Depends(get_member_id_int),
):
    """发表文章评论."""
    import uuid as _uuid
    from datetime import datetime

    comment = {
        "id": _uuid.uuid4().hex[:12],
        "article_id": aid,
        "user_id": user_id,
        "content": content,
        "created_at": datetime.utcnow().isoformat(),
    }
    if aid not in _article_comments:
        _article_comments[aid] = []
    _article_comments[aid].append(comment)
    return success(comment)


@router.delete("/{nid}/recommend", summary="取消推荐")
async def unrecommend_news(nid: int):
    with get_session() as db:
        try:
            n = db.query(News).filter(News.id == nid).first()
            if not n:
                return error("资讯不存在", "404")
            n.recommend = False
            return success({"id": n.id, "recommend": n.recommend})
        except Exception as e:
            logger.error(f"news unrecommend error: {e}")
            return error(str(e))


@router.delete("/{nid}/top", summary="取消置顶")
async def untop_news(nid: int):
    with get_session() as db:
        try:
            n = db.query(News).filter(News.id == nid).first()
            if not n:
                return error("资讯不存在", "404")
            n.top = False
            return success({"id": n.id, "top": n.top})
        except Exception as e:
            logger.error(f"news untop error: {e}")
            return error(str(e))
