# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""记忆端点属主绑定(2026-09-25 续票):归属只从令牌主体取的那三条硬验收。

与 tests/test_memory_authz.py(并发会话已暂存的那票)的分工:那票钉的是
"跨用户必须 403 / 缺身份必须 401"(收紧没有漏),本票钉的是它**未覆盖**的三格 ——

  1. **请求不带 user_id ⇒ 归属即令牌主体**,且能正常读写自己的
     (那票的清单里 user_id 仍是必填,不传会 422;"参数说什么就是谁"的反面
     不是"参数必须说",而是"参数最多是一次一致性校验,缺席时用令牌主体");
  2. **403 且不落库** —— 只断状态码证明不了没写库。本票把服务层换成记录器,
     断言跨用户请求下服务层**一次都没被调用**,这才是"不落库"的机器载体
     (同时兜住"403 判定不得先查库"的存在性预言机型缺陷);
  3. **变异取证(判据有牙证明)**:把 `_resolve_owner` 换成"参数说什么就是谁"
     的旧语义,同一条越权请求必须**成功并以 B 的 id 抵达服务层**。缺这条,
     前两票的红可能来自夹具而不是判据 —— 摘掉判据不红的门等于没有门。

测试隔离(AGENTS.md §5):服务层全部换成内存记录器,`asyncpg.create_pool` 被替换成
抛 AssertionError —— 建池即炸,零生产 PG(8810)/Redis(8811) 触达。
"""

from __future__ import annotations

import time
from typing import Any

import jwt
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api import memory as memory_api
from app.core import jwt_auth
from app.core.config import settings

pytestmark = pytest.mark.real_jwt

TEST_SECRET = "test-jwt-secret-for-memory-owner-binding"
USER_A = "user-a-owner-binding"
USER_B = "user-b-owner-binding"

# (method, path, 省略 user_id 的其余入参, 该端点必经的服务层方法) —— 8 个收 user_id
# 的端点逐一登记,任一端的"缺席即取令牌主体"没实现,对应那一条立即红。
ENDPOINTS: tuple[tuple[str, str, dict[str, Any], str], ...] = (
    ("post", "/api/memory/save", {"json": {"content": "c", "layer": "semantic"}}, "save"),
    ("get", "/api/memory/recall", {"params": {"query": "q"}}, "recall"),
    ("post", "/api/memory/dream", {"json": {}}, "consolidate"),
    ("get", "/api/memory/topics", {"params": {}}, "dream_topic"),
    ("delete", "/api/memory/forget", {"params": {}}, "forget"),
    ("get", "/api/memory/episodic", {"params": {}}, "list_episodic"),
    ("get", "/api/memory/procedural", {"params": {}}, "list_procedural"),
    ("post", "/api/memory/procedural", {"json": {"pattern": "p"}}, "add_procedural"),
)

# 带 user_id 的形态(与上面一一对应,用于 403-不落库 与变异取证)
ENDPOINTS_WITH_UID: dict[str, dict[str, Any]] = {
    "post:/api/memory/save": {"json": {"content": "c", "layer": "semantic"}},
    "get:/api/memory/recall": {"params": {"query": "q"}},
    "post:/api/memory/dream": {"json": {}},
    "get:/api/memory/topics": {"params": {}},
    "delete:/api/memory/forget": {"params": {}},
    "get:/api/memory/episodic": {"params": {}},
    "get:/api/memory/procedural": {"params": {}},
    "post:/api/memory/procedural": {"json": {"pattern": "p"}},
}

# 服务层方法的归属参数位置:POST 走 body 里的 user_id(kwargs),GET 走首位置参数。
_KWARG_OWNER_METHODS = frozenset({"save", "add_procedural"})


class _Recorder:
    """服务层替身:记录每一次调用的归属,永不触达任何存储。"""

    def __init__(self) -> None:
        self.calls: dict[str, list[tuple[tuple[Any, ...], dict[str, Any]]]] = {}

    def hook(self, name: str) -> Any:
        async def _call(*args: Any, **kwargs: Any) -> dict[str, str]:
            self.calls.setdefault(name, []).append((args, kwargs))
            return {"stubbed": name}

        return _call

    @property
    def total(self) -> int:
        return sum(len(v) for v in self.calls.values())

    def owner_of_first(self, name: str) -> str | None:
        hits = self.calls.get(name)
        if not hits:
            return None
        args, kwargs = hits[0]
        if name in _KWARG_OWNER_METHODS:
            return kwargs.get("user_id")
        return args[0] if args else kwargs.get("user_id")


def _with_user_id(kwargs: dict[str, Any], user_id: str) -> dict[str, Any]:
    data = dict(kwargs)
    if "json" in data:
        data["json"] = {**data["json"], "user_id": user_id}
    else:
        data["params"] = {**data.get("params", {}), "user_id": user_id}
    return data


def _token(user_id: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": user_id,
            "type": "access",
            "iss": settings.jwt_issuer,
            "aud": "ihui-ai-users",
            "iat": now,
            "exp": now + 3600,
        },
        TEST_SECRET,
        algorithm="HS256",
    )


def _auth(user_id: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(user_id)}"}


def _memory_app() -> FastAPI:
    """挂真实 JWTAuthMiddleware + 真实 memory router,等价生产链路。"""
    app = FastAPI()
    app.add_middleware(jwt_auth.JWTAuthMiddleware)
    app.include_router(memory_api.router, prefix="/api")
    return app


@pytest.fixture(autouse=True)
def _forbid_production_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """AGENTS.md §5 铁律:本文件用例零 DB 触达(建池即报错)。"""

    async def _no_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("属主绑定回归不得创建 asyncpg 连接池(生产库禁连)")

    monkeypatch.setattr("asyncpg.create_pool", _no_pool)


@pytest.fixture(autouse=True)
def _enforce_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    """钉死测试密钥:非空 jwt_secret ⇒ auth_globally_enforced() 为真,无 dev 降级。"""
    monkeypatch.setattr(settings, "jwt_secret", TEST_SECRET)
    monkeypatch.setattr(jwt_auth.settings, "jwt_secret", TEST_SECRET)


@pytest.fixture
def recorder(monkeypatch: pytest.MonkeyPatch) -> _Recorder:
    """服务层整体换成记录器(不 mock 判据本体 `_resolve_owner`)。"""
    rec = _Recorder()
    for name in (
        "save",
        "recall",
        "list_episodic",
        "list_procedural",
        "get_working",
        "add_procedural",
    ):
        monkeypatch.setattr(memory_api.memory_service, name, rec.hook(name))
    for name in ("consolidate", "dream_topic", "forget"):
        monkeypatch.setattr(memory_api.dream_service, name, rec.hook(name))
    return rec


@pytest.fixture
async def client() -> Any:
    transport = ASGITransport(app=_memory_app())
    async with AsyncClient(transport=transport, base_url="http://owner-bind.test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# 验收②:只带令牌、不传 user_id ⇒ 以令牌主体为准且能正常读写自己的
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("method,path,kwargs,svc", ENDPOINTS)
async def test_param_absent_falls_back_to_token_subject(
    client: AsyncClient, recorder: _Recorder, method: str, path: str, kwargs: dict[str, Any], svc: str
) -> None:
    resp = await getattr(client, method)(path, headers=_auth(USER_A), **kwargs)
    assert resp.status_code == 200, f"{method.upper()} {path} 不传 user_id 应落到令牌主体(实得 {resp.status_code} {resp.text[:120]})"
    assert resp.json()["code"] == 0
    assert recorder.owner_of_first(svc) == USER_A, (
        f"{svc} 收到的归属不是令牌主体:实得 {recorder.owner_of_first(svc)!r}"
    )


# ---------------------------------------------------------------------------
# 验收①/③:跨用户 ⇒ 403 且服务层零调用(读、写、删各一,判据同形)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("method,path,kwargs,svc", ENDPOINTS)
async def test_cross_user_denied_and_never_reaches_storage(
    client: AsyncClient, recorder: _Recorder, method: str, path: str, kwargs: dict[str, Any], svc: str
) -> None:
    resp = await getattr(client, method)(
        path, headers=_auth(USER_A), **_with_user_id(kwargs, USER_B)
    )
    assert resp.status_code == 403, f"{method.upper()} {path} 仍可跨用户操作(实得 {resp.status_code})"
    assert recorder.total == 0, f"{svc} 在 403 之前已被调用 —— 「不落库」不成立: {recorder.calls}"


# ---------------------------------------------------------------------------
# 变异取证:摘掉"与令牌主体比对"这一步 ⇒ 越权必须复现(证明上面两组的红来自判据)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("method,path,kwargs,svc", ENDPOINTS)
async def test_mutation_evidence_owner_check_removed(
    client: AsyncClient,
    recorder: _Recorder,
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
    kwargs: dict[str, Any],
    svc: str,
) -> None:
    """把 `_resolve_owner` 换回旧语义("参数说什么就是谁"),同一条请求必须得手。

    这条测试**通过**才说明判据真的在起作用:若摘掉判据它仍然 403,那前两组的
    红就是夹具造出来的,而不是这条越权路径被封住的证据。
    """
    monkeypatch.setattr(memory_api, "_resolve_owner", lambda principal, user_id: user_id or principal)
    resp = await getattr(client, method)(
        path, headers=_auth(USER_A), **_with_user_id(kwargs, USER_B)
    )
    assert resp.status_code == 200, f"变异未复现越权(实得 {resp.status_code}),判据另有出处"
    assert recorder.owner_of_first(svc) == USER_B, "越权请求未以 B 的身份抵达服务层,物证不成立"


# ---------------------------------------------------------------------------
# 反向对照:合法本人路径全程绿(证明收口不是恒 403)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("method,path,kwargs,svc", ENDPOINTS)
async def test_self_owner_explicit_user_id_still_works(
    client: AsyncClient, recorder: _Recorder, method: str, path: str, kwargs: dict[str, Any], svc: str
) -> None:
    resp = await getattr(client, method)(
        path, headers=_auth(USER_A), **_with_user_id(kwargs, USER_A)
    )
    assert resp.status_code == 200, f"同主显式传自己 id 被误拒(实得 {resp.status_code})"
    assert recorder.owner_of_first(svc) == USER_A
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
