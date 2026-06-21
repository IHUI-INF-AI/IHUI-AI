"""行为分析 - 点赞/收藏/评论/分享/举报/敏感词"""


from fastapi import APIRouter, Query
from loguru import logger

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.behavior_models import (
    BehaviorComment,
    BehaviorFavorite,
    BehaviorFollow,
    BehaviorLike,
    BehaviorReport,
    BehaviorSensitive,
    BehaviorShare,
)
from app.schemas.common import error, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

# ============ 点赞 ============


@router.post("/like", operation_id="behavior_toggle_like", summary="点赞/取消点赞")
async def toggle_like(target_type: str = Query(...), target_id: int = Query(...)):
    with get_session() as db:
        try:
            uid = _uid()
            like = (
                db.query(BehaviorLike)
                .filter(
                    BehaviorLike.user_id == uid,
                    BehaviorLike.target_type == target_type,
                    BehaviorLike.target_id == target_id,
                )
                .first()
            )
            if like:
                db.delete(like)
                return success({"liked": False})
            db.add(
                BehaviorLike(
                    user_id=uid,
                    user_name="匿名用户",
                    target_type=target_type,
                    target_id=target_id,
                )
            )
            return success({"liked": True})
        except Exception as e:
            logger.error(f"behavior like error: {e}")
            return error(str(e))


@router.get("/like/list", summary="点赞列表")
async def like_list(
    target_type: str | None = None,
    user_id: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(BehaviorLike)
            if target_type:
                q = q.filter(BehaviorLike.target_type == target_type)
            if user_id:
                q = q.filter(BehaviorLike.user_id == user_id)
            total = q.count()
            items = q.order_by(BehaviorLike.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": l.id,
                        "user_id": l.user_id,
                        "user_name": l.user_name,
                        "target_type": l.target_type,
                        "target_id": l.target_id,
                        "create_time": l.created_at.isoformat() if l.created_at else None,
                    }
                    for l in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"behavior like list error: {e}")
            return error(str(e))


# ============ 收藏 ============


@router.post("/favorite", operation_id="behavior_toggle_favorite", summary="收藏/取消收藏")
async def toggle_favorite(target_type: str = Query(...), target_id: int = Query(...), folder: str = "default"):
    with get_session() as db:
        try:
            uid = _uid()
            fav = (
                db.query(BehaviorFavorite)
                .filter(
                    BehaviorFavorite.user_id == uid,
                    BehaviorFavorite.target_type == target_type,
                    BehaviorFavorite.target_id == target_id,
                )
                .first()
            )
            if fav:
                db.delete(fav)
                return success({"favorited": False})
            db.add(
                BehaviorFavorite(
                    user_id=uid,
                    user_name="匿名用户",
                    target_type=target_type,
                    target_id=target_id,
                    folder=folder,
                )
            )
            return success({"favorited": True})
        except Exception as e:
            logger.error(f"behavior favorite error: {e}")
            return error(str(e))


@router.get("/favorite/list", summary="收藏列表")
async def favorite_list(
    target_type: str | None = None,
    folder: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(BehaviorFavorite).filter(BehaviorFavorite.user_id == _uid())
            if target_type:
                q = q.filter(BehaviorFavorite.target_type == target_type)
            if folder:
                q = q.filter(BehaviorFavorite.folder == folder)
            total = q.count()
            items = q.order_by(BehaviorFavorite.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": f.id,
                        "target_type": f.target_type,
                        "target_id": f.target_id,
                        "folder": f.folder,
                        "create_time": f.created_at.isoformat() if f.created_at else None,
                    }
                    for f in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"behavior favorite list error: {e}")
            return error(str(e))


# ============ 评论 ============


@router.post("/comment", operation_id="behavior_add_comment", summary="发表评论")
async def add_comment(
    target_type: str = Query(...),
    target_id: int = Query(...),
    content: str = Query(..., min_length=1),
    pid: int = 0,
    reply_user_id: str | None = None,
    reply_user_name: str | None = None,
):
    with get_session() as db:
        try:
            uid = _uid()
            content = _filter_sensitive(db, content)
            c = BehaviorComment(
                user_id=uid,
                user_name="匿名用户",
                target_type=target_type,
                target_id=target_id,
                content=content,
                pid=pid,
                reply_user_id=reply_user_id,
                reply_user_name=reply_user_name,
                status=1,
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"behavior comment error: {e}")
            return error(str(e))


@router.get("/comment/list", summary="评论列表")
async def comment_list(
    target_type: str = Query(...),
    target_id: int = Query(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(BehaviorComment).filter(
                BehaviorComment.target_type == target_type,
                BehaviorComment.target_id == target_id,
                BehaviorComment.status == 1,
            )
            total = q.count()
            items = q.order_by(BehaviorComment.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": c.id,
                        "user_id": c.user_id,
                        "user_name": c.user_name,
                        "user_avatar": c.user_avatar,
                        "content": c.content,
                        "pid": c.pid,
                        "reply_user_id": c.reply_user_id,
                        "reply_user_name": c.reply_user_name,
                        "like_num": c.like_num,
                        "create_time": c.created_at.isoformat() if c.created_at else None,
                    }
                    for c in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"behavior comment list error: {e}")
            return error(str(e))


@router.delete("/comment/{cid}", summary="删除评论")
async def delete_comment(cid: int):
    with get_session() as db:
        try:
            c = db.query(BehaviorComment).filter(BehaviorComment.id == cid).first()
            if not c:
                return error("评论不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"behavior comment delete error: {e}")
            return error(str(e))


# ============ 分享 ============


@router.post("/share", summary="分享")
async def share(
    target_type: str = Query(...), target_id: int = Query(...), platform: str | None = None, ip: str | None = None
):
    with get_session() as db:
        try:
            db.add(
                BehaviorShare(
                    user_id=_uid(),
                    target_type=target_type,
                    target_id=target_id,
                    platform=platform,
                    ip=ip,
                )
            )
            return success()
        except Exception as e:
            logger.error(f"behavior share error: {e}")
            return error(str(e))


# ============ 举报 ============


@router.post("/report", summary="举报")
async def report(
    target_type: str = Query(...),
    target_id: int = Query(...),
    reason: str | None = None,
    category: str | None = None,
):
    with get_session() as db:
        try:
            r = BehaviorReport(
                user_id=_uid(),
                target_type=target_type,
                target_id=target_id,
                reason=reason,
                category=category,
                status=0,
            )
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"behavior report error: {e}")
            return error(str(e))


@router.get("/report/list", summary="举报列表")
async def report_list(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), status: int | None = None):
    with get_session() as db:
        try:
            q = db.query(BehaviorReport)
            if status is not None:
                q = q.filter(BehaviorReport.status == status)
            total = q.count()
            items = q.order_by(BehaviorReport.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": r.id,
                        "user_id": r.user_id,
                        "target_type": r.target_type,
                        "target_id": r.target_id,
                        "reason": r.reason,
                        "category": r.category,
                        "status": r.status,
                        "handle_user": r.handle_user,
                        "handle_remark": r.handle_remark,
                        "create_time": r.created_at.isoformat() if r.created_at else None,
                    }
                    for r in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"behavior report list error: {e}")
            return error(str(e))


@router.put("/report/{rid}/handle", summary="处理举报")
async def handle_report(rid: int, status: int = Query(...), remark: str | None = None):
    with get_session() as db:
        try:
            r = db.query(BehaviorReport).filter(BehaviorReport.id == rid).first()
            if not r:
                return error("举报不存在", "404")
            r.status = status
            r.handle_user = "admin"
            r.handle_remark = remark
            return success()
        except Exception as e:
            logger.error(f"behavior report handle error: {e}")
            return error(str(e))


# ============ 敏感词 ============


def _filter_sensitive(db, content: str) -> str:
    """过滤敏感词"""
    items = db.query(BehaviorSensitive).filter(BehaviorSensitive.status == 1).all()
    for s in items:
        if s.action == "replace" and s.word in content:
            content = content.replace(s.word, s.replacement or "***")
    return content


@router.get("/sensitive/list", summary="敏感词列表")
async def sensitive_list(
    page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=200), category: str | None = None
):
    with get_session() as db:
        try:
            q = db.query(BehaviorSensitive)
            if category:
                q = q.filter(BehaviorSensitive.category == category)
            total = q.count()
            items = q.order_by(BehaviorSensitive.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": s.id,
                        "word": s.word,
                        "category": s.category,
                        "level": s.level,
                        "action": s.action,
                        "replacement": s.replacement,
                        "status": s.status,
                    }
                    for s in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"sensitive list error: {e}")
            return error(str(e))


@router.post("/sensitive", summary="添加敏感词")
async def add_sensitive(
    word: str = Query(...),
    category: str | None = None,
    level: int = 1,
    action: str = "replace",
    replacement: str | None = None,
):
    with get_session() as db:
        try:
            s = BehaviorSensitive(
                word=word,
                category=category,
                level=level,
                action=action,
                replacement=replacement,
                status=1,
            )
            db.add(s)
            db.flush()
            return success({"id": s.id})
        except Exception as e:
            logger.error(f"sensitive add error: {e}")
            return error(str(e))


@router.delete("/sensitive/{sid}", summary="删除敏感词")
async def delete_sensitive(sid: int):
    with get_session() as db:
        try:
            s = db.query(BehaviorSensitive).filter(BehaviorSensitive.id == sid).first()
            if not s:
                return error("敏感词不存在", "404")
            db.delete(s)
            return success()
        except Exception as e:
            logger.error(f"sensitive delete error: {e}")
            return error(str(e))


@router.post("/sensitive/check", summary="敏感词检测")
async def check_sensitive(content: str = Query(..., min_length=1)):
    with get_session() as db:
        try:
            items = db.query(BehaviorSensitive).filter(BehaviorSensitive.status == 1).all()
            hits = []
            for s in items:
                if s.word in content:
                    hits.append(
                        {
                            "word": s.word,
                            "category": s.category,
                            "level": s.level,
                            "action": s.action,
                        }
                    )
            return success({"has_sensitive": len(hits) > 0, "hits": hits, "count": len(hits)})
        except Exception as e:
            logger.error(f"sensitive check error: {e}")
            return error(str(e))


# ============ 关注 ============


@router.post("/follow", summary="关注/取消关注")
async def toggle_follow(target_user_id: str = Query(...)):
    with get_session() as db:
        try:
            uid = _uid()
            if uid == target_user_id:
                return error("不能关注自己", "400")
            f = (
                db.query(BehaviorFollow)
                .filter(
                    BehaviorFollow.user_id == uid,
                    BehaviorFollow.target_user_id == target_user_id,
                )
                .first()
            )
            if f:
                db.delete(f)
                return success({"followed": False})
            db.add(BehaviorFollow(user_id=uid, target_user_id=target_user_id))
            return success({"followed": True})
        except Exception as e:
            logger.error(f"behavior follow error: {e}")
            return error(str(e))


@router.get("/follow/list", summary="关注列表")
async def follow_list(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), is_follower: bool = False):
    with get_session() as db:
        try:
            uid = _uid()
            if is_follower:
                q = db.query(BehaviorFollow).filter(BehaviorFollow.target_user_id == uid)
            else:
                q = db.query(BehaviorFollow).filter(BehaviorFollow.user_id == uid)
            total = q.count()
            items = q.order_by(BehaviorFollow.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": f.id,
                        "user_id": f.user_id,
                        "target_user_id": f.target_user_id,
                        "is_mutual": f.is_mutual,
                        "create_time": f.created_at.isoformat() if f.created_at else None,
                    }
                    for f in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"behavior follow list error: {e}")
            return error(str(e))
