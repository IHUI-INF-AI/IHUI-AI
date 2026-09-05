# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSO / OIDC 集成层(企业级补齐最小可用版,2026-09-06 立)。

设计约束:**不引入新 pip 依赖**(ldap3/authlib 未装)。核心为:
1. ``SSOProvider`` Protocol 抽象(authorize_url / exchange_code → UserIdentity);
2. 内置 ``mock`` provider(离线开发/测试用);
3. OIDC authorization-code 流程的 **纯函数 URL 构造**(可离线单测);
4. token exchange 用 httpx(项目既有依赖),仅在配置了真实 IdP 时可达。

环境变量骨架(pydantic Settings 大小写不敏感,对应 .env):
  SSO_PROVIDERS      — 逗号分隔的启用 provider 列表(如 "oidc,mock")
  SSO_OIDC_ISSUER    — IdP issuer URL(如 https://idp.example.com/realms/ihui)
  SSO_OIDC_CLIENT_ID / SSO_OIDC_CLIENT_SECRET — OAuth2 客户端凭证
  SSO_OIDC_AUTH_ENDPOINT / SSO_OIDC_TOKEN_ENDPOINT — 端点覆盖(默认从 issuer 推导)
  SSO_REDIRECT_URI   — 本服务回调地址(如 http://localhost:8803/api/sso/callback)
未配置 issuer/client_id 时 oidc provider 视为未启用,router 返回 501。
"""

from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable
from urllib.parse import urlencode

logger = logging.getLogger(__name__)


class SSOConfigError(RuntimeError):
    """SSO provider 配置缺失/错误。"""


@dataclass(frozen=True)
class UserIdentity:
    """SSO 断言的统一用户身份。"""

    subject: str
    email: str = ""
    name: str = ""
    provider: str = ""
    raw_claims: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class SSOProvider(Protocol):
    """SSO provider 抽象协议。"""

    name: str

    def authorize_url(self, state: str, nonce: str = "") -> str:
        """构造跳转到 IdP 的授权 URL。"""
        ...

    async def exchange_code(self, code: str) -> UserIdentity:
        """用授权码换取用户身份;失败抛 SSOConfigError / RuntimeError。"""
        ...


# ---------------- OIDC 纯函数层(URL 构造,可离线测) ----------------


def oidc_endpoints_from_issuer(
    issuer: str,
    auth_endpoint: str = "",
    token_endpoint: str = "",
) -> tuple[str, str]:
    """从 issuer 推导 OIDC authorization/token endpoint。

    优先使用显式覆盖值;否则按 OIDC 发现约定拼接:
      {issuer}/protocol/openid-connect/auth|token(Keycloak 风格)→ 若不确定,
      退化为通用 {issuer}/authorize 与 {issuer}/token。
    """
    base = issuer.rstrip("/")
    return (
        auth_endpoint or f"{base}/authorize",
        token_endpoint or f"{base}/token",
    )


def build_oidc_authorize_url(
    *,
    issuer: str = "",
    client_id: str,
    redirect_uri: str,
    state: str,
    scope: str = "openid profile email",
    nonce: str = "",
    auth_endpoint: str = "",
    extra_params: dict[str, str] | None = None,
) -> str:
    """构造 OIDC authorization-code 流程的授权跳转 URL(纯函数)。

    - issuer 与 auth_endpoint 至少一个非空,否则抛 SSOConfigError
    - 固定携带 response_type=code、client_id、redirect_uri、scope、state
    - nonce 非空时加入(PKCE 之外的重放防护,配合 id_token 校验)
    """
    endpoint = auth_endpoint or (oidc_endpoints_from_issuer(issuer)[0] if issuer else "")
    if not endpoint:
        raise SSOConfigError("OIDC provider 未配置:缺少 issuer 或 auth_endpoint")
    params: dict[str, str] = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scope,
        "state": state,
    }
    if nonce:
        params["nonce"] = nonce
    if extra_params:
        params.update(extra_params)
    sep = "&" if "?" in endpoint else "?"
    return f"{endpoint}{sep}{urlencode(params)}"


def parse_callback_params(query: dict[str, Any]) -> tuple[str, str]:
    """从回调 query 提取 (code, state);缺 code 抛 SSOConfigError。"""
    code = str(query.get("code") or "")
    state = str(query.get("state") or "")
    error = str(query.get("error") or "")
    if error:
        raise SSOConfigError(f"IdP 返回错误: {error}")
    if not code:
        raise SSOConfigError("回调缺少 code 参数")
    return code, state


# ---------------- Provider 实现 ----------------


class MockSSOProvider:
    """离线 mock provider:authorize 跳本地占位页,exchange 返回固定身份。

    仅用于开发/测试环境验证 SSO 流程骨架,绝不用于生产。
    """

    name = "mock"

    def __init__(self, identity: UserIdentity | None = None) -> None:
        self._identity = identity or UserIdentity(
            subject="mock-user-1",
            email="mock@example.com",
            name="Mock User",
            provider="mock",
        )

    def authorize_url(self, state: str, nonce: str = "") -> str:
        params = {"code": "mock-auth-code", "state": state}
        # 占位 IdP 页:httpx/浏览器均可解析(about:blank 对 ASGI 测试客户端非法)
        url = f"http://localhost:1/mock-sso?{urlencode(params)}"
        return url

    async def exchange_code(self, code: str) -> UserIdentity:
        if not code:
            raise SSOConfigError("mock provider 需要非空 code")
        return self._identity


class OIDCSSOProvider:
    """真实 OIDC authorization-code provider(httpx 做 token exchange)。"""

    name = "oidc"

    def __init__(
        self,
        *,
        issuer: str = "",
        client_id: str = "",
        client_secret: str = "",
        redirect_uri: str = "",
        auth_endpoint: str = "",
        token_endpoint: str = "",
    ) -> None:
        self.issuer = issuer
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.auth_endpoint = auth_endpoint
        self.token_endpoint_override = token_endpoint

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.redirect_uri) and bool(
            self.issuer or self.auth_endpoint
        )

    def _require_config(self) -> None:
        if not self.configured:
            raise SSOConfigError(
                "OIDC provider 未配置完整(需 issuer/auth_endpoint + client_id + redirect_uri)"
            )

    def authorize_url(self, state: str, nonce: str = "") -> str:
        self._require_config()
        return build_oidc_authorize_url(
            issuer=self.issuer,
            client_id=self.client_id,
            redirect_uri=self.redirect_uri,
            state=state,
            nonce=nonce,
            auth_endpoint=self.auth_endpoint,
        )

    async def exchange_code(self, code: str) -> UserIdentity:
        """授权码 → token → 用户身份。

        两步:POST token_endpoint 换 access_token(+ 可选 id_token claims),
        再 GET userinfo_endpoint(若配置)取 claims。网络/协议错误抛 RuntimeError。
        """
        self._require_config()
        import httpx  # 延迟导入:模块加载不强依赖网络栈

        _, token_ep = oidc_endpoints_from_issuer(
            self.issuer, self.auth_endpoint, self.token_endpoint_override
        )
        async with httpx.AsyncClient(timeout=10.0) as http:
            resp = await http.post(
                token_ep,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": self.redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            if resp.status_code != 200:
                raise RuntimeError(f"token exchange 失败: HTTP {resp.status_code}")
            tokens = resp.json()
        access_token = str(tokens.get("access_token") or "")
        if not access_token:
            raise RuntimeError("token exchange 响应缺少 access_token")
        # TODO(SSO-P2): 校验 id_token 签名(nonce/aud/iss)+ JWKS 拉取。
        # 当前最小实现信任 userinfo 端点;真实部署接入前必须补验签。
        claims: dict[str, Any] = {}
        userinfo_ep = tokens.get("userinfo_endpoint") or (
            f"{self.issuer.rstrip('/')}/userinfo" if self.issuer else ""
        )
        if userinfo_ep:
            try:
                async with httpx.AsyncClient(timeout=10.0) as http:
                    ur = await http.get(
                        userinfo_ep,
                        headers={"Authorization": f"Bearer {access_token}"},
                    )
                    if ur.status_code == 200:
                        body = ur.json()
                        if isinstance(body, dict):
                            claims = body
            except Exception as e:  # noqa: BLE001 - userinfo 失败降级到空 claims
                logger.warning("sso userinfo 获取失败(降级): %s", e)
        subject = str(claims.get("sub") or "")
        if not subject:
            raise RuntimeError("userinfo 响应缺少 sub")
        return UserIdentity(
            subject=subject,
            email=str(claims.get("email") or ""),
            name=str(claims.get("name") or claims.get("preferred_username") or ""),
            provider=self.name,
            raw_claims=claims,
        )


# ---------------- Registry(环境变量驱动) ----------------


def _env(name: str, default: str = "") -> str:
    import os

    return os.environ.get(name, default).strip() or default


def build_provider(name: str) -> SSOProvider:
    """按名称构造 provider;未知名称抛 SSOConfigError。"""
    key = name.lower().strip()
    if key == "mock":
        return MockSSOProvider()
    if key == "oidc":
        provider = OIDCSSOProvider(
            issuer=_env("SSO_OIDC_ISSUER"),
            client_id=_env("SSO_OIDC_CLIENT_ID"),
            client_secret=_env("SSO_OIDC_CLIENT_SECRET"),
            redirect_uri=_env("SSO_REDIRECT_URI"),
            auth_endpoint=_env("SSO_OIDC_AUTH_ENDPOINT"),
            token_endpoint=_env("SSO_OIDC_TOKEN_ENDPOINT"),
        )
        # 未配置真实 IdP → 视为不可用(router 层据此返回 501)
        if not provider.configured:
            raise SSOConfigError(
                "OIDC provider 未启用:请配置 SSO_OIDC_ISSUER/SSO_OIDC_CLIENT_ID/SSO_REDIRECT_URI"
            )
        return provider
    raise SSOConfigError(f"未知 SSO provider: {name}")


def list_enabled_providers() -> list[SSOProvider]:
    """解析 SSO_PROVIDERS(逗号分隔);未设置时默认提供 mock(开发便利)。

    构建失败(如 oidc 未配置)的 provider 仍列入但 configured=False,
    便于前端展示"已部署待配置"状态。
    """
    raw = _env("SSO_PROVIDERS")
    names = [n.strip() for n in (raw.split(",") if raw else ["mock"]) if n.strip()]
    providers: list[SSOProvider] = []
    for n in names:
        if n.lower() == "oidc":
            providers.append(
                OIDCSSOProvider(
                    issuer=_env("SSO_OIDC_ISSUER"),
                    client_id=_env("SSO_OIDC_CLIENT_ID"),
                    client_secret=_env("SSO_OIDC_CLIENT_SECRET"),
                    redirect_uri=_env("SSO_REDIRECT_URI"),
                    auth_endpoint=_env("SSO_OIDC_AUTH_ENDPOINT"),
                    token_endpoint=_env("SSO_OIDC_TOKEN_ENDPOINT"),
                )
            )
            continue
        try:
            providers.append(build_provider(n))
        except SSOConfigError as e:
            logger.warning("sso provider %s 构建失败(跳过): %s", n, e)
    return providers


def new_state() -> str:
    """CSRF 防护用的随机 state(Cookie/Session 存储留给 P2)。"""
    return secrets.token_urlsafe(24)
