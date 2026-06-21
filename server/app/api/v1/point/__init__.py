"""积分体系路由注册"""

from fastapi import APIRouter

from app.api.v1.point.point import router as point_router

router = APIRouter()
router.include_router(point_router, prefix="/point", tags=["Point"])
