"""实时服务目录路由注册"""

from fastapi import APIRouter

from app.api.v1.service_catalog.service_catalog import router as service_catalog_router

router = APIRouter()
router.include_router(service_catalog_router, prefix="/service-catalog", tags=["Service Catalog"])
