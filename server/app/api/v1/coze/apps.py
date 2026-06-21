from fastapi import APIRouter
from loguru import logger

from app.utils.coze_compat import CozeClient

router = APIRouter(prefix="/apps", tags=["Coze Apps"])


@router.get("/list")
async def list_apps(page: int = 1, size: int = 20):
    try:
        async with CozeClient() as coze:
            return await coze.list_apps(page, size)
    except Exception as e:
        logger.error("List apps error: " + str(e))
        raise


@router.get("/list_api_apps")
async def list_api_apps(page: int = 1, size: int = 20):
    try:
        async with CozeClient() as coze:
            return await coze.list_api_apps(page, size)
    except Exception as e:
        logger.error("List api apps error: " + str(e))
        raise


@router.get("/events")
async def list_app_events(app_id: str, page: int = 1, size: int = 20):
    try:
        async with CozeClient() as coze:
            return await coze.list_app_events(app_id, page, size)
    except Exception as e:
        logger.error("List app events error: " + str(e))
        raise
