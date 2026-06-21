"""Agent上传路由注册"""
from fastapi import APIRouter

from app.api.v1.agent_upload.agent_upload import router as agent_upload_router

router = APIRouter()
router.include_router(agent_upload_router, prefix="/agent-upload", tags=["Agent Upload"])
