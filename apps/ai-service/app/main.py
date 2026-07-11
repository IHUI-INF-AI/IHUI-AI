"""IHUI AI 服务 - FastAPI 入口。

提供 LLM 网关、MCP 工具、LangGraph 工作流等 AI 能力。
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app import __version__
from app.core.config import settings
from app.routers import a2a, agents, health, llm, mcp, tools
from app.routers.legacy import router as legacy_router

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """创建 FastAPI 应用实例。"""
    app = FastAPI(
        title="IHUI AI Service",
        description="AI 服务 - LLM 网关 + MCP + LangGraph",
        version=__version__,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin.split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册路由(路由器自带 /llm /mcp /agents /a2a /tools 前缀,统一加 /api)
    app.include_router(health.router, tags=["health"])
    app.include_router(llm.router, prefix="/api", tags=["llm"])
    app.include_router(tools.router, prefix="/api", tags=["tools"])
    app.include_router(mcp.router, prefix="/api", tags=["mcp"])
    app.include_router(agents.router, prefix="/api", tags=["agents"])
    app.include_router(a2a.router, prefix="/api", tags=["a2a"])
    app.include_router(legacy_router)

    # Prometheus 指标(/metrics 端点,由 prometheus-fastapi-instrumentator 自动暴露)
    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        should_respect_env_var=False,
        excluded_handlers=["/health", "/metrics"],
    ).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.node_env == "development",
        log_level=settings.log_level,
    )
