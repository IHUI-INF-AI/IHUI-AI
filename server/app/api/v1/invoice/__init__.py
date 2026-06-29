"""发票管理路由注册"""
from fastapi import APIRouter

from app.api.v1.invoice.routes import router as routes_router

router = APIRouter()
router.include_router(routes_router, prefix="/invoice", tags=["Invoice"])
