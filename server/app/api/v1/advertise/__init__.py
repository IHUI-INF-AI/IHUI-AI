"""广告管理路由注册"""

from fastapi import APIRouter

from app.api.v1.advertise.advertise import router as advertise_router

router = APIRouter()
router.include_router(advertise_router, prefix="/advertise", tags=["Advertise"])
