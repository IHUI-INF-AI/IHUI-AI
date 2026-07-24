"""ai-service 调用 apps/api 的 HTTP 客户端(支持 mTLS 双向证书认证)。

设计原则:
- **单例复用**:全局共享一个 httpx.AsyncClient(连接池复用,避免每次请求新建 client)
- **mTLS 感知**:MTLS_ENABLED=true 时自动配置 cert=(client.crt, client.key) + verify=ca.crt
- **降级模式**:MTLS_ENABLED=false(默认)时退化为普通 httpx 客户端(开发环境)
- **fail-fast**:启动时由 settings.validate_mtls_config() 校验证书存在性,本模块不做二次校验

使用方式(调用 apps/api 的推荐入口):

    from app.services.api_client import get_api_client

    client = get_api_client()
    resp = await client.post(
        f"{settings.api_service_url}/api/ai/callback",
        json=body,
        headers={"X-Internal-Secret": settings.ai_callback_secret},
    )

生命周期:
- get_api_client() 懒初始化,首次调用时创建
- close_api_client() 在 main.py lifespan shutdown 阶段调用,释放连接池

与 llm_gateway.get_http_client() 的区别:
- llm_gateway.get_http_client() 用于调用**外部 LLM provider**(OpenAI / Anthropic / ...),不走 mTLS
- 本模块 get_api_client() 用于调用**内部 apps/api**,启用 mTLS 时走双向证书
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from ..core.config import settings

logger = logging.getLogger(__name__)

# 全局共享 httpx.AsyncClient(连接池复用)
# 懒初始化:首次 get_api_client() 调用时创建,close_api_client() 关闭后置 None
_api_client: Optional[httpx.AsyncClient] = None


def _build_api_client() -> httpx.AsyncClient:
    """根据 settings 构建带 mTLS 配置的 httpx.AsyncClient。"""
    kwargs: dict[str, object] = {"timeout": 30.0}
    if settings.mtls_enabled:
        # mTLS 模式:双向证书 + 校验服务端证书
        # cert 接受 (cert_path, key_path) 元组,verify 接受 CA 证书路径
        kwargs["cert"] = (
            settings.mtls_client_cert_path,
            settings.mtls_client_key_path,
        )
        kwargs["verify"] = settings.mtls_ca_cert_path
        logger.info(
            "mTLS 客户端已启用(client_cert=%s, ca_cert=%s)",
            settings.mtls_client_cert_path,
            settings.mtls_ca_cert_path,
        )
    else:
        # 降级模式:不校验服务端证书(开发环境,允许自签/无证书)
        # 生产环境应设置 MTLS_ENABLED=true
        kwargs["verify"] = False
        logger.warning(
            "mTLS 未启用(MTLS_ENABLED=false),ai-service → api 调用走降级模式,"
            "生产环境请设置 MTLS_ENABLED=true 并配置证书路径"
        )
    return httpx.AsyncClient(**kwargs)  # type: ignore[arg-type]


def get_api_client() -> httpx.AsyncClient:
    """获取全局共享的 api 调用 httpx.AsyncClient(懒初始化,连接池复用)。

    MTLS_ENABLED=true 时,客户端自动配置:
    - cert=(client.crt, client.key):提交客户端证书给服务端
    - verify=ca.crt:校验服务端证书(防中间人)

    MTLS_ENABLED=false 时退化为普通 httpx 客户端(开发环境,不校验服务端证书)。
    """
    global _api_client
    if _api_client is None or _api_client.is_closed:
        _api_client = _build_api_client()
    return _api_client


async def close_api_client() -> None:
    """关闭全局共享的 api 调用 httpx.AsyncClient(main.py shutdown 调用)。"""
    global _api_client
    if _api_client is not None:
        await _api_client.aclose()
        _api_client = None
        logger.info("api httpx.AsyncClient closed")


__all__ = ["get_api_client", "close_api_client"]
