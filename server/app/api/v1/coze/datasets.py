
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from loguru import logger
from pydantic import BaseModel

from app.security import require_login, require_role
from app.utils.coze_compat import CozeClient

router = APIRouter(prefix="/datasets", tags=["Coze Datasets"])


class DatasetCreateReq(BaseModel):
    name: str
    description: str | None = None
    space_id: str


class DatasetListReq(BaseModel):
    space_id: str
    limit: int | None = 10
    offset: int | None = 0


class DocListReq(BaseModel):
    dataset_id: str
    limit: int | None = 10
    offset: int | None = 0


class ImageListReq(BaseModel):
    dataset_id: str
    limit: int | None = 10
    offset: int | None = 0


@router.post("")
async def create_dataset(req: DatasetCreateReq, _: str = Depends(require_role("admin"))):
    try:
        body = {"name": req.name, "space_id": req.space_id}
        if req.description:
            body["description"] = req.description
        async with CozeClient() as coze:
            return await coze.create_dataset(body)
    except Exception as e:
        logger.error("Create dataset error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/list")
async def list_datasets(req: DatasetListReq, _: str = Depends(require_login)):
    try:
        async with CozeClient() as coze:
            return await coze.list_datasets(req.space_id, req.offset, req.limit)
    except Exception as e:
        logger.error("List datasets error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/documents/upload")
async def upload_document(dataset_id: str = Form(...), file: UploadFile = File(...), user_uuid: str = Depends(require_login)):
    try:
        content = await file.read()
        async with CozeClient() as coze:
            return await coze.upload_document(dataset_id, content, file.filename or "doc")
    except Exception as e:
        logger.error("Upload document error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/documents/list")
async def list_documents(req: DocListReq, _: str = Depends(require_login)):
    try:
        async with CozeClient() as coze:
            return await coze.list_documents(req.dataset_id, req.offset, req.limit)
    except Exception as e:
        logger.error("List documents error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/images/upload")
async def upload_image(dataset_id: str = Form(...), file: UploadFile = File(...), user_uuid: str = Depends(require_login)):
    try:
        content = await file.read()
        async with CozeClient() as coze:
            return await coze.upload_image(dataset_id, content, file.filename or "img")
    except Exception as e:
        logger.error("Upload image error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/images/list")
async def list_images(req: ImageListReq, _: str = Depends(require_login)):
    try:
        async with CozeClient() as coze:
            return await coze.list_images(req.dataset_id, req.offset, req.limit)
    except Exception as e:
        logger.error("List images error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e
