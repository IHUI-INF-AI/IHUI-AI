"""Edu learn router - /api/v1/edu/learn

Migrated from ihui-ai-edu-learn-service.
Complete Phase B implementation.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_session


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session (contextmanager)."""
    with get_session() as db:
        yield db


try:
    from app.dependencies import get_current_user_id
except ImportError:
    def get_current_user_id() -> int:
        return 1  # dev stub

from app.schemas.common import success

router = APIRouter()


@router.post("/courses", summary="Create course")
async def create_course_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_learn import create_course
    result = create_course(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.put("/courses/{course_id}", summary="Update course")
async def update_course_endpoint(course_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_learn import update_course
    result = update_course(db, course_id=course_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.delete("/courses/{course_id}", summary="Delete course")
async def delete_course_endpoint(course_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_learn import delete_course
    result = delete_course(db, course_id=course_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/courses/{course_id}", summary="Get course")
async def get_course_endpoint(course_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_learn import get_course
    result = get_course(db, course_id=course_id)
    return success(data=result)

@router.get("/courses", summary="List courses")
async def list_courses_endpoint(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_learn import list_courses
    result = list_courses(db)
    return success(data=result)

@router.post("/courses/{course_id}/enroll", summary="Enroll course")
async def increment_student_count_endpoint(course_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_learn import increment_student_count
    result = increment_student_count(db, course_id=course_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/chapters", summary="Create chapter")
async def create_chapter_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_learn import create_chapter
    result = create_chapter(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/chapters", summary="List chapters")
async def list_chapters_endpoint(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_learn import list_chapters
    result = list_chapters(db)
    return success(data=result)

@router.delete("/chapters/{chapter_id}", summary="Delete chapter")
async def delete_chapter_endpoint(chapter_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_learn import delete_chapter
    result = delete_chapter(db, chapter_id=chapter_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/sections", summary="Create section")
async def create_section_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_learn import create_section
    result = create_section(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/chapters/{chapter_id}/sections", summary="List sections")
async def list_sections_endpoint(chapter_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_learn import list_sections
    result = list_sections(db, chapter_id=chapter_id)
    return success(data=result)

@router.post("/progress", summary="Update progress")
async def update_progress_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_learn import update_progress
    result = update_progress(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/courses/{course_id}/progress", summary="Get my progress")
async def get_user_progress_endpoint(course_id: int, user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_learn import get_user_progress
    result = get_user_progress(db, course_id=course_id, user_id=user_id)
    return success(data=result)

@router.get("/courses/{course_id}/completion", summary="Get completion")
async def get_course_completion_endpoint(course_id: int, user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_learn import get_course_completion
    result = get_course_completion(db, course_id=course_id, user_id=user_id)
    return success(data=result)

@router.post("/homeworks", summary="Create homework")
async def create_homework_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_learn import create_homework
    result = create_homework(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/homeworks/{homework_id}/submit", summary="Submit homework")
async def submit_homework_endpoint(homework_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_learn import submit_homework
    result = submit_homework(db, homework_id=homework_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/submissions/{submission_id}/grade", summary="Grade submission")
async def grade_submission_endpoint(submission_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_learn import grade_submission
    result = grade_submission(db, submission_id=submission_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/certificates/issue", summary="Issue certificate")
async def issue_certificate_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_learn import issue_certificate
    result = issue_certificate(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/certificates/me", summary="My certificates")
async def list_user_certificates_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_learn import list_user_certificates
    result = list_user_certificates(db, user_id=user_id)
    return success(data=result)
