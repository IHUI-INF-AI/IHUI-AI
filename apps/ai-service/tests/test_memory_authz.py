# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P0 水平越权收口(2026-09-25):/api/memory/* 端点级属主对齐回归。

立项事实:`app/api/memory.py` 此前把 user_id 当请求参数收,从不与令牌主体比对 ⇒
任何已登录用户填别人的 UUID 即可读/改/删他人记忆(认证 ≠ 授权)。本文件钉死两条
反向用例(本票存在的理由)+ 一条同主放行正例:
  1. 无身份(不挂中间件的最小 app,jwt_secret 非空)→ 端点级
     `require_request_user_id` 必须 401 —— 白名单/中间件配错也漏不出去;
  2. 令牌主体 A 请求 user_id=B → 一律 403;
  3. 令牌主体 A 请求 user_id=A → 200(mock 服务层,证明收紧不是恒拒)。

测试隔离(AGENTS.md §5):服务层全部 monkeypatch 成内存 stub,建池即报错
(asyncpg.create_pool 被替换为抛 AssertionError),零生产 PG(8810)/Redis(8811) 触达。
范式照抄 tests/test_agents_authz_59.py(real_jwt + 自建 probe app + 真实中间件)。
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

TEST_SECRET = "test-jwt-secret-for-memory-authz-only"
USER_A = "user-a-memory-authz"
USER_B = "user-b-memory-authz"

# (method, path, 请求 user_id, 额外 kwargs) —— 每个收 user_id 的端点逐一登记,
# 任一端点漏挂 Depends 立即红。
MEMORY_ENDPOINTS: tuple[tuple[str, str, dict[str, Any]], ...] = (
    ("post", "/api/memory/save", {"json": {"user_id": USER_B, "content": "c", "layer": "semantic"}}),
    ("get", "/api/memory/recall", {"params": {"user_id": USER_B, "query": "q"}}),
    ("post", "/api/memory/dream", {"json": {"user_id": USER_B}}),
    ("get", "/api/memory/topics", {"params": {"user_id": USER_B}}),
    ("delete", "/api/memory/forget", {"params": {"user_id": USER_B}}),
    ("get", "/api/memory/episodic", {"params": {"user_id": USER_B}}),
    ("get", "/api/memory/procedural", {"params": {"user_id": USER_B}}),
    ("post", "/api/memory/procedural", {"json": {"user_id": USER_B, "pattern": "p"}}),
)


def _swap_user(kwargs: dict[str, Any], user_id: str) -> dict[str, Any]:
    """把示例请求里的 user_id 换成指定主体(正向 200 用例复用同一张清单)。"""
    data = dict(kwargs)
    if "json" in data:
        body = dict(data["json"])
        body["user_id"] = user_id
        data["json"] = body
    elif "params" in data:
        params = dict(data["params"])
        params["user_id"] = user_id
        data["params"] = params
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


@pytest.fixture(autouse=True)
def _forbid_production_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """AGENTS.md §5 铁律:本文件用例零 DB 触达(建池即报错)。"""

    async def _no_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("属主对齐回归不得创建 asyncpg 连接池(生产库禁连)")

    monkeypatch.setattr("asyncpg.create_pool", _no_pool)


@pytest.fixture(autouse=True)
def _enforce_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    """钉死测试密钥:非空 jwt_secret ⇒ auth_globally_enforced() 为真,不允许 dev 降级。"""
    monkeypatch.setattr(settings, "jwt_secret", TEST_SECRET)
    monkeypatch.setattr(jwt_auth.settings, "jwt_secret", TEST_SECRET)


_SEEN: list[str] = []
"""服务层被调用的记录 —— 让"未发出查询"成为可断言的事实。
越权/无身份用例断言它**为空**;同主正例断言它**非空**。后者不是多余:少了这条,
"为空"的断言在"stub 根本没接上"的世界里也永远成立,判据就成了摆设
(本仓记过多次"看起来有、其实没装车"那一型)。"""


@pytest.fixture(autouse=True)
def _stub_memory_services(monkeypatch: pytest.MonkeyPatch) -> None:
    """服务层全 mock:属主校验通过后的 200 正例不触达任何真实存储。"""
    _SEEN.clear()

    def _make(name: str):
        async def _ok(*args: object, **kwargs: object) -> dict[str, str]:
            _SEEN.append(name)
            return {"stubbed": "ok"}

        return _ok

    for name in ("save", "recall", "list_episodic", "list_procedural", "get_working", "add_procedural"):
        monkeypatch.setattr(memory_api.memory_service, name, _make(name))
    for name in ("consolidate", "dream_topic", "forget"):
        monkeypatch.setattr(memory_api.dream_service, name, _make(name))


def _memory_app(*, with_middleware: bool) -> FastAPI:
    """最小装配:真实 memory router(+ 可选真实 JWTAuthMiddleware),前缀同 main.py。"""
    app = FastAPI()
    if with_middleware:
        app.add_middleware(jwt_auth.JWTAuthMiddleware)
    app.include_router(memory_api.router, prefix="/api")
    return app


@pytest.fixture
async def bare_client() -> Any:
    """不挂中间件的客户端:唯一裁判是端点级 Depends(生产态无身份 → 401)。"""
    transport = ASGITransport(app=_memory_app(with_middleware=False))
    async with AsyncClient(transport=transport, base_url="http://mem-authz-bare.test") as ac:
        yield ac


@pytest.fixture
async def probe_client() -> Any:
    """挂真实中间件的客户端:等价生产链路(A 的令牌 + B 的 user_id → 403)。"""
    transport = ASGITransport(app=_memory_app(with_middleware=True))
    async with AsyncClient(transport=transport, base_url="http://mem-authz.test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# 反向用例①:缺身份 → 401(不得回退成"信任请求参数")
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("method,path,kwargs", MEMORY_ENDPOINTS)
async def test_missing_identity_is_401(bare_client: AsyncClient, method: str, path: str, kwargs: dict[str, Any]) -> None:
    """生产态(jwt_secret 非空)无任何身份 → 端点级 require_request_user_id 必 401。"""
    resp = await getattr(bare_client, method)(path, **kwargs)
    assert resp.status_code == 401, f"{method.upper()} {path} 缺端点级鉴权地板(实得 {resp.status_code})"


@pytest.mark.parametrize("method,path,kwargs", MEMORY_ENDPOINTS)
async def test_anonymous_through_middleware_is_401(probe_client: AsyncClient, method: str, path: str, kwargs: dict[str, Any]) -> None:
    """真实中间件下匿名请求同样 401(中间件层,与端点层互为冗余)。"""
    resp = await getattr(probe_client, method)(path, **kwargs)
    assert resp.status_code == 401, f"{method.upper()} {path} 仍可匿名可达(实得 {resp.status_code})"


# ---------------------------------------------------------------------------
# 反向用例②:令牌主体 A 请求 user_id=B → 403(水平越权主案)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("method,path,kwargs", MEMORY_ENDPOINTS)
async def test_cross_user_request_is_403(probe_client: AsyncClient, method: str, path: str, kwargs: dict[str, Any]) -> None:
    """A 持合法令牌填 B 的 user_id → 403。此前该请求会直达服务层读/写 B 的记忆。

    状态码 403 单独不够:若授权判定被挪到查库**之后**,响应仍是 403,而别人的行已被读过/写过一次。
    故这里同时断言**服务层一次都没被调用**(= 未发出任何查询)。该断言的非恒真由
    test_same_owner_request_reaches_service 钉住(同主请求必须真的调到服务层)。
    """
    _SEEN.clear()
    resp = await getattr(probe_client, method)(path, headers=_auth(USER_A), **kwargs)
    assert resp.status_code == 403, f"{method.upper()} {path} 仍可跨用户操作(实得 {resp.status_code})"
    assert resp.json()["detail"] == "user_id 与令牌主体不一致(禁止读写他人记忆)"
    assert _SEEN == [], f"{method.upper()} {path} 虽回 403,但已把请求打到服务层:{_SEEN}(授权判定晚于查库)"


# ---------------------------------------------------------------------------
# 正例:同主 → 200(收紧不是一刀切拒绝;服务层已 stub)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("method,path,kwargs", MEMORY_ENDPOINTS)
async def test_same_owner_request_is_200(probe_client: AsyncClient, method: str, path: str, kwargs: dict[str, Any]) -> None:
    resp = await getattr(probe_client, method)(
        path, headers=_auth(USER_A), **_swap_user(kwargs, USER_A)
    )
    assert resp.status_code == 200, f"{method.upper()} {path} 同主请求被误拒(实得 {resp.status_code})"
    assert resp.json()["code"] == 0


@pytest.mark.parametrize("method,path,kwargs", MEMORY_ENDPOINTS)
async def test_same_owner_request_reaches_service(probe_client: AsyncClient, method: str, path: str, kwargs: dict[str, Any]) -> None:
    """403 用例里"未发出查询"这条断言的**非恒真证明**:同主请求必须真的落到服务层。

    缺了这条,`assert _SEEN == []` 在"stub 压根没接上"的世界里也永远成立 —— 判据看着在、其实是空的。
    """
    _SEEN.clear()
    resp = await getattr(probe_client, method)(
        path, headers=_auth(USER_A), **_swap_user(kwargs, USER_A)
    )
    assert resp.status_code == 200, f"{method.upper()} {path} 同主请求被误拒(实得 {resp.status_code})"
    assert _SEEN, f"{method.upper()} {path} 通过鉴权却没调用任何服务层方法 ⇒ 记录器没接上,403 用例的断言是空的"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
