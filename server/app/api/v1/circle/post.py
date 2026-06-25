"""圈子社区 - 帖子管理"""


from fastapi import APIRouter, Query
from loguru import logger

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.circle_models import Circle, CirclePost, CirclePostComment, CirclePostLike
from app.schemas.common import error, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

def _p_to_dict(p: CirclePost, liked: bool = False) -> dict:
    return {
        "id": p.id,
        "circle_id": p.circle_id,
        "user_id": p.user_id,
        "user_name": p.user_name,
        "user_avatar": p.user_avatar,
        "content": p.content,
        "images": p.images,
        "video": p.video,
        "status": p.status,
        "like_num": p.like_num,
        "comment_num": p.comment_num,
        "share_num": p.share_num,
        "watch_num": p.watch_num,
        "is_top": p.is_top,
        "is_essence": p.is_essence,
        "is_liked": liked,
        "create_time": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/list", summary="帖子列表")
def list_posts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    circle_id: int | None = None,
    user_id: str | None = None,
    keyword: str | None = None,
    order_by: str | None = "create_time",
):
    with get_session() as db:
        try:
            q = db.query(CirclePost).filter(not CirclePost.deleted, CirclePost.status == 1)
            if circle_id:
                q = q.filter(CirclePost.circle_id == circle_id)
            if user_id:
                q = q.filter(CirclePost.user_id == user_id)
            if keyword:
                q = q.filter(CirclePost.content.like(f"%{keyword}%"))
            total = q.count()
            if order_by == "hot":
                items = (
                    q.order_by(CirclePost.is_top.desc(), (CirclePost.like_num + CirclePost.comment_num).desc())
                    .offset((page - 1) * limit)
                    .limit(limit)
                    .all()
                )
            else:
                items = (
                    q.order_by(CirclePost.is_top.desc(), CirclePost.created_at.desc())
                    .offset((page - 1) * limit)
                    .limit(limit)
                    .all()
                )
            uid = _uid()
            data = []
            pids = [it.id for it in items]
            liked_pids = set()
            if pids:
                liked_rows = (
                    db.query(CirclePostLike.post_id)
                    .filter(CirclePostLike.post_id.in_(pids), CirclePostLike.user_id == uid)
                    .all()
                )
                liked_pids = {r[0] for r in liked_rows}
            for it in items:
                liked = it.id in liked_pids
                data.append(_p_to_dict(it, liked))
            return success(data, total=total)
        except Exception as e:
            logger.error(f"circle post list error: {e}")
            return error(str(e))


@router.get("/{pid}", summary="帖子详情")
def get_post(pid: int):
    with get_session() as db:
        try:
            p = db.query(CirclePost).filter(CirclePost.id == pid, not CirclePost.deleted).first()
            if not p:
                return error("帖子不存在", "404")
            p.watch_num = (p.watch_num or 0) + 1
            liked = (
                db.query(CirclePostLike).filter(CirclePostLike.post_id == pid, CirclePostLike.user_id == _uid()).first()
                is not None
            )
            return success(_p_to_dict(p, liked))
        except Exception as e:
            logger.error(f"circle post get error: {e}")
            return error(str(e))


@router.post("", summary="发布帖子")
def create_post(
    circle_id: int = Query(...),
    content: str = Query(..., min_length=1),
    images: str | None = None,
    video: str | None = None,
):
    with get_session() as db:
        try:
            c = db.query(Circle).filter(Circle.id == circle_id).first()
            if not c:
                return error("圈子不存在", "404")
            uid = _uid()
            p = CirclePost(
                circle_id=circle_id,
                user_id=uid,
                user_name="匿名用户",
                content=content,
                images=images,
                video=video,
                status=1,
            )
            db.add(p)
            db.flush()
            c.post_num = (c.post_num or 0) + 1
            return success(_p_to_dict(p))
        except Exception as e:
            logger.error(f"circle post create error: {e}")
            return error(str(e))


@router.put("/{pid}", summary="修改帖子")
def update_post(
    pid: int, content: str | None = None, images: str | None = None, video: str | None = None
):
    with get_session() as db:
        try:
            p = db.query(CirclePost).filter(CirclePost.id == pid).first()
            if not p:
                return error("帖子不存在", "404")
            if content:
                p.content = content
            if images is not None:
                p.images = images
            if video is not None:
                p.video = video
            return success(_p_to_dict(p))
        except Exception as e:
            logger.error(f"circle post update error: {e}")
            return error(str(e))


@router.delete("/{pid}", summary="删除帖子")
def delete_post(pid: int):
    with get_session() as db:
        try:
            p = db.query(CirclePost).filter(CirclePost.id == pid).first()
            if not p:
                return error("帖子不存在", "404")
            p.deleted = True
            p.status = 0
            c = db.query(Circle).filter(Circle.id == p.circle_id).first()
            if c and c.post_num and c.post_num > 0:
                c.post_num -= 1
            return success()
        except Exception as e:
            logger.error(f"circle post delete error: {e}")
            return error(str(e))


@router.post("/{pid}/like", summary="点赞/取消点赞")
def toggle_like(pid: int):
    with get_session() as db:
        try:
            uid = _uid()
            like = db.query(CirclePostLike).filter(CirclePostLike.post_id == pid, CirclePostLike.user_id == uid).first()
            p = db.query(CirclePost).filter(CirclePost.id == pid).first()
            if not p:
                return error("帖子不存在", "404")
            if like:
                db.delete(like)
                p.like_num = max(0, (p.like_num or 0) - 1)
                return success({"liked": False, "like_num": p.like_num})
            db.add(CirclePostLike(post_id=pid, user_id=uid))
            p.like_num = (p.like_num or 0) + 1
            return success({"liked": True, "like_num": p.like_num})
        except Exception as e:
            logger.error(f"circle post like error: {e}")
            return error(str(e))


@router.get("/{pid}/comments", summary="评论列表")
def list_comments(pid: int, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        try:
            q = db.query(CirclePostComment).filter(CirclePostComment.post_id == pid)
            total = q.count()
            items = q.order_by(CirclePostComment.id.asc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": c.id,
                        "post_id": c.post_id,
                        "user_id": c.user_id,
                        "user_name": c.user_name,
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
            logger.error(f"circle post comments error: {e}")
            return error(str(e))


@router.post("/{pid}/comment", summary="发表评论")
def add_comment(
    pid: int,
    content: str = Query(..., min_length=1),
    pid_parent: int = Query(0, alias="pid"),
    reply_user_id: str | None = None,
    reply_user_name: str | None = None,
):
    with get_session() as db:
        try:
            p = db.query(CirclePost).filter(CirclePost.id == pid).first()
            if not p:
                return error("帖子不存在", "404")
            uid = _uid()
            c = CirclePostComment(
                post_id=pid,
                user_id=uid,
                user_name="匿名用户",
                content=content,
                pid=pid_parent,
                reply_user_id=reply_user_id,
                reply_user_name=reply_user_name,
            )
            db.add(c)
            db.flush()
            p.comment_num = (p.comment_num or 0) + 1
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"circle post add comment error: {e}")
            return error(str(e))
