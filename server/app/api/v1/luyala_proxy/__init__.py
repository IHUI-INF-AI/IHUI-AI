"""露雅拉代理路由注册"""

from fastapi import APIRouter

from app.api.v1.luyala_proxy.luyala_proxy import router as luyala_proxy_router

router = APIRouter()
router.include_router(luyala_proxy_router, prefix="/luyala-proxy", tags=["Luyala Proxy"])
