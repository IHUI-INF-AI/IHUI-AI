"""问答社区 - 问题管理"""


from fastapi import APIRouter, Query
from loguru import logger

from app.database import get_session
from app.models.ask_models import (
    AskAnswer,
    AskCategory,
    AskComment,
    AskFavorite,
    AskLike,
    AskQuestion,
    AskQuestionCategory,
)
from app.schemas.ask import (
    CommentCreate,
    QuestionCreate,
    QuestionUpdate,
)
from app.schemas.common import error, success

router = APIRouter()


def _current_user_id() -> str:
    """简化:从请求上下文获取当前用户UUID(实际生产从JWT获取)"""
    return "guest"


def _q_to_dict(q: AskQuestion, cid_list: list[int], categories: list[dict], current_uid: str) -> dict:
    is_like = False
    if current_uid:
        is_like = db_query_like(current_uid, "question", q.id)
    return {
        "id": q.id,
        "title": q.title,
        "content": q.content,
        "image": q.image,
        "member_id": q.member_id,
        "member_name": q.member_name,
        "member_avatar": q.member_avatar,
        "status": q.status,
        "favorite_num": q.favorite_num,
        "like_num": q.like_num,
        "comment_num": q.comment_num,
        "watch_num": q.watch_num,
        "answer_num": q.answer_num,
        "is_top": q.is_top,
        "is_essence": q.is_essence,
        "cid_list": cid_list,
        "category_list": categories,
        "is_like": is_like,
        "create_time": q.created_at.isoformat() if q.created_at else None,
        "update_time": q.updated_at.isoformat() if q.updated_at else None,
    }


def db_query_like(uid: str, t: str, tid: int) -> bool:
    with get_session() as db:
        return (
            db.query(AskLike).filter(AskLike.user_id == uid, AskLike.target_type == t, AskLike.target_id == tid).first()
            is not None
        )


@router.post("", summary="提出问题")
async def create_question(body: QuestionCreate):
    with get_session() as db:
        try:
            uid = _current_user_id()
            q = AskQuestion(
                title=body.title,
                content=body.content,
                image=body.image,
                member_id=uid,
                member_name="匿名用户",
                status="published",
            )
            db.add(q)
            db.flush()
            for cid in body.cid_list or []:
                db.add(AskQuestionCategory(question_id=q.id, category_id=cid))
            return success(_q_to_dict(q, body.cid_list or [], [], uid))
        except Exception as e:
            logger.error(f"ask create question error: {e}")
            return error(str(e))


@router.put("", summary="修改问题")
async def update_question(body: QuestionUpdate):
    with get_session() as db:
        try:
            q = db.query(AskQuestion).filter(AskQuestion.id == body.id).first()
            if not q:
                return error("问题不存在", "404")
            if body.title is not None:
                q.title = body.title
            if body.content is not None:
                q.content = body.content
            if body.image is not None:
                q.image = body.image
            if body.status is not None:
                q.status = body.status
            if body.cid_list is not None:
                db.query(AskQuestionCategory).filter(AskQuestionCategory.question_id == q.id).delete()
                for cid in body.cid_list:
                    db.add(AskQuestionCategory(question_id=q.id, category_id=cid))
            return success({"id": q.id})
        except Exception as e:
            logger.error(f"ask update question error: {e}")
            return error(str(e))


@router.delete("", summary="删除问题")
async def delete_question(id: int = Query(...)):
    with get_session() as db:
        try:
            q = db.query(AskQuestion).filter(AskQuestion.id == id).first()
            if not q:
                return error("问题不存在", "404")
            q.deleted = True
            db.query(AskAnswer).filter(AskAnswer.question_id == id).update({AskAnswer.deleted: True})
            return success()
        except Exception as e:
            logger.error(f"ask delete question error: {e}")
            return error(str(e))


@router.get("/list", summary="问题列表(需权限)")
async def list_questions(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    keyword: str | None = None,
    status: str | None = None,
    cid: int | None = None,
    member_id: str | None = None,
    order_column: str | None = "create_time",
    order_direction: str | None = "desc",
):
    with get_session() as db:
        try:
            q = db.query(AskQuestion).filter(not AskQuestion.deleted)
            if keyword:
                q = q.filter(AskQuestion.title.like(f"%{keyword}%"))
            if status:
                q = q.filter(AskQuestion.status == status)
            if member_id:
                q = q.filter(AskQuestion.member_id == member_id)
            if cid:
                qids = (
                    db.query(AskQuestionCategory.question_id).filter(AskQuestionCategory.category_id == cid).subquery()
                )
                q = q.filter(AskQuestion.id.in_(qids))
            total = q.count()
            col = getattr(AskQuestion, order_column, AskQuestion.created_at)
            if order_direction == "asc":
                items = q.order_by(col.asc()).offset((page - 1) * limit).limit(limit).all()
            else:
                items = q.order_by(col.desc()).offset((page - 1) * limit).limit(limit).all()
            uid = _current_user_id()
            data = []
            for it in items:
                qcs = db.query(AskQuestionCategory).filter(AskQuestionCategory.question_id == it.id).all()
                cids = [x.category_id for x in qcs]
                cats = []
                if cids:
                    crows = db.query(AskCategory).filter(AskCategory.id.in_(cids)).all()
                    cats = [{"id": c.id, "name": c.name} for c in crows]
                data.append(_q_to_dict(it, cids, cats, uid))
            return success(data, total=total)
        except Exception as e:
            logger.error(f"ask list question error: {e}")
            return error(str(e))


@router.get("/public-api/list", summary="问题列表(公开)")
async def public_list_questions(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    keyword: str | None = None,
    cid: int | None = None,
    order_column: str | None = "create_time",
    order_direction: str | None = "desc",
):
    with get_session() as db:
        try:
            q = db.query(AskQuestion).filter(
                not AskQuestion.deleted,
                AskQuestion.status == "published",
            )
            if keyword:
                q = q.filter(AskQuestion.title.like(f"%{keyword}%"))
            if cid:
                qids = (
                    db.query(AskQuestionCategory.question_id).filter(AskQuestionCategory.category_id == cid).subquery()
                )
                q = q.filter(AskQuestion.id.in_(qids))
            total = q.count()
            col = getattr(AskQuestion, order_column, AskQuestion.created_at)
            if order_direction == "asc":
                items = q.order_by(col.asc()).offset((page - 1) * limit).limit(limit).all()
            else:
                items = q.order_by(col.desc()).offset((page - 1) * limit).limit(limit).all()
            uid = _current_user_id()
            data = []
            for it in items:
                qcs = db.query(AskQuestionCategory).filter(AskQuestionCategory.question_id == it.id).all()
                cids = [x.category_id for x in qcs]
                cats = []
                if cids:
                    crows = db.query(AskCategory).filter(AskCategory.id.in_(cids)).all()
                    cats = [{"id": c.id, "name": c.name} for c in crows]
                data.append(_q_to_dict(it, cids, cats, uid))
            return success(data, total=total)
        except Exception as e:
            logger.error(f"ask public list question error: {e}")
            return error(str(e))


@router.get("/public-api", summary="问题详情")
async def get_question(id: int = Query(...)):
    with get_session() as db:
        try:
            q = db.query(AskQuestion).filter(AskQuestion.id == id, not AskQuestion.deleted).first()
            if not q:
                return error("问题不存在", "404")
            q.watch_num = (q.watch_num or 0) + 1
            qcs = db.query(AskQuestionCategory).filter(AskQuestionCategory.question_id == id).all()
            cids = [x.category_id for x in qcs]
            cats = []
            if cids:
                crows = db.query(AskCategory).filter(AskCategory.id.in_(cids)).all()
                cats = [{"id": c.id, "name": c.name} for c in crows]
            uid = _current_user_id()
            return success(_q_to_dict(q, cids, cats, uid))
        except Exception as e:
            logger.error(f"ask get question error: {e}")
            return error(str(e))


@router.get("/public-api/member/count", summary="会员问题数")
async def member_question_count(member_id: str | None = None):
    with get_session() as db:
        try:
            uid = member_id or _current_user_id()
            count = (
                db.query(AskQuestion)
                .filter(
                    AskQuestion.member_id == uid,
                    not AskQuestion.deleted,
                )
                .count()
            )
            return success({"count": count})
        except Exception as e:
            logger.error(f"ask member count error: {e}")
            return error(str(e))


@router.post("/like", operation_id="ask_question_toggle_like", summary="点赞/取消点赞")
async def toggle_like(target_type: str = Query(..., pattern="^(question|answer)$"), target_id: int = Query(...)):
    with get_session() as db:
        try:
            uid = _current_user_id()
            like = (
                db.query(AskLike)
                .filter(
                    AskLike.user_id == uid,
                    AskLike.target_type == target_type,
                    AskLike.target_id == target_id,
                )
                .first()
            )
            if like:
                db.delete(like)
                liked = False
            else:
                db.add(AskLike(user_id=uid, target_type=target_type, target_id=target_id, is_like=True))
                liked = True
            if target_type == "question":
                q = db.query(AskQuestion).filter(AskQuestion.id == target_id).first()
                if q:
                    q.like_num = max(0, (q.like_num or 0) + (1 if liked else -1))
            else:
                a = db.query(AskAnswer).filter(AskAnswer.id == target_id).first()
                if a:
                    a.like_num = max(0, (a.like_num or 0) + (1 if liked else -1))
            return success({"liked": liked})
        except Exception as e:
            logger.error(f"ask toggle like error: {e}")
            return error(str(e))


@router.post("/favorite", operation_id="ask_question_toggle_favorite", summary="收藏/取消收藏")
async def toggle_favorite(target_type: str = Query(..., pattern="^(question|answer)$"), target_id: int = Query(...)):
    with get_session() as db:
        try:
            uid = _current_user_id()
            fav = (
                db.query(AskFavorite)
                .filter(
                    AskFavorite.user_id == uid,
                    AskFavorite.target_type == target_type,
                    AskFavorite.target_id == target_id,
                )
                .first()
            )
            if fav:
                db.delete(fav)
                ok = False
            else:
                db.add(AskFavorite(user_id=uid, target_type=target_type, target_id=target_id))
                ok = True
            return success({"favorited": ok})
        except Exception as e:
            logger.error(f"ask toggle favorite error: {e}")
            return error(str(e))


@router.post("/comment", operation_id="ask_question_add_comment", summary="发表评论")
async def add_comment(body: CommentCreate):
    with get_session() as db:
        try:
            uid = _current_user_id()
            c = AskComment(
                target_type=body.target_type,
                target_id=body.target_id,
                user_id=uid,
                user_name="匿名用户",
                content=body.content,
                pid=body.pid,
            )
            db.add(c)
            db.flush()
            if body.target_type == "question":
                q = db.query(AskQuestion).filter(AskQuestion.id == body.target_id).first()
                if q:
                    q.comment_num = (q.comment_num or 0) + 1
            else:
                a = db.query(AskAnswer).filter(AskAnswer.id == body.target_id).first()
                if a:
                    a.comment_num = (a.comment_num or 0) + 1
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"ask add comment error: {e}")
            return error(str(e))
