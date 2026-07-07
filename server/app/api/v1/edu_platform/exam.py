"""考试模块路由 - 迁移自旧 Java Spring Boot exam-service (2026-07-05).

包含: 考试分类/考试/章节小节/试卷/试卷规则/试卷题目/题库/考试记录/报名/统计.
前端路由前缀: /exam
"""
from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import (
    EduExam,
    EduExamCategory,
    EduExamChapter,
    EduExamChapterSection,
    EduExamPaper,
    EduExamPaperQuestion,
    EduExamPaperRule,
    EduExamQuestion,
    EduExamRecord,
    EduSignUp,
)
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 序列化辅助函数
# ---------------------------------------------------------------------------


def _category_to_dict(c: EduExamCategory) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "pid": c.pid,
        "sort": c.sort,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _exam_to_dict(e: EduExam, with_desc: bool = True) -> dict:
    return {
        "id": e.id,
        "title": e.title,
        "category_id": e.category_id,
        "description": e.description if with_desc else None,
        "total_score": e.total_score,
        "pass_score": e.pass_score,
        "duration": e.duration,
        "is_published": e.is_published,
        "start_time": e.start_time.isoformat() if e.start_time else None,
        "end_time": e.end_time.isoformat() if e.end_time else None,
        "sort": e.sort,
        "status": e.status,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


def _chapter_to_dict(c: EduExamChapter) -> dict:
    return {
        "id": c.id,
        "exam_id": c.exam_id,
        "title": c.title,
        "sort_order": c.sort_order,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _section_to_dict(s: EduExamChapterSection) -> dict:
    return {
        "id": s.id,
        "chapter_id": s.chapter_id,
        "exam_id": s.exam_id,
        "title": s.title,
        "sort_order": s.sort_order,
        "status": s.status,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _paper_to_dict(p: EduExamPaper) -> dict:
    return {
        "id": p.id,
        "exam_id": p.exam_id,
        "title": p.title,
        "paper_type": p.paper_type,
        "total_score": p.total_score,
        "pass_score": p.pass_score,
        "duration": p.duration,
        "is_published": p.is_published,
        "category_id": p.category_id,
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _paper_rule_to_dict(r: EduExamPaperRule) -> dict:
    return {
        "id": r.id,
        "paper_id": r.paper_id,
        "question_type": r.question_type,
        "category_id": r.category_id,
        "difficulty": r.difficulty,
        "question_count": r.question_count,
        "score_per_question": r.score_per_question,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _paper_question_to_dict(pq: EduExamPaperQuestion) -> dict:
    return {
        "id": pq.id,
        "paper_id": pq.paper_id,
        "question_id": pq.question_id,
        "sort_order": pq.sort_order,
        "score": pq.score,
        "created_at": pq.created_at.isoformat() if pq.created_at else None,
    }


def _question_to_dict(q: EduExamQuestion) -> dict:
    return {
        "id": q.id,
        "category_id": q.category_id,
        "type": q.type,
        "difficulty": q.difficulty,
        "title": q.title,
        "options": q.options,
        "answer": q.answer,
        "analysis": q.analysis,
        "score": q.score,
        "status": q.status,
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "updated_at": q.updated_at.isoformat() if q.updated_at else None,
    }


def _record_to_dict(r: EduExamRecord) -> dict:
    return {
        "id": r.id,
        "exam_id": r.exam_id,
        "paper_id": r.paper_id,
        "member_id": r.member_id,
        "score": r.score,
        "total_score": r.total_score,
        "is_pass": r.is_pass,
        "is_marked": r.is_marked,
        "start_time": r.start_time.isoformat() if r.start_time else None,
        "submit_time": r.submit_time.isoformat() if r.submit_time else None,
        "duration": r.duration,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _sign_up_to_dict(s: EduSignUp) -> dict:
    return {
        "id": s.id,
        "member_id": s.member_id,
        "target_id": s.target_id,
        "target_type": s.target_type,
        "status": s.status,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


# ---------------------------------------------------------------------------
# 考试分类 (category)
# ---------------------------------------------------------------------------


@router.get("/category/admin/list", summary="考试分类列表树", operation_id="edu_platform_exam_category_admin_list")
async def category_admin_list(
    id: int = Query(0, description="父分类id, 0=顶级"),
    fetchAll: bool = Query(False, description="是否获取全部"),
):
    with get_session() as db:
        try:
            q = db.query(EduExamCategory)
            if not fetchAll:
                q = q.filter(EduExamCategory.pid == id)
            items = q.order_by(EduExamCategory.sort.asc(), EduExamCategory.id.asc()).all()
            return success([_category_to_dict(c) for c in items])
        except Exception as e:
            logger.error(f"[edu exam] category admin list error: {e}")
            return error(str(e))


@router.get("/category/{category_id}", summary="考试分类详情", operation_id="edu_platform_exam_get_category")
async def get_category(category_id: int):
    with get_session() as db:
        try:
            c = db.query(EduExamCategory).filter(EduExamCategory.id == category_id).first()
            if not c:
                return error("分类不存在", "404")
            return success(_category_to_dict(c))
        except Exception as e:
            logger.error(f"[edu exam] get category error: {e}")
            return error(str(e))


@router.post("/category", summary="新建考试分类", operation_id="edu_platform_exam_create_category")
async def create_category(
    name: str = Body(..., min_length=1, max_length=100),
    pid: int = Body(0),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            c = EduExamCategory(name=name, pid=pid, sort=sort, status=status)
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu exam] create category error: {e}")
            return error(str(e))


@router.put("/category", summary="更新考试分类", operation_id="edu_platform_exam_update_category")
async def update_category(
    id: int = Body(...),
    name: str | None = Body(None),
    pid: int | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(EduExamCategory).filter(EduExamCategory.id == id).first()
            if not c:
                return error("分类不存在", "404")
            if name is not None:
                c.name = name
            if pid is not None:
                c.pid = pid
            if sort is not None:
                c.sort = sort
            if status is not None:
                c.status = status
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu exam] update category error: {e}")
            return error(str(e))


@router.delete("/category/{category_id}", summary="删除考试分类", operation_id="edu_platform_exam_delete_category")
async def delete_category(category_id: int):
    with get_session() as db:
        try:
            c = db.query(EduExamCategory).filter(EduExamCategory.id == category_id).first()
            if not c:
                return error("分类不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"[edu exam] delete category error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 考试 (exam)
# ---------------------------------------------------------------------------


@router.get("/exam/list", summary="考试列表", operation_id="edu_platform_exam_exam_list")
async def exam_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    title: str | None = None,
    category_id: int | None = None,
    is_published: bool | None = None,
    status: int = Query(1, description="默认只查正常状态"),
):
    with get_session() as db:
        try:
            q = db.query(EduExam).filter(EduExam.status == status)
            if title:
                q = q.filter(EduExam.title.like(f"%{title}%"))
            if category_id:
                q = q.filter(EduExam.category_id == category_id)
            if is_published is not None:
                q = q.filter(EduExam.is_published == is_published)
            total = q.count()
            items = (
                q.order_by(EduExam.sort.desc(), EduExam.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_exam_to_dict(e, with_desc=False) for e in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu exam] exam list error: {e}")
            return error(str(e))


@router.get("/public-api/exam/list", summary="公开考试列表", operation_id="edu_platform_exam_exam_public_list")
async def exam_public_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduExam).filter(
                EduExam.status == 1, EduExam.is_published == True  # noqa: E712
            )
            if category_id:
                q = q.filter(EduExam.category_id == category_id)
            total = q.count()
            items = (
                q.order_by(EduExam.sort.desc(), EduExam.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_exam_to_dict(e, with_desc=False) for e in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu exam] public exam list error: {e}")
            return error(str(e))


@router.post("/exam", summary="新建考试", operation_id="edu_platform_exam_create_exam")
async def create_exam(
    title: str = Body(..., min_length=1, max_length=200),
    category_id: int | None = Body(None),
    description: str | None = Body(None),
    total_score: float = Body(100),
    pass_score: float = Body(60),
    duration: int = Body(60),
    start_time: str | None = Body(None),
    end_time: str | None = Body(None),
    sort: int = Body(0),
):
    with get_session() as db:
        try:
            from datetime import datetime

            st = None
            et = None
            if start_time:
                try:
                    st = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                except ValueError:
                    pass
            if end_time:
                try:
                    et = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
                except ValueError:
                    pass
            e = EduExam(
                title=title,
                category_id=category_id,
                description=description,
                total_score=total_score,
                pass_score=pass_score,
                duration=duration,
                start_time=st,
                end_time=et,
                sort=sort,
            )
            db.add(e)
            db.flush()
            return success({"id": e.id})
        except Exception as e:
            logger.error(f"[edu exam] create exam error: {e}")
            return error(str(e))


@router.put("/exam", summary="更新考试", operation_id="edu_platform_exam_update_exam")
async def update_exam(
    id: int = Body(...),
    title: str | None = Body(None),
    category_id: int | None = Body(None),
    description: str | None = Body(None),
    total_score: float | None = Body(None),
    pass_score: float | None = Body(None),
    duration: int | None = Body(None),
    start_time: str | None = Body(None),
    end_time: str | None = Body(None),
    sort: int | None = Body(None),
):
    with get_session() as db:
        try:
            from datetime import datetime

            e = db.query(EduExam).filter(EduExam.id == id).first()
            if not e:
                return error("考试不存在", "404")
            if title is not None:
                e.title = title
            if category_id is not None:
                e.category_id = category_id
            if description is not None:
                e.description = description
            if total_score is not None:
                e.total_score = total_score
            if pass_score is not None:
                e.pass_score = pass_score
            if duration is not None:
                e.duration = duration
            if start_time is not None:
                try:
                    e.start_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                except ValueError:
                    pass
            if end_time is not None:
                try:
                    e.end_time = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
                except ValueError:
                    pass
            if sort is not None:
                e.sort = sort
            return success({"id": e.id})
        except Exception as e:
            logger.error(f"[edu exam] update exam error: {e}")
            return error(str(e))


@router.get("/exam", summary="考试详情", operation_id="edu_platform_exam_get_exam")
async def get_exam(id: int = Query(..., description="考试id")):
    with get_session() as db:
        try:
            e = db.query(EduExam).filter(EduExam.id == id).first()
            if not e:
                return error("考试不存在", "404")
            return success(_exam_to_dict(e))
        except Exception as e:
            logger.error(f"[edu exam] get exam error: {e}")
            return error(str(e))


@router.delete("/exam", summary="删除考试", operation_id="edu_platform_exam_delete_exam")
async def delete_exam(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            e = db.query(EduExam).filter(EduExam.id == id).first()
            if not e:
                return error("考试不存在", "404")
            e.status = 0
            return success({"id": id})
        except Exception as e:
            logger.error(f"[edu exam] delete exam error: {e}")
            return error(str(e))


@router.put("/exam/publish", summary="发布考试", operation_id="edu_platform_exam_publish_exam")
async def publish_exam(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            e = db.query(EduExam).filter(EduExam.id == id).first()
            if not e:
                return error("考试不存在", "404")
            e.is_published = True
            return success({"id": e.id, "is_published": e.is_published})
        except Exception as e:
            logger.error(f"[edu exam] publish exam error: {e}")
            return error(str(e))


@router.put("/exam/un-publish", summary="取消发布考试", operation_id="edu_platform_exam_un_publish_exam")
async def un_publish_exam(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            e = db.query(EduExam).filter(EduExam.id == id).first()
            if not e:
                return error("考试不存在", "404")
            e.is_published = False
            return success({"id": e.id, "is_published": e.is_published})
        except Exception as e:
            logger.error(f"[edu exam] un-publish exam error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 考试章节 (chapter / section)
# ---------------------------------------------------------------------------


@router.post("/exam/chapter", summary="新建考试章节", operation_id="edu_platform_exam_create_exam_chapter")
async def create_exam_chapter(
    exam_id: int = Body(...),
    title: str = Body(..., min_length=1, max_length=200),
    sort_order: int = Body(0),
):
    with get_session() as db:
        try:
            c = EduExamChapter(exam_id=exam_id, title=title, sort_order=sort_order)
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu exam] create chapter error: {e}")
            return error(str(e))


@router.put("/exam/chapter", summary="更新考试章节", operation_id="edu_platform_exam_update_exam_chapter")
async def update_exam_chapter(
    id: int = Body(...),
    title: str | None = Body(None),
    sort_order: int | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(EduExamChapter).filter(EduExamChapter.id == id).first()
            if not c:
                return error("章节不存在", "404")
            if title is not None:
                c.title = title
            if sort_order is not None:
                c.sort_order = sort_order
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu exam] update chapter error: {e}")
            return error(str(e))


@router.delete("/exam/chapter", summary="删除考试章节", operation_id="edu_platform_exam_delete_exam_chapter")
async def delete_exam_chapter(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            c = db.query(EduExamChapter).filter(EduExamChapter.id == id).first()
            if not c:
                return error("章节不存在", "404")
            db.delete(c)
            return success({"id": id})
        except Exception as e:
            logger.error(f"[edu exam] delete chapter error: {e}")
            return error(str(e))


@router.get("/exam/chapter/list", summary="考试章节列表", operation_id="edu_platform_exam_exam_chapter_list")
async def exam_chapter_list(exam_id: int = Query(..., description="考试id")):
    with get_session() as db:
        try:
            chapters = (
                db.query(EduExamChapter)
                .filter(EduExamChapter.exam_id == exam_id, EduExamChapter.status == 1)
                .order_by(EduExamChapter.sort_order.asc(), EduExamChapter.id.asc())
                .all()
            )
            chapter_ids = [c.id for c in chapters]
            sections_map: dict[int, list] = {}
            if chapter_ids:
                sections = (
                    db.query(EduExamChapterSection)
                    .filter(
                        EduExamChapterSection.chapter_id.in_(chapter_ids),
                        EduExamChapterSection.status == 1,
                    )
                    .order_by(
                        EduExamChapterSection.sort_order.asc(),
                        EduExamChapterSection.id.asc(),
                    )
                    .all()
                )
                for s in sections:
                    sections_map.setdefault(s.chapter_id, []).append(
                        _section_to_dict(s)
                    )
            result = []
            for c in chapters:
                d = _chapter_to_dict(c)
                d["sections"] = sections_map.get(c.id, [])
                result.append(d)
            return success(result)
        except Exception as e:
            logger.error(f"[edu exam] chapter list error: {e}")
            return error(str(e))


@router.post("/exam/chapter-section", summary="新建考试小节", operation_id="edu_platform_exam_create_exam_chapter_section")
async def create_exam_chapter_section(
    chapter_id: int = Body(...),
    exam_id: int = Body(...),
    title: str = Body(..., min_length=1, max_length=200),
    sort_order: int = Body(0),
):
    with get_session() as db:
        try:
            s = EduExamChapterSection(
                chapter_id=chapter_id, exam_id=exam_id, title=title, sort_order=sort_order
            )
            db.add(s)
            db.flush()
            return success({"id": s.id})
        except Exception as e:
            logger.error(f"[edu exam] create chapter-section error: {e}")
            return error(str(e))


@router.put("/exam/chapter-section", summary="更新考试小节", operation_id="edu_platform_exam_update_exam_chapter_section")
async def update_exam_chapter_section(
    id: int = Body(...),
    title: str | None = Body(None),
    sort_order: int | None = Body(None),
):
    with get_session() as db:
        try:
            s = (
                db.query(EduExamChapterSection)
                .filter(EduExamChapterSection.id == id)
                .first()
            )
            if not s:
                return error("小节不存在", "404")
            if title is not None:
                s.title = title
            if sort_order is not None:
                s.sort_order = sort_order
            return success({"id": s.id})
        except Exception as e:
            logger.error(f"[edu exam] update chapter-section error: {e}")
            return error(str(e))


@router.delete("/exam/chapter-section", summary="删除考试小节", operation_id="edu_platform_exam_delete_exam_chapter_section")
async def delete_exam_chapter_section(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            s = (
                db.query(EduExamChapterSection)
                .filter(EduExamChapterSection.id == id)
                .first()
            )
            if not s:
                return error("小节不存在", "404")
            db.delete(s)
            return success({"id": id})
        except Exception as e:
            logger.error(f"[edu exam] delete chapter-section error: {e}")
            return error(str(e))


@router.put("/exam/chapter/sort-order", summary="考试章节排序", operation_id="edu_platform_exam_update_exam_chapter_sort_order")
async def update_exam_chapter_sort_order(data: list = Body(...)):
    with get_session() as db:
        try:
            for item in data:
                cid = item.get("id")
                sort_order = item.get("sort_order", 0)
                c = db.query(EduExamChapter).filter(EduExamChapter.id == cid).first()
                if c:
                    c.sort_order = sort_order
            return success()
        except Exception as e:
            logger.error(f"[edu exam] chapter sort-order error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 试卷 (paper)
# ---------------------------------------------------------------------------


@router.get("/paper", summary="试卷详情", operation_id="edu_platform_exam_get_paper")
async def get_paper(id: int = Query(..., description="试卷id")):
    with get_session() as db:
        try:
            p = db.query(EduExamPaper).filter(EduExamPaper.id == id).first()
            if not p:
                return error("试卷不存在", "404")
            return success(_paper_to_dict(p))
        except Exception as e:
            logger.error(f"[edu exam] get paper error: {e}")
            return error(str(e))


@router.delete("/paper", summary="删除试卷", operation_id="edu_platform_exam_delete_paper")
async def delete_paper(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            p = db.query(EduExamPaper).filter(EduExamPaper.id == id).first()
            if not p:
                return error("试卷不存在", "404")
            p.status = 0
            return success({"id": id})
        except Exception as e:
            logger.error(f"[edu exam] delete paper error: {e}")
            return error(str(e))


@router.put("/paper/publish", summary="发布试卷", operation_id="edu_platform_exam_publish_paper")
async def publish_paper(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            p = db.query(EduExamPaper).filter(EduExamPaper.id == id).first()
            if not p:
                return error("试卷不存在", "404")
            p.is_published = True
            return success({"id": p.id, "is_published": p.is_published})
        except Exception as e:
            logger.error(f"[edu exam] publish paper error: {e}")
            return error(str(e))


@router.put("/paper/un-publish", summary="取消发布试卷", operation_id="edu_platform_exam_un_publish_paper")
async def un_publish_paper(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            p = db.query(EduExamPaper).filter(EduExamPaper.id == id).first()
            if not p:
                return error("试卷不存在", "404")
            p.is_published = False
            return success({"id": p.id, "is_published": p.is_published})
        except Exception as e:
            logger.error(f"[edu exam] un-publish paper error: {e}")
            return error(str(e))


@router.post("/paper/rule", summary="新建试卷规则", operation_id="edu_platform_exam_create_paper_rule")
async def create_paper_rule(
    paper_id: int = Body(...),
    question_type: str = Body(...),
    category_id: int | None = Body(None),
    difficulty: int = Body(1),
    question_count: int = Body(0),
    score_per_question: float = Body(1),
):
    with get_session() as db:
        try:
            r = EduExamPaperRule(
                paper_id=paper_id,
                question_type=question_type,
                category_id=category_id,
                difficulty=difficulty,
                question_count=question_count,
                score_per_question=score_per_question,
            )
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"[edu exam] create paper rule error: {e}")
            return error(str(e))


@router.put("/paper/rule", summary="更新试卷规则", operation_id="edu_platform_exam_update_paper_rule")
async def update_paper_rule(
    id: int = Body(...),
    question_type: str | None = Body(None),
    category_id: int | None = Body(None),
    difficulty: int | None = Body(None),
    question_count: int | None = Body(None),
    score_per_question: float | None = Body(None),
):
    with get_session() as db:
        try:
            r = db.query(EduExamPaperRule).filter(EduExamPaperRule.id == id).first()
            if not r:
                return error("试卷规则不存在", "404")
            if question_type is not None:
                r.question_type = question_type
            if category_id is not None:
                r.category_id = category_id
            if difficulty is not None:
                r.difficulty = difficulty
            if question_count is not None:
                r.question_count = question_count
            if score_per_question is not None:
                r.score_per_question = score_per_question
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"[edu exam] update paper rule error: {e}")
            return error(str(e))


@router.get("/paper/rule/by-paper-id", summary="按试卷获取规则", operation_id="edu_platform_exam_get_paper_rule_by_paper_id")
async def get_paper_rule_by_paper_id(paperId: int = Query(..., description="试卷id")):
    with get_session() as db:
        try:
            items = (
                db.query(EduExamPaperRule)
                .filter(EduExamPaperRule.paper_id == paperId)
                .order_by(EduExamPaperRule.id.asc())
                .all()
            )
            return success([_paper_rule_to_dict(r) for r in items])
        except Exception as e:
            logger.error(f"[edu exam] get paper rule by paper id error: {e}")
            return error(str(e))


@router.post("/paper/question", summary="添加试卷题目", operation_id="edu_platform_exam_save_paper_question")
async def save_paper_question(
    paper_id: int = Body(...),
    question_id: int = Body(...),
    sort_order: int = Body(0),
    score: float = Body(1),
):
    with get_session() as db:
        try:
            pq = EduExamPaperQuestion(
                paper_id=paper_id,
                question_id=question_id,
                sort_order=sort_order,
                score=score,
            )
            db.add(pq)
            db.flush()
            return success({"id": pq.id})
        except Exception as e:
            logger.error(f"[edu exam] save paper question error: {e}")
            return error(str(e))


@router.get("/paper/question/by-paper-id", summary="按试卷获取题目", operation_id="edu_platform_exam_get_paper_question_by_paper_id")
async def get_paper_question_by_paper_id(
    paperId: int = Query(..., description="试卷id"),
):
    with get_session() as db:
        try:
            items = (
                db.query(EduExamPaperQuestion)
                .filter(EduExamPaperQuestion.paper_id == paperId)
                .order_by(EduExamPaperQuestion.sort_order.asc(), EduExamPaperQuestion.id.asc())
                .all()
            )
            result = []
            question_ids = [pq.question_id for pq in items]
            questions_map: dict[int, dict] = {}
            if question_ids:
                questions = (
                    db.query(EduExamQuestion)
                    .filter(EduExamQuestion.id.in_(question_ids))
                    .all()
                )
                questions_map = {q.id: _question_to_dict(q) for q in questions}
            for pq in items:
                d = _paper_question_to_dict(pq)
                d["question"] = questions_map.get(pq.question_id)
                result.append(d)
            return success(result)
        except Exception as e:
            logger.error(f"[edu exam] get paper question by paper id error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 题库 (question-lib)
# ---------------------------------------------------------------------------


@router.delete("/question-lib/question", summary="删除题库题目", operation_id="edu_platform_exam_delete_question")
async def delete_question(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            q = db.query(EduExamQuestion).filter(EduExamQuestion.id == id).first()
            if not q:
                return error("题目不存在", "404")
            q.status = 0
            return success({"id": id})
        except Exception as e:
            logger.error(f"[edu exam] delete question error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 考试记录 (record)
# ---------------------------------------------------------------------------


@router.get("/record/mark/paper/list", summary="待批阅试卷列表", operation_id="edu_platform_exam_mark_paper_list")
async def mark_paper_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    exam_id: int | None = None,
    member_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduExamRecord).filter(
                EduExamRecord.status == 1, EduExamRecord.is_marked == False  # noqa: E712
            )
            if exam_id:
                q = q.filter(EduExamRecord.exam_id == exam_id)
            if member_id:
                q = q.filter(EduExamRecord.member_id == member_id)
            total = q.count()
            items = (
                q.order_by(EduExamRecord.submit_time.desc(), EduExamRecord.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_record_to_dict(r) for r in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu exam] mark paper list error: {e}")
            return error(str(e))


@router.put("/record/manual/mark/paper", summary="手动批阅", operation_id="edu_platform_exam_manual_mark_paper")
async def manual_mark_paper(
    id: int = Body(...),
    score: float = Body(..., description="批阅得分"),
    is_pass: bool | None = Body(None, description="是否通过, 不传则按及格分判定"),
):
    with get_session() as db:
        try:
            r = db.query(EduExamRecord).filter(EduExamRecord.id == id).first()
            if not r:
                return error("考试记录不存在", "404")
            r.score = score
            r.is_marked = True
            r.status = 2
            if is_pass is not None:
                r.is_pass = is_pass
            else:
                r.is_pass = score >= (r.pass_score if hasattr(r, "pass_score") and r.pass_score else 60)
            return success(
                {
                    "id": r.id,
                    "score": r.score,
                    "is_pass": r.is_pass,
                    "is_marked": r.is_marked,
                    "status": r.status,
                }
            )
        except Exception as e:
            logger.error(f"[edu exam] manual mark paper error: {e}")
            return error(str(e))


@router.get("/record/list", summary="考试记录列表", operation_id="edu_platform_exam_record_list")
async def record_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    exam_id: int | None = None,
    member_id: int | None = None,
    is_pass: bool | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduExamRecord)
            if exam_id:
                q = q.filter(EduExamRecord.exam_id == exam_id)
            if member_id:
                q = q.filter(EduExamRecord.member_id == member_id)
            if is_pass is not None:
                q = q.filter(EduExamRecord.is_pass == is_pass)
            if status is not None:
                q = q.filter(EduExamRecord.status == status)
            total = q.count()
            items = (
                q.order_by(EduExamRecord.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_record_to_dict(r) for r in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu exam] record list error: {e}")
            return error(str(e))


@router.get("/auth-api/record", summary="获取考试记录", operation_id="edu_platform_exam_get_record")
async def get_record(
    id: int | None = Query(None, description="记录id"),
    exam_id: int | None = Query(None, description="考试id"),
    member_id: int | None = Query(None, description="会员id"),
):
    with get_session() as db:
        try:
            if id:
                r = db.query(EduExamRecord).filter(EduExamRecord.id == id).first()
                if not r:
                    return error("考试记录不存在", "404")
                return success(_record_to_dict(r))
            q = db.query(EduExamRecord)
            if exam_id:
                q = q.filter(EduExamRecord.exam_id == exam_id)
            if member_id:
                q = q.filter(EduExamRecord.member_id == member_id)
            items = q.order_by(EduExamRecord.id.desc()).limit(50).all()
            return success([_record_to_dict(r) for r in items])
        except Exception as e:
            logger.error(f"[edu exam] get record error: {e}")
            return error(str(e))


@router.get("/auth-api/paper", summary="获取试卷(考试用)", operation_id="edu_platform_exam_get_paper_for_exam")
async def get_paper_for_exam(
    id: int | None = Query(None, description="试卷id"),
    exam_id: int | None = Query(None, description="考试id"),
):
    with get_session() as db:
        try:
            paper = None
            if id:
                paper = db.query(EduExamPaper).filter(EduExamPaper.id == id).first()
            elif exam_id:
                paper = (
                    db.query(EduExamPaper)
                    .filter(EduExamPaper.exam_id == exam_id, EduExamPaper.status == 1)
                    .first()
                )
            if not paper:
                return error("试卷不存在", "404")
            result = _paper_to_dict(paper)
            questions = (
                db.query(EduExamPaperQuestion)
                .filter(EduExamPaperQuestion.paper_id == paper.id)
                .order_by(EduExamPaperQuestion.sort_order.asc())
                .all()
            )
            question_ids = [pq.question_id for pq in questions]
            questions_map: dict[int, dict] = {}
            if question_ids:
                qlist = (
                    db.query(EduExamQuestion)
                    .filter(EduExamQuestion.id.in_(question_ids))
                    .all()
                )
                for q in qlist:
                    qd = _question_to_dict(q)
                    qd.pop("answer", None)
                    qd.pop("analysis", None)
                    questions_map[q.id] = qd
            result["questions"] = [
                {**_paper_question_to_dict(pq), "question": questions_map.get(pq.question_id)}
                for pq in questions
            ]
            return success(result)
        except Exception as e:
            logger.error(f"[edu exam] get paper for exam error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 报名 (sign-up)
# ---------------------------------------------------------------------------


@router.get("/sign-up/list", summary="考试报名列表", operation_id="edu_platform_exam_sign_up_list")
async def sign_up_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    target_id: int | None = None,
    member_id: int | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduSignUp).filter(EduSignUp.target_type == "exam")
            if target_id:
                q = q.filter(EduSignUp.target_id == target_id)
            if member_id:
                q = q.filter(EduSignUp.member_id == member_id)
            if status is not None:
                q = q.filter(EduSignUp.status == status)
            total = q.count()
            items = (
                q.order_by(EduSignUp.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_sign_up_to_dict(s) for s in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu exam] sign-up list error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 统计 (statistics)
# ---------------------------------------------------------------------------


@router.get("/statistics", summary="考试统计", operation_id="edu_platform_exam_exam_statistics")
async def exam_statistics():
    with get_session() as db:
        try:
            from sqlalchemy import func

            total_exams = db.query(EduExam).filter(EduExam.status == 1).count()
            published_exams = (
                db.query(EduExam)
                .filter(EduExam.status == 1, EduExam.is_published == True)  # noqa: E712
                .count()
            )
            total_papers = db.query(EduExamPaper).filter(EduExamPaper.status == 1).count()
            total_questions = db.query(EduExamQuestion).filter(EduExamQuestion.status == 1).count()
            total_records = db.query(EduExamRecord).count()
            passed_records = (
                db.query(EduExamRecord).filter(EduExamRecord.is_pass == True).count()  # noqa: E712
            )
            total_signups = (
                db.query(EduSignUp)
                .filter(EduSignUp.target_type == "exam", EduSignUp.status == 1)
                .count()
            )
            avg_score = (
                db.query(func.avg(EduExamRecord.score))
                .filter(EduExamRecord.status == 2)
                .scalar()
            )
            return success(
                {
                    "total_exams": total_exams,
                    "published_exams": published_exams,
                    "total_papers": total_papers,
                    "total_questions": total_questions,
                    "total_records": total_records,
                    "passed_records": passed_records,
                    "total_signups": total_signups,
                    "avg_score": round(float(avg_score), 2) if avg_score else 0,
                }
            )
        except Exception as e:
            logger.error(f"[edu exam] statistics error: {e}")
            return error(str(e))
