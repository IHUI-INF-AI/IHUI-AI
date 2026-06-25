"""答卷记录 API (迁移自 ihui-ai-edu-learn-service exampaper 模块)

提供考试答卷的保存、提交、评分、查询、删除与考试统计能力。
模型: ExamPaperRecord
状态: 0=未提交 1=已提交 2=已评分
"""
from app.utils.datetime_helper import utcnow

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import func

from app.database import get_session
from app.models.learn_models import ExamPaperRecord
from app.schemas.common import error, page_result, success

router = APIRouter()


def _to_dict(item: ExamPaperRecord) -> dict:
    return {
        "id": item.id,
        "exam_id": item.exam_id,
        "exam_chapter_section_id": item.exam_chapter_section_id,
        "sign_up_id": item.sign_up_id,
        "member_id": item.member_id,
        "paper": item.paper,
        "answer": item.answer,
        "reference_answer": item.reference_answer,
        "start_time": item.start_time.isoformat() if item.start_time else None,
        "end_time": item.end_time.isoformat() if item.end_time else None,
        "score": item.score,
        "status": item.status,
        "lesson_id": item.lesson_id,
        "serial_num": item.serial_num,
        "exam_title": item.exam_title,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


class PaperSave(BaseModel):
    exam_id: int
    member_id: int
    exam_chapter_section_id: int | None = None
    sign_up_id: int | None = None
    paper: str | None = None
    answer: str | None = None
    reference_answer: str | None = None
    lesson_id: int | None = None
    serial_num: str | None = None
    exam_title: str | None = None


class PaperSubmit(BaseModel):
    record_id: int
    answer: str | None = None


class PaperScore(BaseModel):
    score: int


@router.post("/save", summary="保存答卷")
def save_paper(body: PaperSave):
    with get_session() as db:
        try:
            # 查找该会员该考试的未提交答卷, 存在则更新, 否则新建
            item = (
                db.query(ExamPaperRecord)
                .filter(
                    ExamPaperRecord.exam_id == body.exam_id,
                    ExamPaperRecord.member_id == body.member_id,
                    ExamPaperRecord.status == 0,
                )
                .order_by(ExamPaperRecord.id.desc())
                .first()
            )
            if item:
                item.paper = body.paper
                item.answer = body.answer
                item.reference_answer = body.reference_answer
                item.exam_chapter_section_id = body.exam_chapter_section_id
                item.sign_up_id = body.sign_up_id
                item.lesson_id = body.lesson_id
                item.serial_num = body.serial_num
                item.exam_title = body.exam_title
            else:
                item = ExamPaperRecord(
                    exam_id=body.exam_id,
                    member_id=body.member_id,
                    exam_chapter_section_id=body.exam_chapter_section_id,
                    sign_up_id=body.sign_up_id,
                    paper=body.paper,
                    answer=body.answer,
                    reference_answer=body.reference_answer,
                    start_time=utcnow(),
                    status=0,
                    lesson_id=body.lesson_id,
                    serial_num=body.serial_num,
                    exam_title=body.exam_title,
                )
                db.add(item)
            db.flush()
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("save_paper error")
            return error(str(e))


@router.post("/submit", summary="提交答卷")
def submit_paper(body: PaperSubmit):
    with get_session() as db:
        try:
            item = db.query(ExamPaperRecord).filter(ExamPaperRecord.id == body.record_id).first()
            if not item:
                return error("答卷不存在")
            if body.answer is not None:
                item.answer = body.answer
            item.status = 1
            item.end_time = utcnow()
            db.flush()
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("submit_paper error")
            return error(str(e))


@router.put("/{record_id}/score", summary="评分")
def score_paper(record_id: int, body: PaperScore):
    with get_session() as db:
        try:
            item = db.query(ExamPaperRecord).filter(ExamPaperRecord.id == record_id).first()
            if not item:
                return error("答卷不存在")
            item.score = body.score
            item.status = 2
            db.flush()
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("score_paper error")
            return error(str(e))


@router.get("/member/{member_id}/list", summary="会员答卷列表")
def list_member_papers(
    member_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(ExamPaperRecord).filter(ExamPaperRecord.member_id == member_id)
            total = q.count()
            items = (
                q.order_by(ExamPaperRecord.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_member_papers error")
            return error(str(e))


@router.get("/exam/{exam_id}/list", summary="考试答卷列表")
def list_exam_papers(
    exam_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(ExamPaperRecord).filter(ExamPaperRecord.exam_id == exam_id)
            total = q.count()
            items = (
                q.order_by(ExamPaperRecord.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_exam_papers error")
            return error(str(e))


@router.get("/lesson/{lesson_id}/list", summary="课程答卷列表")
def list_lesson_papers(
    lesson_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(ExamPaperRecord).filter(ExamPaperRecord.lesson_id == lesson_id)
            total = q.count()
            items = (
                q.order_by(ExamPaperRecord.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_lesson_papers error")
            return error(str(e))


@router.get("/member/{member_id}/exam/{exam_id}", summary="查询会员某考试的答卷")
def get_member_exam_paper(member_id: int, exam_id: int):
    with get_session() as db:
        try:
            item = (
                db.query(ExamPaperRecord)
                .filter(
                    ExamPaperRecord.member_id == member_id,
                    ExamPaperRecord.exam_id == exam_id,
                )
                .order_by(ExamPaperRecord.id.desc())
                .first()
            )
            if not item:
                return error("答卷不存在")
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("get_member_exam_paper error")
            return error(str(e))


@router.get("/exam/{exam_id}/statistics", summary="考试统计")
def exam_statistics(exam_id: int):
    with get_session() as db:
        try:
            total_count = (
                db.query(func.count(ExamPaperRecord.id))
                .filter(ExamPaperRecord.exam_id == exam_id)
                .scalar()
                or 0
            )
            avg_score = (
                db.query(func.avg(ExamPaperRecord.score))
                .filter(
                    ExamPaperRecord.exam_id == exam_id,
                    ExamPaperRecord.score.isnot(None),
                )
                .scalar()
            )
            max_score = (
                db.query(func.max(ExamPaperRecord.score))
                .filter(
                    ExamPaperRecord.exam_id == exam_id,
                    ExamPaperRecord.score.isnot(None),
                )
                .scalar()
            )
            min_score = (
                db.query(func.min(ExamPaperRecord.score))
                .filter(
                    ExamPaperRecord.exam_id == exam_id,
                    ExamPaperRecord.score.isnot(None),
                )
                .scalar()
            )
            return success(
                {
                    "exam_id": exam_id,
                    "total_count": total_count,
                    "avg_score": round(float(avg_score), 2) if avg_score is not None else 0,
                    "max_score": max_score or 0,
                    "min_score": min_score or 0,
                }
            )
        except Exception as e:
            logger.exception("exam_statistics error")
            return error(str(e))


@router.get("/{record_id}", summary="答卷详情")
def get_paper_record(record_id: int):
    with get_session() as db:
        try:
            item = db.query(ExamPaperRecord).filter(ExamPaperRecord.id == record_id).first()
            if not item:
                return error("答卷不存在")
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("get_paper_record error")
            return error(str(e))


@router.delete("/{record_id}", summary="删除答卷")
def delete_paper_record(record_id: int):
    with get_session() as db:
        try:
            item = db.query(ExamPaperRecord).filter(ExamPaperRecord.id == record_id).first()
            if not item:
                return error("答卷不存在")
            db.delete(item)
            db.flush()
            return success()
        except Exception as e:
            logger.exception("delete_paper_record error")
            return error(str(e))
