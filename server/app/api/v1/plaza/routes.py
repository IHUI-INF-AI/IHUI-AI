"""Plaza 广场模块 - 智能体广场列表 (miniapp 端对接).

2026-06-29: 新增端点, 为 miniapp pagesA/plaza/index.vue 提供 /api/v1/plaza/list.
复用 agents 表 + agents_square_list 逻辑, 按赛道/状态/搜索过滤.
"""

from fastapi import APIRouter, Query
from loguru import logger

from app.database import get_session
from app.models.agent_models import Agent
from app.schemas.common import success

router = APIRouter()


@router.get("/list", summary="广场智能体列表")
async def plaza_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: str | None = None,
    status: str | None = None,
    keyword: str | None = None,
):
    """获取广场智能体列表.

    返回公开(is_public=1)的智能体, 支持按分类/状态/关键词过滤.
    """
    with get_session() as db:
        try:
            q = db.query(Agent).filter(Agent.is_public == 1)
            if category:
                q = q.filter(Agent.category == category)
            if status:
                q = q.filter(Agent.status == status)
            if keyword:
                q = q.filter(Agent.name.like(f"%{keyword}%"))
            total = q.count()
            items = (
                q.order_by(Agent.usage_count.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            data = [
                {
                    "id": a.agent_id,
                    "name": a.name,
                    "description": a.description,
                    "avatar": a.avatar,
                    "category": a.category,
                    "status": a.status,
                    "usage_count": a.usage_count,
                    "like_count": a.like_count,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in items
            ]
            return success(data, total=total)
        except Exception as e:
            logger.error(f"plaza list error: {e}")
            return success([], total=0)
