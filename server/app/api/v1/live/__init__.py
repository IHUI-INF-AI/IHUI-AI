"""直播路由注册 (迁移自 edu server ihui-ai-edu-live-service)"""

from fastapi import APIRouter

from app.api.v1.live.category import router as category_router
from app.api.v1.live.channel import router as channel_router
from app.api.v1.live.lecturer import router as lecturer_router
from app.api.v1.live.statistics import router as statistics_router
from app.api.v1.live.subscribe import router as subscribe_router
from app.api.v1.live.tencent import router as tencent_router

router = APIRouter()
router.include_router(channel_router, prefix="/live", tags=["Live"])
router.include_router(subscribe_router, prefix="/live", tags=["Live-Subscribe"])
router.include_router(category_router, prefix="/live", tags=["Live-Category"])
router.include_router(tencent_router, prefix="/live", tags=["Live-Tencent"])
router.include_router(statistics_router, prefix="/live", tags=["Live-Statistics"])
router.include_router(lecturer_router, prefix="/live", tags=["Live-Lecturer"])
