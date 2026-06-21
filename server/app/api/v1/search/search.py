"""搜索功能 - 全文搜索/热搜"""


from fastapi import APIRouter, Query
from loguru import logger

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.search_models import SearchHotKeyword, SearchIndex, SearchLog
from app.schemas.common import error, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

@router.get("/query", summary="全文搜索")
async def query(
    keyword: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    target_type: str | None = None,
    category: str | None = None,
    order_by: str | None = "weight",
):
    with get_session() as db:
        try:
            kw = f"%{keyword}%"
            q = (
                db.query(SearchIndex)
                .filter(
                    SearchIndex.status == 1,
                )
                .filter((SearchIndex.title.like(kw)) | (SearchIndex.content.like(kw)) | (SearchIndex.keywords.like(kw)))
            )
            if target_type:
                q = q.filter(SearchIndex.target_type == target_type)
            if category:
                q = q.filter(SearchIndex.category == category)
            total = q.count()
            if order_by == "new":
                items = (
                    q.order_by(SearchIndex.is_top.desc(), SearchIndex.id.desc())
                    .offset((page - 1) * limit)
                    .limit(limit)
                    .all()
                )
            elif order_by == "hot":
                items = (
                    q.order_by(SearchIndex.is_top.desc(), SearchIndex.view_num.desc())
                    .offset((page - 1) * limit)
                    .limit(limit)
                    .all()
                )
            else:
                items = (
                    q.order_by(SearchIndex.is_top.desc(), SearchIndex.weight.desc(), SearchIndex.id.desc())
                    .offset((page - 1) * limit)
                    .limit(limit)
                    .all()
                )
            db.add(
                SearchLog(
                    user_id=_uid(),
                    keyword=keyword,
                    target_type=target_type,
                    result_count=total,
                )
            )
            kw_record = db.query(SearchHotKeyword).filter(SearchHotKeyword.keyword == keyword).first()
            if kw_record:
                kw_record.search_count = (kw_record.search_count or 0) + 1
            return success(
                [
                    {
                        "id": i.id,
                        "target_type": i.target_type,
                        "target_id": i.target_id,
                        "title": i.title,
                        "content": i.content,
                        "category": i.category,
                        "tags": i.tags,
                        "cover": i.cover,
                        "url": i.url,
                        "user_id": i.user_id,
                        "user_name": i.user_name,
                        "weight": i.weight,
                        "view_num": i.view_num,
                        "like_num": i.like_num,
                        "comment_num": i.comment_num,
                        "is_top": i.is_top,
                        "is_essence": i.is_essence,
                    }
                    for i in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"search query error: {e}")
            return error(str(e))


@router.get("/hot", summary="热搜词")
async def hot_keywords(limit: int = Query(20, ge=1, le=50)):
    with get_session() as db:
        try:
            items = (
                db.query(SearchHotKeyword)
                .filter(SearchHotKeyword.status == 1)
                .order_by(
                    SearchHotKeyword.is_hot.desc(),
                    SearchHotKeyword.sort_order.asc(),
                    SearchHotKeyword.search_count.desc(),
                )
                .limit(limit)
                .all()
            )
            return success(
                [
                    {
                        "id": k.id,
                        "keyword": k.keyword,
                        "search_count": k.search_count,
                        "is_hot": k.is_hot,
                        "sort_order": k.sort_order,
                    }
                    for k in items
                ]
            )
        except Exception as e:
            logger.error(f"search hot error: {e}")
            return error(str(e))


@router.get("/suggest", summary="搜索建议")
async def suggest(keyword: str = Query(..., min_length=1), limit: int = Query(10, ge=1, le=20)):
    with get_session() as db:
        try:
            kw = f"%{keyword}%"
            items = (
                db.query(SearchIndex.title)
                .filter(SearchIndex.status == 1, SearchIndex.title.like(kw))
                .limit(limit)
                .all()
            )
            return success([i[0] for i in items])
        except Exception as e:
            logger.error(f"search suggest error: {e}")
            return error(str(e))


# ============ 索引管理(管理员) ============


@router.post("/index", summary="添加/更新索引")
async def add_index(
    target_type: str = Query(...),
    target_id: int = Query(...),
    title: str = Query(..., min_length=1, max_length=500),
    content: str | None = None,
    keywords: str | None = None,
    category: str | None = None,
    tags: str | None = None,
    cover: str | None = None,
    url: str | None = None,
    user_id: str | None = None,
    user_name: str | None = None,
    weight: int = 0,
):
    with get_session() as db:
        try:
            idx = (
                db.query(SearchIndex)
                .filter(
                    SearchIndex.target_type == target_type,
                    SearchIndex.target_id == target_id,
                )
                .first()
            )
            if idx:
                idx.title = title
                idx.content = content
                idx.keywords = keywords
                idx.category = category
                idx.tags = tags
                idx.cover = cover
                idx.url = url
                idx.weight = weight
                return success({"id": idx.id, "updated": True})
            idx = SearchIndex(
                target_type=target_type,
                target_id=target_id,
                title=title,
                content=content,
                keywords=keywords,
                category=category,
                tags=tags,
                cover=cover,
                url=url,
                user_id=user_id,
                user_name=user_name,
                weight=weight,
                status=1,
            )
            db.add(idx)
            db.flush()
            return success({"id": idx.id, "created": True})
        except Exception as e:
            logger.error(f"search index add error: {e}")
            return error(str(e))


@router.delete("/index/{idx_id}", summary="删除索引")
async def delete_index(idx_id: int):
    with get_session() as db:
        try:
            idx = db.query(SearchIndex).filter(SearchIndex.id == idx_id).first()
            if not idx:
                return error("索引不存在", "404")
            db.delete(idx)
            return success()
        except Exception as e:
            logger.error(f"search index delete error: {e}")
            return error(str(e))


@router.delete("/index/by-target", summary="按目标删除索引")
async def delete_by_target(target_type: str = Query(...), target_id: int = Query(...)):
    with get_session() as db:
        try:
            db.query(SearchIndex).filter(
                SearchIndex.target_type == target_type,
                SearchIndex.target_id == target_id,
            ).delete()
            return success()
        except Exception as e:
            logger.error(f"search index delete by target error: {e}")
            return error(str(e))


# ============ 热搜词管理 ============


@router.post("/hot/keyword", summary="添加热搜词")
async def add_hot_keyword(keyword: str = Query(...), is_hot: bool = False, sort_order: int = 0):
    with get_session() as db:
        try:
            h = db.query(SearchHotKeyword).filter(SearchHotKeyword.keyword == keyword).first()
            if h:
                h.is_hot = is_hot
                h.sort_order = sort_order
                h.status = 1
                return success({"id": h.id})
            h = SearchHotKeyword(keyword=keyword, is_hot=is_hot, sort_order=sort_order, status=1)
            db.add(h)
            db.flush()
            return success({"id": h.id})
        except Exception as e:
            logger.error(f"hot keyword add error: {e}")
            return error(str(e))


@router.delete("/hot/keyword/{kid}", summary="删除热搜词")
async def delete_hot_keyword(kid: int):
    with get_session() as db:
        try:
            h = db.query(SearchHotKeyword).filter(SearchHotKeyword.id == kid).first()
            if not h:
                return error("热搜词不存在", "404")
            db.delete(h)
            return success()
        except Exception as e:
            logger.error(f"hot keyword delete error: {e}")
            return error(str(e))


# ============ 搜索日志 ============


@router.get("/log/list", operation_id="search_log_list", summary="搜索日志")
async def log_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_id: str | None = None,
    keyword: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(SearchLog)
            if user_id:
                q = q.filter(SearchLog.user_id == user_id)
            if keyword:
                q = q.filter(SearchLog.keyword.like(f"%{keyword}%"))
            total = q.count()
            items = q.order_by(SearchLog.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": l.id,
                        "user_id": l.user_id,
                        "keyword": l.keyword,
                        "target_type": l.target_type,
                        "result_count": l.result_count,
                        "ip": l.ip,
                        "create_time": l.created_at.isoformat() if l.created_at else None,
                    }
                    for l in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"search log error: {e}")
            return error(str(e))
