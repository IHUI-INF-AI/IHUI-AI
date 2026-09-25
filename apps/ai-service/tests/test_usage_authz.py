# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P0 水平越权收口(2026-09-25):/api/v1/ai/usage/* 端点级属主对齐回归。

立项事实:`app/routers/usage.py` 的 /stats 与 /quota 原本写的是
`uid = user_id or request.state.user_id` —— **自报的 user_id 优先于令牌主体**,而参数说明里
那句"(管理员用)"在这个文件里没有任何对应校验。于是任何已登录用户带上
`?user_id=<别人的 UUID>` 就能读到别人的用量与配额(认证 ≠ 授权)。
这个洞此前无人看见,是因为守门 117 的两条正则只认 `user_id: str = Query(...)`,
而本仓 python 侧已普遍写成 `user_id: str | None = Query(...)` ⇒ 该门扫到 0 个端点、
一路 exit 0(同一票里把正则补宽)。

钉死四条:
  1. 无身份(不挂中间件的最小 app + 非空 jwt_secret)→ 401;
  2. 令牌主体 A 带 user_id=B → 403,且**服务层一次都没被调用**;
  3. 令牌主体 A 不传 user_id → 200,服务层**确实被调用**(少了这条,2 的"未调用"
     在 stub 根本没接上的世界里也永远成立 —— 判据就成了摆设);
  4. 管理员令牌(roleId≥1)带 user_id=B → 200 且服务层收到的是 B(收紧没有把正当的
     管理员视图打死)。

测试隔离(AGENTS.md §5):服务层全部 monkeypatch 成内存 stub,建池即报错,零生产 PG 触达。
"""

from __future__ import annotations

import time
import types
from typing import Any

import jwt
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core import jwt_auth
from app.core.config import settings
from app.routers import usage as usage_api

pytestmark = pytest.mark.real_jwt

TEST_SECRET = "test-jwt-secret-for-usage-authz-only"
USER_A = "user-a-usage-authz"
USER_B = "user-b-usage-authz"

_SEEN: list[tuple[str, Any]] = []
"""服务层调用记录 (方法名, 传入的 uid)。越权/无身份用例断言它为空,正例断言它非空。"""


def _token(user_id: str, role_id: int = 0) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": user_id,
            "roleId": role_id,
            "type": "access",
            "iss": settings.jwt_issuer,
            "aud": "ihui-ai-users",
            "iat": now,
            "exp": now + 3600,
        },
        TEST_SECRET,
        algorithm="HS256",
    )


def _auth(user_id: str, role_id: int = 0) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(user_id, role_id)}"}


@pytest.fixture(autouse=True)
def _forbid_production_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """AGENTS.md §5 铁律:本文件用例零 DB 触达(建池即报错)。"""

    async def _no_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("属主对齐回归不得创建 asyncpg 连接池(生产库禁连)")

    monkeypatch.setattr("asyncpg.create_pool", _no_pool)


@pytest.fixture(autouse=True)
def _enforce_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    """非空 jwt_secret ⇒ auth_globally_enforced() 为真,不允许 dev 降级身份。"""
    monkeypatch.setattr(settings, "jwt_secret", TEST_SECRET)
    monkeypatch.setattr(jwt_auth.settings, "jwt_secret", TEST_SECRET)


@pytest.fixture(autouse=True)
def _stub_usage_service(monkeypatch: pytest.MonkeyPatch) -> None:
    _SEEN.clear()

    def _stats(user_id: str, **kwargs: object) -> dict[str, Any]:
        _SEEN.append(("get_user_stats", user_id))
        return {"user_id": user_id}

    def _quota(user_id: str) -> dict[str, Any]:
        _SEEN.append(("get_quota_info", user_id))
        return {"user_id": user_id}

    def _record(**kwargs: Any) -> Any:
        _SEEN.append(("record_usage", kwargs.get("user_id")))
        # 路由读的是 ORM 行的属性(record.id / .estimated_cost),stub 必须同形;
        # 用 SimpleNamespace 而不是 dict —— 第一版返回 dict 时本例以
        # AttributeError: 'dict' object has no attribute 'id' 失败,那是 stub 错不是产品错。
        return types.SimpleNamespace(id="stub-usage-row", estimated_cost=0.0)

    monkeypatch.setattr(usage_api.usage_service, "get_user_stats", _stats)
    monkeypatch.setattr(usage_api.usage_service, "get_quota_info", _quota)
    monkeypatch.setattr(usage_api.usage_service, "record_usage", _record)


def _usage_app(*, with_middleware: bool) -> FastAPI:
    app = FastAPI()
    if with_middleware:
        app.add_middleware(jwt_auth.JWTAuthMiddleware)
    app.include_router(usage_api.router)
    return app


@pytest.fixture
async def bare_client() -> Any:
    transport = ASGITransport(app=_usage_app(with_middleware=False))
    async with AsyncClient(transport=transport, base_url="http://usage-authz-bare") as ac:
        yield ac


@pytest.fixture
async def client() -> Any:
    transport = ASGITransport(app=_usage_app(with_middleware=True))
    async with AsyncClient(transport=transport, base_url="http://usage-authz") as ac:
        yield ac


#: 三个收 user_id 的落点逐一登记;将来再加一个端点不登记就该被下面的参数化漏掉。
TARGETS: tuple[tuple[str, str], ...] = (
    ("get", "/api/v1/ai/usage/stats"),
    ("get", "/api/v1/ai/usage/quota"),
)


@pytest.mark.parametrize("method,path", TARGETS)
async def test_no_identity_is_401_not_anonymous(client: Any, bare_client: Any, method: str, path: str) -> None:
    """白名单/中间件配错也漏不出去:端点级缺身份一律 401。"""
    fn = getattr(client, method)
    r = await fn(path, params={"user_id": USER_A})
    assert r.status_code == 401, f"{path} 无身份应 401,实得 {r.status_code}"
    assert _SEEN == [], "401 之前不得已经打过服务层查询"


@pytest.mark.parametrize("method,path", TARGETS)
async def test_cross_user_read_is_403(client: Any, method: str, path: str) -> None:
    """本票存在理由:A 的令牌 + B 的 user_id ⇒ 403 且零查询发出。"""
    fn = getattr(client, method)
    r = await fn(path, params={"user_id": USER_B}, headers=_auth(USER_A))
    assert r.status_code == 403, f"{path} 越权应 403,实得 {r.status_code}:{r.text[:120]}"
    assert _SEEN == [], f"越权请求不得触达服务层,实得 {_SEEN}"


@pytest.mark.parametrize("method,path", TARGETS)
async def test_self_scope_without_param(client: Any, method: str, path: str) -> None:
    """收紧不是恒拒:A 不传 user_id ⇒ 200,且服务层收到的正是 A。"""
    fn = getattr(client, method)
    r = await fn(path, headers=_auth(USER_A))
    assert r.status_code == 200, f"{path} 同主应 200,实得 {r.status_code}:{r.text[:120]}"
    assert [s[1] for s in _SEEN] == [USER_A], f"服务层应收到令牌主体 A,实得 {_SEEN}"


@pytest.mark.parametrize("method,path", TARGETS)
async def test_admin_may_still_scope_to_other(client: Any, method: str, path: str) -> None:
    """管理员(roleId=1)带 user_id=B ⇒ 正当放行,且转发的正是 B。"""
    fn = getattr(client, method)
    r = await fn(path, params={"user_id": USER_B}, headers=_auth(USER_A, role_id=1))
    assert r.status_code == 200, f"管理员视图不该被收紧打死,实得 {r.status_code}:{r.text[:120]}"
    assert [s[1] for s in _SEEN] == [USER_B], f"管理员指定的目标应原样下发,实得 {_SEEN}"


async def test_record_body_cannot_impersonate(client: Any) -> None:
    """POST /record 同口径:body 里自报 user_id 不得覆盖令牌主体。"""
    r = await client.post(
        "/api/v1/ai/usage/record",
        json={"provider": "p", "model": "m", "user_id": USER_B, "input_tokens": 1, "output_tokens": 1},
        headers=_auth(USER_A),
    )
    assert r.status_code == 403, f"record 越权写入应 403,实得 {r.status_code}:{r.text[:120]}"
    assert _SEEN == [], f"越权写入不得落库,实得 {_SEEN}"


async def test_record_without_user_uses_token_subject(client: Any) -> None:
    """同主正例:不传 user_id 的 /record 仍能记账,主体取令牌。"""
    r = await client.post(
        "/api/v1/ai/usage/record",
        json={"provider": "p", "model": "m", "input_tokens": 2, "output_tokens": 3},
        headers=_auth(USER_A),
    )
    assert r.status_code == 200, f"同主 record 应 200,实得 {r.status_code}:{r.text[:120]}"
    assert ("record_usage", USER_A) in _SEEN, f"应记录到令牌主体,实得 {_SEEN}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
