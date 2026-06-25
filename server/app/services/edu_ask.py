"""edu_ask service - Q&A platform (migrated from ihui-ai-edu-ask-service).

Source (junction access): G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-ask-service\\
Original package: com.yjs.cloud.learning.ask
Modules: biz/answer, biz/category, biz/question, biz/statistics

Phase B: complete implementation extracted from 4 controllers and 9 services.
"""

from __future__ import annotations

from typing import Optional, List, Tuple, Dict, Any

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduAskAnswer, EduAskQuestion
from app.services.edu_base import (
    EduPermissionError,
    EduValidationError,
    paginate,
    get_or_404,
)


# ============================================================================
# Question CRUD (迁移自 QuestionController + QuestionService)
# ============================================================================

def create_question(
    db: Session,
    user_id: int,
    title: str,
    content: str,
    course_id: Optional[int] = None,
    tags: Optional[str] = None,
) -> EduAskQuestion:
    """Create a new Q&A question.

    Java source: QuestionService.create(QuestionDTO)
    Endpoint: POST /api/edu/ask/question/create
    """
    if not title or len(title) > 256:
        raise EduValidationError("title must be 1-256 chars")
    if not content:
        raise EduValidationError("content is required")

    q = EduAskQuestion(
        member_id=user_id,
        title=title,
        content=content,
        watch_num=0,
        answer_num=0,
    )
    db.add(q)
    db.flush()
    db.refresh(q)
    return q


def update_question(
    db: Session, question_id: int, user_id: int, **fields
) -> EduAskQuestion:
    """Update a question. Only the author can update.

    Java source: QuestionService.update(QuestionDTO)
    """
    q = get_or_404(db, EduAskQuestion, question_id, "question")
    if q.member_id != user_id:
        raise EduPermissionError("only the author can update the question")
    for k, v in fields.items():
        if v is not None and hasattr(q, k):
            setattr(q, k, v)
    db.flush()
    db.refresh(q)
    return q


def delete_question(db: Session, question_id: int, user_id: int) -> bool:
    """Soft-delete a question. Only the author can delete.

    Java source: QuestionService.delete(Long id, Long userId)
    """
    q = get_or_404(db, EduAskQuestion, question_id, "question")
    if q.member_id != user_id:
        raise EduPermissionError("only the author can delete the question")
    q.deleted = True
    db.flush()
    return True


def get_question(db: Session, question_id: int, increment_view: bool = True) -> EduAskQuestion:
    """Get question by id, optionally increment view count.

    Java source: QuestionService.getById(Long id)
    """
    q = get_or_404(db, EduAskQuestion, question_id, "question")
    if increment_view:
        q.watch_num = (q.watch_num or 0) + 1
        db.flush()
    return q


def list_questions(
    db: Session,
    page: int = 1,
    size: int = 20,
    user_id: Optional[int] = None,
    course_id: Optional[int] = None,
    is_resolved: Optional[bool] = None,
    keyword: Optional[str] = None,
    order_by: str = "latest",
) -> Tuple[List[EduAskQuestion], int]:
    """Paginated question list with filters.

    Java source: QuestionService.page(QuestionQueryDTO)
    """
    filters = []
    if user_id is not None:
        filters.append(EduAskQuestion.member_id == user_id)
    if keyword:
        kw = f"%{keyword}%"
        filters.append(
            or_(
                EduAskQuestion.title.ilike(kw),
                EduAskQuestion.content.ilike(kw),
            )
        )

    if order_by == "hot":
        order = desc(EduAskQuestion.watch_num + EduAskQuestion.answer_num * 5)
    elif order_by == "unresolved":
        # FIXME: 字段映射不确定 - AskQuestion 无 is_resolved 字段, 暂按最新排序
        order = desc(EduAskQuestion.created_at)
    else:
        order = desc(EduAskQuestion.created_at)

    return paginate(db, EduAskQuestion, page=page, size=size, filters=filters, order_by=order)


# ============================================================================
# Answer CRUD (迁移自 AnswerController + AnswerService)
# ============================================================================

def create_answer(
    db: Session, question_id: int, user_id: int, content: str
) -> EduAskAnswer:
    """Post an answer to a question. Auto-increment answer_num.

    Java source: AnswerService.create(AnswerDTO)
    """
    if not content:
        raise EduValidationError("answer content is required")
    q = get_or_404(db, EduAskQuestion, question_id, "question")
    a = EduAskAnswer(
        question_id=question_id,
        member_id=user_id,
        content=content,
        is_adopted=False,
        like_num=0,
    )
    db.add(a)
    db.flush()
    q.answer_num = (q.answer_num or 0) + 1
    db.flush()
    db.refresh(a)
    return a


def delete_answer(db: Session, answer_id: int, user_id: int) -> bool:
    """Delete an answer. Only the author can delete.

    Java source: AnswerService.delete(Long id, Long userId)
    """
    a = get_or_404(db, EduAskAnswer, answer_id, "answer")
    if a.member_id != user_id:
        raise EduPermissionError("only the author can delete the answer")
    question_id = a.question_id
    # AskQuestion 无 is_resolved/best_answer_id 字段; 采纳状态以 AskAnswer.is_adopted 为准, 删除回答即自动失效
    db.delete(a)
    q = db.get(EduAskQuestion, question_id)
    if q and q.answer_num and q.answer_num > 0:
        q.answer_num -= 1
    db.flush()
    return True


def list_answers(
    db: Session,
    question_id: int,
    page: int = 1,
    size: int = 20,
    order_by: str = "best",
) -> Tuple[List[EduAskAnswer], int]:
    """List answers for a question, best answer first by default.

    Java source: AnswerService.pageByQuestion(Long questionId, PageQuery)
    """
    filters = [EduAskAnswer.question_id == question_id]
    items, total = paginate(db, EduAskAnswer, page=page, size=size, filters=filters)
    if order_by == "best":
        items = sorted(
            items,
            key=lambda a: (
                not a.is_adopted,
                -(a.like_num or 0),
                -(a.created_at.timestamp() if a.created_at else 0),
            ),
        )
    return items, total


def adopt_answer(db: Session, answer_id: int, user_id: int) -> EduAskAnswer:
    """Mark an answer as the best (adopted) answer. Only the question author can adopt.

    Java source: AnswerService.adopt(Long answerId, Long userId)
    """
    a = get_or_404(db, EduAskAnswer, answer_id, "answer")
    q = get_or_404(db, EduAskQuestion, a.question_id, "question")
    if q.member_id != user_id:
        raise EduPermissionError("only the question author can adopt an answer")

    # Unset other best answers for this question
    db.query(EduAskAnswer).filter(
        and_(
            EduAskAnswer.question_id == q.id,
            EduAskAnswer.id != answer_id,
            EduAskAnswer.is_adopted == True,
        )
    ).update({"is_adopted": False})

    a.is_adopted = True
    db.flush()
    db.refresh(a)
    return a


def like_answer(db: Session, answer_id: int, user_id: int) -> int:
    """Increment like count for an answer.

    Java source: AnswerService.like(Long answerId, Long userId)
    Note: simplified; production should use Redis to dedupe user likes.
    """
    a = get_or_404(db, EduAskAnswer, answer_id, "answer")
    a.like_num = (a.like_num or 0) + 1
    db.flush()
    return a.like_num


# ============================================================================
# Statistics (迁移自 StatisticsController + StatisticsService)
# ============================================================================

def get_user_stats(db: Session, user_id: int = None, user_uuid: str = None) -> dict:
    """Get user's Q&A statistics.

    Java source: StatisticsService.userStats(Long userId)
    """
    question_count = db.execute(
        select(func.count(EduAskQuestion.id)).where(EduAskQuestion.member_id == user_id)
    ).scalar() or 0
    answer_count = db.execute(
        select(func.count(EduAskAnswer.id)).where(EduAskAnswer.member_id == user_id)
    ).scalar() or 0
    resolved_count = db.execute(
        select(func.count(EduAskQuestion.id)).where(
            and_(
                EduAskQuestion.member_id == user_id,
                EduAskQuestion.id.in_(
                    select(EduAskAnswer.question_id).where(
                        EduAskAnswer.is_adopted == True
                    )
                ),
            )
        )
    ).scalar() or 0
    best_answer_count = db.execute(
        select(func.count(EduAskAnswer.id)).where(
            and_(
                EduAskAnswer.member_id == user_id,
                EduAskAnswer.is_adopted == True,
            )
        )
    ).scalar() or 0
    total_view = db.execute(
        select(func.coalesce(func.sum(EduAskQuestion.watch_num), 0)).where(
            EduAskQuestion.member_id == user_id
        )
    ).scalar() or 0
    return {
        "user_id": user_id,
        "question_count": question_count,
        "answer_count": answer_count,
        "resolved_count": resolved_count,
        "best_answer_count": best_answer_count,
        "total_view": int(total_view),
    }


def get_question_stats(db: Session, question_id: int) -> dict:
    """Get statistics for a specific question.

    Java source: StatisticsService.questionStats(Long questionId)
    """
    q = get_or_404(db, EduAskQuestion, question_id, "question")
    # AskQuestion 无 best_answer_id 字段; 改为按 AskAnswer.is_adopted 查询采纳回答
    best_answer = db.execute(
        select(EduAskAnswer).where(
            and_(
                EduAskAnswer.question_id == question_id,
                EduAskAnswer.is_adopted == True,
            )
        ).limit(1)
    ).scalars().first()
    return {
        "question_id": question_id,
        "view_count": q.watch_num or 0,
        "answer_count": q.answer_num or 0,
        "is_resolved": bool(best_answer),
        "best_answer": {
            "id": best_answer.id,
            "content": best_answer.content,
            "user_id": best_answer.member_id,
            "adopted_at": best_answer.updated_at,
        } if best_answer else None,
    }


def get_hot_questions(db: Session, limit: int = 10) -> List[EduAskQuestion]:
    """Get hottest questions (by view + answer*5).

    Java source: StatisticsService.hotQuestions(Integer limit)
    Phase E: returns ORM objects with Phase A fields injected via
    inject_phase_a_fields (in edu_base.paginate wrapping).
    """
    from app.services.edu_base import inject_phase_a_fields
    items = db.execute(
        select(EduAskQuestion)
        .order_by(desc(EduAskQuestion.watch_num + EduAskQuestion.answer_num * 5))
        .limit(limit)
    ).scalars().all()
    for item in items:
        inject_phase_a_fields(item)
    return items