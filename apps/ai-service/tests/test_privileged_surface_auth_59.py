# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""O19 特权 router 面收权回归:白名单不得让无端点级鉴权的 router 匿名可达。

背景(本机实测复现,非推测):部署机 .env 的 JWT_PUBLIC_PATHS 含目录前缀 `/api/agents/`,
使 routers/agents.py 全部端点匿名可达 —— 匿名可 GET /api/agents/sessions 列出全站会话、
POST /api/agents/approval-response 抵达决策写入点(人工审批门被第三方自行批准)、
订阅 GET /api/agents/tasks/stream 收到他人会话实时工具事件。对照:`/api/agent/security-config`
(单数,不被该前缀命中)与 `/api/mcp` 均正确 401。

本文件钉两层(与 tests/test_session_import_auth.py 同一范式:conftest._isolate_jwt_auth
把中间件降级为放行,故本模块整体打 real_jwt 标记绕开该隔离):
  1) 解析层:_resolve_public_paths 对特权 router 根 / catch-all 一律剔除;
  2) 判定层:把**真实 JWTAuthMiddleware** 装到最小 app 上发匿名请求,以"是否抵达 handler"为判据。

另附一条支撑撤销理由的断言:撤掉白名单后 EventSource 类调用仍可通过
auth_token cookie 完成鉴权(前端无法给 EventSource 加 Authorization header,这是当初
"只能放行"的说法来源,而它忽略了中间件本就有的 cookie 兜底)。
"""

from __future__ import annotations

import time
from collections.abc import Iterator

import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from app.core import jwt_auth
from app.core.config import settings
from app.core.jwt_auth import JWTAuthMiddleware

pytestmark = pytest.mark.real_jwt

JWT_TEST_SECRET = "test-jwt-secret-for-privileged-surface-auth-only"

# 特权 router 根下各种写法(目录前缀 / 裸根 / 精确到端点)都必须剔除
AGENTS_ENTRIES = (
    "/api/agents/",
    "/api/agents",
    "/api/agents/approval-response",
    "/api/agents/tasks/stream",
    "/api/agents/execute",
)
# 匿名请求必须被拦下的实际请求路径
AGENTS_PATHS = (
    "/api/agents/sessions",
    "/api/agents/approval-response",
    "/api/agents/tasks/stream",
    "/api/agents/execute",
    "/api/agents/conv-1/cancel",
)
CATCH_ALL_ENTRIES = ("/", "/api", "/api/")
LEGITIMATE_ENTRY = "/api/health"


def _reference_rule(path: str, entries: tuple[str, ...]) -> bool:
    """测试侧独立匹配契约:非目录条目精确匹配,目录条目(以 / 结尾)才前缀匹配。"""
    return path in entries or any(path.startswith(p) for p in entries if p.endswith("/"))


async def _passed_through(request: Request) -> JSONResponse:
    return JSONResponse({"reached_handler": True})


def _probe_app() -> Starlette:
    return Starlette(
        routes=[Route("/{rest:path}", _passed_through, methods=["GET", "POST"])],
        middleware=[Middleware(JWTAuthMiddleware)],
    )


@pytest.fixture(autouse=True)
def _forbid_production_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """AGENTS.md §5 测试隔离铁律:本文件用例零 DB 触达(建池即报错)。"""

    async def _no_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("鉴权回归用例不得创建 asyncpg 连接池(生产库禁连)")

    monkeypatch.setattr("asyncpg.create_pool", _no_pool)


@pytest.fixture
def enforce_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", JWT_TEST_SECRET)


@pytest.fixture
def hostile_whitelist(monkeypatch: pytest.MonkeyPatch) -> tuple[str, ...]:
    """把"带毒 .env"喂回解析器,并让中间件用解析结果 —— 模拟有人把前缀加回去的现场。"""
    hostile = ",".join(
        (LEGITIMATE_ENTRY, "/health", *AGENTS_ENTRIES, *CATCH_ALL_ENTRIES, "/api/mcp/")
    )
    resolved = jwt_auth._resolve_public_paths(hostile)
    monkeypatch.setattr(jwt_auth, "PUBLIC_PATHS", resolved)
    return resolved


@pytest.fixture
async def probe_client(enforce_jwt: None) -> Iterator[AsyncClient]:
    transport = ASGITransport(app=_probe_app())
    async with AsyncClient(transport=transport, base_url="http://probe.test") as ac:
        yield ac


def _access_token(sub: str = "user-owner") -> str:
    return jwt.encode(
        {
            "sub": sub,
            "type": "access",
            "roleId": 2,
            "aud": "ihui-ai-users",
            "iss": settings.jwt_issuer,
            "exp": int(time.time()) + 300,
        },
        JWT_TEST_SECRET,
        algorithm="HS256",
    )


# ---------------------------------------------------------------------------
# 1. 解析层:特权 router 根与 catch-all 一律剔除
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("entry", AGENTS_ENTRIES)
def test_agents_root_never_anonymous_even_if_configured(entry: str) -> None:
    resolved = jwt_auth._resolve_public_paths(f"{LEGITIMATE_ENTRY},{entry}")
    assert entry not in resolved, f"{entry} 必须被剔除,实得 {resolved}"
    assert LEGITIMATE_ENTRY in resolved


def test_agents_root_does_not_over_strip_other_entries() -> None:
    """剔除必须精确到根:同前缀但不同 router 的 /api/agent(单数)是合法可配条目,不得误伤。"""
    resolved = jwt_auth._resolve_public_paths("/api/agents/,/api/agent/security-config")
    assert "/api/agent/security-config" in resolved, resolved
    assert "/api/agents/" not in resolved, resolved


@pytest.mark.parametrize("entry", CATCH_ALL_ENTRIES)
def test_catchall_entry_never_anonymous(entry: str) -> None:
    resolved = jwt_auth._resolve_public_paths(f"{LEGITIMATE_ENTRY},{entry}")
    assert entry not in resolved, f"catch-all 条目 {entry!r} 必须被剔除"


def test_live_effective_whitelist_has_no_privileged_root() -> None:
    """对**本机真实生效名单**断言(读 .env 覆盖值):/api/agents 与 /api/mcp 都不在其中。

    .env 干净时通过 = 配置正确;.env 带毒时也通过 = fail-safe 生效。两种情形都不该红。
    """
    for entry in jwt_auth.PUBLIC_PATHS:
        assert not jwt_auth._is_never_public(entry), f"生效名单混入特权条目 {entry!r}"
        assert not entry.startswith("/api/agents"), entry
        assert entry not in ("/", "/api", "/api/")


# ---------------------------------------------------------------------------
# 2. 判定层:带毒名单下真实中间件仍拦住匿名请求
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("path", AGENTS_PATHS)
async def test_anonymous_agents_request_requires_auth(
    probe_client: AsyncClient, hostile_whitelist: tuple[str, ...], path: str
) -> None:
    resp = await probe_client.get(path)
    assert resp.status_code == 401, f"{path} 必须走 JWT 鉴权(实得 {resp.status_code})"
    assert resp.json()["message"] == "Authentication required"
    assert "reached_handler" not in resp.json()


async def test_resolved_whitelist_still_matches_reference_rule(
    probe_client: AsyncClient, hostile_whitelist: tuple[str, ...]
) -> None:
    """剔除后剩余名单的行为仍与匹配契约一致(防止剔除逻辑把白名单整体改成恒放行/恒拦)。"""
    for path in (*hostile_whitelist, *AGENTS_PATHS, "/totally/unknown"):
        resp = await probe_client.get(path)
        passed_through = resp.status_code == 200
        assert passed_through is _reference_rule(path, hostile_whitelist), path


# ---------------------------------------------------------------------------
# 3. 撤销理由支撑:cookie 兜底让 EventSource 类调用仍然可用
# ---------------------------------------------------------------------------


async def test_cookie_only_request_passes_agents_path(
    enforce_jwt: None, hostile_whitelist: tuple[str, ...]
) -> None:
    """无 Authorization、仅 auth_token cookie → 放行。

    这是撤掉 /api/agents/ 白名单后前端 EventSource 仍能工作的依据:浏览器同源请求自动带
    HttpOnly cookie,而中间件有 cookie 兜底(jwt_auth.py)。cookie 按 host 分区不分 port,
    故 apps/api 登录下发的 cookie 对 8801/8803 同源请求均生效。
    """
    transport = ASGITransport(app=_probe_app())
    async with AsyncClient(
        transport=transport,
        base_url="http://probe.test",
        cookies={"auth_token": _access_token()},
    ) as ac:
        resp = await ac.get("/api/agents/tasks/stream")
    assert resp.status_code == 200, resp.text
    assert resp.json()["reached_handler"] is True


async def test_refresh_type_cookie_is_rejected(enforce_jwt: None) -> None:
    """cookie 兜底不得成为弱校验通道:refresh token 一律 401。"""
    token = jwt.encode(
        {
            "sub": "user-owner",
            "type": "refresh",
            "aud": "ihui-ai-users",
            "iss": settings.jwt_issuer,
            "exp": int(time.time()) + 300,
        },
        JWT_TEST_SECRET,
        algorithm="HS256",
    )
    transport = ASGITransport(app=_probe_app())
    async with AsyncClient(
        transport=transport, base_url="http://probe.test", cookies={"auth_token": token}
    ) as ac:
        resp = await ac.get("/api/agents/sessions")
    assert resp.status_code == 401, resp.text


# ---------------------------------------------------------------------------
# 4. 身份解析 helper 的降级边界(端点级属主校验依赖它)
# ---------------------------------------------------------------------------


def test_dev_fallback_only_when_auth_not_enforced(monkeypatch: pytest.MonkeyPatch) -> None:
    """jwt_secret 为空 + development(中间件自身也 no-op)才可回落单一 dev 身份;
    一旦启用鉴权,缺失身份必须 401 —— 白名单命中也不例外。"""
    from app.core.jwt_auth import (
        DEV_ANONYMOUS_PRINCIPAL,
        auth_globally_enforced,
        require_request_user_id,
    )

    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")
    assert auth_globally_enforced() is False

    monkeypatch.setattr(settings, "jwt_secret", JWT_TEST_SECRET)
    assert auth_globally_enforced() is True

    class _NoAuthState:
        user_id = None

    class _Req:
        state = _NoAuthState()

    async def _call() -> str:
        return await require_request_user_id(_Req())  # type: ignore[arg-type]

    import asyncio

    from fastapi import HTTPException

    monkeypatch.setattr(settings, "jwt_secret", "")
    assert asyncio.run(_call()) == DEV_ANONYMOUS_PRINCIPAL

    monkeypatch.setattr(settings, "jwt_secret", JWT_TEST_SECRET)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(_call())
    assert exc.value.status_code == 401
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
