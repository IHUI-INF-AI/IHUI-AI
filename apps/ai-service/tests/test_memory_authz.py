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

import asyncio
import json
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

# 只挂身份地板、**不收 user_id** 的端点(GET /memory/working:句柄是 session_id,
# 归属由条目自身的属主决定,见 services/memory_service.py::entry_visible_to)。
# 它进不了 MEMORY_ENDPOINTS —— 那组的 403 用例靠"请求里带别人的 user_id"构造,
# 这个端点根本没这个参数;但"缺身份必 401"两条对它是**同样成立**的判据。
IDENTITY_ONLY_ENDPOINTS: tuple[tuple[str, str, dict[str, Any]], ...] = (
    ("get", "/api/memory/working", {"params": {"session_id": "any-session"}}),
)

# 参与"缺身份 → 401"两条参数化用例的全集
ALL_PROTECTED_ENDPOINTS: tuple[tuple[str, str, dict[str, Any]], ...] = (
    MEMORY_ENDPOINTS + IDENTITY_ONLY_ENDPOINTS
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


@pytest.mark.parametrize("method,path,kwargs", ALL_PROTECTED_ENDPOINTS)
async def test_missing_identity_is_401(bare_client: AsyncClient, method: str, path: str, kwargs: dict[str, Any]) -> None:
    """生产态(jwt_secret 非空)无任何身份 → 端点级 require_request_user_id 必 401。"""
    resp = await getattr(bare_client, method)(path, **kwargs)
    assert resp.status_code == 401, f"{method.upper()} {path} 缺端点级鉴权地板(实得 {resp.status_code})"


@pytest.mark.parametrize("method,path,kwargs", ALL_PROTECTED_ENDPOINTS)
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


# ===========================================================================
# GET /api/memory/working —— 2026-09-28 收紧落地:下面这组**原为「现状钉桩」**
# (2026-09-27 安全票),当时该端点既无端点级 401 地板、也无属主过滤。
# 按票面纪律,这些测试**一条都不删**,只把断言从「泄漏成立」逐条改判为「泄漏被封」;
# 原文记录的现状一并留在下面这张清单里,免得下一个人把「曾经是什么样」读成猜测。
#
# 原状(2026-09-27 现读,已由本票逐条改判):
#   ① 端点不挂 Depends ⇒ 匿名请求直接打到服务层并 200(原 test_working_no_identity_
#      reaches_store_today 记的就是这一格);
#   ② 服务层是 `self._working.get(session_id)`、零属主过滤 ⇒ A 持合法令牌填 B 的
#      session_id 即可读到 B 的工作记忆,且到达服务层的参数只有 {session_id, limit}
#      —— 属主从未穿过服务边界(原 test_working_cross_session_read_leaks_under_valid_token);
#   ③ working 条目不落属主:旧 `add_working` 没有 owner 形参;旧 `save()` 的 working 分支
#      是「先入桶、再对返回值补 msg['\''userId'\'']」(锁外后置改写,并发读能撞进无主窗口);
#   ④ 「不存在」回 200 + 空桶(原 test_working_unknown_session_is_empty_today)—— 这一条
#      不是漏洞,而是**同形口径的基准**:「不是你的」必须与它回同一个形状,否则端点
#      退化成存在性预言机(§5「两条同形的拒绝口径」)。
#   ⑤ 权威来源:agent_memory_episodic 的 (session_id, user_id) 列;session_store 的
#      threads 是另一个 id 命名空间且无 user_id 列,不得当权威。本票按此把 owner 写进
#      条目、存量走 scripts/backfill_working_owner.py 幂等回填,推不出的**保持无主**
#      —— 无主条目按 `entry_visible_to` 分支 2 维持改动前行为,**这是回退不是授权结论**。
# ===========================================================================

WORKING_METHOD_PATH = "get /api/memory/working"

# 待对齐台账:收紧落地后**必须恒为空**。留着这个空字典而不是删掉,是因为它同时是
# 「清单存续性锁」的三选一出口 —— 哪天新增一条既没收口、又进不了上面两组的 /memory/*
# 路由,补进这里必须连现状钉桩一起写,并且本文件 `test_memory_endpoint_ledger_*`
# 会因为「台账非空」当场红:那是**故意**的,未收口面不该能安静地挂进台账。
WORKING_PENDING_LEDGER: dict[str, str] = {}

_SESSION_OF_B = "session-of-user-b-working-pin"
_OWN_SESSION_OF_A = "session-owned-by-user-a-working-pin"
_LEGACY_SESSION = "legacy-unowned-session-working-pin"
_MIXED_SESSION = "mixed-owner-session-working-pin"
_B_SECRET_CONTENT = "B 的私有工作记忆(越权钉桩标记)"
_A_OWN_CONTENT = "A 自己的 working 记忆(正向对照)"
_LEGACY_CONTENT = "收口前写入的无主条目(回退档正向对照)"


def _install_working_service(
    monkeypatch: pytest.MonkeyPatch,
) -> tuple[Any, list[dict[str, Any]]]:
    """把**真实** MemoryService 装到端点的模块属性上,并记录每一次内容读取(不预置数据)。

    为什么用真服务而不是手写桶 stub:本票要判的是「读侧过滤真的封住了越权」,而过滤逻辑
    在 `MemoryService.entry_visible_to` / `get_working` 里 —— stub 掉它,测试判的就只是
    「端点调了一个假函数」(§22c「镜像测试只复读实现就是复读机」同一条禁令)。
    working 层全程不碰 DB(§5 测试隔离铁律由本文件 `_forbid_production_db` 兜底:
    这些用例一次都不会去建连接池)。

    刻意不在这里 seed:`add_working` 是协程,而 async 用例已在跑动的 loop 里 ——
    在夹具里 asyncio.run 会直接 RuntimeError,所以 seeding 交给 `await _seed_buckets(svc)`
    (同一条 sync 降级用例把 seed+请求放进同一个 asyncio.run 里跑)。
    """
    from app.services.memory_service import MemoryService

    svc = MemoryService(gateway=object())
    calls: list[dict[str, Any]] = []
    original_get = svc.get_working

    async def _spy(session_id: str, limit: int = 50, **kwargs: Any) -> list[dict[str, Any]]:
        calls.append({"session_id": session_id, "limit": limit, **kwargs})
        return await original_get(session_id, limit, **kwargs)

    monkeypatch.setattr(svc, "get_working", _spy)
    monkeypatch.setattr(memory_api, "memory_service", svc)
    return svc, calls


async def _seed_buckets(svc: Any) -> None:
    """四种形态各写一次:他人桶 / 自己桶 / 无主存量桶 / 混属主桶。

    每条之间睡 20ms:`add_working` 的 msg_id 是 `f"{session_id}:{timestamp}"`,Windows
    的时间戳精度不足以区分同一微秒内的两次写入 —— 不睡则**同桶第二条会静默覆盖第一条**
    (`tests/test_memory_service.py::test_lru_limit_50` 早已记过同一坑)。混属主那一格
    正好要在同一个桶里写两条,所以这里不是可选的加固,而是那一条用例能否存在的前提。
    """
    await svc.add_working(_SESSION_OF_B, "user", _B_SECRET_CONTENT, owner=USER_B)
    await asyncio.sleep(0.02)
    await svc.add_working(_OWN_SESSION_OF_A, "user", _A_OWN_CONTENT, owner=USER_A)
    await asyncio.sleep(0.02)
    await svc.add_working(_LEGACY_SESSION, "user", _LEGACY_CONTENT)  # 无主:收口前的存量
    await asyncio.sleep(0.02)
    await svc.add_working(_MIXED_SESSION, "user", "A 的那一条", owner=USER_A)
    await asyncio.sleep(0.02)
    await svc.add_working(_MIXED_SESSION, "user", "B 的那一条", owner=USER_B)


def _registered_memory_routes() -> set[str]:
    """现读 router 上注册的全部 /memory/* 路由(判据输入由被审面自身推导)。"""
    keys: set[str] = set()
    for route in memory_api.router.routes:
        path = getattr(route, "path", "")
        methods = getattr(route, "methods", None) or set()
        if not path.startswith("/memory/"):
            continue
        for m in methods:
            if m in {"HEAD", "OPTIONS"}:
                continue
            keys.add(f"{m.lower()} /api{path}")
    return keys


# ---------------------------------------------------------------------------
# 清单存续性锁
# ---------------------------------------------------------------------------


def test_memory_endpoint_ledger_covers_every_registered_route() -> None:
    """每条已注册路由必须落在三组之一:收 user_id 的 403 族 / 只挂身份地板族 / 待对齐台账。

    这条存在的理由不变(手工清单少登记一条 ⇒ 其余参数化用例只是「少跑一条」,账面全绿
    而新端点零看守),但**判据方向在本票翻了一面**:待对齐台账现在必须恒为空 ——
    未收口面不再允许安静地挂进台账;真要挂,就得连现状钉桩一起写并被这条点名。
    """
    registered = _registered_memory_routes()
    assert registered, "memory router 枚举到 0 条路由 ⇒ 存续性锁失效,空扫不算通过"
    aligned = {f"{m} {p}" for m, p, _kwargs in MEMORY_ENDPOINTS}
    identity_only = {f"{m} {p}" for m, p, _kwargs in IDENTITY_ONLY_ENDPOINTS}
    pending = set(WORKING_PENDING_LEDGER)
    assert pending == set(), (
        f"待对齐台账必须为空(working 已于 2026-09-28 收口);又挂进来了:{sorted(pending)}"
    )
    uncovered = registered - aligned - identity_only - pending
    assert not uncovered, (
        "以下已注册路由三组都不在(新增端点必须立刻归组:收 user_id→MEMORY_ENDPOINTS、"
        "只挂身份地板→IDENTITY_ONLY_ENDPOINTS、真未收口→另开票并补现状钉桩):"
        f"{sorted(uncovered)}"
    )
    stale = (aligned | identity_only) - registered
    assert not stale, f"台账点名了 router 上不存在的路径(清单腐烂):{sorted(stale)}"
    assert WORKING_METHOD_PATH in identity_only, (
        "working 必须留在「只挂身份地板」组 —— 挪进 MEMORY_ENDPOINTS 会让 403 族拿一个"
        "它结构上没有的参数(user_id)去构造用例,那是判据自伤不是收紧"
    )


# ---------------------------------------------------------------------------
# 改判①:缺身份 → 401(原状:匿名直达服务层并 200)
# ---------------------------------------------------------------------------


async def test_working_no_identity_reaches_store_today(
    bare_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """【2026-09-28 由现状钉桩改判为拒绝】不挂中间件的最小 app 上,该端点现在有端点级
    `require_request_user_id` 地板 ⇒ 匿名必 401,且**内容读取一次都没发出**。

    原名保留(断言已反向):它是票面「禁止删测试」那条纪律的载体 —— 删掉它等于把
    「这里曾经匿名可读」当没发生过。名字里的 `today` 现在指**判据在位的今天**。
    """
    _svc, calls = _install_working_service(monkeypatch)
    await _seed_buckets(_svc)
    resp = await bare_client.get("/api/memory/working", params={"session_id": _SESSION_OF_B})
    assert resp.status_code == 401, f"收紧后匿名仍可达(实得 {resp.status_code})"
    assert calls == [], f"401 之前已把请求打到服务层(鉴权地板晚于查库):{calls}"
    assert _B_SECRET_CONTENT not in resp.text, "被拒的回答里带着 B 的内容"


# ---------------------------------------------------------------------------
# 改判②:跨用户读 → 同形拒绝 + 短路(原状:200 且响应体带着 B 的内容)
# ---------------------------------------------------------------------------


async def test_working_cross_session_read_leaks_under_valid_token(
    probe_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """【2026-09-28 由现状钉桩改判为拒绝】A 持合法令牌填 B 的 session_id ⇒ 读不到 B 的任何内容。

    四条断言各防一种「看起来收了」的假状:
      1. 200 + `data == []` —— **同形口径**:「不是你的」与「不存在」回同一个形状,否则
         端点变成存在性预言机(见下面那条逐字同形对照);
      2. 响应体不含 B 的内容 —— 判「到了调用方」,不是只判「服务层返回了空」;
      3. `get_working` **一次都没被调用** —— 短路生效(读侧的「未发出查询」式断言);
      4. 混属主那一格由 test_working_mixed_bucket_exposes_only_own_entries 单独判。
    第 3 条的非恒真由 test_working_same_owner_read_is_200 钉住(同主必须真的调它)。
    """
    _svc, calls = _install_working_service(monkeypatch)
    await _seed_buckets(_svc)
    resp = await probe_client.get(
        "/api/memory/working", params={"session_id": _SESSION_OF_B}, headers=_auth(USER_A)
    )
    assert resp.status_code == 200, f"同形口径应回 200+空桶(实得 {resp.status_code})"
    assert resp.json()["data"] == [], f"跨用户读没被折叠成空桶:{resp.json()}"
    assert _B_SECRET_CONTENT not in resp.text, "B 的内容仍随响应体出网"
    assert calls == [], f"端点未走短路,把整桶内容读出来了:{calls}"


async def test_working_cross_user_and_unknown_are_indistinguishable(
    probe_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """存在性预言机对照:同一主体问「别人的 session」与问「根本没这个 session」响应**逐字同形**。

    这条不是把上一条换个说法:上一条判「读不到内容」,这一条判「两种情况长得一样」。
    只留前者,把 403/404 加回来仍然绿 —— 而 §5 明令禁止那种可区分的回包。
    """
    _svc, _calls = _install_working_service(monkeypatch)
    await _seed_buckets(_svc)
    foreign = await probe_client.get(
        "/api/memory/working", params={"session_id": _SESSION_OF_B}, headers=_auth(USER_A)
    )
    unknown = await probe_client.get(
        "/api/memory/working",
        params={"session_id": "no-such-session-anyone"},
        headers=_auth(USER_A),
    )
    assert foreign.status_code == unknown.status_code == 200
    assert foreign.text == unknown.text, (
        f"「不是你的」与「不存在」不同形(前者 {foreign.text[:120]} / 后者 {unknown.text[:120]})"
        "⇒ 端点可被用来枚举哪些 session 真实存在且不属于调用者"
    )


# ---------------------------------------------------------------------------
# 正向对照(收紧不是一刀切拒绝;同时是「未发出查询」式断言的非恒真证明)
# ---------------------------------------------------------------------------


async def test_working_same_owner_read_is_200(
    probe_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """自己读自己:200 + 内容 + 服务层**真的被调用了一次**(证明上面那条 `calls == []` 有牙)。"""
    _svc, calls = _install_working_service(monkeypatch)
    await _seed_buckets(_svc)
    resp = await probe_client.get(
        "/api/memory/working", params={"session_id": _OWN_SESSION_OF_A}, headers=_auth(USER_A)
    )
    assert resp.status_code == 200, f"自己读自己被拒(实得 {resp.status_code})"
    assert _A_OWN_CONTENT in resp.text
    assert len(calls) == 1 and calls[0]["session_id"] == _OWN_SESSION_OF_A, (
        f"正向对照没落到服务层 ⇒ 「未发出查询」在桩没接上时也会永远成立:{calls}"
    )
    assert calls[0].get("requester") == USER_A, (
        f"服务层收到了请求却没拿到主体:{calls[0]} —— 逐条过滤那一层就没人喂了"
    )


async def test_working_unowned_bucket_read_is_unchanged(
    probe_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """无主存量条目(收口前写入的)⇒ **维持改动前行为**,逐字与「不喂主体」时一致。

    这条是「回退不是授权结论」的机器载体:`entry_visible_to` 分支 2 若被顺手改成
    「无主即拒」,本条第一个红 —— 而那会让存量 working 记忆对所有人生效性丢失
    (用功能换账面干净)。真正的补法在回填票,不在读侧判据里。
    """
    svc, _calls = _install_working_service(monkeypatch)
    await _seed_buckets(svc)
    resp = await probe_client.get(
        "/api/memory/working", params={"session_id": _LEGACY_SESSION}, headers=_auth(USER_A)
    )
    assert resp.status_code == 200 and _LEGACY_CONTENT in resp.text
    with_none = await svc.get_working(_LEGACY_SESSION)
    with_a = await svc.get_working(_LEGACY_SESSION, requester=USER_A)
    assert with_none == with_a, "无主桶在「喂不喂主体」两种调用下形状不同 ⇒ 回退档被改严了"


async def test_working_mixed_bucket_exposes_only_own_entries(
    probe_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """混属主桶:短路放行(确实有可见条目),逐条过滤必须只留下自己那一条。

    原状钉桩①b 当年断言「到达服务层的参数只有 {session_id, limit}」—— 那正是「无属主
    过滤」在 service 边界上的形状;现在这一格由**这一条**判:B 的那一条不再出现在 A 的响应里。
    """
    _svc, calls = _install_working_service(monkeypatch)
    await _seed_buckets(_svc)
    resp = await probe_client.get(
        "/api/memory/working", params={"session_id": _MIXED_SESSION}, headers=_auth(USER_A)
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert [d["content"] for d in data] == ["A 的那一条"], f"混属主桶漏了别人的条目:{data}"
    assert len(calls) == 1, "混属主桶该走逐条过滤(有可见条目 ⇒ 不短路),不是整桶拒绝"


# ---------------------------------------------------------------------------
# 变异取证:两处绑定各拆一刀,同一条越权请求必须复现(证明红来自判据而不是夹具)
# ---------------------------------------------------------------------------


async def test_mutation_evidence_read_binding_removed(
    probe_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """同时拆掉「端点短路」与「逐条过滤」两处判据 ⇒ B 的内容必须真的能被 A 读到。

    只拆一处不算证据:短路判据(`working_has_visible_entries`)与过滤判据(`entry_visible_to`)
    是纵深,任一在位都拦得住这条请求 —— 而「改一处就红」恰恰说明另一处也在起作用。摘掉两处仍
    读不到,就说明红来自夹具而不是判据(与本文件既有的变异取证条目同一条纪律)。
    """
    svc, calls = _install_working_service(monkeypatch)
    await _seed_buckets(svc)

    async def _always_visible(session_id: str, requester: str | None) -> bool:
        return True

    monkeypatch.setattr(svc, "working_has_visible_entries", _always_visible)
    monkeypatch.setattr(
        type(svc), "entry_visible_to", staticmethod(lambda entry_owner, requester: True)
    )
    _SEEN.clear()
    resp = await probe_client.get(
        "/api/memory/working", params={"session_id": _SESSION_OF_B}, headers=_auth(USER_A)
    )
    assert resp.status_code == 200
    assert (
        _B_SECRET_CONTENT in resp.text
    ), "变异未复现越权 ⇒ 收紧另有出处,本组用例的根不在这两处判据"
    assert len(calls) == 1 and calls[0]["requester"] == USER_A


# ---------------------------------------------------------------------------
# 同形基准(2026-09-27 写下时是「现状」,收紧后它是参照物)
# ---------------------------------------------------------------------------


async def test_working_unknown_session_is_empty_today(
    probe_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """「不存在」回 200 + 空 data —— 上面那条逐字同形对照的基准就在这里。

    收紧落地后它与「不是你的」连**服务层调用次数**都一致(都是 0 次:两者都在可见性
    短路处折叠成空桶)—— 所以这里的断言是 `calls == []`,而 2026-09-27 写这条时它是
    「照样发一次查询」(原状④)。翻面本身就是这条测试继续存在的理由。
    """
    _svc, calls = _install_working_service(monkeypatch)
    await _seed_buckets(_svc)
    resp = await probe_client.get(
        "/api/memory/working",
        params={"session_id": "no-such-session-anyone"},
        headers=_auth(USER_A),
    )
    assert resp.status_code == 200 and resp.json()["data"] == []
    assert calls == [], f"不存在的 session 不该再发一次内容读取(与「不是你的」同形):{calls}"


# ---------------------------------------------------------------------------
# 开发降级态:本进程根本没启用 JWT 校验时,该端点不得把自己打成不可用
# ---------------------------------------------------------------------------


def test_working_dev_principal_is_not_treated_as_an_owner(monkeypatch: pytest.MonkeyPatch) -> None:
    """`DEV_ANONYMOUS_PRINCIPAL` 是「本进程没做 JWT 校验」的哨兵,不是真实属主。

    把它当 requester 喂进过滤,开发单机与所有以 ASGI in-process 跑的既有测试会整片读不到
    自己的 working 记忆(与 `_resolve_owner` 的 DEV 分支是同一条判断,不新造第二种)。
    判据打在端点函数上:进服务层之前就必须把 DEV 主体折成 None。
    """
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(jwt_auth.settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")
    monkeypatch.setattr(jwt_auth.settings, "node_env", "development")

    svc, calls = _install_working_service(monkeypatch)
    app = FastAPI()
    app.include_router(memory_api.router, prefix="/api")  # 不挂中间件 ⇒ 走 DEV 降级分支

    async def _go() -> dict[str, Any]:
        await _seed_buckets(svc)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://dev-fallback.test") as ac:
            resp = await ac.get("/api/memory/working", params={"session_id": _SESSION_OF_B})
            assert resp.status_code == 200, f"开发降级态被收紧打成非 200:{resp.status_code}"
            body: dict[str, Any] = resp.json()
            return body

    body = asyncio.run(_go())
    assert calls and calls[-1]["requester"] is None
    assert _B_SECRET_CONTENT in json.dumps(body, ensure_ascii=False), (
        "DEV 主体被当成真实属主去比对了 —— 那会让开发单机不可用,不是收紧"
    )
