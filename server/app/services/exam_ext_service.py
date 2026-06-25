"""考试服务 - 12 个新 model 基础 CRUD (P0 补全)."""
from __future__ import annotations

import logging
from typing import Any

from app.database import get_session
from app.models.exam_models import (
    Exam,
    ExamCategoryRelation,
    ExamSignUp,
    PaperCategory,
    PaperCategoryRelation,
    PaperPaperCategoryRelation,
    PaperQuestion,
    PaperQuestionRule,
    Question,
    QuestionAndCategoryRelation,
    QuestionCategory,
    QuestionCategoryRelation,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exam 测评主表
# ---------------------------------------------------------------------------

def create_exam(
    name: str,
    code: str | None = None,
    start_time: Any = None,
    end_time: Any = None,
    **kwargs: Any,
) -> Exam:
    with get_session() as db:
        e = Exam(
            name=name,
            code=code,
            start_time=start_time,
            end_time=end_time,
            status=0,
            type=kwargs.get("type", "sign"),
            image=kwargs.get("image"),
            phrase=kwargs.get("phrase"),
            introduction=kwargs.get("introduction"),
        )
        db.add(e)
        db.flush()
        db.refresh(e)
        return e


def get_exam(exam_id: str) -> Exam | None:
    with get_session() as db:
        return db.query(Exam).filter(Exam.id == exam_id).first()


def list_exams(
    status: int | None = None,
    page: int = 1,
    page_size: int = 20,
) -> list[Exam]:
    with get_session() as db:
        q = db.query(Exam)
        if status is not None:
            q = q.filter(Exam.status == status)
        return q.order_by(Exam.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()


def bind_exam_category(exam_id: str, category_id: str) -> ExamCategoryRelation:
    with get_session() as db:
        r = ExamCategoryRelation(exam_id=exam_id, category_id=category_id)
        db.add(r)
        return r


# ---------------------------------------------------------------------------
# ExamSignUp 测评报名
# ---------------------------------------------------------------------------

def exam_sign_up(exam_id: str, member_id: str) -> ExamSignUp:
    """会员报名测评."""
    with get_session() as db:
        existing = (
            db.query(ExamSignUp)
            .filter(ExamSignUp.exam_id == exam_id, ExamSignUp.member_id == member_id)
            .first()
        )
        if existing:
            return existing
        s = ExamSignUp(exam_id=exam_id, member_id=member_id, status=0)
        db.add(s)
        db.flush()
        db.refresh(s)
        return s


def complete_exam(signup_id: str) -> bool:
    """完成测评."""
    with get_session() as db:
        s = db.query(ExamSignUp).filter(ExamSignUp.id == signup_id).first()
        if not s:
            return False
        s.status = 1
        s.completed_time = __import__("datetime").datetime.utcnow()
        return True


# ---------------------------------------------------------------------------
# PaperCategory / QuestionCategory 分类树
# ---------------------------------------------------------------------------

def create_paper_category(name: str, level: int = 1) -> PaperCategory:
    with get_session() as db:
        c = PaperCategory(name=name, level=level, is_show=True)
        db.add(c)
        db.flush()
        db.refresh(c)
        return c


def create_question_category(name: str, level: int = 1) -> QuestionCategory:
    with get_session() as db:
        c = QuestionCategory(name=name, level=level, is_show=True)
        db.add(c)
        db.flush()
        db.refresh(c)
        return c


def bind_paper_category_relation(
    child_id: str, father_id: str, direct_father_id: int = 0
) -> PaperCategoryRelation:
    with get_session() as db:
        r = PaperCategoryRelation(
            child_category_id=child_id,
            father_category_id=father_id,
            direct_father_category_id=direct_father_id,
            is_sub=1 if direct_father_id else 0,
        )
        db.add(r)
        return r


def bind_question_category_relation(
    child_id: str, father_id: str, direct_father_id: int = 0
) -> QuestionCategoryRelation:
    with get_session() as db:
        r = QuestionCategoryRelation(
            child_category_id=child_id,
            father_category_id=father_id,
            direct_father_category_id=direct_father_id,
            is_sub=1 if direct_father_id else 0,
        )
        db.add(r)
        return r


# ---------------------------------------------------------------------------
# Paper 关联表
# ---------------------------------------------------------------------------

def bind_paper_paper_category(paper_id: str, category_id: str) -> PaperPaperCategoryRelation:
    with get_session() as db:
        r = PaperPaperCategoryRelation(paper_id=paper_id, category_id=category_id)
        db.add(r)
        return r


def add_paper_question(paper_id: str, question_id: str, sort_order: int = 0) -> PaperQuestion:
    with get_session() as db:
        q = PaperQuestion(paper_id=paper_id, question_id=question_id, sort_order=sort_order)
        db.add(q)
        return q


def set_paper_question_rule(paper_id: str, rule_json: str) -> PaperQuestionRule:
    with get_session() as db:
        existing = db.query(PaperQuestionRule).filter(PaperQuestionRule.paper_id == paper_id).first()
        if existing:
            existing.rule_json = rule_json
            return existing
        r = PaperQuestionRule(paper_id=paper_id, rule_json=rule_json)
        db.add(r)
        return r


# ---------------------------------------------------------------------------
# Question 题库主表
# ---------------------------------------------------------------------------

def create_question(
    title: str,
    type: int,
    score: float = 0,
    options: str | None = None,
    reference_answer: str | None = None,
    difficulty: int = 1,
    **kwargs: Any,
) -> Question:
    with get_session() as db:
        q = Question(
            title=title,
            type=type,
            score=score,
            options=options,
            reference_answer=reference_answer,
            reference_answer_note=kwargs.get("reference_answer_note"),
            note=kwargs.get("note"),
            difficulty=difficulty,
            status=1,
        )
        db.add(q)
        db.flush()
        db.refresh(q)
        return q


def bind_question_category(question_id: str, category_id: str) -> QuestionAndCategoryRelation:
    with get_session() as db:
        r = QuestionAndCategoryRelation(question_id=question_id, category_id=category_id)
        db.add(r)
        return r


def list_questions_by_category(category_id: str, page: int = 1, page_size: int = 20) -> list[Question]:
    with get_session() as db:
        return (
            db.query(Question)
            .join(QuestionAndCategoryRelation, QuestionAndCategoryRelation.question_id == Question.id)
            .filter(QuestionAndCategoryRelation.category_id == category_id)
            .order_by(Question.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
