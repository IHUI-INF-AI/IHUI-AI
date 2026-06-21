from typing import Any

from fastapi import APIRouter
from loguru import logger
from pydantic import BaseModel

from app.utils.coze_compat import CozeClient

router = APIRouter(prefix="/workspaces", tags=["Coze Workspaces"])


class MembersReq(BaseModel):
    workspace_id: str
    members: list[dict[str, Any]]


class DeleteMembersReq(BaseModel):
    workspace_id: str
    member_ids: list[str]


@router.get("/list")
async def list_workspaces(page: int = 1, size: int = 20):
    try:
        async with CozeClient() as coze:
            return await coze.list_workspaces(page, size)
    except Exception as e:
        logger.error("List workspaces error: " + str(e))
        raise


@router.post("/members/create")
async def create_members(req: MembersReq):
    try:
        async with CozeClient() as coze:
            return await coze.create_workspace_members(req.workspace_id, req.members)
    except Exception as e:
        logger.error("Create members error: " + str(e))
        raise


@router.post("/members/delete")
async def delete_members(req: DeleteMembersReq):
    try:
        async with CozeClient() as coze:
            return await coze.delete_workspace_members(req.workspace_id, req.member_ids)
    except Exception as e:
        logger.error("Delete members error: " + str(e))
        raise
