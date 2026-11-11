# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ai-service 调用 apps/api 的 HTTP 客户端(支持 mTLS 双向证书认证)。

设计原则:
- **单例复用**:全局共享一个 httpx.AsyncClient(连接池复用,避免每次请求新建 client)
- **mTLS 感知**:MTLS_ENABLED=true 时自动配置 cert=(client.crt, client.key) + verify=ca.crt
- **默认仍校验 TLS**:MTLS_ENABLED=false 时不再关闭证书校验。信任库默认走 certifi;
  已有 CA 环境变量按 SSL_CERT_FILE、SSL_CERT_DIR、CURL_CA_BUNDLE、REQUESTS_CA_BUNDLE、
  NODE_EXTRA_CA_CERTS、NODE_TLS_CA_CERTS 的顺序优先。只有 API_CLIENT_TLS_VERIFY 显式为
  false/0/no/off 且环境不是 production 时才允许 verify=False,该决定挂在 client.tls_verify 上。
- **fail-fast**:启动时由 settings.validate_mtls_config() 校验证书存在性,本模块不做二次校验

使用方式(调用 apps/api 的推荐入口,鉴权头经唯一出口构造,见 internal_ticket):

    from app.core.internal_ticket import internal_service_headers
    from app.services.api_client import get_api_client

    client = get_api_client()
    resp = await client.post(
        f"{settings.api_service_url}/api/ai/callback",
        json=body,
        headers=internal_service_headers("<subject>", "ai-callback", legacy_token=settings.ai_callback_secret),
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
import os
import ssl
from collections.abc import Mapping
from typing import NamedTuple

import certifi
import httpx

from ..core.config import settings

logger = logging.getLogger(__name__)

# 显式开发开关。未设置 / 空 / 非关值一律继续校验。已有 NODE_ENV 优先于 settings.node_env。
API_CLIENT_TLS_VERIFY_ENV = "API_CLIENT_TLS_VERIFY"
_VERIFY_OFF = frozenset({"0", "false", "no", "off"})
# 已有 CA 环境变量优先于 certifi 默认库。SSL_CERT_* 与 httpx 自身顺序一致,其后是本仓已在用的证书变量。
_CA_ENV_SPECS: tuple[tuple[str, str], ...] = (
    ("SSL_CERT_FILE", "file"),
    ("SSL_CERT_DIR", "dir"),
    ("CURL_CA_BUNDLE", "file"),
    ("REQUESTS_CA_BUNDLE", "file"),
    ("NODE_EXTRA_CA_CERTS", "file"),
    ("NODE_TLS_CA_CERTS", "file"),
)


class ApiTlsDecision(NamedTuple):
    """本次 httpx 客户端的 TLS 校验决定。测试读 client.tls_verify。

    enabled=False 只出现在开发开关真正关掉校验时;verify 为 False 或 CA 路径或 True。
    source 点名依据:dev-switch / production-kept / default / mtls-ca / 某个 CA 环境变量名。
    """

    enabled: bool
    verify: bool | str
    source: str


class _ApiHttpClient(httpx.AsyncClient):
    """共享客户端。tls_verify 让测试直接看见校验有没有被关掉。"""

    tls_verify: ApiTlsDecision


# 全局共享 httpx.AsyncClient(连接池复用)
# 懒初始化:首次 get_api_client() 调用时创建,close_api_client() 关闭后置 None
_api_client: httpx.AsyncClient | None = None


def _verify_switch_off(env: Mapping[str, str]) -> bool:
    """API_CLIENT_TLS_VERIFY 显式为关值才返回 True。缺省与空串都不是关闭。"""
    raw = env.get(API_CLIENT_TLS_VERIFY_ENV)
    if raw is None:
        return False
    return raw.strip().lower() in _VERIFY_OFF


def _runtime_node_env(env: Mapping[str, str], node_env: str | None) -> str:
    """环境名。进程里已有的 NODE_ENV 优先于调用方参数,再退回 settings,最后 production。"""
    raw = env.get("NODE_ENV")
    if raw is not None and raw.strip():
        return raw.strip()
    if node_env is not None and node_env.strip():
        return node_env.strip()
    configured = str(settings.node_env or "").strip()
    return configured or "production"


def _is_production(node_env: str) -> bool:
    """空环境名按 production 处理,避免漏配把校验关掉。"""
    normalized = node_env.strip().lower()
    return normalized == "" or normalized == "production"


def _first_existing_ca(env: Mapping[str, str]) -> tuple[str, str] | None:
    """按固定顺序找第一个真实存在的 CA 文件或目录。路径不存在则跳过,不让启动崩。"""
    for key, kind in _CA_ENV_SPECS:
        raw = env.get(key)
        if raw is None:
            continue
        path = raw.strip()
        if not path:
            continue
        if kind == "dir" and os.path.isdir(path):
            return key, path
        if kind == "file" and os.path.isfile(path):
            return key, path
    return None


def resolve_api_tls_verify(
    *,
    mtls_enabled: bool | None = None,
    ca_cert_path: str | None = None,
    environ: Mapping[str, str] | None = None,
    node_env: str | None = None,
) -> ApiTlsDecision:
    """决定内部 api 客户端的 TLS 校验。

    mTLS 打开时始终校验 MTLS_CA_CERT_PATH。否则默认校验;已有 CA 环境变量优先于 certifi。
    只有开发开关显式关闭且当前不是 production 时才返回 enabled=False。
    """
    env = os.environ if environ is None else environ
    mtls = settings.mtls_enabled if mtls_enabled is None else mtls_enabled
    ca_path = settings.mtls_ca_cert_path if ca_cert_path is None else ca_cert_path
    if mtls:
        return ApiTlsDecision(enabled=True, verify=ca_path, source="mtls-ca")

    off_requested = _verify_switch_off(env)
    if off_requested and not _is_production(_runtime_node_env(env, node_env)):
        return ApiTlsDecision(enabled=False, verify=False, source="dev-switch")

    existing_ca = _first_existing_ca(env)
    if existing_ca is not None:
        key, path = existing_ca
        return ApiTlsDecision(enabled=True, verify=path, source=key)
    source = "production-kept" if off_requested else "default"
    return ApiTlsDecision(enabled=True, verify=True, source=source)


def _httpx_verify(decision: ApiTlsDecision) -> bool | str | ssl.SSLContext:
    """把决定翻译成 httpx 的 verify 参数。

    非 mTLS 的「校验」传 SSLContext 而不是 verify=True,这样坏掉的 SSL_CERT_FILE
    不会再被 httpx 自己读一次并把客户端构造打崩。关闭校验时原样传 False。
    """
    value = decision.verify
    if value is False:
        return False
    if isinstance(value, str):
        if decision.source == "mtls-ca":
            return value
        if decision.source == "SSL_CERT_DIR":
            return ssl.create_default_context(capath=value)
        return ssl.create_default_context(cafile=value)
    return ssl.create_default_context(cafile=certifi.where())


def _build_api_client() -> _ApiHttpClient:
    """根据 settings 构建带 mTLS 配置的 httpx.AsyncClient。默认校验 TLS。"""
    decision = resolve_api_tls_verify()
    verify = _httpx_verify(decision)
    if settings.mtls_enabled:
        # mTLS 模式:双向证书 + 校验服务端证书
        # cert 接受 (cert_path, key_path) 元组,verify 接受 CA 证书路径
        client = _ApiHttpClient(
            timeout=30.0,
            verify=verify,
            cert=(settings.mtls_client_cert_path, settings.mtls_client_key_path),
        )
        logger.info(
            "mTLS 客户端已启用(client_cert=%s, ca_cert=%s)",
            settings.mtls_client_cert_path,
            settings.mtls_ca_cert_path,
        )
    else:
        client = _ApiHttpClient(timeout=30.0, verify=verify)
        if decision.source == "dev-switch":
            logger.warning(
                "%s 已显式关闭 TLS 校验(仅非生产),ai-service → api 调用可被中间人篡改",
                API_CLIENT_TLS_VERIFY_ENV,
            )
        elif decision.source == "production-kept":
            logger.warning(
                "%s 请求关闭 TLS 校验,但当前环境是 production,仍保持校验",
                API_CLIENT_TLS_VERIFY_ENV,
            )
        else:
            logger.info(
                "mTLS 未启用,ai-service → api 仍校验 TLS(source=%s)",
                decision.source,
            )
    # 关掉时测试直接读 client.tls_verify.enabled / .verify,不必拆 httpx 私有传输。
    client.tls_verify = decision
    return client


def get_api_client() -> httpx.AsyncClient:
    """获取全局共享的 api 调用 httpx.AsyncClient(懒初始化,连接池复用)。

    MTLS_ENABLED=true 时,客户端自动配置:
    - cert=(client.crt, client.key):提交客户端证书给服务端
    - verify=ca.crt:校验服务端证书(防中间人)

    MTLS_ENABLED=false 时默认仍校验 TLS。只有 API_CLIENT_TLS_VERIFY 显式关闭
    且非 production 才是 verify=False;该决定在 client.tls_verify 上。
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


__all__ = [
    "API_CLIENT_TLS_VERIFY_ENV",
    "ApiTlsDecision",
    "close_api_client",
    "get_api_client",
    "resolve_api_tls_verify",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
