"""小程序版本管理路由注册"""
from fastapi import APIRouter

from app.api.v1.app_version.app_version import router as app_version_router

router = APIRouter()
router.include_router(app_version_router, prefix="/app-version", tags=["App Version"])
