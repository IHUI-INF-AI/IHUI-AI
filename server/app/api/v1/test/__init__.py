"""测试页面路由注册"""

from fastapi import APIRouter

from app.api.v1.test.test import router as test_router

router = APIRouter()
router.include_router(test_router, prefix="/test", tags=["Test"])
