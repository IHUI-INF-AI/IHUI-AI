"""健康检查路由。"""
from fastapi import APIRouter

from app import __version__
from app.core.config import settings
from app.core.llm_gateway import llm_gateway

router = APIRouter()


@router.get("/")
async def root():
    """服务根端点,返回基本信息。"""
    return {
        "service": "ihui-ai-service",
        "version": __version__,
        "docs": "/docs",
        "health": "/health",
    }


@router.get("/health")
async def health():
    """综合健康检查(liveness,不检查依赖)。"""
    return {"status": "ok", "service": "ihui-ai-service"}


@router.get("/health/live")
async def health_live():
    """Liveness 探针。"""
    return {"status": "alive"}


@router.get("/health/ready")
async def health_ready():
    """Readiness 探针(检查 LLM 配置 + litellm 可用性)。

    检查项:
    - LLM API key 是否配置(至少一个 provider)
    - litellm 是否可导入(真实模式)
    - stub 模式也算 ready(可返回模拟响应)
    """
    checks = {}
    stub_mode = llm_gateway._is_stub_mode()
    checks["llm_configured"] = not stub_mode
    checks["stub_mode"] = stub_mode

    if not stub_mode:
        # 真实模式检查 litellm 是否可导入
        try:
            import litellm  # noqa: F401
            checks["litellm_available"] = True
        except ImportError:
            checks["litellm_available"] = False
            return {"status": "not_ready", "checks": checks, "error": "litellm not installed"}

    return {"status": "ready", "checks": checks}
