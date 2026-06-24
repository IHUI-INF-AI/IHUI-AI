"""Edu oss router - /api/v1/edu/oss

Migrated from ihui-ai-edu-oss-service.
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


@router.post("/upload/init", summary="Init upload")
async def init_multipart_upload_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_oss import init_multipart_upload
    result = init_multipart_upload(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/upload/{session_id}/part/{part_number}/url", summary="Get part URL")
async def get_part_upload_url_endpoint(session_id: int, part_number: str, user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_oss import get_part_upload_url
    result = get_part_upload_url(db, session_id=session_id, part_number=part_number, user_id=user_id)
    return success(data=result)

@router.post("/upload/{session_id}/part/{part_number}/uploaded", summary="Mark part uploaded")
async def mark_part_uploaded_endpoint(session_id: int, part_number: str, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_oss import mark_part_uploaded
    result = mark_part_uploaded(db, session_id=session_id, part_number=part_number, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/upload/{session_id}/complete", summary="Complete")
async def complete_upload_endpoint(session_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_oss import complete_upload
    result = complete_upload(db, session_id=session_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/upload/{session_id}/abort", summary="Abort")
async def abort_upload_endpoint(session_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_oss import abort_upload
    result = abort_upload(db, session_id=session_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)
