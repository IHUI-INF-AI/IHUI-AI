
from fastapi import APIRouter
from loguru import logger
from pydantic import BaseModel

from app.utils.coze_compat import CozeClient

router = APIRouter(prefix="/templates", tags=["Coze Templates"])


class DuplicateTemplateReq(BaseModel):
    template_id: str
    workspace_id: str
    name: str


@router.get("/list")
async def list_templates(page: int = 1, size: int = 20):
    try:
        async with CozeClient() as coze:
            return await coze.list_templates(page, size)
    except Exception as e:
        logger.error("List templates error: " + str(e))
        raise


@router.post("/duplicate")
async def duplicate_template(req: DuplicateTemplateReq):
    try:
        async with CozeClient() as coze:
            return await coze.duplicate_template(req.template_id, req.workspace_id, req.name)
    except Exception as e:
        logger.error("Duplicate template error: " + str(e))
        raise
