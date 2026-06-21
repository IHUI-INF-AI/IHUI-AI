"""Agent CRUD routes."""

from fastapi import APIRouter, Depends, Query

from app.schemas.common import error, success
from app.security import require_login
from app.services.agent_service import create_agent, delete_agent, get_agent, list_agents, update_agent

router = APIRouter()


@router.get("/list", summary="List agents")
async def get_agents(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str = Query(None),
    status: int = Query(None),
    user_uuid: str = Depends(require_login),
):
    result = list_agents(page, limit, keyword=keyword, status=status)
    return success(result["data"], total=result["total"])


@router.get("/{agent_id}", summary="Get agent detail")
async def get_detail(agent_id: str, user_uuid: str = Depends(require_login)):
    agent = get_agent(agent_id)
    if not agent:
        return error("Agent not found", "404")
    return success(agent)


@router.post("/create", summary="Create agent")
async def create(
    agent_name: str = Query(...),
    bot_id: str = Query(None),
    agent_prompt: str = Query(None),
    user_uuid: str = Depends(require_login),
):
    result = create_agent(user_uuid, agent_name, bot_id, agent_prompt)
    if not result["success"]:
        return error(result["msg"])
    return success(result)


@router.put("/{agent_id}", summary="Update agent")
async def update(
    agent_id: str,
    agent_name: str = Query(None),
    agent_prompt: str = Query(None),
    publish_status: int = Query(None),
    user_uuid: str = Depends(require_login),
):
    result = update_agent(agent_id, agent_name=agent_name, agent_prompt=agent_prompt, publish_status=publish_status)
    if not result["success"]:
        return error(result["msg"])
    return success(msg="Updated")


@router.delete("/{agent_id}", summary="Delete agent")
async def delete(agent_id: str, user_uuid: str = Depends(require_login)):
    result = delete_agent(agent_id)
    if not result["success"]:
        return error(result["msg"])
    return success(msg="Deleted")
