"""Coze Bot 完整 CRUD 路由(基于 coze_compat.CozeClient)."""

from fastapi import APIRouter, Depends, Query

from app.schemas.common import error, success
from app.security import require_login
from app.utils.coze_compat import CozeClient

router = APIRouter()


@router.get("/list", summary="Bot 列表")
async def list_bots(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    space_id: str = Query("", description="空间 ID,默认使用 settings.COZE_ACCOUNT_ID"),
    user_uuid: str = Depends(require_login),
):
    async with CozeClient() as cli:
        data = await cli.list_bots(space_id=space_id, page=page, size=page_size)
    if data.get("code") != 0:
        return error(data.get("msg", "Coze API error"))
    return success(
        data.get("data", {}).get("bot_list", []),
        total=data.get("data", {}).get("total", 0),
    )


@router.get("/{bot_id}", summary="Bot 详情")
async def get_bot(bot_id: str, user_uuid: str = Depends(require_login)):
    async with CozeClient() as cli:
        data = await cli.get_bot(bot_id)
    if data.get("code") != 0:
        return error(data.get("msg", "Coze API error"))
    return success(data.get("data"))


@router.post("/create", summary="创建 Bot")
async def create_bot(
    name: str = Query(...),
    description: str = Query(""),
    persona: str = Query("", description="Bot 人设描述"),
    user_uuid: str = Depends(require_login),
):
    payload = {
        "space_id": "",  # 由 Coze 端兜底
        "name": name,
        "description": description,
        "persona": {"system_prompt": persona} if persona else {},
    }
    async with CozeClient() as cli:
        data = await cli.create_bot(payload)
    if data.get("code") != 0:
        return error(data.get("msg", "Coze API error"))
    return success(data.get("data"))


@router.post("/update", summary="更新 Bot")
async def update_bot(
    bot_id: str = Query(...),
    name: str = Query(None),
    description: str = Query(None),
    persona: str = Query(None),
    user_uuid: str = Depends(require_login),
):
    payload = {}
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if persona is not None:
        payload["persona"] = {"system_prompt": persona}
    async with CozeClient() as cli:
        data = await cli.update_bot(bot_id, payload)
    if data.get("code") != 0:
        return error(data.get("msg", "Coze API error"))
    return success(data.get("data"))


@router.post("/delete", summary="删除 Bot")
async def delete_bot(bot_id: str = Query(...), user_uuid: str = Depends(require_login)):
    async with CozeClient() as cli:
        data = await cli.delete_bot(bot_id)
    if data.get("code") != 0:
        return error(data.get("msg", "Coze API error"))
    return success({"bot_id": bot_id, "deleted": True})


@router.post("/publish", summary="发布 Bot")
async def publish_bot(
    bot_id: str = Query(...),
    version: str = Query(""),
    user_uuid: str = Depends(require_login),
):
    async with CozeClient() as cli:
        data = await cli.publish_bot(bot_id, version=version)
    if data.get("code") != 0:
        return error(data.get("msg", "Coze API error"))
    return success(data.get("data"))


@router.get("/datasets/list", summary="Bot 关联知识库列表")
async def list_datasets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    async with CozeClient() as cli:
        data = await cli.list_datasets(page=page, size=page_size)
    if data.get("code") != 0:
        return error(data.get("msg", "Coze API error"))
    return success(
        data.get("data", {}).get("dataset_list", []),
        total=data.get("data", {}).get("total", 0),
    )
