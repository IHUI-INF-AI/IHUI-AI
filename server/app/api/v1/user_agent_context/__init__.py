"""用户上下文路由注册"""

from fastapi import APIRouter

from app.api.v1.user_agent_context.user_agent_context import router as user_agent_context_router

router = APIRouter()
router.include_router(user_agent_context_router, prefix="/user-agent-context", tags=["User Agent Context"])
