import hashlib
import os
import re
import shutil
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.security import require_login
from app.services.audit_service import log_action
from app.services.database_service import (
    Session,
    ShareCreate,
    ShareService,
    UploadedFileCreate,
    UploadedFileService,
    UploadRecordCreate,
    UploadService,
    get_db,
)
from app.services.storage_service import FileStorageService
from app.utils.datetime_helper import utcnow

router = APIRouter()

UPLOAD_DIR = "uploads"
CHUNKS_DIR = "uploads/chunks"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CHUNKS_DIR, exist_ok=True)

storage_service = FileStorageService(UPLOAD_DIR)

# 安全 ID 校验: 仅允许字母/数字/下划线/连字符, 长度 1-64, 防止路径穿越 (../) 和绝对路径
_SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _validate_safe_id(value: str | None, name: str = "id") -> str:
    """校验上传/文件 ID 只含安全字符, 防止路径穿越攻击."""
    if not value or not _SAFE_ID_RE.match(value):
        raise HTTPException(status_code=400, detail=f"非法 {name}: {value!r}")
    return value


def _validate_chunk_index(idx: int) -> int:
    """校验分片索引为非负整数."""
    if not isinstance(idx, int) or idx < 0:
        raise HTTPException(status_code=400, detail=f"非法分片索引: {idx}")
    return idx


class UploadInit(BaseModel):
    uploadId: str  # noqa: 5
    fileId: str  # noqa: 5
    fileName: str  # noqa: 5
    fileSize: int  # noqa: 5
    totalChunks: int  # noqa: 5
    userId: str | None = None  # noqa: 5


class ChunkUpload(BaseModel):
    uploadId: str  # noqa: 5
    chunkIndex: int  # noqa: 5


class ShareCreateRequest(BaseModel):
    fileId: str  # noqa: 5
    password: str | None = None
    maxDownloads: int | None = None  # noqa: 5
    expiresIn: int | None = None  # noqa: 5


@router.post("/init")
async def init_upload(data: UploadInit, db: Session = Depends(get_db), user_uuid: str = Depends(require_login)):
    _validate_safe_id(data.uploadId, "uploadId")
    _validate_safe_id(data.fileId, "fileId")
    upload_dir = os.path.join(CHUNKS_DIR, data.uploadId)
    os.makedirs(upload_dir, exist_ok=True)

    upload_data = UploadRecordCreate(
        upload_id=data.uploadId,
        file_id=data.fileId,
        filename=data.fileName,
        file_size=data.fileSize,
        total_chunks=data.totalChunks,
        user_id=user_uuid
    )
    UploadService.create_upload(db, upload_data)

    return {"success": True, "uploadId": data.uploadId}


@router.post("/chunk")
async def upload_chunk(
    uploadId: str = Form(...),  # noqa: 5
    chunkIndex: int = Form(...),  # noqa: 5
    chunk: UploadFile = File(...),
    user_uuid: str = Depends(require_login),
):
    _validate_safe_id(uploadId, "uploadId")
    _validate_chunk_index(chunkIndex)
    upload_dir = os.path.join(CHUNKS_DIR, uploadId)
    if not os.path.exists(upload_dir):
        raise HTTPException(status_code=404, detail="Upload session not found")

    chunk_path = os.path.join(upload_dir, f"chunk_{chunkIndex}")
    content = await chunk.read()
    with open(chunk_path, "wb") as f:
        f.write(content)

    return {"success": True, "chunkIndex": chunkIndex}


@router.post("/chunk/confirm")
async def confirm_chunk(
    uploadId: str = Form(...),  # noqa: 5
    chunkIndex: int = Form(...),  # noqa: 5
    db: Session = Depends(get_db),
    user_uuid: str = Depends(require_login)
):
    UploadService.update_upload_chunks(db, uploadId, chunkIndex)
    return {"success": True}


@router.post("/complete")
async def complete_upload(
    request: Request,
    uploadId: str = Form(...),  # noqa: 5
    fileName: str = Form(...),  # noqa: 5
    db: Session = Depends(get_db),
    user_uuid: str = Depends(require_login),
):
    _validate_safe_id(uploadId, "uploadId")
    upload_record = UploadService.get_upload(db, uploadId)
    if not upload_record:
        raise HTTPException(status_code=404, detail="Upload session not found")

    upload_dir = os.path.join(CHUNKS_DIR, uploadId)
    if not os.path.exists(upload_dir):
        raise HTTPException(status_code=404, detail="Upload chunks not found")

    file_id = upload_record.file_id
    _validate_safe_id(file_id, "fileId")
    file_path = os.path.join(UPLOAD_DIR, file_id)

    with open(file_path, "wb") as outfile:
        for i in range(upload_record.total_chunks):
            chunk_path = os.path.join(upload_dir, f"chunk_{i}")
            if not os.path.exists(chunk_path):
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing chunk {i}"
                )
            with open(chunk_path, "rb") as infile:
                outfile.write(infile.read())

    shutil.rmtree(upload_dir)

    file_size = os.path.getsize(file_path)
    mime_type = _get_mime_type(fileName)

    file_data = UploadedFileCreate(
        file_id=file_id,
        filename=os.path.basename(file_path),
        original_name=fileName,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        user_id=upload_record.user_id,
        upload_id=uploadId
    )
    UploadedFileService.create(db, file_data)

    UploadService.complete_upload(db, uploadId)

    log_action(
        action="file_upload",
        user_id=upload_record.user_id,
        resource_type="file",
        resource_id=file_id,
        details=f"Uploaded file: {fileName}, size: {file_size} bytes",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")
    )

    return {
        "success": True,
        "fileId": file_id,
        "fileName": fileName,
        "fileSize": file_size
    }


@router.post("/single")
async def upload_single(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_uuid: str = Depends(require_login),
):
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, file_id)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    file_size = os.path.getsize(file_path)
    mime_type = file.content_type or _get_mime_type(file.filename or "")

    file_data = UploadedFileCreate(
        file_id=file_id,
        filename=os.path.basename(file_path),
        original_name=file.filename or file_id,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        user_id=user_uuid
    )
    UploadedFileService.create(db, file_data)

    log_action(
        action="file_upload",
        user_id=user_uuid,
        resource_type="file",
        resource_id=file_id,
        details=f"Uploaded file: {file.filename}, size: {file_size} bytes",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")
    )

    return {
        "success": True,
        "fileId": file_id,
        "fileName": file.filename,
        "fileSize": file_size
    }


@router.get("/files")
async def list_files(
    userId: str | None = Query(None),  # noqa: 5
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user_uuid: str = Depends(require_login)
):
    files = UploadedFileService.get_all(db, userId, limit, offset)
    total = UploadedFileService.count(db, userId)

    return {
        "success": True,
        "files": [
            {
                "id": f.file_id,
                "name": f.original_name,
                "size": f.file_size,
                "mimeType": f.mime_type,
                "createdAt": f.created_at.isoformat() if f.created_at else None
            }
            for f in files
        ],
        "total": total
    }


@router.get("/file/{file_id}")
async def get_file(file_id: str, request: Request, db: Session = Depends(get_db), user_uuid: str = Depends(require_login)):
    _validate_safe_id(file_id, "file_id")
    record = UploadedFileService.get_by_file_id(db, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    if not os.path.exists(record.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    log_action(
        action="file_download",
        user_id=user_uuid,
        resource_type="file",
        resource_id=file_id,
        details=f"Downloaded file: {record.original_name}",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")
    )

    return FileResponse(
        record.file_path,
        filename=record.original_name,
        media_type=record.mime_type
    )


@router.delete("/file/{file_id}")
async def delete_file(file_id: str, request: Request, db: Session = Depends(get_db), user_uuid: str = Depends(require_login)):
    _validate_safe_id(file_id, "file_id")
    record = UploadedFileService.get_by_file_id(db, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    file_name = record.original_name

    if os.path.exists(record.file_path):
        os.remove(record.file_path)

    UploadedFileService.delete(db, file_id)

    log_action(
        action="file_delete",
        user_id=user_uuid,
        resource_type="file",
        resource_id=file_id,
        details=f"Deleted file: {file_name}",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")
    )

    return {"success": True}


@router.post("/share")
async def create_share(
    data: ShareCreateRequest,
    db: Session = Depends(get_db),
    user_uuid: str = Depends(require_login)
):
    record = UploadedFileService.get_by_file_id(db, data.fileId)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    share_id = hashlib.md5(f"{data.fileId}{utcnow().isoformat()}".encode()).hexdigest()[:12]

    expires_at = None
    if data.expiresIn:
        expires_at = utcnow() + timedelta(hours=data.expiresIn)

    share_data = ShareCreate(
        share_id=share_id,
        file_id=data.fileId,
        filename=record.original_name,
        file_url=f"/api/upload/share/{share_id}/download",
        password=data.password,
        max_downloads=data.maxDownloads,
        expires_at=expires_at,
        created_by=record.user_id
    )
    ShareService.create(db, share_data)

    return {
        "success": True,
        "shareId": share_id,
        "shareUrl": f"/api/upload/share/{share_id}/download"
    }


@router.get("/share/{share_id}")
async def get_share_info(share_id: str, db: Session = Depends(get_db)):
    record = ShareService.get_active(db, share_id)
    if not record:
        raise HTTPException(status_code=404, detail="Share not found or expired")

    return {
        "success": True,
        "fileName": record.filename,
        "requiresPassword": bool(record.password)
    }


@router.post("/share/{share_id}/download")
async def download_shared_file(
    share_id: str,
    password: str | None = Form(None),
    db: Session = Depends(get_db)
):
    record = ShareService.get_active(db, share_id)
    if not record:
        raise HTTPException(status_code=404, detail="Share not found or expired")

    if record.password and record.password != password:
        raise HTTPException(status_code=403, detail="Invalid password")

    file_record = UploadedFileService.get_by_file_id(db, record.file_id)
    if not file_record or not os.path.exists(file_record.file_path):
        raise HTTPException(status_code=404, detail="File not found")

    ShareService.increment_downloads(db, share_id)

    return FileResponse(
        file_record.file_path,
        filename=file_record.original_name,
        media_type=file_record.mime_type
    )


@router.delete("/share/{share_id}")
async def delete_share(share_id: str, db: Session = Depends(get_db), user_uuid: str = Depends(require_login)):
    ShareService.delete(db, share_id)
    return {"success": True}


@router.get("/shares")
async def list_shares(
    userId: str | None = Query(None),  # noqa: 5
    db: Session = Depends(get_db),
    user_uuid: str = Depends(require_login)
):
    if userId:
        shares = ShareService.get_by_user(db, userId)
    else:
        from app.services.database_service import ShareRecord
        shares = db.query(ShareRecord).order_by(ShareRecord.created_at.desc()).limit(100).all()

    return {
        "success": True,
        "shares": [
            {
                "id": s.share_id,
                "fileId": s.file_id,
                "fileName": s.filename,
                "downloads": s.current_downloads,
                "maxDownloads": s.max_downloads,
                "expiresAt": s.expires_at.isoformat() if s.expires_at else None,
                "createdAt": s.created_at.isoformat() if s.created_at else None
            }
            for s in shares
        ]
    }


def _get_mime_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    mime_types = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.txt': 'text/plain',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.mp3': 'audio/mpeg',
        '.zip': 'application/zip',
        '.rar': 'application/x-rar-compressed'
    }
    return mime_types.get(ext, 'application/octet-stream')
