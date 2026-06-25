"""edu_exam service - Exam (migrated from ihui-ai-edu-exam-service).

Source: G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-exam-service\\
Original package: com.yjs.cloud.learning.exam
Controllers: PaperController, QuestionController, ExamRecordController, WrongBookController
"""

from __future__ import annotations

import json
from datetime import timezone

from typing import Optional, List, Dict, Tuple, Any

from sqlalchemy import and_, desc, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduPaper, EduQuestion, EduExamRecord, EduWrongBook
from app.models.exam_models import PaperQuestion
from app.services.edu_base import EduValidationError, paginate, get_or_404
from app.utils.datetime_helper import utcnow


# ============================================================================
# Paper CRUD (迁移自 PaperController)
# ============================================================================

def create_paper(db: Session, title: str, **fields) -> EduPaper:
    """2026-06-25 字段对齐修复: duration_minutes→duration, is_published→status, question_count→question_num."""
    if not title:
        raise EduValidationError("title required")
    paper = EduPaper(
        title=title, course_id=fields.get("course_id"),
        description=fields.get("description"),
        duration=fields.get("duration", 60),
        total_score=fields.get("total_score", 100),
        pass_score=fields.get("pass_score", 60),
        difficulty=fields.get("difficulty", "medium"),
        status=1,
        question_num=0,
    )
    db.add(paper)
    db.flush()
    db.refresh(paper)
    return paper


def publish_paper(db: Session, paper_id: int) -> EduPaper:
    """2026-06-25 字段对齐修复: is_published→status=1."""
    p = get_or_404(db, EduPaper, paper_id, "paper")
    p.status = 1
    db.flush()
    db.refresh(p)
    return p


def list_papers(
    db: Session, page: int = 1, size: int = 20,
    course_id: Optional[int] = None, is_published: Optional[bool] = None,
) -> Tuple[List[EduPaper], int]:
    """2026-06-25 字段对齐修复: EduPaper.is_published→EduPaper.status."""
    filters = []
    if course_id is not None:
        filters.append(EduPaper.course_id == course_id)
    if is_published is not None:
        filters.append(EduPaper.status == (1 if is_published else 0))
    return paginate(db, EduPaper, page=page, size=size, filters=filters, order_by=desc(EduPaper.id))


def get_paper(db: Session, paper_id: int) -> EduPaper:
    return get_or_404(db, EduPaper, paper_id, "paper")


# ============================================================================
# Question CRUD (迁移自 QuestionController)
# ============================================================================

def add_question(
    db: Session, paper_id: Optional[int], question_type: str, stem: str,
    options: Optional[List[str]] = None, correct_answer: Optional[str] = None,
    analysis: Optional[str] = None, score: int = 1, difficulty: str = "medium",
    tags: Optional[str] = None,
) -> EduQuestion:
    """Add a question to a paper (or as standalone).

    2026-06-25 字段对齐修复: EduQuestion 构造删除 paper_id, stem→title,
    question_type→type, correct_answer→reference_answer, analysis→reference_answer_note,
    tags→删除; paper.question_count→paper.question_num.
    """
    valid_types = {"single", "multi", "judge", "fill", "essay"}
    if question_type not in valid_types:
        raise EduValidationError(f"question_type must be one of {valid_types}")
    q = EduQuestion(
        title=stem, type=question_type,
        options=json.dumps(options) if options else None,
        reference_answer=correct_answer, reference_answer_note=analysis,
        score=score, difficulty=difficulty,
    )
    db.add(q)
    db.flush()
    # Update paper question count
    if paper_id:
        paper = db.get(EduPaper, paper_id)
        if paper:
            paper.question_num = (paper.question_num or 0) + 1
            paper.total_score = (paper.total_score or 0) + score
    db.flush()
    db.refresh(q)
    return q


def list_questions(db: Session, paper_id: int) -> List[EduQuestion]:
    """2026-06-25 字段对齐修复: EduQuestion 无 paper_id, 改通过 PaperQuestion 关联表查询."""
    question_ids = select(PaperQuestion.question_id).where(PaperQuestion.paper_id == paper_id)
    return list(db.execute(
        select(EduQuestion).where(EduQuestion.id.in_(question_ids)).order_by(EduQuestion.id)
    ).scalars().all())


# ============================================================================
# Exam Record (迁移自 ExamRecordController)
# ============================================================================

def start_exam(db: Session, user_id: int, paper_id: int) -> EduExamRecord:
    """Start an exam attempt.

    2026-06-25 字段对齐修复: paper.is_published→paper.status, start_at→start_time,
    duration_seconds→cost_time, status="in_progress"→status=0.
    """
    paper = get_or_404(db, EduPaper, paper_id, "paper")
    if paper.status != 1:
        raise EduValidationError("paper not published")
    record = EduExamRecord(
        user_id=user_id, paper_id=paper_id,
        start_time=utcnow(),
        cost_time=0,
        status=0,
    )
    db.add(record)
    db.flush()
    db.refresh(record)
    return record


def submit_exam(
    db: Session, record_id: int, user_id: int, answers: Dict[int, str]
) -> EduExamRecord:
    """Submit exam and auto-grade.

    2026-06-25 字段对齐修复: record.submit_at→submit_time, start_at→start_time,
    duration_seconds→cost_time, q.question_type→q.type, q.correct_answer→q.reference_answer,
    record.is_passed→is_pass, record.status="submitted"→status=1,
    EduWrongBook: last_wrong_at→last_wrong_time, mastered→is_mastered, 补 paper_id.
    """
    record = get_or_404(db, EduExamRecord, record_id, "exam_record")
    if record.user_id != user_id:
        from app.services.edu_base import EduPermissionError
        raise EduPermissionError("not your exam record")
    if record.status != 0:
        raise EduValidationError("exam already submitted")

    record.submit_time = utcnow()
    # 兼容历史 aware datetime 记录: 若 start_at 带 tzinfo, 转为 naive UTC
    start_at = record.start_time
    if start_at is not None and start_at.tzinfo is not None:
        start_at = start_at.astimezone(timezone.utc).replace(tzinfo=None)
    record.cost_time = int((record.submit_time - start_at).total_seconds()) if start_at else 0

    # Auto-grade + 收集错题 question_id (单次遍历, 避免重复循环)
    questions = list_questions(db, record.paper_id)
    score = 0.0
    wrong_question_ids: List[int] = []
    for q in questions:
        user_answer = answers.get(q.id)
        if not user_answer:
            continue
        is_correct = False
        if q.type in ("single", "judge", "fill"):
            is_correct = user_answer.strip().lower() == (q.reference_answer or "").strip().lower()
            if is_correct:
                score += q.score
        elif q.type == "multi":
            correct = set((q.reference_answer or "").split(","))
            given = set(user_answer.split(","))
            is_correct = correct == given
            if is_correct:
                score += q.score
        # essay requires manual grading
        if not is_correct:
            wrong_question_ids.append(q.id)

    paper = get_or_404(db, EduPaper, record.paper_id, "paper")
    record.score = score
    record.is_pass = score >= paper.pass_score
    record.status = 1
    db.flush()

    # 批量预查询已存在的错题记录 (避免循环内 N+1 查询)
    existing_wbs: Dict[int, EduWrongBook] = {}
    if wrong_question_ids:
        existing_wbs = {
            wb.question_id: wb
            for wb in db.execute(
                select(EduWrongBook).where(
                    and_(
                        EduWrongBook.user_id == user_id,
                        EduWrongBook.question_id.in_(wrong_question_ids),
                    )
                )
            ).scalars().all()
        }
    now = utcnow()
    for qid in wrong_question_ids:
        existing = existing_wbs.get(qid)
        if existing:
            existing.wrong_count = (existing.wrong_count or 0) + 1
            existing.last_wrong_time = now
        else:
            db.add(EduWrongBook(
                user_id=user_id, question_id=qid, paper_id=record.paper_id,
                wrong_count=1, last_wrong_time=now,
                is_mastered=False,
            ))
    db.flush()  # 单次 flush, 避免 N+1

    db.refresh(record)
    return record


def get_exam_record(db: Session, record_id: int) -> EduExamRecord:
    return get_or_404(db, EduExamRecord, record_id, "exam_record")


def list_user_exams(
    db: Session, user_id: int, page: int = 1, size: int = 20,
    status: Optional[str] = None,
) -> Tuple[List[EduExamRecord], int]:
    """2026-06-25 字段对齐修复: EduExamRecord.start_at→start_time."""
    filters = [EduExamRecord.user_id == user_id]
    if status:
        filters.append(EduExamRecord.status == status)
    return paginate(db, EduExamRecord, page=page, size=size, filters=filters, order_by=desc(EduExamRecord.start_time))


# ============================================================================
# Wrong Book (迁移自 WrongBookController)
# ============================================================================

def add_wrong_question(db: Session, user_id: int, question_id: int) -> EduWrongBook:
    """Add a question to user's wrong book (or increment count).

    2026-06-25 字段对齐修复: last_wrong_at→last_wrong_time, mastered→is_mastered,
    补 paper_id (nullable=False, 通过 PaperQuestion 关联表回查, 缺失时回退 0).
    """
    existing = db.execute(
        select(EduWrongBook).where(
            and_(EduWrongBook.user_id == user_id, EduWrongBook.question_id == question_id)
        )
    ).scalar_one_or_none()
    if existing:
        existing.wrong_count = (existing.wrong_count or 0) + 1
        existing.last_wrong_time = utcnow()
        db.flush()
        db.refresh(existing)
        return existing
    paper_id = db.execute(
        select(PaperQuestion.paper_id).where(PaperQuestion.question_id == question_id).limit(1)
    ).scalar() or 0
    wb = EduWrongBook(
        user_id=user_id, question_id=question_id, paper_id=paper_id,
        wrong_count=1, last_wrong_time=utcnow(),
        is_mastered=False,
    )
    db.add(wb)
    db.flush()
    db.refresh(wb)
    return wb


def mark_mastered(db: Session, wrong_book_id: int, user_id: int) -> EduWrongBook:
    """2026-06-25 字段对齐修复: wb.mastered→wb.is_mastered."""
    wb = get_or_404(db, EduWrongBook, wrong_book_id, "wrong_book")
    if wb.user_id != user_id:
        from app.services.edu_base import EduPermissionError
        raise EduPermissionError("not your wrong book entry")
    wb.is_mastered = True
    db.flush()
    db.refresh(wb)
    return wb


def list_wrong_book(
    db: Session, user_id: int, page: int = 1, size: int = 20,
    mastered: Optional[bool] = None,
) -> Tuple[List[EduWrongBook], int]:
    """2026-06-25 字段对齐修复: EduWrongBook.mastered→is_mastered, last_wrong_at→last_wrong_time."""
    filters = [EduWrongBook.user_id == user_id]
    if mastered is not None:
        filters.append(EduWrongBook.is_mastered == mastered)
    return paginate(db, EduWrongBook, page=page, size=size, filters=filters, order_by=desc(EduWrongBook.last_wrong_time))
