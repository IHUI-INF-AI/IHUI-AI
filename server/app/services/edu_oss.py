"""edu_oss service - Object storage (migrated from ihui-ai-edu-oss-service)."""

from __future__ import annotations
import secrets
from datetime import datetime
from sqlalchemy import select
from app.models.edu_models import EduOssFile, EduOssUploadSession
from app.services.edu_base import EduNotFoundError, EduValidationError


def init_multipart_upload(
    db: Session, uploader_id: int, file_name: str, file_size: int,
    content_type: Optional[str] = None, total_parts: int = 1,
) -> EduOssUploadSession:
    """Initialize a multipart upload session."""
    if total_parts < 1 or total_parts > 10000:
        raise EduValidationError("total_parts must be 1-10000")
    session_id = secrets.token_urlsafe(24)
    file_key = f"edu/{datetime.now().strftime('%Y/%m/%d')}/{secrets.token_hex(8)}/{file_name}"
    s = EduOssUploadSession(
        session_id=session_id, file_key=file_key, uploader_id=uploader_id,
        total_parts=total_parts, uploaded_parts=0, status="active",
    )
    db.add(s)
    # Create file record
    f = EduOssFile(
        file_key=file_key, file_name=file_name, bucket="edu-bucket",
        content_type=content_type, size_bytes=file_size,
        uploader_id=uploader_id,
    )
    db.add(f)
    db.flush()
    db.refresh(s)
    return s


def get_part_upload_url(db: Session, session_id: str, part_number: int) -> str:
    """Get pre-signed URL for uploading a specific part."""
    s = db.execute(
        select(EduOssUploadSession).where(EduOssUploadSession.session_id == session_id)
    ).scalar_one_or_none()
    if not s:
        raise EduNotFoundError("upload_session", 0)
    if s.status != "active":
        raise EduValidationError("upload session not active")
    if part_number < 1 or part_number > s.total_parts:
        raise EduValidationError("invalid part_number")
    # In production: generate pre-signed URL from S3/MinIO SDK
    return f"https://oss.example.com/{s.file_key}?partNumber={part_number}&uploadId={s.session_id}"


def mark_part_uploaded(db: Session, session_id: str, part_number: int) -> EduOssUploadSession:
    """Mark a part as uploaded."""
    s = db.execute(
        select(EduOssUploadSession).where(EduOssUploadSession.session_id == session_id)
    ).scalar_one_or_none()
    if not s:
        raise EduNotFoundError("upload_session", 0)
    s.uploaded_parts = (s.uploaded_parts or 0) + 1
    db.flush()
    db.refresh(s)
    return s


def complete_upload(db: Session, session_id: str) -> EduOssUploadSession:
    """Mark upload session as completed."""
    s = db.execute(
        select(EduOssUploadSession).where(EduOssUploadSession.session_id == session_id)
    ).scalar_one_or_none()
    if not s:
        raise EduNotFoundError("upload_session", 0)
    if s.uploaded_parts < s.total_parts:
        raise EduValidationError(f"only {s.uploaded_parts}/{s.total_parts} parts uploaded")
    s.status = "completed"
    db.flush()
    db.refresh(s)
    return s


def abort_upload(db: Session, session_id: str) -> EduOssUploadSession:
    s = db.execute(
        select(EduOssUploadSession).where(EduOssUploadSession.session_id == session_id)
    ).scalar_one_or_none()
    if not s:
        raise EduNotFoundError("upload_session", 0)
    s.status = "aborted"
    db.flush()
    db.refresh(s)
    return s
