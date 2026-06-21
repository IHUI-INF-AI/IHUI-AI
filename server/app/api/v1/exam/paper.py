"""考试系统 - 试卷管理"""

from datetime import datetime

from fastapi import APIRouter, Query
from loguru import logger

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.exam_models import ExamCategory, ExamPaper, ExamQuestion, ExamRecord, ExamWrongQuestion
from app.schemas.common import error, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

def _p_to_dict(p: ExamPaper) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "category_id": p.category_id,
        "course_id": p.course_id,
        "cover": p.cover,
        "total_score": p.total_score,
        "pass_score": p.pass_score,
        "duration": p.duration,
        "question_num": p.question_num,
        "attempt_num": p.attempt_num,
        "avg_score": p.avg_score,
        "type": p.type,
        "difficulty": p.difficulty,
        "is_free": p.is_free,
        "price": p.price,
        "status": p.status,
        "sort_order": p.sort_order,
        "create_time": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/paper/list", summary="试卷列表")
async def list_papers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category_id: int | None = None,
    keyword: str | None = None,
    difficulty: int | None = None,
    is_free: bool | None = None,
):
    with get_session() as db:
        try:
            q = db.query(ExamPaper).filter(ExamPaper.status == 1)
            if category_id:
                q = q.filter(ExamPaper.category_id == category_id)
            if keyword:
                q = q.filter(ExamPaper.title.like(f"%{keyword}%"))
            if difficulty is not None:
                q = q.filter(ExamPaper.difficulty == difficulty)
            if is_free is not None:
                q = q.filter(ExamPaper.is_free == is_free)
            total = q.count()
            items = (
                q.order_by(ExamPaper.sort_order.asc(), ExamPaper.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success([_p_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"exam paper list error: {e}")
            return error(str(e))


@router.get("/paper/{pid}", summary="试卷详情")
async def get_paper(pid: int):
    with get_session() as db:
        try:
            p = db.query(ExamPaper).filter(ExamPaper.id == pid).first()
            if not p:
                return error("试卷不存在", "404")
            return success(_p_to_dict(p))
        except Exception as e:
            logger.error(f"exam paper get error: {e}")
            return error(str(e))


@router.post("/paper", summary="创建试卷")
async def create_paper(
    title: str = Query(..., min_length=1, max_length=200),
    description: str | None = None,
    category_id: int | None = None,
    course_id: int | None = None,
    cover: str | None = None,
    total_score: float = 100,
    pass_score: float = 60,
    duration: int = 60,
    type: int = 1,
    difficulty: int = 1,
    is_free: bool = True,
    price: float = 0,
):
    with get_session() as db:
        try:
            p = ExamPaper(
                title=title,
                description=description,
                category_id=category_id,
                course_id=course_id,
                cover=cover,
                total_score=total_score,
                pass_score=pass_score,
                duration=duration,
                type=type,
                difficulty=difficulty,
                is_free=is_free,
                price=price,
                status=1,
            )
            db.add(p)
            db.flush()
            return success(_p_to_dict(p))
        except Exception as e:
            logger.error(f"exam paper create error: {e}")
            return error(str(e))


@router.put("/paper/{pid}", summary="修改试卷")
async def update_paper(
    pid: int,
    title: str | None = None,
    description: str | None = None,
    total_score: float | None = None,
    pass_score: float | None = None,
    duration: int | None = None,
    difficulty: int | None = None,
    price: float | None = None,
    is_free: bool | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            p = db.query(ExamPaper).filter(ExamPaper.id == pid).first()
            if not p:
                return error("试卷不存在", "404")
            if title:
                p.title = title
            if description is not None:
                p.description = description
            if total_score is not None:
                p.total_score = total_score
            if pass_score is not None:
                p.pass_score = pass_score
            if duration is not None:
                p.duration = duration
            if difficulty is not None:
                p.difficulty = difficulty
            if price is not None:
                p.price = price
            if is_free is not None:
                p.is_free = is_free
            if status is not None:
                p.status = status
            return success(_p_to_dict(p))
        except Exception as e:
            logger.error(f"exam paper update error: {e}")
            return error(str(e))


@router.delete("/paper/{pid}", summary="删除试卷")
async def delete_paper(pid: int):
    with get_session() as db:
        try:
            p = db.query(ExamPaper).filter(ExamPaper.id == pid).first()
            if not p:
                return error("试卷不存在", "404")
            db.delete(p)
            db.query(ExamQuestion).filter(ExamQuestion.paper_id == pid).delete()
            return success()
        except Exception as e:
            logger.error(f"exam paper delete error: {e}")
            return error(str(e))


# ============ 题目管理 ============


@router.get("/question/list", summary="题目列表")
async def list_questions(paper_id: int = Query(...)):
    with get_session() as db:
        try:
            items = (
                db.query(ExamQuestion)
                .filter(ExamQuestion.paper_id == paper_id)
                .order_by(ExamQuestion.sort_order.asc())
                .all()
            )
            return success(
                [
                    {
                        "id": q.id,
                        "paper_id": q.paper_id,
                        "type": q.type,
                        "content": q.content,
                        "options": q.options,
                        "answer": q.answer,
                        "analysis": q.analysis,
                        "score": q.score,
                        "difficulty": q.difficulty,
                        "sort_order": q.sort_order,
                    }
                    for q in items
                ]
            )
        except Exception as e:
            logger.error(f"exam question list error: {e}")
            return error(str(e))


@router.post("/question", summary="新增题目")
async def create_question(
    paper_id: int = Query(...),
    type: int = Query(..., ge=1, le=5),
    content: str = Query(..., min_length=1),
    options: str | None = None,
    answer: str = Query(..., min_length=1),
    analysis: str | None = None,
    score: float = 1,
    difficulty: int = 1,
    sort_order: int = 0,
):
    with get_session() as db:
        try:
            q = ExamQuestion(
                paper_id=paper_id,
                type=type,
                content=content,
                options=options,
                answer=answer,
                analysis=analysis,
                score=score,
                difficulty=difficulty,
                sort_order=sort_order,
            )
            db.add(q)
            db.flush()
            db.query(ExamPaper).filter(ExamPaper.id == paper_id).update(
                {ExamPaper.question_num: ExamPaper.question_num + 1}
            )
            return success({"id": q.id})
        except Exception as e:
            logger.error(f"exam question create error: {e}")
            return error(str(e))


@router.put("/question/{qid}", summary="修改题目")
async def update_question(
    qid: int,
    content: str | None = None,
    options: str | None = None,
    answer: str | None = None,
    analysis: str | None = None,
    score: float | None = None,
    sort_order: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(ExamQuestion).filter(ExamQuestion.id == qid).first()
            if not q:
                return error("题目不存在", "404")
            if content:
                q.content = content
            if options is not None:
                q.options = options
            if answer:
                q.answer = answer
            if analysis is not None:
                q.analysis = analysis
            if score is not None:
                q.score = score
            if sort_order is not None:
                q.sort_order = sort_order
            return success({"id": q.id})
        except Exception as e:
            logger.error(f"exam question update error: {e}")
            return error(str(e))


@router.delete("/question/{qid}", summary="删除题目")
async def delete_question(qid: int):
    with get_session() as db:
        try:
            q = db.query(ExamQuestion).filter(ExamQuestion.id == qid).first()
            if not q:
                return error("题目不存在", "404")
            db.delete(q)
            db.query(ExamPaper).filter(ExamPaper.id == q.paper_id).update(
                {ExamPaper.question_num: ExamPaper.question_num - 1}
            )
            return success()
        except Exception as e:
            logger.error(f"exam question delete error: {e}")
            return error(str(e))


# ============ 考试记录 ============


@router.post("/record/start", summary="开始考试")
async def start_exam(paper_id: int = Query(...)):
    with get_session() as db:
        try:
            p = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
            if not p:
                return error("试卷不存在", "404")
            uid = _uid()
            r = ExamRecord(
                paper_id=paper_id,
                paper_title=p.title,
                user_id=uid,
                user_name="匿名用户",
                total_score=p.total_score,
                pass_score=p.pass_score,
                status=0,
                start_time=datetime.utcnow(),
            )
            db.add(r)
            db.flush()
            return success({"record_id": r.id, "duration": p.duration, "total_score": p.total_score})
        except Exception as e:
            logger.error(f"exam start error: {e}")
            return error(str(e))


@router.post("/record/submit", summary="提交答卷")
async def submit_exam(record_id: int = Query(...), answers: str = Query(..., description="答案JSON")):
    with get_session() as db:
        try:
            r = db.query(ExamRecord).filter(ExamRecord.id == record_id).first()
            if not r:
                return error("记录不存在", "404")
            if r.status != 0:
                return error("记录已提交", "400")
            import json

            try:
                ans_map = json.loads(answers)
            except Exception:
                ans_map = {}
            questions = db.query(ExamQuestion).filter(ExamQuestion.paper_id == r.paper_id).all()
            score = 0.0
            correct_num = 0
            wrong_num = 0
            uid = _uid()
            for q in questions:
                ua = ans_map.get(str(q.id), "")
                if str(ua).strip() == str(q.answer).strip():
                    score += q.score
                    correct_num += 1
                else:
                    wrong_num += 1
                    exist = (
                        db.query(ExamWrongQuestion)
                        .filter(ExamWrongQuestion.user_id == uid, ExamWrongQuestion.question_id == q.id)
                        .first()
                    )
                    if exist:
                        exist.wrong_count = (exist.wrong_count or 0) + 1
                        exist.last_wrong_time = datetime.utcnow()
                        exist.user_answer = ua
                        exist.right_answer = q.answer
                    else:
                        db.add(
                            ExamWrongQuestion(
                                user_id=uid,
                                question_id=q.id,
                                paper_id=q.paper_id,
                                paper_title=r.paper_title,
                                user_answer=ua,
                                right_answer=q.answer,
                                last_wrong_time=datetime.utcnow(),
                            )
                        )
            r.score = score
            r.correct_num = correct_num
            r.wrong_num = wrong_num
            r.is_pass = score >= r.pass_score
            r.status = 1
            r.answer_data = answers
            r.submit_time = datetime.utcnow()
            if r.start_time:
                r.cost_time = int((r.submit_time - r.start_time).total_seconds())
            p = db.query(ExamPaper).filter(ExamPaper.id == r.paper_id).first()
            if p:
                p.attempt_num = (p.attempt_num or 0) + 1
                if p.attempt_num > 0:
                    p.avg_score = ((p.avg_score or 0) * (p.attempt_num - 1) + score) / p.attempt_num
            return success({"score": score, "is_pass": r.is_pass, "correct_num": correct_num, "wrong_num": wrong_num})
        except Exception as e:
            logger.error(f"exam submit error: {e}")
            return error(str(e))


@router.get("/record/list", summary="考试记录列表")
async def list_records(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_id: str | None = None,
    paper_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(ExamRecord)
            uid = user_id or _uid()
            q = q.filter(ExamRecord.user_id == uid)
            if paper_id:
                q = q.filter(ExamRecord.paper_id == paper_id)
            total = q.count()
            items = q.order_by(ExamRecord.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": r.id,
                        "paper_id": r.paper_id,
                        "paper_title": r.paper_title,
                        "user_id": r.user_id,
                        "score": r.score,
                        "total_score": r.total_score,
                        "is_pass": r.is_pass,
                        "status": r.status,
                        "correct_num": r.correct_num,
                        "wrong_num": r.wrong_num,
                        "cost_time": r.cost_time,
                        "start_time": r.start_time.isoformat() if r.start_time else None,
                        "submit_time": r.submit_time.isoformat() if r.submit_time else None,
                    }
                    for r in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"exam record list error: {e}")
            return error(str(e))


@router.get("/record/{rid}", summary="考试记录详情")
async def get_record(rid: int):
    with get_session() as db:
        try:
            r = db.query(ExamRecord).filter(ExamRecord.id == rid).first()
            if not r:
                return error("记录不存在", "404")
            return success(
                {
                    "id": r.id,
                    "paper_id": r.paper_id,
                    "paper_title": r.paper_title,
                    "user_id": r.user_id,
                    "score": r.score,
                    "total_score": r.total_score,
                    "pass_score": r.pass_score,
                    "is_pass": r.is_pass,
                    "status": r.status,
                    "correct_num": r.correct_num,
                    "wrong_num": r.wrong_num,
                    "cost_time": r.cost_time,
                    "answer_data": r.answer_data,
                    "start_time": r.start_time.isoformat() if r.start_time else None,
                    "submit_time": r.submit_time.isoformat() if r.submit_time else None,
                }
            )
        except Exception as e:
            logger.error(f"exam record get error: {e}")
            return error(str(e))


@router.get("/wrong/list", summary="错题本")
async def wrong_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    is_mastered: bool | None = None,
):
    with get_session() as db:
        try:
            q = db.query(ExamWrongQuestion).filter(ExamWrongQuestion.user_id == _uid())
            if is_mastered is not None:
                q = q.filter(ExamWrongQuestion.is_mastered == is_mastered)
            total = q.count()
            items = q.order_by(ExamWrongQuestion.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": w.id,
                        "question_id": w.question_id,
                        "paper_id": w.paper_id,
                        "paper_title": w.paper_title,
                        "user_answer": w.user_answer,
                        "right_answer": w.right_answer,
                        "wrong_count": w.wrong_count,
                        "is_mastered": w.is_mastered,
                        "last_wrong_time": w.last_wrong_time.isoformat() if w.last_wrong_time else None,
                    }
                    for w in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"exam wrong list error: {e}")
            return error(str(e))


@router.put("/wrong/{wid}/master", summary="标记错题为已掌握")
async def mark_mastered(wid: int):
    with get_session() as db:
        try:
            w = db.query(ExamWrongQuestion).filter(ExamWrongQuestion.id == wid).first()
            if not w:
                return error("记录不存在", "404")
            w.is_mastered = True
            return success()
        except Exception as e:
            logger.error(f"exam wrong master error: {e}")
            return error(str(e))


@router.get("/category/list", operation_id="exam_paper_category_list", summary="考试分类列表")
async def category_list():
    with get_session() as db:
        try:
            items = (
                db.query(ExamCategory)
                .filter(ExamCategory.is_show)
                .order_by(ExamCategory.sort_order.asc())
                .all()
            )
            return success([{"id": c.id, "pid": c.pid, "name": c.name, "sort_order": c.sort_order} for c in items])
        except Exception as e:
            logger.error(f"exam category list error: {e}")
            return error(str(e))
