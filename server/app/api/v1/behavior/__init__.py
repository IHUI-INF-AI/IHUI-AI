"""行为分析路由注册"""

from fastapi import APIRouter

from app.api.v1.behavior.behavior import router as behavior_router

router = APIRouter()
router.include_router(behavior_router, prefix="/behavior", tags=["Behavior"])
