"""评论模块路由 - 迁移自旧 Java Spring Boot comment-service (2026-07-05).

包含: 收藏/评论/回复评论/点赞/敏感词CRUD.
收藏与点赞支持多种目标类型(lesson/news/article/resource/dynamic/comment/reply).
"""
from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import (
    EduComment,
    EduFavorite,
    EduLike,
    EduReplyComment,
    EduSensitiveWord,
)
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 收藏
# ---------------------------------------------------------------------------


def _favorite_to_dict(f: EduFavorite) -> dict:
    return {
        "id": f.id,
        "member_id": f.member_id,
        "topic_id": f.topic_id,
        "topic_type": f.topic_type,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }


@router.post("/auth-api/favorite", summary="收藏")
async def create_favorite(
    member_id: int = Body(...),
    topic_id: int = Body(...),
    topic_type: str = Body(..., max_length=50),
):
    with get_session() as db:
        try:
            existed = (
                db.query(EduFavorite)
                .filter(
                    EduFavorite.member_id == member_id,
                    EduFavorite.topic_id == topic_id,
                    EduFavorite.topic_type == topic_type,
                )
                .first()
            )
            if existed:
                return success({"id": existed.id, "existed": True})
            f = EduFavorite(
                member_id=member_id, topic_id=topic_id, topic_type=topic_type
            )
            db.add(f)
            db.flush()
            return success({"id": f.id})
        except Exception as e:
            logger.error(f"[edu comment] create favorite error: {e}")
            return error(str(e))


@router.delete("/auth-api/favorite", summary="取消收藏")
async def delete_favorite(
    member_id: int = Query(...),
    topic_id: int = Query(...),
    topic_type: str = Query(..., max_length=50),
):
    with get_session() as db:
        try:
            f = (
                db.query(EduFavorite)
                .filter(
                    EduFavorite.member_id == member_id,
                    EduFavorite.topic_id == topic_id,
                    EduFavorite.topic_type == topic_type,
                )
                .first()
            )
            if not f:
                return error("收藏记录不存在", "404")
            db.delete(f)
            return success()
        except Exception as e:
            logger.error(f"[edu comment] delete favorite error: {e}")
            return error(str(e))


@router.get("/auth-api/favorite/list", summary="会员收藏列表")
async def favorite_list(
    member_id: int = Query(...),
    topic_type: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(EduFavorite).filter(EduFavorite.member_id == member_id)
            if topic_type:
                q = q.filter(EduFavorite.topic_type == topic_type)
            total = q.count()
            items = (
                q.order_by(EduFavorite.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_favorite_to_dict(f) for f in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu comment] favorite list error: {e}")
            return error(str(e))


@router.get("/public-api/favorite/count", summary="收藏计数")
async def favorite_count(
    topic_id: int = Query(...),
    topic_type: str = Query(..., max_length=50),
):
    with get_session() as db:
        try:
            count = (
                db.query(EduFavorite)
                .filter(
                    EduFavorite.topic_id == topic_id,
                    EduFavorite.topic_type == topic_type,
                )
                .count()
            )
            return success({"count": count})
        except Exception as e:
            logger.error(f"[edu comment] favorite count error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 评论
# ---------------------------------------------------------------------------


def _comment_to_dict(c: EduComment) -> dict:
    return {
        "id": c.id,
        "topic_id": c.topic_id,
        "topic_type": c.topic_type,
        "member_id": c.member_id,
        "member_name": c.member_name,
        "content": c.content,
        "like_count": c.like_count,
        "reply_count": c.reply_count,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.post("/auth-api/comment", summary="发表评论")
async def create_comment(
    topic_id: int = Body(...),
    topic_type: str = Body(..., max_length=50),
    member_id: int = Body(...),
    member_name: str | None = Body(None, max_length=100),
    content: str = Body(..., min_length=1),
):
    with get_session() as db:
        try:
            c = EduComment(
                topic_id=topic_id,
                topic_type=topic_type,
                member_id=member_id,
                member_name=member_name,
                content=content,
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu comment] create comment error: {e}")
            return error(str(e))


@router.delete("/auth-api/comment", summary="删除评论")
async def delete_comment(id: int = Query(...)):
    with get_session() as db:
        try:
            c = db.query(EduComment).filter(EduComment.id == id).first()
            if not c:
                return error("评论不存在", "404")
            c.status = 0
            return success()
        except Exception as e:
            logger.error(f"[edu comment] delete comment error: {e}")
            return error(str(e))


@router.get("/public-api/comment/list", summary="评论列表")
async def comment_list(
    topic_id: int = Query(...),
    topic_type: str = Query(..., max_length=50),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(EduComment).filter(
                EduComment.topic_id == topic_id,
                EduComment.topic_type == topic_type,
                EduComment.status == 1,
            )
            total = q.count()
            items = (
                q.order_by(EduComment.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_comment_to_dict(c) for c in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu comment] comment list error: {e}")
            return error(str(e))


@router.get("/auth-api/current-member/comment/list", summary="当前会员评论")
async def current_member_comment_list(
    member_id: int = Query(...),
    topic_type: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(EduComment).filter(EduComment.member_id == member_id)
            if topic_type:
                q = q.filter(EduComment.topic_type == topic_type)
            total = q.count()
            items = (
                q.order_by(EduComment.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_comment_to_dict(c) for c in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu comment] current member comment list error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 回复评论
# ---------------------------------------------------------------------------


def _reply_to_dict(r: EduReplyComment) -> dict:
    return {
        "id": r.id,
        "comment_id": r.comment_id,
        "member_id": r.member_id,
        "member_name": r.member_name,
        "to_member_id": r.to_member_id,
        "to_member_name": r.to_member_name,
        "content": r.content,
        "like_count": r.like_count,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


@router.post("/auth-api/reply/comment", summary="回复评论")
async def create_reply(
    comment_id: int = Body(...),
    member_id: int = Body(...),
    member_name: str | None = Body(None, max_length=100),
    to_member_id: int | None = Body(None),
    to_member_name: str | None = Body(None, max_length=100),
    content: str = Body(..., min_length=1),
):
    with get_session() as db:
        try:
            c = db.query(EduComment).filter(EduComment.id == comment_id).first()
            if not c:
                return error("评论不存在", "404")
            r = EduReplyComment(
                comment_id=comment_id,
                member_id=member_id,
                member_name=member_name,
                to_member_id=to_member_id,
                to_member_name=to_member_name,
                content=content,
            )
            db.add(r)
            db.flush()
            c.reply_count = (c.reply_count or 0) + 1
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"[edu comment] create reply error: {e}")
            return error(str(e))


@router.delete("/auth-api/reply/comment", summary="删除回复")
async def delete_reply(id: int = Query(...)):
    with get_session() as db:
        try:
            r = db.query(EduReplyComment).filter(EduReplyComment.id == id).first()
            if not r:
                return error("回复不存在", "404")
            r.status = 0
            # 递减评论回复数
            c = db.query(EduComment).filter(EduComment.id == r.comment_id).first()
            if c and c.reply_count:
                c.reply_count = max(0, c.reply_count - 1)
            return success()
        except Exception as e:
            logger.error(f"[edu comment] delete reply error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 点赞
# ---------------------------------------------------------------------------


def _like_to_dict(l: EduLike) -> dict:
    return {
        "id": l.id,
        "member_id": l.member_id,
        "topic_id": l.topic_id,
        "topic_type": l.topic_type,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }


@router.post("/auth-api/like", summary="点赞")
async def create_like(
    member_id: int = Body(...),
    topic_id: int = Body(...),
    topic_type: str = Body(..., max_length=50),
):
    with get_session() as db:
        try:
            existed = (
                db.query(EduLike)
                .filter(
                    EduLike.member_id == member_id,
                    EduLike.topic_id == topic_id,
                    EduLike.topic_type == topic_type,
                )
                .first()
            )
            if existed:
                return success({"id": existed.id, "existed": True})
            l = EduLike(
                member_id=member_id, topic_id=topic_id, topic_type=topic_type
            )
            db.add(l)
            db.flush()
            # 同步点赞计数到目标记录
            _sync_like_count(db, topic_id, topic_type, delta=1)
            return success({"id": l.id})
        except Exception as e:
            logger.error(f"[edu comment] create like error: {e}")
            return error(str(e))


@router.put("/auth-api/like", summary="更新点赞(切换状态)")
async def update_like(
    member_id: int = Body(...),
    topic_id: int = Body(...),
    topic_type: str = Body(..., max_length=50),
    liked: bool = Body(...),
):
    with get_session() as db:
        try:
            l = (
                db.query(EduLike)
                .filter(
                    EduLike.member_id == member_id,
                    EduLike.topic_id == topic_id,
                    EduLike.topic_type == topic_type,
                )
                .first()
            )
            if liked:
                if not l:
                    l = EduLike(
                        member_id=member_id,
                        topic_id=topic_id,
                        topic_type=topic_type,
                    )
                    db.add(l)
                    db.flush()
                    _sync_like_count(db, topic_id, topic_type, delta=1)
                return success({"id": l.id, "liked": True})
            else:
                if l:
                    db.delete(l)
                    _sync_like_count(db, topic_id, topic_type, delta=-1)
                return success({"liked": False})
        except Exception as e:
            logger.error(f"[edu comment] update like error: {e}")
            return error(str(e))


@router.get("/auth-api/like/list", summary="会员点赞列表")
async def like_list(
    member_id: int = Query(...),
    topic_type: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(EduLike).filter(EduLike.member_id == member_id)
            if topic_type:
                q = q.filter(EduLike.topic_type == topic_type)
            total = q.count()
            items = (
                q.order_by(EduLike.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_like_to_dict(l) for l in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu comment] like list error: {e}")
            return error(str(e))


@router.get("/public-api/like/count", summary="点赞计数")
async def like_count(
    topic_id: int = Query(...),
    topic_type: str = Query(..., max_length=50),
):
    with get_session() as db:
        try:
            count = (
                db.query(EduLike)
                .filter(
                    EduLike.topic_id == topic_id,
                    EduLike.topic_type == topic_type,
                )
                .count()
            )
            return success({"count": count})
        except Exception as e:
            logger.error(f"[edu comment] like count error: {e}")
            return error(str(e))


def _sync_like_count(db, topic_id: int, topic_type: str, delta: int) -> None:
    """将点赞变动同步到目标记录的 like_count 字段."""
    try:
        if topic_type == "dynamic":
            from app.models.edu_platform_models_ext import EduCircleDynamic

            obj = db.query(EduCircleDynamic).filter(EduCircleDynamic.id == topic_id).first()
            if obj:
                obj.like_count = max(0, (obj.like_count or 0) + delta)
        elif topic_type == "comment":
            obj = db.query(EduComment).filter(EduComment.id == topic_id).first()
            if obj:
                obj.like_count = max(0, (obj.like_count or 0) + delta)
        elif topic_type == "reply":
            obj = db.query(EduReplyComment).filter(EduReplyComment.id == topic_id).first()
            if obj:
                obj.like_count = max(0, (obj.like_count or 0) + delta)
    except Exception as e:
        logger.warning(f"[edu comment] sync like count error: {e}")


# ---------------------------------------------------------------------------
# 敏感词
# ---------------------------------------------------------------------------


def _sensitive_word_to_dict(w: EduSensitiveWord) -> dict:
    return {
        "id": w.id,
        "word": w.word,
        "status": w.status,
        "created_at": w.created_at.isoformat() if w.created_at else None,
        "updated_at": w.updated_at.isoformat() if w.updated_at else None,
    }


@router.post("/sensitive-word", summary="新建敏感词")
async def create_sensitive_word(
    word: str = Body(..., min_length=1, max_length=200),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            w = EduSensitiveWord(word=word, status=status)
            db.add(w)
            db.flush()
            return success({"id": w.id})
        except Exception as e:
            logger.error(f"[edu comment] create sensitive word error: {e}")
            return error(str(e))


@router.put("/sensitive-word", summary="更新敏感词")
async def update_sensitive_word(
    id: int = Body(...),
    word: str | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            w = db.query(EduSensitiveWord).filter(EduSensitiveWord.id == id).first()
            if not w:
                return error("敏感词不存在", "404")
            if word is not None:
                w.word = word
            if status is not None:
                w.status = status
            return success({"id": w.id})
        except Exception as e:
            logger.error(f"[edu comment] update sensitive word error: {e}")
            return error(str(e))


@router.delete("/sensitive-word", summary="删除敏感词")
async def delete_sensitive_word(id: int = Query(...)):
    with get_session() as db:
        try:
            w = db.query(EduSensitiveWord).filter(EduSensitiveWord.id == id).first()
            if not w:
                return error("敏感词不存在", "404")
            db.delete(w)
            return success()
        except Exception as e:
            logger.error(f"[edu comment] delete sensitive word error: {e}")
            return error(str(e))


@router.get("/sensitive-word/list", summary="敏感词列表")
async def sensitive_word_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    word: str | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduSensitiveWord)
            if word:
                q = q.filter(EduSensitiveWord.word.like(f"%{word}%"))
            if status is not None:
                q = q.filter(EduSensitiveWord.status == status)
            total = q.count()
            items = (
                q.order_by(EduSensitiveWord.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_sensitive_word_to_dict(w) for w in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu comment] sensitive word list error: {e}")
            return error(str(e))
