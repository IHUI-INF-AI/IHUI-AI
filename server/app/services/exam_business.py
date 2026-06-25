"""Exam Legacy Business Service.

完整迁移自 ihui-ai-edu-exam-service:
  - PaperController
  - PaperQuestionController
  - QuestionController
  - ExamChapterController
  - ExamChapterSectionController
  - WrongQuestionController
  - ExamPaperRecordController (在 learn_business 中部分实现)
  - ExamStatisticsController
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy import func, or_

from app.database import get_session
from app.models.exam_models import (
    ExamChapter,
    ExamChapterSection,
    ExamPaper,
    ExamQuestion,
    ExamRecord,
    ExamWrongQuestion,
    PaperQuestion,
    PaperQuestionRule,
)

logger = logging.getLogger(__name__)


def _to_dict(obj: Any) -> dict[str, Any]:
    if obj is None:
        return {}
    out: dict[str, Any] = {}
    for col in obj.__table__.columns:
        v = getattr(obj, col.name, None)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        out[col.name] = v
    return out


def _to_dict_list(items: list[Any]) -> list[dict[str, Any]]:
    return [_to_dict(i) for i in (items or [])]


# ===========================================================================
# PaperController
# ===========================================================================

def list_papers(
    page: int = 1,
    page_size: int = 20,
    title: str | None = None,
    status: int | None = None,
    category_id: int | None = None,
    is_free: bool | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        q = db.query(ExamPaper)
        if title:
            q = q.filter(ExamPaper.title.like(f"%{title}%"))
        if status is not None:
            q = q.filter(ExamPaper.status == status)
        if category_id is not None:
            q = q.filter(ExamPaper.category_id == category_id)
        if is_free is not None:
            q = q.filter(ExamPaper.is_free == is_free)
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total}


def get_paper(paper_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
        return _to_dict(obj)


def create_paper(
    title: str,
    code: str | None = None,
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
) -> dict[str, Any]:
    with get_session() as db:
        obj = ExamPaper(
            title=title, code=code, description=description,
            category_id=category_id, course_id=course_id, cover=cover,
            total_score=total_score, pass_score=pass_score, duration=duration,
            type=type, difficulty=difficulty, is_free=is_free, price=price,
            status=2,  # 待审核
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_paper(
    paper_id: int,
    title: str | None = None,
    description: str | None = None,
    category_id: int | None = None,
    course_id: int | None = None,
    cover: str | None = None,
    total_score: float | None = None,
    pass_score: float | None = None,
    duration: int | None = None,
    difficulty: int | None = None,
    is_free: bool | None = None,
    price: float | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
        if not obj:
            return {}
        if title is not None:
            obj.title = title
        if description is not None:
            obj.description = description
        if category_id is not None:
            obj.category_id = category_id
        if course_id is not None:
            obj.course_id = course_id
        if cover is not None:
            obj.cover = cover
        if total_score is not None:
            obj.total_score = total_score
        if pass_score is not None:
            obj.pass_score = pass_score
        if duration is not None:
            obj.duration = duration
        if difficulty is not None:
            obj.difficulty = difficulty
        if is_free is not None:
            obj.is_free = is_free
        if price is not None:
            obj.price = price
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_paper(paper_id: int) -> None:
    with get_session() as db:
        obj = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
        if obj:
            db.delete(obj)


def publish_paper(paper_id: int) -> None:
    with get_session() as db:
        obj = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
        if obj:
            obj.status = 1


def unpublish_paper(paper_id: int) -> None:
    with get_session() as db:
        obj = db.query(ExamPaper).filter(ExamPaper.id == paper_id).first()
        if obj:
            obj.status = 0


# ===========================================================================
# PaperQuestionController
# ===========================================================================

def list_paper_questions(paper_id: int) -> list[dict[str, Any]]:
    with get_session() as db:
        q = (
            db.query(ExamQuestion, PaperQuestion.sort_order)
            .join(PaperQuestion, PaperQuestion.question_id == ExamQuestion.id)
            .filter(PaperQuestion.paper_id == paper_id)
            .order_by(PaperQuestion.sort_order.asc())
        )
        results = []
        for q_obj, sort_order in q.all():
            d = _to_dict(q_obj)
            d["sortOrder"] = sort_order
            results.append(d)
        return results


# ===========================================================================
# QuestionController
# ===========================================================================

def list_questions(
    page: int = 1,
    page_size: int = 20,
    category_id: int | None = None,
    type: int | None = None,
    difficulty: int | None = None,
    status: int | None = None,
    title: str | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        q = db.query(ExamQuestion)
        if category_id is not None:
            q = q.filter(ExamQuestion.paper_id == category_id)  # paper_id reused as category_id
        if type is not None:
            q = q.filter(ExamQuestion.type == type)
        if difficulty is not None:
            q = q.filter(ExamQuestion.difficulty == difficulty)
        if status is not None:
            q = q.filter(ExamQuestion.status == status)
        if title:
            q = q.filter(ExamQuestion.title.like(f"%{title}%"))
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total}


def get_question(question_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(ExamQuestion).filter(ExamQuestion.id == question_id).first()
        return _to_dict(obj)


def create_question(
    paper_id: int,
    type: int,
    title: str | None = None,
    content: str | None = None,
    note: str | None = None,
    options: str | None = None,
    answer: str | None = None,
    reference_answer: str | None = None,
    analysis: str | None = None,
    score: float = 1,
    difficulty: int = 1,
) -> dict[str, Any]:
    with get_session() as db:
        obj = ExamQuestion(
            paper_id=paper_id, type=type, title=title, content=content,
            note=note, options=options, answer=answer,
            reference_answer=reference_answer, analysis=analysis,
            score=score, difficulty=difficulty, status=1,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_question(
    question_id: int,
    title: str | None = None,
    content: str | None = None,
    note: str | None = None,
    options: str | None = None,
    answer: str | None = None,
    reference_answer: str | None = None,
    analysis: str | None = None,
    score: float | None = None,
    difficulty: int | None = None,
    status: int | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(ExamQuestion).filter(ExamQuestion.id == question_id).first()
        if not obj:
            return {}
        if title is not None:
            obj.title = title
        if content is not None:
            obj.content = content
        if note is not None:
            obj.note = note
        if options is not None:
            obj.options = options
        if answer is not None:
            obj.answer = answer
        if reference_answer is not None:
            obj.reference_answer = reference_answer
        if analysis is not None:
            obj.analysis = analysis
        if score is not None:
            obj.score = score
        if difficulty is not None:
            obj.difficulty = difficulty
        if status is not None:
            obj.status = status
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_question(question_id: int) -> None:
    with get_session() as db:
        obj = db.query(ExamQuestion).filter(ExamQuestion.id == question_id).first()
        if obj:
            db.delete(obj)


# ===========================================================================
# ExamChapterController
# ===========================================================================

def list_exam_chapters(paper_id: int | None = None) -> list[dict[str, Any]]:
    with get_session() as db:
        q = db.query(ExamChapter)
        if paper_id is not None:
            q = q.filter(ExamChapter.paper_id == paper_id)
        q = q.order_by(ExamChapter.sort_order.asc())
        return _to_dict_list(q.all())


def create_exam_chapter(
    title: str,
    paper_id: int | None = None,
    description: str | None = None,
    cover: str | None = None,
    sort_order: int = 0,
) -> dict[str, Any]:
    with get_session() as db:
        obj = ExamChapter(
            title=title, paper_id=paper_id, description=description,
            cover=cover, sort_order=sort_order,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_exam_chapter_sort_order(chapter_id: int, sort_order: int) -> None:
    with get_session() as db:
        obj = db.query(ExamChapter).filter(ExamChapter.id == chapter_id).first()
        if obj:
            obj.sort_order = sort_order


# ===========================================================================
# ExamChapterSectionController
# ===========================================================================

def list_exam_chapter_sections(chapter_id: int | None = None, paper_id: int | None = None) -> list[dict[str, Any]]:
    with get_session() as db:
        q = db.query(ExamChapterSection)
        if chapter_id is not None:
            q = q.filter(ExamChapterSection.chapter_id == chapter_id)
        if paper_id is not None:
            q = q.filter(ExamChapterSection.paper_id == paper_id)
        q = q.order_by(ExamChapterSection.sort_order.asc())
        return _to_dict_list(q.all())


def create_exam_chapter_section(
    title: str,
    chapter_id: int | None = None,
    paper_id: int | None = None,
    description: str | None = None,
    media_url: str | None = None,
    content: str | None = None,
    sort_order: int = 0,
    duration: int = 0,
) -> dict[str, Any]:
    with get_session() as db:
        obj = ExamChapterSection(
            title=title, chapter_id=chapter_id, paper_id=paper_id,
            description=description, media_url=media_url, content=content,
            sort_order=sort_order, duration=duration,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


# ===========================================================================
# WrongQuestionController
# ===========================================================================

def list_wrong_questions(
    user_id: str | None = None,
    paper_id: int | None = None,
) -> list[dict[str, Any]]:
    with get_session() as db:
        q = db.query(ExamWrongQuestion)
        if user_id is not None:
            q = q.filter(ExamWrongQuestion.user_id == user_id)
        if paper_id is not None:
            q = q.filter(ExamWrongQuestion.paper_id == paper_id)
        return _to_dict_list(q.all())


def add_wrong_question(
    user_id: str,
    question_id: int,
    paper_id: int,
    user_answer: str | None = None,
    right_answer: str | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        existing = (
            db.query(ExamWrongQuestion)
            .filter(ExamWrongQuestion.user_id == user_id, ExamWrongQuestion.question_id == question_id)
            .first()
        )
        if existing:
            existing.wrong_count = (existing.wrong_count or 0) + 1
            existing.last_wrong_time = func.now()
            return _to_dict(existing)
        obj = ExamWrongQuestion(
            user_id=user_id, question_id=question_id, paper_id=paper_id,
            user_answer=user_answer, right_answer=right_answer, wrong_count=1,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


# ===========================================================================
# ExamPaperRecordController
# ===========================================================================

def list_exam_paper_records(
    member_id: int | None = None,
    exam_id: int | None = None,
    paper_id: int | None = None,
    status: int | None = None,
) -> list[dict[str, Any]]:
    with get_session() as db:
        q = db.query(ExamRecord)
        if member_id is not None:
            q = q.filter(ExamRecord.member_id == member_id)
        if exam_id is not None:
            q = q.filter(ExamRecord.exam_id == exam_id)
        if paper_id is not None:
            q = q.filter(ExamRecord.paper_id == paper_id)
        if status is not None:
            q = q.filter(ExamRecord.status == status)
        return _to_dict_list(q.all())


def create_exam_paper_record(
    exam_id: int,
    member_id: int,
    paper_id: int,
    paper_title: str | None = None,
    user_name: str | None = None,
    lesson_id: int | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = ExamRecord(
            exam_id=exam_id, member_id=member_id, paper_id=paper_id,
            paper_title=paper_title, user_name=user_name, lesson_id=lesson_id,
            status=0, score=0, total_score=0,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def submit_exam_paper_record(record_id: int, answer_data: str, score: float = 0, total_score: float = 0) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(ExamRecord).filter(ExamRecord.id == record_id).first()
        if obj:
            obj.answer_data = answer_data
            obj.score = score
            obj.total_score = total_score
            obj.status = 1
            obj.submit_time = func.now()
        return _to_dict(obj) if obj else {}


def save_exam_paper_draft(record_id: int, draft_data: str) -> None:
    with get_session() as db:
        obj = db.query(ExamRecord).filter(ExamRecord.id == record_id).first()
        if obj:
            obj.answer_data = draft_data
            obj.status = 0


def manual_mark_paper(record_id: int, score: float) -> None:
    with get_session() as db:
        obj = db.query(ExamRecord).filter(ExamRecord.id == record_id).first()
        if obj:
            obj.score = score
            obj.status = 2
            obj.is_pass = score >= (obj.pass_score or 0)


# ===========================================================================
# ExamStatisticsController
# ===========================================================================

def exam_statistics() -> dict[str, Any]:
    with get_session() as db:
        return {
            "paperCount": db.query(func.count(ExamPaper.id)).scalar() or 0,
            "questionCount": db.query(func.count(ExamQuestion.id)).scalar() or 0,
            "recordCount": db.query(func.count(ExamRecord.id)).scalar() or 0,
            "wrongQuestionCount": db.query(func.count(ExamWrongQuestion.id)).scalar() or 0,
        }
