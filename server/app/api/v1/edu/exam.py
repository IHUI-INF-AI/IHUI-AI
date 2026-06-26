"""Edu exam router - /api/v1/edu/exam

Migrated from ihui-ai-edu-exam-service.
Complete Phase B implementation.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_session


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session (contextmanager)."""
    with get_session() as db:
        yield db


from app.core.current_user import get_current_user_id

from app.schemas.common import success

router = APIRouter()


@router.post("/papers", summary="Create paper")
def create_paper_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_exam import create_paper
    result = create_paper(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.put("/papers/{paper_id}/publish", summary="Publish paper")
def publish_paper_endpoint(paper_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_exam import publish_paper
    result = publish_paper(db, paper_id=paper_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/papers/{paper_id}", summary="Get paper")
def get_paper_endpoint(paper_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_exam import get_paper
    result = get_paper(db, paper_id=paper_id)
    return success(data=result)

@router.get("/papers", summary="List papers")
def list_papers_endpoint(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_exam import list_papers
    result = list_papers(db, page=page, size=size)
    return success(data=result)

@router.post("/questions", summary="Add question")
def add_question_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_exam import add_question
    result = add_question(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/papers/{paper_id}/questions", summary="List questions")
def list_questions_endpoint(paper_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_exam import list_questions
    result = list_questions(db, paper_id=paper_id)
    return success(data=result)

@router.post("/records", summary="Start exam")
def start_exam_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_exam import start_exam
    result = start_exam(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/records/{record_id}/submit", summary="Submit exam")
def submit_exam_endpoint(record_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_exam import submit_exam
    result = submit_exam(db, record_id=record_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/records/{record_id}", summary="Get record")
def get_exam_record_endpoint(record_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_exam import get_exam_record
    result = get_exam_record(db, record_id=record_id)
    return success(data=result)

@router.get("/records/me", summary="My records")
def list_user_exams_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_exam import list_user_exams
    result = list_user_exams(db, user_id=user_id, page=page, size=size)
    return success(data=result)

@router.post("/wrong-book/{question_id}", summary="Add to wrong book")
def add_wrong_question_endpoint(question_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_exam import add_wrong_question
    result = add_wrong_question(db, question_id=question_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/wrong-book/{wrong_book_id}/mastered", summary="Mark mastered")
def mark_mastered_endpoint(wrong_book_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_exam import mark_mastered
    result = mark_mastered(db, wrong_book_id=wrong_book_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/wrong-book/me", summary="My wrong book")
def list_wrong_book_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_exam import list_wrong_book
    result = list_wrong_book(db, user_id=user_id, page=page, size=size)
    return success(data=result)
