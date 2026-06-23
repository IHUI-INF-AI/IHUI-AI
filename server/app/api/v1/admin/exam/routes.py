"""管理员端考试模块路由 - 补齐前端管理端页面所需接口。"""
from fastapi import APIRouter, Query
from loguru import logger

from app.database import get_session
from app.models.exam_models import ExamCategory, ExamPaper, ExamQuestion, ExamRecord, ExamWrongQuestion
from app.schemas.common import error, success

router = APIRouter()


def _paginate(q, page: int, size: int):
    total = q.count()
    items = q.order_by(ExamPaper.id.desc()).offset((page - 1) * size).limit(size).all()
    return items, total


# ==================== 分类 ====================


@router.get("/paper/category/list", summary="试卷分类列表")
async def paper_category_list(keyword: str | None = None, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        q = db.query(ExamCategory)
        if keyword:
            q = q.filter(ExamCategory.name.like(f"%{keyword}%"))
        total = q.count()
        items = q.order_by(ExamCategory.sort_order.asc(), ExamCategory.id.asc()).offset((page - 1) * size).limit(size).all()
        return success({
            "list": [{"id": c.id, "name": c.name, "pid": c.pid, "sort_order": c.sort_order, "is_show": c.is_show} for c in items],
            "total": total,
            "page": page,
            "size": size,
        })


@router.post("/paper/category", summary="新增试卷分类")
async def paper_category_create(name: str = Query(..., min_length=1), pid: int = Query(0), sort_order: int = Query(0)):
    with get_session() as db:
        c = ExamCategory(name=name, pid=pid, sort_order=sort_order)
        db.add(c)
        db.flush()
        return success({"id": c.id})


@router.put("/paper/category/{cid}", summary="修改试卷分类")
async def paper_category_update(cid: int, name: str | None = None, pid: int | None = None, sort_order: int | None = None, is_show: bool | None = None):
    with get_session() as db:
        c = db.query(ExamCategory).filter(ExamCategory.id == cid).first()
        if not c:
            return error("分类不存在", code="404")
        if name is not None:
            c.name = name
        if pid is not None:
            c.pid = pid
        if sort_order is not None:
            c.sort_order = sort_order
        if is_show is not None:
            c.is_show = is_show
        db.flush()
        return success({"id": c.id})


@router.delete("/paper/category/{cid}", summary="删除试卷分类")
async def paper_category_delete(cid: int):
    with get_session() as db:
        c = db.query(ExamCategory).filter(ExamCategory.id == cid).first()
        if not c:
            return error("分类不存在", code="404")
        db.delete(c)
        db.flush()
        return success({"deleted": cid})


@router.post("/paper/category/batch-delete", summary="批量删除试卷分类")
async def paper_category_batch_delete(ids: str = Query(...)):
    id_list = [int(x) for x in ids.split(",") if x.isdigit()]
    with get_session() as db:
        db.query(ExamCategory).filter(ExamCategory.id.in_(id_list)).delete(synchronize_session=False)
        db.flush()
        return success({"deleted": id_list, "count": len(id_list)})


# ==================== 题目分类 CRUD ====================


@router.get("/question/category/list", summary="题目分类列表")
async def question_category_list(keyword: str | None = None, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        q = db.query(ExamCategory)
        if keyword:
            q = q.filter(ExamCategory.name.like(f"%{keyword}%"))
        total = q.count()
        items = q.order_by(ExamCategory.sort_order.asc(), ExamCategory.id.asc()).offset((page - 1) * size).limit(size).all()
        return success({"records": [{"id": c.id, "name": c.name, "pid": c.pid, "sort_order": c.sort_order, "is_show": c.is_show} for c in items], "total": total, "page": page, "size": size})


@router.post("/question/category", summary="新增题目分类")
async def question_category_create(name: str = Query(..., min_length=1), pid: int = Query(0), sort_order: int = Query(0)):
    with get_session() as db:
        c = ExamCategory(name=name, pid=pid, sort_order=sort_order)
        db.add(c)
        db.flush()
        return success({"id": c.id})


@router.put("/question/category/{cid}", summary="修改题目分类")
async def question_category_update(cid: int, name: str | None = None, pid: int | None = None, sort_order: int | None = None, is_show: bool | None = None):
    with get_session() as db:
        c = db.query(ExamCategory).filter(ExamCategory.id == cid).first()
        if not c:
            return error("分类不存在", code="404")
        if name is not None:
            c.name = name
        if pid is not None:
            c.pid = pid
        if sort_order is not None:
            c.sort_order = sort_order
        if is_show is not None:
            c.is_show = is_show
        db.flush()
        return success({"id": c.id})


@router.delete("/question/category/{cid}", summary="删除题目分类")
async def question_category_delete(cid: int):
    with get_session() as db:
        c = db.query(ExamCategory).filter(ExamCategory.id == cid).first()
        if not c:
            return error("分类不存在", code="404")
        db.delete(c)
        db.flush()
        return success({"deleted": cid})


@router.post("/question/category/batch-delete", summary="批量删除题目分类")
async def question_category_batch_delete(ids: str = Query(...)):
    id_list = [int(x) for x in ids.split(",") if x.isdigit()]
    with get_session() as db:
        db.query(ExamCategory).filter(ExamCategory.id.in_(id_list)).delete(synchronize_session=False)
        db.flush()
        return success({"deleted": id_list, "count": len(id_list)})


# ==================== 试卷 CRUD ====================


def _paper_to_dict(p: ExamPaper) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "name": p.title,
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
        "category": {"id": p.category_id},
        "totalScore": p.total_score,
        "passScore": p.pass_score,
        "questionNum": p.question_num,
        "attemptNum": p.attempt_num,
        "avgScore": p.avg_score,
        "isFree": p.is_free,
        "sortOrder": p.sort_order,
        "create_time": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/paper/list", summary="试卷列表")
async def admin_paper_list(keyword: str | None = None, category_id: int | None = None, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        q = db.query(ExamPaper)
        if keyword:
            q = q.filter(ExamPaper.title.like(f"%{keyword}%"))
        if category_id is not None:
            q = q.filter(ExamPaper.category_id == category_id)
        items, total = _paginate(q, page, size)
        return success({"records": [_paper_to_dict(i) for i in items], "total": total, "page": page, "size": size})


@router.get("/list", summary="考试列表兼容")
async def admin_exam_list(keyword: str | None = None, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    return await admin_paper_list(keyword=keyword, page=page, size=size)


@router.get("/paper/mock", summary="模拟试卷")
async def admin_paper_mock(keyword: str | None = None, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        q = db.query(ExamPaper).filter(ExamPaper.type == 3)
        if keyword:
            q = q.filter(ExamPaper.title.like(f"%{keyword}%"))
        items, total = _paginate(q, page, size)
        return success({"records": [_paper_to_dict(i) for i in items], "total": total, "page": page, "size": size})


@router.get("/paper/normal", summary="固定试卷")
async def admin_paper_normal(keyword: str | None = None, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        q = db.query(ExamPaper).filter(ExamPaper.type == 1)
        if keyword:
            q = q.filter(ExamPaper.title.like(f"%{keyword}%"))
        items, total = _paginate(q, page, size)
        return success({"records": [_paper_to_dict(i) for i in items], "total": total, "page": page, "size": size})


@router.get("/paper/random", summary="随机试卷")
async def admin_paper_random(keyword: str | None = None, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        q = db.query(ExamPaper).filter(ExamPaper.type == 2)
        if keyword:
            q = q.filter(ExamPaper.title.like(f"%{keyword}%"))
        items, total = _paginate(q, page, size)
        return success({"records": [_paper_to_dict(i) for i in items], "total": total, "page": page, "size": size})


@router.get("/paper/{pid}", summary="试卷详情")
async def admin_paper_detail(pid: int):
    with get_session() as db:
        p = db.query(ExamPaper).filter(ExamPaper.id == pid).first()
        if not p:
            return error("试卷不存在", code="404")
        return success(_paper_to_dict(p))


@router.post("/paper", summary="新增试卷")
async def admin_paper_create(title: str = Query(..., min_length=1), description: str | None = None, category_id: int | None = None, course_id: int | None = None, cover: str | None = None, total_score: float = Query(100), pass_score: float = Query(60), duration: int = Query(60), type: int = Query(1), difficulty: int = Query(1), is_free: bool = Query(True), price: float = Query(0), sort_order: int = Query(0)):
    with get_session() as db:
        p = ExamPaper(title=title, description=description, category_id=category_id, course_id=course_id, cover=cover, total_score=total_score, pass_score=pass_score, duration=duration, type=type, difficulty=difficulty, is_free=is_free, price=price, status=1, sort_order=sort_order)
        db.add(p)
        db.flush()
        return success(_paper_to_dict(p))


@router.put("/paper/{pid}", summary="修改试卷")
async def admin_paper_update(pid: int, title: str | None = None, description: str | None = None, category_id: int | None = None, course_id: int | None = None, cover: str | None = None, total_score: float | None = None, pass_score: float | None = None, duration: int | None = None, type: int | None = None, difficulty: int | None = None, is_free: bool | None = None, price: float | None = None, status: int | None = None, sort_order: int | None = None):
    with get_session() as db:
        p = db.query(ExamPaper).filter(ExamPaper.id == pid).first()
        if not p:
            return error("试卷不存在", code="404")
        if title is not None:
            p.title = title
        if description is not None:
            p.description = description
        if category_id is not None:
            p.category_id = category_id
        if course_id is not None:
            p.course_id = course_id
        if cover is not None:
            p.cover = cover
        if total_score is not None:
            p.total_score = total_score
        if pass_score is not None:
            p.pass_score = pass_score
        if duration is not None:
            p.duration = duration
        if type is not None:
            p.type = type
        if difficulty is not None:
            p.difficulty = difficulty
        if is_free is not None:
            p.is_free = is_free
        if price is not None:
            p.price = price
        if status is not None:
            p.status = status
        if sort_order is not None:
            p.sort_order = sort_order
        db.flush()
        return success(_paper_to_dict(p))


@router.delete("/paper/{pid}", summary="删除试卷")
async def admin_paper_delete(pid: int):
    with get_session() as db:
        p = db.query(ExamPaper).filter(ExamPaper.id == pid).first()
        if not p:
            return error("试卷不存在", code="404")
        db.delete(p)
        db.query(ExamQuestion).filter(ExamQuestion.paper_id == pid).delete(synchronize_session=False)
        db.flush()
        return success({"deleted": pid})


@router.post("/paper/batch-delete", summary="批量删除试卷")
async def admin_paper_batch_delete(ids: str = Query(...)):
    id_list = [int(x) for x in ids.split(",") if x.isdigit()]
    with get_session() as db:
        paper_ids = [row[0] for row in db.query(ExamQuestion.paper_id).filter(ExamQuestion.paper_id.in_(id_list)).distinct().all()]
        db.query(ExamQuestion).filter(ExamQuestion.paper_id.in_(paper_ids)).delete(synchronize_session=False)
        db.query(ExamPaper).filter(ExamPaper.id.in_(id_list)).delete(synchronize_session=False)
        db.flush()
        return success({"deleted": id_list, "count": len(id_list)})


# ==================== 题目 CRUD ====================


def _question_to_dict(q: ExamQuestion) -> dict:
    return {
        "id": q.id,
        "paper_id": q.paper_id,
        "paperId": q.paper_id,
        "type": q.type,
        "content": q.content,
        "title": q.content,
        "options": q.options,
        "answer": q.answer,
        "analysis": q.analysis,
        "score": q.score,
        "difficulty": q.difficulty,
        "sort_order": q.sort_order,
        "sortOrder": q.sort_order,
        "create_time": q.created_at.isoformat() if q.created_at else None,
    }


@router.get("/question/list", summary="题目列表")
async def admin_question_list(paper_id: int | None = None, keyword: str | None = None, type: int | None = None, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        q = db.query(ExamQuestion)
        if paper_id is not None:
            q = q.filter(ExamQuestion.paper_id == paper_id)
        if keyword:
            q = q.filter(ExamQuestion.content.like(f"%{keyword}%"))
        if type is not None:
            q = q.filter(ExamQuestion.type == type)
        total = q.count()
        items = q.order_by(ExamQuestion.sort_order.asc(), ExamQuestion.id.asc()).offset((page - 1) * size).limit(size).all()
        return success({"records": [_question_to_dict(i) for i in items], "total": total, "page": page, "size": size})


@router.get("/question/{qid}", summary="题目详情")
async def admin_question_detail(qid: int):
    with get_session() as db:
        q = db.query(ExamQuestion).filter(ExamQuestion.id == qid).first()
        if not q:
            return error("题目不存在", code="404")
        return success(_question_to_dict(q))


@router.post("/question", summary="新增题目")
async def admin_question_create(paper_id: int = Query(...), type: int = Query(..., ge=1, le=5), content: str = Query(..., min_length=1), options: str | None = None, answer: str = Query(..., min_length=1), analysis: str | None = None, score: float = Query(1), difficulty: int = Query(1), sort_order: int = Query(0)):
    with get_session() as db:
        q = ExamQuestion(paper_id=paper_id, type=type, content=content, options=options, answer=answer, analysis=analysis, score=score, difficulty=difficulty, sort_order=sort_order)
        db.add(q)
        db.flush()
        db.query(ExamPaper).filter(ExamPaper.id == paper_id).update({ExamPaper.question_num: ExamPaper.question_num + 1})
        db.flush()
        return success(_question_to_dict(q))


@router.put("/question/{qid}", summary="修改题目")
async def admin_question_update(qid: int, content: str | None = None, options: str | None = None, answer: str | None = None, analysis: str | None = None, score: float | None = None, difficulty: int | None = None, sort_order: int | None = None):
    with get_session() as db:
        q = db.query(ExamQuestion).filter(ExamQuestion.id == qid).first()
        if not q:
            return error("题目不存在", code="404")
        if content is not None:
            q.content = content
        if options is not None:
            q.options = options
        if answer is not None:
            q.answer = answer
        if analysis is not None:
            q.analysis = analysis
        if score is not None:
            q.score = score
        if difficulty is not None:
            q.difficulty = difficulty
        if sort_order is not None:
            q.sort_order = sort_order
        db.flush()
        return success(_question_to_dict(q))


@router.delete("/question/{qid}", summary="删除题目")
async def admin_question_delete(qid: int):
    with get_session() as db:
        q = db.query(ExamQuestion).filter(ExamQuestion.id == qid).first()
        if not q:
            return error("题目不存在", code="404")
        paper_id = q.paper_id
        db.delete(q)
        db.query(ExamPaper).filter(ExamPaper.id == paper_id).update({ExamPaper.question_num: ExamPaper.question_num - 1})
        db.flush()
        return success({"deleted": qid})


@router.post("/question/batch-delete", summary="批量删除题目")
async def admin_question_batch_delete(ids: str = Query(...)):
    id_list = [int(x) for x in ids.split(",") if x.isdigit()]
    with get_session() as db:
        paper_ids = [row[0] for row in db.query(ExamQuestion.paper_id).filter(ExamQuestion.id.in_(id_list)).distinct().all()]
        db.query(ExamQuestion).filter(ExamQuestion.id.in_(id_list)).delete(synchronize_session=False)
        for paper_id in paper_ids:
            db.query(ExamPaper).filter(ExamPaper.id == paper_id).update({ExamPaper.question_num: ExamPaper.question_num - 1})
        db.flush()
        return success({"deleted": id_list, "count": len(id_list)})


# ==================== 作答/判分 CRUD ====================


def _answer_to_dict(r: ExamRecord) -> dict:
    return {
        "id": r.id,
        "userName": r.user_name,
        "paperTitle": r.paper_title,
        "score": r.score,
        "totalScore": r.total_score,
        "passScore": r.pass_score,
        "status": r.status,
        "submitTime": r.submit_time.isoformat() if r.submit_time else None,
        "create_time": r.created_at.isoformat() if r.created_at else None,
        "user_id": r.user_id,
        "paper_id": r.paper_id,
        "is_pass": r.is_pass,
        "correct_num": r.correct_num,
        "wrong_num": r.wrong_num,
        "cost_time": r.cost_time,
        "answer_data": r.answer_data,
    }


@router.get("/answer/list", summary="答题记录列表")
async def admin_answer_list(keyword: str | None = None, paper_id: int | None = None, status: int | None = None, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        q = db.query(ExamRecord)
        if keyword:
            q = q.filter((ExamRecord.paper_title.like(f"%{keyword}%")) | (ExamRecord.user_name.like(f"%{keyword}%")))
        if paper_id is not None:
            q = q.filter(ExamRecord.paper_id == paper_id)
        if status is not None:
            q = q.filter(ExamRecord.status == status)
        total = q.count()
        items = q.order_by(ExamRecord.id.desc()).offset((page - 1) * size).limit(size).all()
        return success({"records": [_answer_to_dict(i) for i in items], "total": total, "page": page, "size": size})


@router.get("/answer/{rid}", summary="答题记录详情")
async def admin_answer_detail(rid: int):
    with get_session() as db:
        r = db.query(ExamRecord).filter(ExamRecord.id == rid).first()
        if not r:
            return error("答题记录不存在", code="404")
        payload = _answer_to_dict(r)
        questions = []
        if r.answer_data:
            try:
                import json
                answer_map = json.loads(r.answer_data) or {}
                question_rows = db.query(ExamQuestion).filter(ExamQuestion.paper_id == r.paper_id).all()
                for q in question_rows:
                    user_answer = answer_map.get(str(q.id), "")
                    questions.append({
                        "id": q.id,
                        "title": q.content,
                        "score": q.score,
                        "userAnswer": user_answer,
                        "correctAnswer": q.answer,
                        "markScore": q.score,
                        "markComment": "",
                    })
            except Exception as e:
                logger.warning(f"exam answer detail parse error: {e}")
        payload["questions"] = questions
        return success(payload)


@router.post("/answer", summary="新增作答记录")
async def admin_answer_create(paper_id: int = Query(...), user_name: str = Query(...), score: float = Query(0), total_score: float = Query(0), answer_data: str | None = None, remark: str | None = None):
    with get_session() as db:
        p = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
        if not p:
            return error("试卷不存在", code="404")
        r = ExamRecord(paper_id=paper_id, paper_title=p.title, user_name=user_name, score=score, total_score=total_score or p.total_score, pass_score=p.pass_score, is_pass=score >= p.pass_score, status=1 if score else 0, answer_data=answer_data, remark=remark)
        db.add(r)
        db.flush()
        return success(_answer_to_dict(r))


@router.post("/answer/{rid}/mark", summary="判分")
async def admin_answer_mark(rid: int, marks: str = Query(...)):
    with get_session() as db:
        r = db.query(ExamRecord).filter(ExamRecord.id == rid).first()
        if not r:
            return error("答题记录不存在", code="404")
        try:
            marks_list = __import__("json").loads(marks) or []
        except Exception:
            marks_list = []
        score = 0.0
        for mark in marks_list:
            score += float(mark.get("score", 0))
        r.score = score
        r.is_pass = score >= r.pass_score
        db.flush()
        return success(_answer_to_dict(r))


@router.delete("/answer/{rid}", summary="删除答题记录")
async def admin_answer_delete(rid: int):
    with get_session() as db:
        r = db.query(ExamRecord).filter(ExamRecord.id == rid).first()
        if not r:
            return error("答题记录不存在", code="404")
        db.delete(r)
        db.flush()
        return success({"deleted": rid})


@router.post("/answer/batch-delete", summary="批量删除答题记录")
async def admin_answer_batch_delete(ids: str = Query(...)):
    id_list = [int(x) for x in ids.split(",") if x.isdigit()]
    with get_session() as db:
        db.query(ExamRecord).filter(ExamRecord.id.in_(id_list)).delete(synchronize_session=False)
        db.flush()
        return success({"deleted": id_list, "count": len(id_list)})


# ==================== 错题 CRUD ====================


@router.get("/wrong/list", summary="错题列表")
async def admin_wrong_list(user_id: str | None = None, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        q = db.query(ExamWrongQuestion)
        if user_id:
            q = q.filter(ExamWrongQuestion.user_id == user_id)
        total = q.count()
        items = q.order_by(ExamWrongQuestion.id.desc()).offset((page - 1) * size).limit(size).all()
        return success({
            "records": [
                {
                    "id": w.id,
                    "user_id": w.user_id,
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
            "total": total,
            "page": page,
            "size": size,
        })
