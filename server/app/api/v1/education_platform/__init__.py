"""教育平台路由注册"""
from fastapi import APIRouter

from app.api.v1.education_platform.education_platform import router as education_platform_router

router = APIRouter()
router.include_router(education_platform_router, prefix="/education-platform", tags=["Education Platform"])
