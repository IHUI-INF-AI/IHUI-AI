"""OpenRouter代理路由注册"""

from fastapi import APIRouter

from app.api.v1.openrouter_proxy.openrouter_proxy import router as openrouter_proxy_router

router = APIRouter()
router.include_router(openrouter_proxy_router, prefix="/openrouter-proxy", tags=["OpenRouter Proxy"])
