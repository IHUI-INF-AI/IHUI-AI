# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""健康检查路由。"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app import __version__
from app.core.llm_gateway import llm_gateway

router = APIRouter()


@router.get("/")
async def root() -> dict[str, Any]:
    """服务根端点,返回基本信息。"""
    return {
        "service": "ihui-ai-service",
        "version": __version__,
        "docs": "/docs",
        "health": "/health",
    }


@router.get("/health")
async def health() -> dict[str, Any]:
    """综合健康检查(liveness,不检查依赖)。"""
    return {"status": "ok", "service": "ihui-ai-service"}


@router.get("/health/live")
async def health_live() -> dict[str, Any]:
    """Liveness 探针。"""
    return {"status": "alive"}


@router.get("/health/ready")
async def health_ready() -> dict[str, Any]:
    """Readiness 探针(检查 LLM 配置 + litellm 可用性)。

    检查项:
    - LLM API key 是否配置(至少一个 provider)
    - litellm 是否可导入(真实模式)
    - stub 模式也算 ready(可返回模拟响应)
    """
    checks: dict[str, Any] = {}
    stub_mode = llm_gateway._is_stub_mode()
    checks["llm_configured"] = not stub_mode
    checks["stub_mode"] = stub_mode

    # 会话存储:只在"进程里已经建过"时报一个检索后端(trgm / like)。
    # 探针**不建库**(peek 而不是 get):健康检查不该有副作用,更不该在探活的机器上
    # 顺手 CREATE SCHEMA。没建过就如实不报,不是"绿"。
    try:
        from app.routers.sessions import peek_session_store

        store = peek_session_store()
    except Exception:  # noqa: BLE001 - 探针自身不许把服务判成 not_ready
        store = None
    if store is not None:
        checks["session_store_search_backend"] = store.search_backend
        checks["session_store_schema"] = store.schema_name

    if not stub_mode:
        # 真实模式检查 litellm 是否可导入
        try:
            import litellm  # noqa: F401
            checks["litellm_available"] = True
        except ImportError:
            checks["litellm_available"] = False
            return {"status": "not_ready", "checks": checks, "error": "litellm not installed"}

    return {"status": "ready", "checks": checks}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
