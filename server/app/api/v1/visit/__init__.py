"""访问追踪路由注册"""

from fastapi import APIRouter

from app.api.v1.visit.visit import router as visit_router

router = APIRouter()
router.include_router(visit_router, prefix="/visit", tags=["Visit Tracking"])
