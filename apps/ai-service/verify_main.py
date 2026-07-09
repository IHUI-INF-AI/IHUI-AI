"""临时验证启动脚本 - 只注册 llm + health 路由。

用于本地验证 AI 对话链路(无需 langgraph/mcp 等重依赖)。
验证完成后删除此文件。

启动: cd apps/ai-service && python -m uvicorn verify_main:app --port 8000
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import health, llm

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="IHUI AI Service (verify)", version="verify")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin.split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # 只注册验证必需的路由
    app.include_router(health.router, tags=["health"])
    app.include_router(llm.router, prefix="/api", tags=["llm"])
    return app


app = create_app()
