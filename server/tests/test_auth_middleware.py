"""Bug-38 AuthMiddleware 实战验证测试.

覆盖:
  1. 公开路径放行 (静态资源/文档/健康检查/登录/回调/支付通知/白名单前缀)
  2. 鉴权路径未带 token 返回 401
  3. 鉴权路径带合法 token 通过
  4. 鉴权路径带错误 token 返回 401
  5. 黑名单 token 返回 401
  6. compat_legacy_paths 旧路径透传到新路径
  7. 状态写入 request.state
"""

import os

# 触发纯逻辑测试, 跳过 DB schema 初始化
os.environ.setdefault("SKIP_SCHEMA_INIT", "1")

import pytest
from starlette.requests import Request
from starlette.responses import PlainTextResponse

from app.middleware.auth_middleware import (
    AuthMiddleware,
    _is_public,
    _normalize_path,
)

# ---------------------------------------------------------------------------
# 路径白名单
# ---------------------------------------------------------------------------


def test_normalize_path_passthrough():
    """已是新路径, 不应被改写."""
    assert _normalize_path("/api/v1/users/me") == "/api/v1/users/me"


def test_normalize_path_coze_compat():
    """cozeZhsApi 旧路径 → /api/v1/*."""
    assert _normalize_path("/cozeZhsApi/auth/login") == "/api/v1/auth/login"


def test_normalize_path_auth_legacy():
    """/auth/* → /api/v1/auth/*."""
    assert _normalize_path("/auth/login/username") == "/api/v1/auth/login/username"


def test_normalize_path_ai_login_pwd():
    """/ai/login/pwd/* → /api/v1/auth/*."""
    assert _normalize_path("/ai/login/pwd/login") == "/api/v1/auth/login"


def test_normalize_path_ai_agent():
    """/ai/agent/* → /api/v1/agents/*."""
    assert _normalize_path("/ai/agent/list") == "/api/v1/agents/list"


def test_normalize_path_ai_user():
    """/ai/user/* → /api/v1/user/*."""
    assert _normalize_path("/ai/user/profile") == "/api/v1/user/profile"


def test_normalize_path_code_alias():
    """/code → /api/v1/auth/captcha."""
    assert _normalize_path("/code") == "/api/v1/auth/captcha"


def test_is_public_static():
    """静态资源放行."""
    assert _is_public("/static/css/style.css") is True
    assert _is_public("/static/js/app.js") is True


def test_is_public_health():
    """健康检查放行."""
    for p in ("/health", "/healthz", "/readyz"):
        assert _is_public(p) is True, f"{p} 应放行"


def test_is_public_docs():
    """API 文档放行."""
    for p in ("/docs", "/openapi.json", "/redoc"):
        assert _is_public(p) is True, f"{p} 应放行"


def test_is_public_auth_namespace():
    """/api/v1/auth/* 全部放行 (登录/回调/验证码)."""
    for p in (
        "/api/v1/auth/login",
        "/api/v1/auth/login/sms",
        "/api/v1/auth/captcha",
        "/api/v1/auth/wechat/login",
        "/api/v1/auth/oauth/token",
    ):
        assert _is_public(p) is True, f"{p} 应放行"


def test_is_public_payment_notify():
    """支付回调放行 (异步通知无 JWT)."""
    assert _is_public("/api/v1/payments/alipay/notify") is True
    assert _is_public("/api/v1/payments/wechat/notify") is True


def test_is_public_legacy_compat():
    """旧路径兼容前缀放行."""
    assert _is_public("/cozeZhsApi/auth/login") is True
    assert _is_public("/auth/login/username") is True
    assert _is_public("/ai/login/pwd/login") is True
    assert _is_public("/ai/agent/list") is True


def test_is_private_business_path():
    """业务接口默认要鉴权."""
    for p in (
        "/api/v1/users/me",
        "/api/v1/orders",
        "/api/v1/admin/users",
    ):
        assert _is_public(p) is False, f"{p} 应要求鉴权"


# ---------------------------------------------------------------------------
# Async dispatch 实战
# ---------------------------------------------------------------------------


def _build_request(path: str, headers: dict | None = None) -> Request:
    """构造一个最小可用的 Request (用于 dispatch 单元测试)."""
    raw_headers = []
    for k, v in (headers or {}).items():
        raw_headers.append((k.lower().encode("latin-1"), v.encode("latin-1")))
    scope = {
        "type": "http",
        "method": "GET",
        "path": path,
        "raw_path": path.encode("latin-1"),
        "query_string": b"",
        "headers": raw_headers,
        "server": ("testserver", 80),
        "client": ("testclient", 50000),
        "scheme": "http",
    }
    return Request(scope)


@pytest.mark.asyncio
async def test_dispatch_public_path_passes_through():
    """公开路径直接放行, 不校验 token."""

    async def call_next(req):
        return PlainTextResponse("ok")

    middleware = AuthMiddleware(app=None)
    req = _build_request("/healthz")
    resp = await middleware.dispatch(req, call_next)
    assert resp.status_code == 200
    assert b"ok" in resp.body


@pytest.mark.asyncio
async def test_dispatch_private_no_token_returns_401():
    """业务路径未带 token → 401."""

    async def call_next(req):
        return PlainTextResponse("never reached")

    middleware = AuthMiddleware(app=None)
    req = _build_request("/api/v1/users/me")
    resp = await middleware.dispatch(req, call_next)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_dispatch_private_invalid_token_returns_401():
    """业务路径带错误 token → 401."""

    async def call_next(req):
        return PlainTextResponse("never reached")

    middleware = AuthMiddleware(app=None)
    req = _build_request(
        "/api/v1/users/me",
        headers={"authorization": "Bearer invalid.jwt.token"},
    )
    resp = await middleware.dispatch(req, call_next)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_dispatch_private_revoked_token_returns_401(monkeypatch):
    """业务路径带黑名单 token → 401."""
    from app.core import jwt_blacklist

    monkeypatch.setattr(jwt_blacklist, "is_jwt_revoked", lambda t: True)

    async def call_next(req):
        return PlainTextResponse("never reached")

    middleware = AuthMiddleware(app=None)
    # 用一个明显无效的 token 字符串, 因为黑名单检查会先拦截
    req = _build_request(
        "/api/v1/users/me",
        headers={"authorization": "Bearer any.token.value"},
    )
    resp = await middleware.dispatch(req, call_next)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_dispatch_legacy_path_passes_through():
    """旧路径 /cozeZhsApi/* 应被认作公开 (在白名单前缀中)."""

    async def call_next(req):
        return PlainTextResponse("legacy ok")

    middleware = AuthMiddleware(app=None)
    req = _build_request("/cozeZhsApi/auth/login")
    resp = await middleware.dispatch(req, call_next)
    assert resp.status_code == 200
    assert b"legacy ok" in resp.body


@pytest.mark.asyncio
async def test_dispatch_query_param_token_works(monkeypatch):
    """?token= 兜底也能鉴权通过 (Bug-11 修复)."""
    from app.middleware import auth_middleware as am

    def fake_decode(t):
        return {"sub": "u-1", "exp": 9999999999, "iat": 0}

    # 中间件内部用的是 am._security.decode_access_token (模块级 import as 别名),
    # 如果 round2 测试 reload 了 app.security, am._security 可能指向旧对象.
    # 我们直接 patch 当前 am._security 引用的那个模块的 decode_access_token.
    monkeypatch.setattr(am._security, "decode_access_token", fake_decode)
    # 黑名单检查放行
    from app.core import jwt_blacklist

    monkeypatch.setattr(jwt_blacklist, "is_jwt_revoked", lambda t: False)

    state_seen = {}

    async def call_next(req):
        state_seen["user_uuid"] = req.state.user_uuid
        return PlainTextResponse("query-token ok")

    # 用一个干净 scope + 真实 TokenAuthMiddleware 实例
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/users/me",
        "raw_path": b"/api/v1/users/me",
        "query_string": b"token=any.value",
        "headers": [],
        "server": ("testserver", 80),
        "client": ("testclient", 50000),
        "scheme": "http",
    }
    req = Request(scope)

    middleware = AuthMiddleware(app=None)
    resp = await middleware.dispatch(req, call_next)
    assert resp.status_code == 200, (
        f"期望 200 实际 {resp.status_code}, " f"detail={getattr(resp, 'body', b'').decode(errors='ignore')}"
    )
    assert state_seen.get("user_uuid") == "u-1"


@pytest.mark.asyncio
async def test_dispatch_root_path_passes_through():
    """根路径 / 不在 /api/v1/ 下, 应直接放行."""

    async def call_next(req):
        return PlainTextResponse("root ok")

    middleware = AuthMiddleware(app=None)
    req = _build_request("/")
    resp = await middleware.dispatch(req, call_next)
    assert resp.status_code == 200
