"""搜索模块路由 - 迁移自旧 Java Spring Boot search-service (2026-07-05).

包含: 搜索热词CRUD.
"""
from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import EduHotWord
from app.schemas.common import error, success

router = APIRouter()


def _hot_word_to_dict(w: EduHotWord) -> dict:
    return {
        "id": w.id,
        "word": w.word,
        "search_count": w.search_count,
        "sort": w.sort,
        "is_hot": w.is_hot,
        "status": w.status,
        "created_at": w.created_at.isoformat() if w.created_at else None,
    }


@router.get("/hot-word/list", summary="热词列表")
async def hot_word_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    word: str | None = None,
    is_hot: bool | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduHotWord)
            if word:
                q = q.filter(EduHotWord.word.like(f"%{word}%"))
            if is_hot is not None:
                q = q.filter(EduHotWord.is_hot == is_hot)
            if status is not None:
                q = q.filter(EduHotWord.status == status)
            total = q.count()
            items = (
                q.order_by(EduHotWord.sort.asc(), EduHotWord.search_count.desc(), EduHotWord.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_hot_word_to_dict(w) for w in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu search] hot word list error: {e}")
            return error(str(e))


@router.get("/hot-word", summary="热词详情")
async def get_hot_word(id: int = Query(..., description="热词id")):
    with get_session() as db:
        try:
            w = db.query(EduHotWord).filter(EduHotWord.id == id).first()
            if not w:
                return error("热词不存在", "404")
            return success(_hot_word_to_dict(w))
        except Exception as e:
            logger.error(f"[edu search] get hot word error: {e}")
            return error(str(e))


@router.post("/hot-word", summary="新建热词")
async def create_hot_word(
    word: str = Body(..., min_length=1, max_length=200),
    search_count: int = Body(0),
    sort: int = Body(0),
    is_hot: bool = Body(False),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            w = EduHotWord(
                word=word,
                search_count=search_count,
                sort=sort,
                is_hot=is_hot,
                status=status,
            )
            db.add(w)
            db.flush()
            return success({"id": w.id})
        except Exception as e:
            logger.error(f"[edu search] create hot word error: {e}")
            return error(str(e))


@router.put("/hot-word", summary="更新热词")
async def update_hot_word(
    id: int = Body(...),
    word: str | None = Body(None),
    search_count: int | None = Body(None),
    sort: int | None = Body(None),
    is_hot: bool | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            w = db.query(EduHotWord).filter(EduHotWord.id == id).first()
            if not w:
                return error("热词不存在", "404")
            if word is not None:
                w.word = word
            if search_count is not None:
                w.search_count = search_count
            if sort is not None:
                w.sort = sort
            if is_hot is not None:
                w.is_hot = is_hot
            if status is not None:
                w.status = status
            return success({"id": w.id})
        except Exception as e:
            logger.error(f"[edu search] update hot word error: {e}")
            return error(str(e))


@router.delete("/hot-word", summary="删除热词")
async def delete_hot_word(data: dict = Body(..., description="包含 id 字段")):
    with get_session() as db:
        try:
            wid = data.get("id")
            if wid is None:
                return error("缺少 id 参数", "400")
            w = db.query(EduHotWord).filter(EduHotWord.id == wid).first()
            if not w:
                return error("热词不存在", "404")
            db.delete(w)
            return success()
        except Exception as e:
            logger.error(f"[edu search] delete hot word error: {e}")
            return error(str(e))


@router.post("/hot-word/incr", summary="热词搜索次数自增")
async def incr_hot_word(word: str = Body(..., embed=True)):
    """记录一次搜索, 若热词不存在则自动创建."""
    with get_session() as db:
        try:
            w = db.query(EduHotWord).filter(EduHotWord.word == word).first()
            if not w:
                w = EduHotWord(word=word, search_count=1, status=1)
                db.add(w)
            else:
                w.search_count = (w.search_count or 0) + 1
            db.flush()
            return success({"id": w.id, "search_count": w.search_count})
        except Exception as e:
            logger.error(f"[edu search] incr hot word error: {e}")
            return error(str(e))


@router.get("/public-api/hot-word/list", summary="公开热词列表")
async def hot_word_public_list(
    limit: int = Query(10, ge=1, le=50),
):
    with get_session() as db:
        try:
            items = (
                db.query(EduHotWord)
                .filter(EduHotWord.status == 1)
                .order_by(EduHotWord.is_hot.desc(), EduHotWord.sort.asc(), EduHotWord.search_count.desc())
                .limit(limit)
                .all()
            )
            return success([_hot_word_to_dict(w) for w in items])
        except Exception as e:
            logger.error(f"[edu search] hot word public list error: {e}")
            return error(str(e))
