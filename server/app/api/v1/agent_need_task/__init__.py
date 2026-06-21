"""Agent需求任务路由注册"""

from fastapi import APIRouter

from app.api.v1.agent_need_task.agent_need_task import router as agent_need_task_router

router = APIRouter()
router.include_router(agent_need_task_router, prefix="/agent-need-task", tags=["Agent Need Task"])
