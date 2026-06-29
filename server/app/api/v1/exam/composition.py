"""考试系统 - 组卷能力 (考试/抽题规则/报名/答卷)"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.core.current_user import current_user_id_or_guest, get_member_id_int
from app.database import get_session
from app.models.exam_ext_models import ExamExam, ExamPaperQuestionRule, ExamSignUp
from app.schemas.common import error, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()


def _exam_to_dict(e: ExamExam) -> dict:
    return {
        "id": e.id,
        "name": e.name,
        "code": e.code,
        "start_time": e.start_time.isoformat() if e.start_time else None,
        "end_time": e.end_time.isoformat() if e.end_time else None,
        "image": e.image,
        "status": e.status,
        "phrase": e.phrase,
        "introduction": e.introduction,
        "create_time": e.created_at.isoformat() if e.created_at else None,
    }


def _rule_to_dict(r: ExamPaperQuestionRule) -> dict:
    return {
        "id": r.id,
        "paper_id": r.paper_id,
        "rule_json": r.rule_json,
        "create_time": r.created_at.isoformat() if r.created_at else None,
    }


def _signup_to_dict(s: ExamSignUp) -> dict:
    return {
        "id": s.id,
        "member_id": s.member_id,
        "exam_id": s.exam_id,
        "status": s.status,
        "completed_time": s.completed_time.isoformat() if s.completed_time else None,
        "create_time": s.created_at.isoformat() if s.created_at else None,
    }


# ============ Exam management ============


@router.get("/composition/list", summary="考试列表")
async def list_exams(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(ExamExam)
            if keyword:
                q = q.filter(ExamExam.name.like(f"%{keyword}%"))
            if status:
                q = q.filter(ExamExam.status == status)
            total = q.count()
            items = (
                q.order_by(ExamExam.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success([_exam_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"exam composition list error: {e}")
            return error(str(e))


@router.get("/composition/{eid}", summary="考试详情")
async def get_exam(eid: int):
    with get_session() as db:
        try:
            e = db.query(ExamExam).filter(ExamExam.id == eid).first()
            if not e:
                return error("考试不存在", "404")
            return success(_exam_to_dict(e))
        except Exception as e:
            logger.error(f"exam composition get error: {e}")
            return error(str(e))


@router.post("/composition", summary="创建考试")
async def create_exam(
    name: str = Query(..., min_length=1, max_length=100),
    code: str = Query(..., min_length=1, max_length=100),
    start_time: datetime = Query(...),
    end_time: datetime = Query(...),
    image: str = Query(..., min_length=1),
    status: str = Query("draft"),
    phrase: str = "",
    introduction: str = "",
):
    with get_session() as db:
        try:
            e = ExamExam(
                name=name,
                code=code,
                start_time=start_time,
                end_time=end_time,
                image=image,
                status=status,
                phrase=phrase,
                introduction=introduction,
            )
            db.add(e)
            db.flush()
            return success(_exam_to_dict(e))
        except Exception as e:
            logger.error(f"exam composition create error: {e}")
            return error(str(e))


@router.put("/composition/{eid}", summary="修改考试")
async def update_exam(
    eid: int,
    name: str | None = None,
    code: str | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    image: str | None = None,
    status: str | None = None,
    phrase: str | None = None,
    introduction: str | None = None,
):
    with get_session() as db:
        try:
            e = db.query(ExamExam).filter(ExamExam.id == eid).first()
            if not e:
                return error("考试不存在", "404")
            if name:
                e.name = name
            if code:
                e.code = code
            if start_time:
                e.start_time = start_time
            if end_time:
                e.end_time = end_time
            if image:
                e.image = image
            if status:
                e.status = status
            if phrase is not None:
                e.phrase = phrase
            if introduction is not None:
                e.introduction = introduction
            return success(_exam_to_dict(e))
        except Exception as e:
            logger.error(f"exam composition update error: {e}")
            return error(str(e))


@router.delete("/composition/{eid}", summary="删除考试")
async def delete_exam(eid: int):
    with get_session() as db:
        try:
            e = db.query(ExamExam).filter(ExamExam.id == eid).first()
            if not e:
                return error("考试不存在", "404")
            db.delete(e)
            return success()
        except Exception as e:
            logger.error(f"exam composition delete error: {e}")
            return error(str(e))


# ============ Composition rules ============


@router.get("/composition/rule/list", summary="抽题规则列表")
async def list_rules(paper_id: int = Query(...)):
    with get_session() as db:
        try:
            items = (
                db.query(ExamPaperQuestionRule)
                .filter(ExamPaperQuestionRule.paper_id == paper_id)
                .order_by(ExamPaperQuestionRule.id.asc())
                .all()
            )
            return success([_rule_to_dict(i) for i in items])
        except Exception as e:
            logger.error(f"exam rule list error: {e}")
            return error(str(e))


@router.post("/composition/rule", summary="新增抽题规则")
async def create_rule(
    paper_id: int = Query(...),
    rule_json: str = Query(..., min_length=1, description="抽题规则JSON"),
):
    with get_session() as db:
        try:
            r = ExamPaperQuestionRule(paper_id=paper_id, rule_json=rule_json)
            db.add(r)
            db.flush()
            return success(_rule_to_dict(r))
        except Exception as e:
            logger.error(f"exam rule create error: {e}")
            return error(str(e))


@router.put("/composition/rule/{rid}", summary="修改抽题规则")
async def update_rule(
    rid: int,
    rule_json: str | None = None,
):
    with get_session() as db:
        try:
            r = db.query(ExamPaperQuestionRule).filter(ExamPaperQuestionRule.id == rid).first()
            if not r:
                return error("规则不存在", "404")
            if rule_json:
                r.rule_json = rule_json
            return success(_rule_to_dict(r))
        except Exception as e:
            logger.error(f"exam rule update error: {e}")
            return error(str(e))


@router.delete("/composition/rule/{rid}", summary="删除抽题规则")
async def delete_rule(rid: int):
    with get_session() as db:
        try:
            r = db.query(ExamPaperQuestionRule).filter(ExamPaperQuestionRule.id == rid).first()
            if not r:
                return error("规则不存在", "404")
            db.delete(r)
            return success()
        except Exception as e:
            logger.error(f"exam rule delete error: {e}")
            return error(str(e))


# ============ Exam sign-up ============


@router.get("/composition/signup/list", summary="报名列表")
async def list_signups(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    exam_id: int | None = None,
    member_id: int | None = None,
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(ExamSignUp)
            if exam_id:
                q = q.filter(ExamSignUp.exam_id == exam_id)
            if member_id:
                q = q.filter(ExamSignUp.member_id == member_id)
            if status:
                q = q.filter(ExamSignUp.status == status)
            total = q.count()
            items = (
                q.order_by(ExamSignUp.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success([_signup_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"exam signup list error: {e}")
            return error(str(e))


@router.get("/composition/signup/my", summary="我的报名/答卷列表")
async def my_signups(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
):
    with get_session() as db:
        try:
            uid = _uid()
            try:
                member_id = int(uid)
            except (TypeError, ValueError):
                member_id = 0
            q = db.query(ExamSignUp).filter(ExamSignUp.member_id == member_id)
            if status:
                q = q.filter(ExamSignUp.status == status)
            total = q.count()
            items = (
                q.order_by(ExamSignUp.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success([_signup_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"exam my signup list error: {e}")
            return error(str(e))


@router.get("/composition/signup/{sid}", summary="报名详情")
async def get_signup(sid: int):
    with get_session() as db:
        try:
            s = db.query(ExamSignUp).filter(ExamSignUp.id == sid).first()
            if not s:
                return error("报名不存在", "404")
            return success(_signup_to_dict(s))
        except Exception as e:
            logger.error(f"exam signup get error: {e}")
            return error(str(e))


@router.post("/composition/signup", summary="创建报名")
async def create_signup(
    exam_id: int = Query(...),
    status: str = Query("enrolled"),
    member_id: int = Depends(get_member_id_int),
):
    with get_session() as db:
        try:
            exist = (
                db.query(ExamSignUp)
                .filter(
                    ExamSignUp.member_id == member_id,
                    ExamSignUp.exam_id == exam_id,
                )
                .first()
            )
            if exist:
                return error("已报名该考试", "400")
            s = ExamSignUp(member_id=member_id, exam_id=exam_id, status=status)
            db.add(s)
            db.flush()
            return success(_signup_to_dict(s))
        except Exception as e:
            logger.error(f"exam signup create error: {e}")
            return error(str(e))


@router.put("/composition/signup/{sid}", summary="修改报名")
async def update_signup(
    sid: int,
    status: str | None = None,
):
    with get_session() as db:
        try:
            s = db.query(ExamSignUp).filter(ExamSignUp.id == sid).first()
            if not s:
                return error("报名不存在", "404")
            if status:
                s.status = status
            return success(_signup_to_dict(s))
        except Exception as e:
            logger.error(f"exam signup update error: {e}")
            return error(str(e))


@router.delete("/composition/signup/{sid}", summary="删除报名")
async def delete_signup(sid: int):
    with get_session() as db:
        try:
            s = db.query(ExamSignUp).filter(ExamSignUp.id == sid).first()
            if not s:
                return error("报名不存在", "404")
            db.delete(s)
            return success()
        except Exception as e:
            logger.error(f"exam signup delete error: {e}")
            return error(str(e))


@router.post("/composition/signup/{sid}/submit", summary="提交答卷")
async def submit_signup(sid: int):
    with get_session() as db:
        try:
            s = db.query(ExamSignUp).filter(ExamSignUp.id == sid).first()
            if not s:
                return error("报名不存在", "404")
            if s.status == "completed":
                return error("答卷已提交", "400")
            s.status = "completed"
            s.completed_time = datetime.utcnow()
            return success(_signup_to_dict(s))
        except Exception as e:
            logger.error(f"exam signup submit error: {e}")
            return error(str(e))
