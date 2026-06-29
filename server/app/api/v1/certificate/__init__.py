"""证书模块路由注册"""

from fastapi import APIRouter

from app.api.v1.certificate.routes import router as routes_router

router = APIRouter()
router.include_router(routes_router, prefix="/certificate", tags=["Certificate"])
