from fastapi import APIRouter, Depends, File, UploadFile
from loguru import logger

from app.security import require_login
from app.utils.coze_compat import CozeClient

router = APIRouter(prefix="/files", tags=["Coze Files"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), user_uuid: str = Depends(require_login)):
    try:
        content = await file.read()
        async with CozeClient() as coze:
            result = await coze.upload_file(content, file.filename or "upload")
        return result
    except Exception as e:
        logger.error("Upload file error: " + str(e))
        raise
