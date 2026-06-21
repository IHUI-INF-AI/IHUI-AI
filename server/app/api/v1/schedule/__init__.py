"""日程管理路由注册"""

from fastapi import APIRouter

from app.api.v1.schedule.schedule import router as schedule_router

router = APIRouter()
router.include_router(schedule_router, prefix="/schedule", tags=["Schedule"])
