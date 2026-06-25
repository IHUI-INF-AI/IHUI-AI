"""edu_oss service - Object storage (migrated from ihui-ai-edu-oss-service).

2026-06-25 字段对齐修复 (创建缺失模型):
  - 原 edu_models.py 通过 try/except ImportError 导入 SysFile/SysUploadSession,
    但 sys_models.py 中并不存在这两个类, 导致 EduOssFile/EduOssUploadSession 为 None.
  - 本次在 sys_models.py 中补全真实模型后, 将本模块所有字段对齐到新模型:
      * file_key/file_name/bucket/content_type/size_bytes/uploader_id 直接保留
      * status 由字符串 ("active"/"completed"/"aborted") 改为 Integer (0/1/2)
      * session_id/total_parts/uploaded_parts 直接保留
  - 补充 import 验证要求的函数: upload_part/complete_multipart_upload/
    get_upload_status/delete_file/list_files (基于现有逻辑实现, 不改签名风格).
"""

from __future__ import annotations

import secrets
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.edu_models import EduOssFile, EduOssUploadSession
from app.services.edu_base import EduNotFoundError, EduValidationError


def init_multipart_upload(
    db: Session, uploader_id: int, file_name: str, file_size: int,
    content_type: Optional[str] = None, total_parts: int = 1,
) -> EduOssUploadSession:
    """Initialize a multipart upload session.

    2026-06-25 字段对齐修复 (创建缺失模型):
      - session.status 由字符串 "active" 改为 Integer 0 (进行中)
      - file 记录显式设置 status=0 (上传中), file_name 对齐到新模型字段
    """
    if total_parts < 1 or total_parts > 10000:
        raise EduValidationError("total_parts must be 1-10000")
    session_id = secrets.token_urlsafe(24)
    file_key = f"edu/{datetime.now().strftime('%Y/%m/%d')}/{secrets.token_hex(8)}/{file_name}"
    s = EduOssUploadSession(
        session_id=session_id, file_key=file_key, file_name=file_name,
        uploader_id=uploader_id, total_parts=total_parts,
        uploaded_parts=0, status=0,
    )
    db.add(s)
    # Create file record
    f = EduOssFile(
        file_key=file_key, file_name=file_name, bucket="edu-bucket",
        content_type=content_type, size_bytes=file_size,
        uploader_id=uploader_id, status=0,
    )
    db.add(f)
    db.flush()
    db.refresh(s)
    return s


def get_part_upload_url(db: Session, session_id: str, part_number: int) -> str:
    """Get pre-signed URL for uploading a specific part.

    2026-06-25 字段对齐修复 (创建缺失模型):
      - status 判断由字符串 "active" 改为 Integer 0 (进行中)
    """
    s = db.execute(
        select(EduOssUploadSession).where(EduOssUploadSession.session_id == session_id)
    ).scalar_one_or_none()
    if not s:
        raise EduNotFoundError("upload_session", 0)
    if s.status != 0:
        raise EduValidationError("upload session not active")
    if part_number < 1 or part_number > s.total_parts:
        raise EduValidationError("invalid part_number")
    # In production: generate pre-signed URL from S3/MinIO SDK
    return f"https://oss.example.com/{s.file_key}?partNumber={part_number}&uploadId={s.session_id}"


def mark_part_uploaded(db: Session, session_id: str, part_number: int) -> EduOssUploadSession:
    """Mark a part as uploaded.

    2026-06-25 字段对齐修复 (创建缺失模型):
      - uploaded_parts 字段直接保留 (Integer, default 0)
    """
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
    """Mark upload session as completed.

    2026-06-25 字段对齐修复 (创建缺失模型):
      - session.status 由字符串 "completed" 改为 Integer 1 (已完成)
      - 同步更新关联 file.status 为 1 (已完成)
    """
    s = db.execute(
        select(EduOssUploadSession).where(EduOssUploadSession.session_id == session_id)
    ).scalar_one_or_none()
    if not s:
        raise EduNotFoundError("upload_session", 0)
    if s.uploaded_parts < s.total_parts:
        raise EduValidationError(f"only {s.uploaded_parts}/{s.total_parts} parts uploaded")
    s.status = 1
    # 同步更新关联文件状态为已完成
    f = db.execute(
        select(EduOssFile).where(EduOssFile.file_key == s.file_key)
    ).scalar_one_or_none()
    if f is not None:
        f.status = 1
    db.flush()
    db.refresh(s)
    return s


def abort_upload(db: Session, session_id: str) -> EduOssUploadSession:
    """Abort an upload session.

    2026-06-25 字段对齐修复 (创建缺失模型):
      - session.status 由字符串 "aborted" 改为 Integer 2 (已取消)
      - 同步更新关联 file.status 为 2 (已失败)
    """
    s = db.execute(
        select(EduOssUploadSession).where(EduOssUploadSession.session_id == session_id)
    ).scalar_one_or_none()
    if not s:
        raise EduNotFoundError("upload_session", 0)
    s.status = 2
    # 同步更新关联文件状态为已失败
    f = db.execute(
        select(EduOssFile).where(EduOssFile.file_key == s.file_key)
    ).scalar_one_or_none()
    if f is not None:
        f.status = 2
    db.flush()
    db.refresh(s)
    return s


def upload_part(db: Session, session_id: str, part_number: int) -> str:
    """Upload a single part: return pre-signed URL and mark part as uploaded.

    2026-06-25 字段对齐修复 (创建缺失模型):
      - 组合 get_part_upload_url + mark_part_uploaded, 字段对齐 status Integer.
    """
    url = get_part_upload_url(db, session_id, part_number)
    mark_part_uploaded(db, session_id, part_number)
    return url


def complete_multipart_upload(db: Session, session_id: str) -> EduOssUploadSession:
    """Complete a multipart upload session (alias of complete_upload).

    2026-06-25 字段对齐修复 (创建缺失模型):
      - 委托 complete_upload, 保持 status Integer 语义.
    """
    return complete_upload(db, session_id)


def get_upload_status(db: Session, session_id: str) -> EduOssUploadSession:
    """Get the status of an upload session.

    2026-06-25 字段对齐修复 (创建缺失模型):
      - 字段对齐: session_id/total_parts/uploaded_parts/status 直接保留.
    """
    s = db.execute(
        select(EduOssUploadSession).where(EduOssUploadSession.session_id == session_id)
    ).scalar_one_or_none()
    if not s:
        raise EduNotFoundError("upload_session", 0)
    return s


def delete_file(db: Session, file_key: str) -> bool:
    """Delete a file record by file_key.

    2026-06-25 字段对齐修复 (创建缺失模型):
      - 字段对齐: file_key 直接保留.
    """
    f = db.execute(
        select(EduOssFile).where(EduOssFile.file_key == file_key)
    ).scalar_one_or_none()
    if not f:
        raise EduNotFoundError("file", 0)
    db.delete(f)
    db.flush()
    return True


def list_files(
    db: Session, uploader_id: Optional[int] = None, limit: int = 50,
) -> list:
    """List uploaded files.

    2026-06-25 字段对齐修复 (创建缺失模型):
      - 字段对齐: uploader_id 直接保留, status Integer.
    """
    stmt = select(EduOssFile)
    if uploader_id is not None:
        stmt = stmt.where(EduOssFile.uploader_id == uploader_id)
    stmt = stmt.limit(limit)
    return list(db.execute(stmt).scalars().all())
