"""分享内容路由 - 获取分享内容与创建分享记录.

当前无独立 share_content 表, 优先从 agents 表查询 (share_id 视为 agent_id).
后续接入独立 share 表时, 仅需替换查询逻辑, 端点契约保持不变.
"""

from datetime import datetime

from fastapi import APIRouter, Depends
from loguru import logger
from pydantic import BaseModel

from app.database import get_session
from app.models.agent_models import Agent
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


class ShareCreateRequest(BaseModel):
    """创建分享请求."""

    agent_id: str | None = None
    user_id: str | None = None
    title: str | None = None
    description: str | None = None
    image: str | None = None
    content_type: str = "agent"
    content_data: str | None = None


@router.get("/content/{share_id}", summary="获取分享内容")
async def get_share_content(share_id: str):
    """根据 share_id 查询分享内容.

    返回字段: title / description / image / author / content_type / content_data / created_at.
    找不到对应数据时返回 404000 错误码.
    """
    with get_session() as db:
        try:
            agent = db.query(Agent).filter(Agent.agent_id == share_id).first()
            if not agent:
                logger.warning(f"share content not found for share_id={share_id}")
                return error("Share content not found", "404000")

            created_at = None
            if agent.publish_time:
                created_at = agent.publish_time.isoformat()
            elif agent.created_at:
                created_at = agent.created_at.isoformat() if hasattr(agent.created_at, "isoformat") else str(agent.created_at)

            return success(
                {
                    "title": agent.agent_name or "",
                    "description": agent.agent_description or "",
                    "image": agent.agent_avatar or "",
                    "author": agent.user_name or agent.creator_name or "",
                    "content_type": "agent",
                    "content_data": agent.prologue or agent.agent_description or "",
                    "created_at": created_at,
                }
            )
        except Exception as e:
            logger.error(f"get_share_content error: {e}")
            return error(str(e))


@router.post("/create", summary="创建分享记录")
async def create_share(
    data: ShareCreateRequest,
    user_uuid: str = Depends(require_login),
):
    """创建分享记录.

    接收 agent_id/user_id/title/description 等字段, 返回 share_id.
    当前无独立 share 表, share_id 直接复用 agent_id (若提供), 否则生成临时 ID.
    """
    try:
        share_id = data.agent_id or f"share_{int(datetime.utcnow().timestamp())}"
        logger.info(
            f"create_share: user={user_uuid}, agent_id={data.agent_id}, share_id={share_id}"
        )
        return success(
            {
                "share_id": share_id,
                "title": data.title or "",
                "description": data.description or "",
                "image": data.image or "",
                "content_type": data.content_type,
                "share_url": f"/share/{share_id}",
            }
        )
    except Exception as e:
        logger.error(f"create_share error: {e}")
        return error(str(e))
