"""代理商使用明细路由注册"""

from fastapi import APIRouter

from app.api.v1.agent_usedetail.agent_usedetail import router as agent_usedetail_router

router = APIRouter()
router.include_router(agent_usedetail_router, prefix="/agent-usedetail", tags=["Agent Use Detail"])
