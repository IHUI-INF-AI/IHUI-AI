"""edu_exam service - Exam (migrated from ihui-ai-edu-exam-service).

Source: G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-exam-service\\
Original package: com.yjs.cloud.learning.exam
Controllers: PaperController, QuestionController, ExamRecordController, WrongBookController
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduPaper, EduQuestion, EduExamRecord, EduWrongBook
from app.services.edu_base import EduValidationError, paginate, get_or_404


# ============================================================================
# Paper CRUD (迁移自 PaperController)
# ============================================================================

def create_paper(db: Session, title: str, **fields) -> EduPaper:
    if not title:
        raise EduValidationError("title required")
    paper = EduPaper(
        title=title, course_id=fields.get("course_id"),
        description=fields.get("description"),
        duration_minutes=fields.get("duration_minutes", 60),
        total_score=fields.get("total_score", 100),
        pass_score=fields.get("pass_score", 60),
        difficulty=fields.get("difficulty", "medium"),
        is_published=False,
        question_count=0,
    )
    db.add(paper)
    db.flush()
    db.refresh(paper)
    return paper


def publish_paper(db: Session, paper_id: int) -> EduPaper:
    p = get_or_404(db, EduPaper, paper_id, "paper")
    p.is_published = True
    db.flush()
    db.refresh(p)
    return p


def list_papers(
    db: Session, page: int = 1, size: int = 20,
    course_id: Optional[int] = None, is_published: Optional[bool] = None,
) -> Tuple[List[EduPaper], int]:
    filters = []
    if course_id is not None:
        filters.append(EduPaper.course_id == course_id)
    if is_published is not None:
        filters.append(EduPaper.is_published == is_published)
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
    """Add a question to a paper (or as standalone)."""
    valid_types = {"single", "multi", "judge", "fill", "essay"}
    if question_type not in valid_types:
        raise EduValidationError(f"question_type must be one of {valid_types}")
    q = EduQuestion(
        paper_id=paper_id, question_type=question_type, stem=stem,
        options=json.dumps(options) if options else None,
        correct_answer=correct_answer, analysis=analysis,
        score=score, difficulty=difficulty, tags=tags,
    )
    db.add(q)
    db.flush()
    # Update paper question count
    if paper_id:
        paper = db.get(EduPaper, paper_id)
        if paper:
            paper.question_count = (paper.question_count or 0) + 1
            paper.total_score = (paper.total_score or 0) + score
    db.flush()
    db.refresh(q)
    return q


def list_questions(db: Session, paper_id: int) -> List[EduQuestion]:
    return list(db.execute(
        select(EduQuestion).where(EduQuestion.paper_id == paper_id).order_by(EduQuestion.id)
    ).scalars().all())


# ============================================================================
# Exam Record (迁移自 ExamRecordController)
# ============================================================================

def start_exam(db: Session, user_id: int, paper_id: int) -> EduExamRecord:
    """Start an exam attempt."""
    paper = get_or_404(db, EduPaper, paper_id, "paper")
    if not paper.is_published:
        raise EduValidationError("paper not published")
    record = EduExamRecord(
        user_id=user_id, paper_id=paper_id,
        start_at=datetime.now(timezone.utc),
        duration_seconds=0,
        status="in_progress",
    )
    db.add(record)
    db.flush()
    db.refresh(record)
    return record


def submit_exam(
    db: Session, record_id: int, user_id: int, answers: Dict[int, str]
) -> EduExamRecord:
    """Submit exam and auto-grade."""
    record = get_or_404(db, EduExamRecord, record_id, "exam_record")
    if record.user_id != user_id:
        from app.services.edu_base import EduPermissionError
        raise EduPermissionError("not your exam record")
    if record.status != "in_progress":
        raise EduValidationError("exam already submitted")

    record.submit_at = datetime.now(timezone.utc)
    record.duration_seconds = int((record.submit_at - record.start_at).total_seconds())

    # Auto-grade
    questions = list_questions(db, record.paper_id)
    score = 0.0
    for q in questions:
        user_answer = answers.get(q.id)
        if not user_answer:
            continue
        if q.question_type in ("single", "judge", "fill"):
            if user_answer.strip().lower() == (q.correct_answer or "").strip().lower():
                score += q.score
        elif q.question_type == "multi":
            correct = set((q.correct_answer or "").split(","))
            given = set(user_answer.split(","))
            if correct == given:
                score += q.score
        # essay requires manual grading

    paper = get_or_404(db, EduPaper, record.paper_id, "paper")
    record.score = score
    record.is_passed = score >= paper.pass_score
    record.status = "submitted"
    db.flush()

    # Add wrong questions to wrong book
    for q in questions:
        user_answer = answers.get(q.id)
        if not user_answer:
            continue
        is_correct = False
        if q.question_type in ("single", "judge", "fill"):
            is_correct = user_answer.strip().lower() == (q.correct_answer or "").strip().lower()
        elif q.question_type == "multi":
            correct = set((q.correct_answer or "").split(","))
            given = set(user_answer.split(","))
            is_correct = correct == given
        if not is_correct:
            add_wrong_question(db, user_id, q.id)

    db.refresh(record)
    return record


def get_exam_record(db: Session, record_id: int) -> EduExamRecord:
    return get_or_404(db, EduExamRecord, record_id, "exam_record")


def list_user_exams(
    db: Session, user_id: int, page: int = 1, size: int = 20,
    status: Optional[str] = None,
) -> Tuple[List[EduExamRecord], int]:
    filters = [EduExamRecord.uuid == user_id]
    if status:
        filters.append(EduExamRecord.status == status)
    return paginate(db, EduExamRecord, page=page, size=size, filters=filters, order_by=desc(EduExamRecord.start_at))


# ============================================================================
# Wrong Book (迁移自 WrongBookController)
# ============================================================================

def add_wrong_question(db: Session, user_id: int, question_id: int) -> EduWrongBook:
    """Add a question to user's wrong book (or increment count)."""
    existing = db.execute(
        select(EduWrongBook).where(
            and_(EduWrongBook.uuid == user_id, EduWrongBook.question_id == question_id)
        )
    ).scalar_one_or_none()
    if existing:
        existing.wrong_count = (existing.wrong_count or 0) + 1
        existing.last_wrong_at = datetime.now(timezone.utc)
        db.flush()
        db.refresh(existing)
        return existing
    wb = EduWrongBook(
        user_id=user_id, question_id=question_id,
        wrong_count=1, last_wrong_at=datetime.now(timezone.utc),
        mastered=False,
    )
    db.add(wb)
    db.flush()
    db.refresh(wb)
    return wb


def mark_mastered(db: Session, wrong_book_id: int, user_id: int) -> EduWrongBook:
    wb = get_or_404(db, EduWrongBook, wrong_book_id, "wrong_book")
    if wb.user_id != user_id:
        from app.services.edu_base import EduPermissionError
        raise EduPermissionError("not your wrong book entry")
    wb.mastered = True
    db.flush()
    db.refresh(wb)
    return wb


def list_wrong_book(
    db: Session, user_id: int, page: int = 1, size: int = 20,
    mastered: Optional[bool] = None,
) -> Tuple[List[EduWrongBook], int]:
    filters = [EduWrongBook.uuid == user_id]
    if mastered is not None:
        filters.append(EduWrongBook.mastered == mastered)
    return paginate(db, EduWrongBook, page=page, size=size, filters=filters, order_by=desc(EduWrongBook.last_wrong_at))
