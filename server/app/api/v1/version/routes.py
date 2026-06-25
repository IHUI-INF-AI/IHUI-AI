import hashlib
import os
import shutil
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.services.database_service import FileVersionService, Session, UploadedFileService, get_db
from app.services.diff_service import FileDiffService
from app.security import require_login, require_role

router = APIRouter()

UPLOAD_DIR = "uploads"
VERSIONS_DIR = "uploads/versions"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(VERSIONS_DIR, exist_ok=True)


class VersionCreate(BaseModel):
    file_id: str
    change_summary: str | None = None
    changed_by: str | None = None


class VersionInfo(BaseModel):
    version_id: str
    file_id: str
    version_number: int
    file_size: int
    checksum: str
    change_summary: str | None
    changed_by: str | None
    is_current: bool
    created_at: str


@router.post("/version/create")
async def create_version(
    file_id: str = Form(...),
    file: UploadFile = File(...),
    change_summary: str | None = Form(None),
    changed_by: str | None = Form(None),
    db: Session = Depends(get_db),
    _: str = Depends(require_login)
):
    file_record = UploadedFileService.get_by_file_id(db, file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    content = await file.read()
    checksum = hashlib.sha256(content).hexdigest()

    version_id = f"{file_id}_v{uuid.uuid4().hex[:8]}"
    version_path = os.path.join(VERSIONS_DIR, version_id)

    with open(version_path, "wb") as f:
        f.write(content)

    version = FileVersionService.create_version(
        db, file_id, version_path, len(content), checksum, changed_by, change_summary
    )

    return {
        "success": True,
        "version": {
            "version_id": version.version_id,
            "version_number": version.version_number,
            "file_size": version.file_size,
            "checksum": version.checksum,
            "is_current": version.is_current,
            "created_at": version.created_at.isoformat()
        }
    }


@router.get("/version/list/{file_id}")
def list_versions(file_id: str, db: Session = Depends(get_db), _: str = Depends(require_login)):
    versions = FileVersionService.get_versions(db, file_id)

    return {
        "success": True,
        "versions": [
            {
                "version_id": v.version_id,
                "version_number": v.version_number,
                "file_size": v.file_size,
                "checksum": v.checksum,
                "change_summary": v.change_summary,
                "changed_by": v.changed_by,
                "is_current": v.is_current,
                "created_at": v.created_at.isoformat()
            }
            for v in versions
        ]
    }


@router.get("/version/{version_id}")
def get_version(version_id: str, db: Session = Depends(get_db), _: str = Depends(require_login)):
    version = FileVersionService.get_version(db, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    if not os.path.exists(version.file_path):
        raise HTTPException(status_code=404, detail="Version file not found")

    file_record = UploadedFileService.get_by_file_id(db, version.file_id)
    filename = file_record.original_name if file_record else version.version_id

    return FileResponse(
        version.file_path,
        filename=f"{filename}_v{version.version_number}",
        media_type="application/octet-stream"
    )


@router.post("/version/rollback/{version_id}")
def rollback_version(version_id: str, db: Session = Depends(get_db), _: str = Depends(require_role("admin"))):
    version = FileVersionService.rollback_to_version(db, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    file_record = UploadedFileService.get_by_file_id(db, version.file_id)
    if file_record and os.path.exists(version.file_path):
        shutil.copy(version.file_path, file_record.file_path)

    return {
        "success": True,
        "version": {
            "version_id": version.version_id,
            "version_number": version.version_number,
            "is_current": version.is_current
        }
    }


@router.delete("/version/{version_id}")
def delete_version(version_id: str, db: Session = Depends(get_db), _: str = Depends(require_role("admin"))):
    version = FileVersionService.get_version(db, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    if version.is_current:
        raise HTTPException(status_code=400, detail="Cannot delete current version")

    if os.path.exists(version.file_path):
        os.remove(version.file_path)

    FileVersionService.delete_version(db, version_id)

    return {"success": True}


@router.get("/version/current/{file_id}")
def get_current_version(file_id: str, db: Session = Depends(get_db), _: str = Depends(require_login)):
    version = FileVersionService.get_current_version(db, file_id)
    if not version:
        raise HTTPException(status_code=404, detail="No version found")

    return {
        "success": True,
        "version": {
            "version_id": version.version_id,
            "version_number": version.version_number,
            "file_size": version.file_size,
            "checksum": version.checksum,
            "is_current": version.is_current,
            "created_at": version.created_at.isoformat()
        }
    }


@router.get("/version/compare/{file_id}")
def compare_versions(
    file_id: str,
    version1: int = Query(...),
    version2: int = Query(...),
    db: Session = Depends(get_db),
    _: str = Depends(require_login)
):
    versions = FileVersionService.get_versions(db, file_id)

    v1 = next((v for v in versions if v.version_number == version1), None)
    v2 = next((v for v in versions if v.version_number == version2), None)

    if not v1 or not v2:
        raise HTTPException(status_code=404, detail="Version not found")

    if not os.path.exists(v1.file_path) or not os.path.exists(v2.file_path):
        raise HTTPException(status_code=404, detail="Version file not found on disk")

    diff_result = FileDiffService.compare_files(v1.file_path, v2.file_path)
    similarity = FileDiffService.get_similarity(v1.file_path, v2.file_path)

    return {
        "success": True,
        "comparison": {
            "version1": {
                "version_number": v1.version_number,
                "file_size": v1.file_size,
                "checksum": v1.checksum,
                "change_summary": v1.change_summary,
                "created_at": v1.created_at.isoformat()
            },
            "version2": {
                "version_number": v2.version_number,
                "file_size": v2.file_size,
                "checksum": v2.checksum,
                "change_summary": v2.change_summary,
                "created_at": v2.created_at.isoformat()
            },
            "size_diff": v2.file_size - v1.file_size,
            "checksum_match": v1.checksum == v2.checksum,
            "diff": {
                "additions": diff_result.additions,
                "deletions": diff_result.deletions,
                "changes": diff_result.changes,
                "from_content": diff_result.from_content[:10000],
                "to_content": diff_result.to_content[:10000],
                "from_content_html": diff_result.from_content_html,
                "to_content_html": diff_result.to_content_html,
                "changes_list": diff_result.changes_list
            },
            "similarity": round(similarity * 100, 2)
        }
    }
