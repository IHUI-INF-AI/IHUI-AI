"""内容模块路由 - 迁移自旧 Java Spring Boot content-service (2026-07-05).

包含: 文章CRUD/资讯CRUD/分类CRUD.
文章和资讯都支持置顶/推荐/浏览量统计.
"""
from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models import EduArticle, EduCategory, EduNews
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 文章
# ---------------------------------------------------------------------------


def _article_to_dict(a: EduArticle, with_content: bool = True) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "content": a.content if with_content else None,
        "summary": a.summary,
        "cover_image": a.cover_image,
        "author_id": a.author_id,
        "author_name": a.author_name,
        "category_id": a.category_id,
        "view_count": a.view_count,
        "like_count": a.like_count,
        "is_top": a.is_top,
        "is_recommend": a.is_recommend,
        "status": a.status,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


@router.get("/article/list", summary="文章列表", operation_id="edu_platform_content_article_list")
async def article_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    title: str | None = None,
    category_id: int | None = None,
    status: int | None = None,
    is_top: bool | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduArticle)
            if title:
                q = q.filter(EduArticle.title.like(f"%{title}%"))
            if category_id:
                q = q.filter(EduArticle.category_id == category_id)
            if status is not None:
                q = q.filter(EduArticle.status == status)
            if is_top is not None:
                q = q.filter(EduArticle.is_top == is_top)
            total = q.count()
            items = (
                q.order_by(EduArticle.is_top.desc(), EduArticle.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_article_to_dict(a, with_content=False) for a in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu content] article list error: {e}")
            return error(str(e))


@router.get("/public-api/article", summary="文章详情(公开)", operation_id="edu_platform_content_get_article_public")
async def get_article_public(id: int = Query(..., description="文章id")):
    with get_session() as db:
        try:
            a = db.query(EduArticle).filter(EduArticle.id == id).first()
            if not a:
                return error("文章不存在", "404")
            a.view_count = (a.view_count or 0) + 1
            db.flush()
            return success(_article_to_dict(a, with_content=True))
        except Exception as e:
            logger.error(f"[edu content] get article public error: {e}")
            return error(str(e))


@router.get("/public-api/article/list", summary="公开文章列表", operation_id="edu_platform_content_article_public_list")
async def article_public_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduArticle).filter(EduArticle.status == 1)
            if category_id:
                q = q.filter(EduArticle.category_id == category_id)
            total = q.count()
            items = (
                q.order_by(EduArticle.is_top.desc(), EduArticle.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_article_to_dict(a, with_content=False) for a in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu content] article public list error: {e}")
            return error(str(e))


@router.post("/auth-api/article", summary="创建文章", operation_id="edu_platform_content_create_article")
async def create_article(
    title: str = Body(..., min_length=1, max_length=200),
    content: str | None = Body(None),
    summary: str | None = Body(None, max_length=500),
    cover_image: str | None = Body(None, max_length=500),
    author_id: int | None = Body(None),
    author_name: str | None = Body(None, max_length=100),
    category_id: int | None = Body(None),
    status: int = Body(1),
    is_top: bool = Body(False),
    is_recommend: bool = Body(False),
):
    with get_session() as db:
        try:
            a = EduArticle(
                title=title,
                content=content,
                summary=summary,
                cover_image=cover_image,
                author_id=author_id,
                author_name=author_name,
                category_id=category_id,
                status=status,
                is_top=is_top,
                is_recommend=is_recommend,
            )
            db.add(a)
            db.flush()
            return success({"id": a.id})
        except Exception as e:
            logger.error(f"[edu content] create article error: {e}")
            return error(str(e))


@router.put("/auth-api/article", summary="更新文章", operation_id="edu_platform_content_update_article")
async def update_article(
    id: int = Body(...),
    title: str | None = Body(None),
    content: str | None = Body(None),
    summary: str | None = Body(None),
    cover_image: str | None = Body(None),
    author_name: str | None = Body(None),
    category_id: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            a = db.query(EduArticle).filter(EduArticle.id == id).first()
            if not a:
                return error("文章不存在", "404")
            if title is not None:
                a.title = title
            if content is not None:
                a.content = content
            if summary is not None:
                a.summary = summary
            if cover_image is not None:
                a.cover_image = cover_image
            if author_name is not None:
                a.author_name = author_name
            if category_id is not None:
                a.category_id = category_id
            if status is not None:
                a.status = status
            return success({"id": a.id})
        except Exception as e:
            logger.error(f"[edu content] update article error: {e}")
            return error(str(e))


@router.delete("/auth-api/article", summary="删除文章", operation_id="edu_platform_content_delete_article")
async def delete_article(id: int = Query(...)):
    with get_session() as db:
        try:
            a = db.query(EduArticle).filter(EduArticle.id == id).first()
            if not a:
                return error("文章不存在", "404")
            db.delete(a)
            return success()
        except Exception as e:
            logger.error(f"[edu content] delete article error: {e}")
            return error(str(e))


@router.post("/article/top", summary="置顶/取消置顶", operation_id="edu_platform_content_toggle_article_top")
async def toggle_article_top(
    id: int = Body(..., embed=True),
    isTop: bool = Body(..., embed=True),
):
    with get_session() as db:
        try:
            a = db.query(EduArticle).filter(EduArticle.id == id).first()
            if not a:
                return error("文章不存在", "404")
            a.is_top = isTop
            return success({"id": a.id, "is_top": a.is_top})
        except Exception as e:
            logger.error(f"[edu content] toggle article top error: {e}")
            return error(str(e))


@router.post("/article/recommend", summary="推荐/取消推荐", operation_id="edu_platform_content_toggle_article_recommend")
async def toggle_article_recommend(
    id: int = Body(..., embed=True),
    isRecommend: bool = Body(..., embed=True),
):
    with get_session() as db:
        try:
            a = db.query(EduArticle).filter(EduArticle.id == id).first()
            if not a:
                return error("文章不存在", "404")
            a.is_recommend = isRecommend
            return success({"id": a.id, "is_recommend": a.is_recommend})
        except Exception as e:
            logger.error(f"[edu content] toggle article recommend error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 资讯
# ---------------------------------------------------------------------------


def _news_to_dict(n: EduNews, with_content: bool = True) -> dict:
    return {
        "id": n.id,
        "title": n.title,
        "content": n.content if with_content else None,
        "summary": n.summary,
        "cover_image": n.cover_image,
        "author_id": n.author_id,
        "category_id": n.category_id,
        "view_count": n.view_count,
        "is_top": n.is_top,
        "is_recommend": n.is_recommend,
        "status": n.status,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("/news/list", summary="资讯列表", operation_id="edu_platform_content_news_list")
async def news_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    title: str | None = None,
    category_id: int | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduNews)
            if title:
                q = q.filter(EduNews.title.like(f"%{title}%"))
            if category_id:
                q = q.filter(EduNews.category_id == category_id)
            if status is not None:
                q = q.filter(EduNews.status == status)
            total = q.count()
            items = (
                q.order_by(EduNews.is_top.desc(), EduNews.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_news_to_dict(n, with_content=False) for n in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu content] news list error: {e}")
            return error(str(e))


@router.get("/public-api/news", summary="资讯详情(公开)", operation_id="edu_platform_content_get_news_public")
async def get_news_public(id: int = Query(..., description="资讯id")):
    with get_session() as db:
        try:
            n = db.query(EduNews).filter(EduNews.id == id).first()
            if not n:
                return error("资讯不存在", "404")
            n.view_count = (n.view_count or 0) + 1
            db.flush()
            return success(_news_to_dict(n, with_content=True))
        except Exception as e:
            logger.error(f"[edu content] get news public error: {e}")
            return error(str(e))


@router.post("/news", summary="创建资讯", operation_id="edu_platform_content_create_news")
async def create_news(
    title: str = Body(..., min_length=1, max_length=200),
    content: str | None = Body(None),
    summary: str | None = Body(None, max_length=500),
    cover_image: str | None = Body(None, max_length=500),
    author_id: int | None = Body(None),
    category_id: int | None = Body(None),
    status: int = Body(1),
    is_top: bool = Body(False),
    is_recommend: bool = Body(False),
):
    with get_session() as db:
        try:
            n = EduNews(
                title=title,
                content=content,
                summary=summary,
                cover_image=cover_image,
                author_id=author_id,
                category_id=category_id,
                status=status,
                is_top=is_top,
                is_recommend=is_recommend,
            )
            db.add(n)
            db.flush()
            return success({"id": n.id})
        except Exception as e:
            logger.error(f"[edu content] create news error: {e}")
            return error(str(e))


@router.put("/news", summary="更新资讯", operation_id="edu_platform_content_update_news")
async def update_news(
    id: int = Body(...),
    title: str | None = Body(None),
    content: str | None = Body(None),
    summary: str | None = Body(None),
    cover_image: str | None = Body(None),
    category_id: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            n = db.query(EduNews).filter(EduNews.id == id).first()
            if not n:
                return error("资讯不存在", "404")
            if title is not None:
                n.title = title
            if content is not None:
                n.content = content
            if summary is not None:
                n.summary = summary
            if cover_image is not None:
                n.cover_image = cover_image
            if category_id is not None:
                n.category_id = category_id
            if status is not None:
                n.status = status
            return success({"id": n.id})
        except Exception as e:
            logger.error(f"[edu content] update news error: {e}")
            return error(str(e))


@router.delete("/news", summary="删除资讯", operation_id="edu_platform_content_delete_news")
async def delete_news(id: int = Query(...)):
    with get_session() as db:
        try:
            n = db.query(EduNews).filter(EduNews.id == id).first()
            if not n:
                return error("资讯不存在", "404")
            db.delete(n)
            return success()
        except Exception as e:
            logger.error(f"[edu content] delete news error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 分类
# ---------------------------------------------------------------------------


def _category_to_dict(c: EduCategory) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "pid": c.pid,
        "type": c.type,
        "sort": c.sort,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/category/admin/list", summary="分类列表", operation_id="edu_platform_content_category_admin_list")
async def category_admin_list(
    type: str | None = None,
    pid: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduCategory)
            if type:
                q = q.filter(EduCategory.type == type)
            if pid is not None:
                q = q.filter(EduCategory.pid == pid)
            items = q.order_by(EduCategory.sort.asc(), EduCategory.id.asc()).all()
            return success([_category_to_dict(c) for c in items])
        except Exception as e:
            logger.error(f"[edu content] category admin list error: {e}")
            return error(str(e))


@router.post("/category", summary="创建分类", operation_id="edu_platform_content_create_category")
async def create_category(
    name: str = Body(..., min_length=1, max_length=100),
    pid: int = Body(0),
    type: str = Body("article"),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            c = EduCategory(name=name, pid=pid, type=type, sort=sort, status=status)
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu content] create category error: {e}")
            return error(str(e))


@router.put("/category", summary="更新分类", operation_id="edu_platform_content_update_category")
async def update_category(
    id: int = Body(...),
    name: str | None = Body(None),
    pid: int | None = Body(None),
    type: str | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(EduCategory).filter(EduCategory.id == id).first()
            if not c:
                return error("分类不存在", "404")
            if name is not None:
                c.name = name
            if pid is not None:
                c.pid = pid
            if type is not None:
                c.type = type
            if sort is not None:
                c.sort = sort
            if status is not None:
                c.status = status
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu content] update category error: {e}")
            return error(str(e))


@router.delete("/category/{id}", summary="删除分类", operation_id="edu_platform_content_delete_category")
async def delete_category(id: int):
    with get_session() as db:
        try:
            c = db.query(EduCategory).filter(EduCategory.id == id).first()
            if not c:
                return error("分类不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"[edu content] delete category error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 资讯置顶/推荐
# ---------------------------------------------------------------------------


@router.post("/news/top", operation_id="edu_platform_content_set_news_top")
async def set_news_top(data: dict = Body(...)):
    """设置资讯置顶"""
    try:
        with get_session() as db:
            news_id = data.get("id")
            news = db.query(EduNews).filter(EduNews.id == news_id).first()
            if not news:
                return error("资讯不存在")
            news.is_top = not getattr(news, "is_top", False)
            db.commit()
            return success(data={"id": news_id, "is_top": news.is_top})
    except Exception as e:
        logger.error(f"[edu content] set news top error: {e}")
        return error(str(e))


@router.delete("/news/top", operation_id="edu_platform_content_cancel_news_top")
async def cancel_news_top(id: int = Query(...)):
    """取消资讯置顶"""
    try:
        with get_session() as db:
            news = db.query(EduNews).filter(EduNews.id == id).first()
            if not news:
                return error("资讯不存在")
            news.is_top = False
            db.commit()
            return success(data={"id": id, "is_top": False})
    except Exception as e:
        logger.error(f"[edu content] cancel news top error: {e}")
        return error(str(e))


@router.post("/news/recommend", operation_id="edu_platform_content_set_news_recommend")
async def set_news_recommend(data: dict = Body(...)):
    """设置资讯推荐"""
    try:
        with get_session() as db:
            news_id = data.get("id")
            news = db.query(EduNews).filter(EduNews.id == news_id).first()
            if not news:
                return error("资讯不存在")
            news.is_recommend = not getattr(news, "is_recommend", False)
            db.commit()
            return success(data={"id": news_id, "is_recommend": news.is_recommend})
    except Exception as e:
        logger.error(f"[edu content] set news recommend error: {e}")
        return error(str(e))


@router.delete("/news/recommend", operation_id="edu_platform_content_cancel_news_recommend")
async def cancel_news_recommend(id: int = Query(...)):
    """取消资讯推荐"""
    try:
        with get_session() as db:
            news = db.query(EduNews).filter(EduNews.id == id).first()
            if not news:
                return error("资讯不存在")
            news.is_recommend = False
            db.commit()
            return success(data={"id": id, "is_recommend": False})
    except Exception as e:
        logger.error(f"[edu content] cancel news recommend error: {e}")
        return error(str(e))


# ---------------------------------------------------------------------------
# 文章取消置顶/推荐
# ---------------------------------------------------------------------------


@router.delete("/article/top", operation_id="edu_platform_content_cancel_article_top")
async def cancel_article_top(id: int = Query(...)):
    """取消文章置顶"""
    try:
        with get_session() as db:
            article = db.query(EduArticle).filter(EduArticle.id == id).first()
            if not article:
                return error("文章不存在")
            article.is_top = False
            db.commit()
            return success(data={"id": id, "is_top": False})
    except Exception as e:
        logger.error(f"[edu content] cancel article top error: {e}")
        return error(str(e))


@router.delete("/article/recommend", operation_id="edu_platform_content_cancel_article_recommend")
async def cancel_article_recommend(id: int = Query(...)):
    """取消文章推荐"""
    try:
        with get_session() as db:
            article = db.query(EduArticle).filter(EduArticle.id == id).first()
            if not article:
                return error("文章不存在")
            article.is_recommend = False
            db.commit()
            return success(data={"id": id, "is_recommend": False})
    except Exception as e:
        logger.error(f"[edu content] cancel article recommend error: {e}")
        return error(str(e))


# ---------------------------------------------------------------------------
# 分类详情
# ---------------------------------------------------------------------------


@router.get("/category/{category_id}", operation_id="edu_platform_content_get_category_detail")
async def get_category_detail(category_id: int):
    """获取分类详情"""
    try:
        with get_session() as db:
            category = db.query(EduCategory).filter(EduCategory.id == category_id).first()
            if not category:
                return error("分类不存在")
            return success(data={
                "id": category.id,
                "name": category.name,
                "pid": category.pid,
                "type": category.type,
                "sort": getattr(category, "sort", 0),
                "status": getattr(category, "status", 1),
                "created_at": str(category.created_at) if category.created_at else None,
                "updated_at": str(category.updated_at) if category.updated_at else None,
            })
    except Exception as e:
        logger.error(f"[edu content] get category detail error: {e}")
        return error(str(e))
