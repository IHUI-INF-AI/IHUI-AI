"""Edu Edu-Ask router - /api/v1/edu/ask

Q&A platform endpoints (migrated from ihui-ai-edu-ask-service).
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_session


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session."""
    with get_session() as db:
        yield db


try:
    from app.dependencies import get_current_user_id
except ImportError:
    def get_current_user_id() -> int:
        return 1  # dev stub

from app.schemas.common import success

router = APIRouter()


@router.post("/questions", summary="Create a new Q&A question")
def create_question(
    payload: dict,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(_get_db),
):
    from app.services.edu_ask import create_question
    q = create_question(
        db,
        user_id=user_id,
        title=payload.get("title"),
        content=payload.get("content"),
        course_id=payload.get("course_id"),
        tags=payload.get("tags"),
    )
    return success(data={
        "id": q.id,
        "user_id": q.user_id,
        "title": q.title,
        "content": q.content,
        "course_id": q.course_id,
        "tags": q.tags,
        "view_count": q.view_count,
        "answer_count": q.answer_count,
        "is_resolved": q.is_resolved,
        "created_at": q.created_at,
    })


@router.get("/questions", summary="List Q&A questions (paginated, filterable)")
def list_questions(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    user_id: Optional[int] = Query(None),
    course_id: Optional[int] = Query(None),
    is_resolved: Optional[bool] = Query(None),
    keyword: Optional[str] = Query(None),
    order_by: str = Query("latest", pattern="^(latest|hot|unresolved)$"),
    db: Session = Depends(_get_db),
):
    from app.services.edu_ask import list_questions
    items, total = list_questions(
        db, page=page, size=size, user_id=user_id, course_id=course_id,
        is_resolved=is_resolved, keyword=keyword, order_by=order_by,
    )
    return success(data={
        "items": [
            {
                "id": q.id,
                "user_id": q.user_id,
                "title": q.title,
                "course_id": q.course_id,
                "tags": q.tags,
                "view_count": q.view_count,
                "answer_count": q.answer_count,
                "is_resolved": q.is_resolved,
                "created_at": q.created_at,
            } for q in items
        ],
        "total": total,
        "page": page,
        "size": size,
    })


@router.get("/questions/hot", summary="Get hot questions")
def hot_questions(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(_get_db),
):
    from app.services.edu_ask import get_hot_questions
    items = get_hot_questions(db, limit=limit)
    return success(data={
        "items": [
            {
                "id": q.id,
                "title": q.title,
                "view_count": q.view_count,
                "answer_count": q.answer_count,
                "is_resolved": q.is_resolved,
            } for q in items
        ],
    })


@router.get("/questions/{question_id}", summary="Get question detail")
def get_question(question_id: int, db: Session = Depends(_get_db)):
    from app.services.edu_ask import get_question
    q = get_question(db, question_id, increment_view=True)
    return success(data={
        "id": q.id,
        "user_id": q.user_id,
        "title": q.title,
        "content": q.content,
        "course_id": q.course_id,
        "tags": q.tags,
        "view_count": q.view_count,
        "answer_count": q.answer_count,
        "is_resolved": q.is_resolved,
        "best_answer_id": q.best_answer_id,
        "created_at": q.created_at,
        "updated_at": q.updated_at,
    })


@router.put("/questions/{question_id}", summary="Update question (author only)")
def update_question(
    question_id: int,
    payload: dict,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(_get_db),
):
    from app.services.edu_ask import update_question
    q = update_question(db, question_id, user_id=user_id, **payload)
    return success(data={"id": q.id, "title": q.title, "updated_at": q.updated_at})


@router.delete("/questions/{question_id}", summary="Delete question (author only)")
def delete_question(
    question_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(_get_db),
):
    from app.services.edu_ask import delete_question
    ok = delete_question(db, question_id, user_id=user_id)
    return success(data={"deleted": ok})


@router.get("/questions/{question_id}/stats", summary="Get question statistics")
def get_question_stats(question_id: int, db: Session = Depends(_get_db)):
    from app.services.edu_ask import get_question_stats
    return success(data=get_question_stats(db, question_id))


@router.get("/users/{user_id}/stats", summary="Get user's Q&A statistics")
def get_user_stats(user_id: int, db: Session = Depends(_get_db)):
    from app.services.edu_ask import get_user_stats
    return success(data=get_user_stats(db, user_id))


@router.post("/questions/{question_id}/answers", summary="Post answer to a question")
def create_answer(
    question_id: int,
    payload: dict,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(_get_db),
):
    from app.services.edu_ask import create_answer
    a = create_answer(
        db, question_id=question_id, user_id=user_id, content=payload.get("content")
    )
    return success(data={
        "id": a.id,
        "question_id": a.question_id,
        "user_id": a.user_id,
        "content": a.content,
        "is_best": a.is_best,
        "like_count": a.like_count,
        "created_at": a.created_at,
    })


@router.get("/questions/{question_id}/answers", summary="List answers for a question")
def list_answers(
    question_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    order_by: str = Query("best", pattern="^(best|latest)$"),
    db: Session = Depends(_get_db),
):
    from app.services.edu_ask import list_answers
    items, total = list_answers(db, question_id, page=page, size=size, order_by=order_by)
    return success(data={
        "items": [
            {
                "id": a.id,
                "question_id": a.question_id,
                "user_id": a.user_id,
                "content": a.content,
                "is_best": a.is_best,
                "like_count": a.like_count,
                "adopted_at": a.adopted_at,
                "created_at": a.created_at,
            } for a in items
        ],
        "total": total,
        "page": page,
        "size": size,
    })


@router.delete("/answers/{answer_id}", summary="Delete answer (author only)")
def delete_answer(
    answer_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(_get_db),
):
    from app.services.edu_ask import delete_answer
    ok = delete_answer(db, answer_id, user_id=user_id)
    return success(data={"deleted": ok})


@router.post("/answers/{answer_id}/adopt", summary="Adopt answer as best (question author only)")
def adopt_answer(
    answer_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(_get_db),
):
    from app.services.edu_ask import adopt_answer
    a = adopt_answer(db, answer_id, user_id=user_id)
    return success(data={
        "id": a.id,
        "is_best": a.is_best,
        "adopted_at": a.adopted_at,
    })


@router.post("/answers/{answer_id}/like", summary="Like an answer")
def like_answer(
    answer_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(_get_db),
):
    from app.services.edu_ask import like_answer
    new_count = like_answer(db, answer_id, user_id=user_id)
    return success(data={"like_count": new_count})
