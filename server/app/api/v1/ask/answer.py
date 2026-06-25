"""问答社区 - 回答管理"""


from fastapi import APIRouter, Query
from loguru import logger

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.ask_models import AskAnswer, AskQuestion
from app.schemas.ask import AnswerCreate, AnswerUpdate
from app.schemas.common import error, success

router = APIRouter()


def _current_user_id() -> str:
    return current_user_id_or_guest()

def _a_to_dict(a: AskAnswer) -> dict:
    return {
        "id": a.id,
        "question_id": a.question_id,
        "content": a.content,
        "member_id": a.member_id,
        "member_name": a.member_name,
        "member_avatar": a.member_avatar,
        "favorite_num": a.favorite_num,
        "like_num": a.like_num,
        "comment_num": a.comment_num,
        "is_adopted": a.is_adopted,
        "is_top": a.is_top,
        "create_time": a.created_at.isoformat() if a.created_at else None,
        "update_time": a.updated_at.isoformat() if a.updated_at else None,
    }


@router.post("", summary="提出回答")
def create_answer(body: AnswerCreate):
    with get_session() as db:
        try:
            q = db.query(AskQuestion).filter(AskQuestion.id == body.question_id).first()
            if not q:
                return error("问题不存在", "404")
            uid = _current_user_id()
            a = AskAnswer(
                question_id=body.question_id,
                content=body.content,
                member_id=uid,
                member_name="匿名用户",
            )
            db.add(a)
            db.flush()
            q.answer_num = (q.answer_num or 0) + 1
            return success(_a_to_dict(a))
        except Exception as e:
            logger.error(f"ask create answer error: {e}")
            return error(str(e))


@router.put("", summary="修改回答")
def update_answer(body: AnswerUpdate):
    with get_session() as db:
        try:
            a = db.query(AskAnswer).filter(AskAnswer.id == body.id).first()
            if not a:
                return error("回答不存在", "404")
            if body.content is not None:
                a.content = body.content
            return success(_a_to_dict(a))
        except Exception as e:
            logger.error(f"ask update answer error: {e}")
            return error(str(e))


@router.delete("", summary="删除回答")
def delete_answer(id: int = Query(...)):
    with get_session() as db:
        try:
            a = db.query(AskAnswer).filter(AskAnswer.id == id).first()
            if not a:
                return error("回答不存在", "404")
            a.deleted = True
            q = db.query(AskQuestion).filter(AskQuestion.id == a.question_id).first()
            if q and q.answer_num and q.answer_num > 0:
                q.answer_num -= 1
            return success()
        except Exception as e:
            logger.error(f"ask delete answer error: {e}")
            return error(str(e))


@router.get("/list", summary="回答列表(需权限)")
def list_answers(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    question_id: int | None = None,
    member_id: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(AskAnswer).filter(AskAnswer.deleted.is_(False))
            if question_id:
                q = q.filter(AskAnswer.question_id == question_id)
            if member_id:
                q = q.filter(AskAnswer.member_id == member_id)
            total = q.count()
            items = (
                q.order_by(AskAnswer.is_top.desc(), AskAnswer.id.desc()).offset((page - 1) * limit).limit(limit).all()
            )
            return success([_a_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"ask list answer error: {e}")
            return error(str(e))


@router.get("/public-api/list", summary="回答列表(公开)")
def public_list_answers(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    question_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(AskAnswer).filter(AskAnswer.deleted.is_(False))
            if question_id:
                q = q.filter(AskAnswer.question_id == question_id)
            total = q.count()
            items = (
                q.order_by(AskAnswer.is_adopted.desc(), AskAnswer.is_top.desc(), AskAnswer.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success([_a_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"ask public list answer error: {e}")
            return error(str(e))


@router.get("/public-api", summary="回答详情")
def get_answer(id: int = Query(...)):
    with get_session() as db:
        try:
            a = db.query(AskAnswer).filter(AskAnswer.id == id, AskAnswer.deleted.is_(False)).first()
            if not a:
                return error("回答不存在", "404")
            return success(_a_to_dict(a))
        except Exception as e:
            logger.error(f"ask get answer error: {e}")
            return error(str(e))


@router.get("/public-api/member/count", summary="会员回答数")
def member_answer_count(member_id: str | None = None):
    with get_session() as db:
        try:
            uid = member_id or _current_user_id()
            count = (
                db.query(AskAnswer)
                .filter(
                    AskAnswer.member_id == uid,
                    AskAnswer.deleted.is_(False),
                )
                .count()
            )
            return success({"count": count})
        except Exception as e:
            logger.error(f"ask member answer count error: {e}")
            return error(str(e))


@router.put("/adopt", summary="采纳回答")
def adopt_answer(id: int = Query(...)):
    with get_session() as db:
        try:
            a = db.query(AskAnswer).filter(AskAnswer.id == id).first()
            if not a:
                return error("回答不存在", "404")
            db.query(AskAnswer).filter(AskAnswer.question_id == a.question_id).update({AskAnswer.is_adopted: False})
            a.is_adopted = True
            return success()
        except Exception as e:
            logger.error(f"ask adopt answer error: {e}")
            return error(str(e))
