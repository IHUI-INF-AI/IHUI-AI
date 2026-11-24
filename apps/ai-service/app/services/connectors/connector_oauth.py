# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""连接器「用户授权(user_access_token)」链路 —— 让 AI 以用户本人身份调用平台 API。

背景(2026-11-24):
    连接器此前只有「平台应用凭据托管」(tenant_access_token),用户点一键接入后
    AI 只能以应用身份调用。台账里飞书 164 条 API 明确需要 ``feishu_user`` 用户态
    令牌(如通讯录个人字段、日历、云文档个人空间),tenant 令牌调用必失败。
    用户诉求:扫码连自己的账号后 AI 都能调得通 —— 必须有 user token 的完整
    授权→换取→加密存储→注入→刷新链路。

本模块职责(纯逻辑,不触网、不碰 DB):
    - 三平台 OAuth 参数表(授权 URL / token 端点 / 字段映射),单源;
    - state 生成与校验(CSRF 防护:state 绑定用户+平台+时间戳,HMAC 签名,TTL);
    - token 换取/刷新的**请求构造**(真正 HTTP 由调用方注入,便于单测隔离);
    - user token 的加密/解密封装(复用 credentials_crypto AES-256-GCM)。

安全纪律:
    - state 必须 HMAC 签名 + 短 TTL,绝不接收回调里未签名的 state 直接放行;
    - 令牌密文存 connector extra,明文永不进响应/日志;
    - 平台仅启用飞书(端点已官方文档核实);钉钉/企微端点未核实前 disabled,
      授权请求直接拒绝,绝不编造端点。

失效方向:配置缺失/平台未启用/令牌损坏 ⇒ 显式拒绝,不静默降级成 tenant 令牌。
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Callable, Coroutine

logger = logging.getLogger(__name__)

# 免水印声明:本文件为凭证安全核心,水印置于首行注释(above)。

# state TTL(秒):OAuth 授权码一般 5 分钟有效,state 略宽松到 10 分钟。
STATE_TTL_SECONDS = 600
# 令牌提前刷新窗口(秒):过期前 5 分钟内主动刷新。
REFRESH_SKEW_SECONDS = 300

# 用户令牌在 connector.extra 下的键名(密文)。
USER_TOKEN_EXTRA_KEY = "user_oauth"
_TOKEN_CIPHER_PREFIX = "enc:user-oauth:v1:"


class ConnectorOAuthError(RuntimeError):
    """用户授权链路的可预期失败(配置缺失/state 非法/令牌损坏/平台未启用)。"""


@dataclass(frozen=True)
class OAuthProviderConfig:
    """单一平台的用户 OAuth 参数(全部来自官方文档,未经核实不得填)。"""

    platform: str
    authorize_url: str
    token_url: str
    # 授权页参数名差异:飞书/钉钉用 client_id(即 app_id)
    client_id_param: str
    # token 端点请求体字段名(飞书 snake_case;钉钉 camelCase)
    token_client_id_param: str = "client_id"
    token_secret_param: str = "client_secret"
    token_grant_param: str = "grant_type"
    token_code_param: str = "code"
    token_refresh_param: str = "refresh_token"
    # token 端点响应字段名(飞书 snake_case;钉钉 camelCase)
    resp_access_token: str = "access_token"
    resp_refresh_token: str = "refresh_token"
    resp_expires_in: str = "expires_in"
    # 换取 token 的 grant_type 值
    exchange_grant_type: str = "authorization_code"
    # 刷新 token 的 grant_type 值
    refresh_grant_type: str = "refresh_token"
    # 授权页额外固定参数(钉钉需 scope=openid + prompt=consent)
    authorize_extra_params: tuple[tuple[str, str], ...] = ()
    # 是否启用(端点未经官方文档核实的平台保持 False)
    enabled: bool = False
    docs: str = ""
    # 未启用原因(区分「端点未核实」与「协议不提供 per-user token」)
    disabled_reason: str = ""


# 端点来源(2026-11-24 官方文档实测,均为官方域原文):
# 飞书:
# - 授权: https://open.feishu.cn/open-apis/authen/v1/authorize
# - 换取/刷新: https://open.feishu.cn/open-apis/authen/v2/oauth/token
#   (官方「刷新 user_access_token」页「基本 HTTP URL」原文)
# 钉钉:
# - 授权: https://login.dingtalk.com/oauth2/auth
#   (官方「获取登录用户的访问凭证」页参数表原文:redirect_uri/response_type=code/
#    client_id/scope=openid/state/prompt=consent)
# - 换取/刷新: https://api.dingtalk.com/v1.0/oauth2/userAccessToken
#   (官方「获取用户token」页原文:POST,body clientId/clientSecret/code/
#    refreshToken/grantType=authorization_code|refresh_token;
#    响应 accessToken/refreshToken/expireIn/corpId)
PROVIDERS: dict[str, OAuthProviderConfig] = {
    "feishu": OAuthProviderConfig(
        platform="feishu",
        authorize_url="https://open.feishu.cn/open-apis/authen/v1/authorize",
        token_url="https://open.feishu.cn/open-apis/authen/v2/oauth/token",
        client_id_param="client_id",
        enabled=True,
        docs="https://open.feishu.cn/document/common-capabilities/sso/web-application-sso",
    ),
    "dingtalk": OAuthProviderConfig(
        platform="dingtalk",
        authorize_url="https://login.dingtalk.com/oauth2/auth",
        token_url="https://api.dingtalk.com/v1.0/oauth2/userAccessToken",
        client_id_param="client_id",
        token_client_id_param="clientId",
        token_secret_param="clientSecret",
        token_grant_param="grantType",
        token_code_param="code",
        token_refresh_param="refreshToken",
        resp_access_token="accessToken",
        resp_refresh_token="refreshToken",
        resp_expires_in="expireIn",
        authorize_extra_params=(("scope", "openid"), ("prompt", "consent")),
        enabled=True,
        docs="https://open.dingtalk.com/document/orgapp/obtain-identity-credentials",
    ),
    # 企微 OAuth 网页授权只返回 userid/user_ticket(官方「构造网页授权链接」/
    # 「获取访问用户身份」页),**不提供 per-user access_token**;所有企微 API 均以
    # 应用 access_token(/cgi-bin/gettoken)调用。因此无法构造「以用户身份注入」的
    # user token 链路 —— 保持 disabled,这不是端点未核实,是协议层不成立。
    "wecom": OAuthProviderConfig(
        platform="wecom",
        authorize_url="",
        token_url="",
        client_id_param="appid",
        enabled=False,
        disabled_reason=(
            "企业微信 OAuth 网页授权只返回 userid/user_ticket,协议不提供 per-user "
            "access_token;API 均以应用身份调用,无法以用户本人身份注入令牌"
        ),
        docs="https://developer.work.weixin.qq.com/document/path/91022",
    ),
}


def provider(platform: str) -> OAuthProviderConfig:
    cfg = PROVIDERS.get(platform)
    if cfg is None:
        raise ConnectorOAuthError(f"不支持用户授权的平台: {platform}")
    if not cfg.enabled:
        reason = cfg.disabled_reason or "端点尚未经官方文档核实"
        raise ConnectorOAuthError(f"{platform} 的用户授权暂未启用:{reason};请使用应用身份凭据")
    return cfg


# ---------------------------------------------------------------------------
# state: HMAC 签名 + TTL(CSRF 防护)
# ---------------------------------------------------------------------------


def _state_secret() -> bytes:
    """state 签名密钥:优先环境变量,否则从 credentials_encryption_key 派生。

    与 app_secret 加密共用一把根密钥的不同派生,避免再引入一份密钥配置。
    """
    raw = os.environ.get("CONNECTOR_OAUTH_STATE_SECRET", "").strip()
    if not raw:
        from app.core.config import settings

        raw = str(getattr(settings, "credentials_encryption_key", "") or "")
    if not raw:
        raise ConnectorOAuthError("未配置 CONNECTOR_OAUTH_STATE_SECRET / credentials_encryption_key")
    return hashlib.sha256(("connector-oauth-state:" + raw).encode()).digest()


def make_state(
    platform: str,
    owner: str,
    *,
    user_id: str = "",
    tenant_id: str = "",
    now: float | None = None,
) -> str:
    """生成绑定(平台, 归属, 时间)的签名 state。

    形状: ``base64url(payload).base64url(sig)``;payload 含 platform/owner/iat/nonce。
    ``owner`` 是连接器检索作用域(个人=user_id,租户=tenant_id),``user_id`` 是发起
    授权的真实用户,``tenant_id`` 是存储隔离键 —— 三者全部进签名,回调须原样回传,
    确保用户令牌落到与 list/invoke 完全相同的作用域,否则 AI 列不到也调不到。
    """
    import base64
    import secrets

    ts = now if now is not None else time.time()
    payload = {
        "p": platform,
        "o": owner,
        "u": user_id,
        "t": tenant_id,
        "iat": int(ts),
        "n": secrets.token_hex(8),
    }
    body = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    ).decode().rstrip("=")
    sig = hmac.new(_state_secret(), body.encode(), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode().rstrip("=")
    return f"{body}.{sig_b64}"


def verify_state(state: str, platform: str, owner: str, *, now: float | None = None) -> None:
    """校验 state 签名、平台、归属与 TTL;任一不符抛 ConnectorOAuthError。"""
    import base64

    if not state or "." not in state:
        raise ConnectorOAuthError("state 格式非法")
    body, sig_b64 = state.rsplit(".", 1)
    try:
        sig = base64.urlsafe_b64decode(sig_b64 + "=" * (-len(sig_b64) % 4))
        expected = hmac.new(_state_secret(), body.encode(), hashlib.sha256).digest()
    except Exception as exc:  # noqa: BLE001
        raise ConnectorOAuthError("state 签名解码失败") from exc
    if not hmac.compare_digest(sig, expected):
        raise ConnectorOAuthError("state 签名校验失败(可能伪造)")
    try:
        payload = json.loads(
            base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)).decode()
        )
    except Exception as exc:  # noqa: BLE001
        raise ConnectorOAuthError("state 载荷解码失败") from exc
    if payload.get("p") != platform or payload.get("o") != owner:
        raise ConnectorOAuthError("state 与当前平台/用户不匹配(可能 CSRF)")
    ts = now if now is not None else time.time()
    iat = int(payload.get("iat") or 0)
    if iat <= 0 or ts - iat > STATE_TTL_SECONDS or iat - ts > 60:
        raise ConnectorOAuthError("state 已过期或时间戳异常")


# ---------------------------------------------------------------------------
# token 密文存储
# ---------------------------------------------------------------------------


def encrypt_user_token(token: dict[str, Any]) -> str:
    """加密 user token 载荷到可存 jsonb 的字符串。"""
    from app.services.publish.credentials_crypto import encrypt

    return _TOKEN_CIPHER_PREFIX + encrypt(dict(token))


def decrypt_user_token(value: str) -> dict[str, Any]:
    """解密;密文损坏/密钥不匹配抛 ConnectorOAuthError(fail-closed)。"""
    if not value or not value.startswith(_TOKEN_CIPHER_PREFIX):
        raise ConnectorOAuthError("用户令牌不存在或格式非法")
    try:
        from app.services.publish.credentials_crypto import decrypt

        payload = decrypt(value[len(_TOKEN_CIPHER_PREFIX) :])
    except Exception as exc:  # noqa: BLE001
        raise ConnectorOAuthError("用户令牌解密失败(密钥不匹配或密文损坏)") from exc
    if not isinstance(payload, dict) or not payload.get("access_token"):
        raise ConnectorOAuthError("用户令牌载荷缺少 access_token")
    return payload


# ---------------------------------------------------------------------------
# token 换取 / 刷新(请求构造,HTTP 注入)
# ---------------------------------------------------------------------------

# 注入的 HTTP 函数签名: async (url, json_body) -> dict
HttpJson = Callable[[str, dict[str, Any]], Coroutine[Any, Any, dict[str, Any]]]


def build_exchange_body(
    config: OAuthProviderConfig, code: str, *, app_id: str, app_secret: str, redirect_uri: str
) -> dict[str, Any]:
    """构造 code→user_access_token 请求体。

    字段名按平台 config 映射:飞书 v2 snake_case 且带 redirect_uri;钉钉 v1.0
    camelCase( ``grantType/clientId/clientSecret/code`` )且**不带** redirect_uri
    (官方「获取用户token」body 参数表无此字段,多传可能被拒)。
    """
    body: dict[str, Any] = {
        config.token_grant_param: config.exchange_grant_type,
        config.token_client_id_param: app_id,
        config.token_secret_param: app_secret,
        config.token_code_param: code,
    }
    if config.platform == "feishu":
        body["redirect_uri"] = redirect_uri
    return body


def build_refresh_body(
    config: OAuthProviderConfig, refresh_token: str, *, app_id: str, app_secret: str
) -> dict[str, Any]:
    """构造 refresh_token→user_access_token 请求体(字段名按平台映射)。"""
    return {
        config.token_grant_param: config.refresh_grant_type,
        config.token_client_id_param: app_id,
        config.token_secret_param: app_secret,
        config.token_refresh_param: refresh_token,
    }


def normalize_token_response(
    data: dict[str, Any], *, config: OAuthProviderConfig | None = None, now: float | None = None
) -> dict[str, Any]:
    """把平台 token 响应规范成统一存储形状,带本地过期时间。

    ``config`` 缺省沿用飞书 snake_case(测试与历史调用兼容);钉钉传入自身 config,
    按 ``accessToken/refreshToken/expireIn`` 取值。
    """
    cfg = config
    access = str(data.get(cfg.resp_access_token if cfg else "access_token") or "")
    if not access:
        raise ConnectorOAuthError("平台未返回 access_token")
    ts = now if now is not None else time.time()
    expires_in = data.get(cfg.resp_expires_in if cfg else "expires_in")
    try:
        expires_in = int(expires_in) if expires_in is not None else 0
    except (TypeError, ValueError):
        expires_in = 0
    return {
        "access_token": access,
        "refresh_token": str(data.get(cfg.resp_refresh_token if cfg else "refresh_token") or ""),
        "expires_at": ts + expires_in if expires_in > 0 else 0,
        "token_type": str(data.get("token_type") or "Bearer"),
        "scope": str(data.get("scope") or ""),
    }


def needs_refresh(token: dict[str, Any], *, now: float | None = None) -> bool:
    """判断 user token 是否需刷新(无过期时间视为不过期,由平台返回错误再触发)。"""
    expires_at = int(token.get("expires_at") or 0)
    if expires_at <= 0:
        return False
    ts = now if now is not None else time.time()
    return expires_at - ts <= REFRESH_SKEW_SECONDS


async def exchange_code(
    config: OAuthProviderConfig,
    code: str,
    *,
    app_id: str,
    app_secret: str,
    redirect_uri: str,
    http_json: HttpJson,
) -> dict[str, Any]:
    """用授权码换 user token;返回规范化的加密前载荷。"""
    body = build_exchange_body(config, code, app_id=app_id, app_secret=app_secret, redirect_uri=redirect_uri)
    data = await http_json(config.token_url, body)
    if not isinstance(data, dict):
        raise ConnectorOAuthError("token 端点返回非对象")
    return normalize_token_response(data, config=config)


async def refresh_user_token(
    config: OAuthProviderConfig,
    token: dict[str, Any],
    *,
    app_id: str,
    app_secret: str,
    http_json: HttpJson,
) -> dict[str, Any]:
    """刷新 user token;平台可能不回 refresh_token,沿用旧值。"""
    rt = str(token.get("refresh_token") or "")
    if not rt:
        raise ConnectorOAuthError("refresh_token 缺失,需用户重新授权")
    body = build_refresh_body(config, rt, app_id=app_id, app_secret=app_secret)
    data = await http_json(config.token_url, body)
    if not isinstance(data, dict):
        raise ConnectorOAuthError("刷新端点返回非对象")
    refreshed = normalize_token_response(data, config=config)
    if not refreshed.get("refresh_token"):
        refreshed["refresh_token"] = rt
    return refreshed
