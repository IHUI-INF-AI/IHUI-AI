"""File storage management routes."""


from fastapi import APIRouter, Depends, Query
from loguru import logger
from pydantic import BaseModel

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


@router.get("/list", summary="文件列表")
def list_files(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    file_type: str = Query(None, description="按文件类型过滤"),
    user_uuid: str = Depends(require_login),
):
    from app.models.app_content_models import AiFileStorage

    with get_session() as db:
        q = db.query(AiFileStorage).filter(AiFileStorage.status == 1)
        if file_type:
            q = q.filter(AiFileStorage.file_type == file_type)
        total = q.count()
        items = q.order_by(AiFileStorage.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": f.id,
                "file_name": f.file_name,
                "file_path": f.file_path,
                "file_size": f.file_size,
                "file_type": f.file_type,
                "bucket": f.bucket,
                "user_uuid": f.user_uuid,
            }
            for f in items
        ]
        return success(data, total=total)


class FileUploadBody(BaseModel):
    file_name: str
    file_path: str
    file_size: int | None = None
    file_type: str | None = None
    bucket: str | None = None


@router.post("/upload", summary="上传文件记录")
def upload_file(
    body: FileUploadBody,
    user_uuid: str = Depends(require_login),
):
    from app.models.app_content_models import AiFileStorage

    with get_session() as db:
        try:
            fs = AiFileStorage(
                file_name=body.file_name,
                file_path=body.file_path,
                file_size=body.file_size,
                file_type=body.file_type,
                bucket=body.bucket,
                user_uuid=user_uuid,
                status=1,
            )
            db.add(fs)
            db.commit()
            db.refresh(fs)
            return success({"id": fs.id, "file_name": fs.file_name, "file_path": fs.file_path})
        except Exception as e:
            logger.error(f"Upload file error: {e}")
            return error(str(e))


@router.delete("/{file_id}", summary="删除文件")
def delete_file(
    file_id: int,
    user_uuid: str = Depends(require_login),
):
    from app.models.app_content_models import AiFileStorage

    with get_session() as db:
        try:
            f = db.query(AiFileStorage).filter(AiFileStorage.id == file_id).first()
            if not f:
                return error("文件不存在", "404")
            f.status = 0
            db.commit()
            return success({"id": file_id, "deleted": True})
        except Exception as e:
            logger.error(f"Delete file error: {e}")
            return error(str(e))
