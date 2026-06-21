"""组织管理路由注册"""

from fastapi import APIRouter

from app.api.v1.organization.organization import router as organization_router

router = APIRouter()
router.include_router(organization_router, prefix="/organization", tags=["Organization"])
