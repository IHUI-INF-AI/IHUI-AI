# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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


# ===========================================================================
# GET /api/memory/working —— 属主绑定缺口的**现状钉桩**(2026-09-27 安全票)
#
# 为什么单列一段而不是并进 MEMORY_ENDPOINTS:该端点今日**既无端点级 401 地板
# (整层不挂 Depends)、也无属主过滤**(memory.py:208-215 只收 session_id;
# memory_service.get_working 是 `self._working.get(session_id)`,services/
# memory_service.py:249-256),并入会立刻红在"它回 200 不回 403"上 —— 那是把
# 未收口面伪装成已收口。现读结论(派单口径,勿照抄本段做二次派单):
#   ① 仓内**无活读调用方**:全仓 `git grep memory/working` 唯一指向 ai-service 的
#      入口是 apps/api v1 网关转发(v1-knowledge-tools.ts:2315-2336),其 handler
#      为 `async (_request, reply)`(入站请求根本没用),path 是定值字符串、init
#      不带 query ⇒ 到 ai-service 时缺必填 session_id ⇒ 422 ⇒ forwardAiService
#      折叠成 503 —— 结构死路(该文件 :2333-2335 注释与其测试
#      apps/api/tests/v1-memory-principal.test.ts:306-319 均自述"主体豁免")。
#      SDK(webapi/go/java/python/dotnet)的 working() 都走该死网关;CLI 只写
#      (tools/memory.ts:295 save layer=working,会话号为宿主进程内 randomUUID,
#      模型不可填)不读;api-client 的 ai-service 直连基址(client.ts:3549-3557)
#      只用于 tool-result/form 上行,零 memory 端点。
#   ② session↔owner **权威来源缺失**,故本票**不改行为**:working 桶条目不落属主
#      (memory_service.py:217 键只有 session_id、:229-240 的 msg 无 user 字段,
#      save() 的 working 分支 :677-680 把已解析的 owner 直接丢弃);
#      agent_memory_episodic 虽有 (session_id,user_id) 列(:288-289),但只覆盖
#      写过 episodic 的会话,working-only 桶(CLI 每进程随机会话号)无行可查;
#      session_store 的 threads 是另一 id 命名空间且无 user_id 列(属主只在
#      metadata JSON,session_store.py:270)。不得凭猜造一份。
# 下面的钉桩成对存在:反向两条把"他人可读"记成机器可见的事实,**收紧落地时必须
# 逐条改成断言拒绝并留本段(禁止删测试** —— 删掉等于把漏洞行为当没发生过);
# 正向对照(自己读自己)在收紧后必须仍是 200,它们同时是"未发出查询"式断言的
# 非恒真证明(与本文件既有 doctrine 同一条禁令)。
# 同形口径(收紧时的建议,归持有人拍板):今日"不存在"回 200+空桶
# (test_working_unknown_session_is_empty_today),故"不是你的"应与"不存在"**同形**
# (空桶),否则端点变成存在性预言机;差别须写进落地注释,不得抄成 403 了事。
# ===========================================================================

WORKING_METHOD_PATH = "get /api/memory/working"

# 待对齐台账:路径 → 为什么还开着(归属四态之一:等"权威来源"定夺)。
# 收紧落地时:该条必须整行删除,且端点移入 MEMORY_ENDPOINTS + 上方钉桩改判拒绝。
WORKING_PENDING_LEDGER: dict[str, str] = {
    WORKING_METHOD_PATH: (
        "session↔owner 权威来源缺失(working 桶不记属主;episodic 的 (session_id,"
        "user_id) 只覆盖写过 episodic 的会话;session_store threads 是另一 id 命名空间)"
        "⇒ 现状由本文件 test_working_* 钉桩;定权威来源前禁止并入 MEMORY_ENDPOINTS"
    ),
}

_SESSION_OF_B = "session-of-user-b-working-pin"
_OWN_SESSION_OF_A = "session-owned-by-user-a-working-pin"
_B_SECRET_CONTENT = "B 的私有工作记忆(越权现状钉桩标记)"
_A_OWN_CONTENT = "A 自己的 working 记忆(正向对照)"


def _working_stub_factory(
    monkeypatch: pytest.MonkeyPatch,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """按真实 get_working 的语义(查不到 = 空列表)造可观测桶。

    返回 (calls, buckets 无关) —— calls 逐次记录服务层收到的参数,让
    "owner 从未穿过服务边界"成为可断言的事实,而不是只断响应码。
    """
    calls: list[dict[str, Any]] = []

    async def _get_working(session_id: str, limit: int = 50) -> list[dict[str, Any]]:
        calls.append({"session_id": session_id, "limit": limit})
        if session_id == _SESSION_OF_B:
            return [{"id": "b1", "sessionId": _SESSION_OF_B, "content": _B_SECRET_CONTENT}]
        if session_id == _OWN_SESSION_OF_A:
            return [{"id": "a1", "sessionId": _OWN_SESSION_OF_A, "content": _A_OWN_CONTENT}]
        return []

    monkeypatch.setattr(memory_api.memory_service, "get_working", _get_working)
    return calls


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


def test_memory_endpoint_ledger_covers_every_registered_route() -> None:
    """清单存续性锁(票面点名的"反向锁"):router 上每条 /api/memory/* 路由都必须
    要么在 MEMORY_ENDPOINTS(已对齐,跨用户必 403 族),要么在 WORKING_PENDING_LEDGER
    (现状钉桩族);两边都不在 ⇒ 红。这条存在的理由:MEMORY_ENDPOINTS 是手工清单,
    新增端点忘了登记时,其余参数化用例只会"少跑一条",账面全绿而新端点零看守
    (本仓"一条门只管自己立项那一型"同族)。同时判两个方向的腐烂:台账点名了
    router 上不存在的路径也红(清单过期比没有清单更糟)。
    """
    registered = _registered_memory_routes()
    assert registered, "memory router 枚举到 0 条路由 ⇒ 存续性锁失效,空扫不算通过"
    aligned = {f"{m} {p}" for m, p, _kwargs in MEMORY_ENDPOINTS}
    pending = set(WORKING_PENDING_LEDGER)
    uncovered = registered - aligned - pending
    assert not uncovered, (
        f"以下已注册路由既不在 MEMORY_ENDPOINTS 也不在待对齐台账(新增端点必须二选一:"
        f"已收口→进清单并补跨用户 403 用例;未收口→进台账并补现状钉桩):{sorted(uncovered)}"
    )
    stale = (aligned | pending) - registered
    assert not stale, f"台账点名了 router 上不存在的路径(清单腐烂):{sorted(stale)}"
    assert pending == {WORKING_METHOD_PATH}, (
        "待对齐台账只许容纳 /memory/working 这一格;别的端点混进来 = 把已收口面重新放出去"
    )
    assert WORKING_METHOD_PATH not in aligned, (
        "working 尚未对齐就进了 MEMORY_ENDPOINTS ⇒ 上面 401/403 参数化用例会红在这里;"
        "正确顺序是先定 session↔owner 权威来源、改 behavior、再把现状钉桩逐条改成断言拒绝"
    )


async def test_working_no_identity_reaches_store_today(bare_client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """现状钉桩①a:不挂中间件的最小 app 上,该端点**没有任何鉴权地板** ——
    匿名请求直接打到服务层并 200(其余 8 端点同场景必 401,见上方参数化用例)。

    收紧落地时本条必须改:断言 401(require_request_user_id 生产态),且 calls 为空。
    """
    calls = _working_stub_factory(monkeypatch)
    resp = await bare_client.get("/api/memory/working", params={"session_id": _SESSION_OF_B})
    assert resp.status_code == 200, f"现状应有记录:实得 {resp.status_code}"
    assert len(calls) == 1 and calls[0]["session_id"] == _SESSION_OF_B, (
        f"钉桩失效(查询没被发出):{calls}"
    )
    assert _B_SECRET_CONTENT in resp.text, "匿名可达却读不到内容 ⇒ 桩没接上,本条断言会变空"


async def test_working_cross_session_read_leaks_under_valid_token(
    probe_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """现状钉桩①b(主案):A 持合法令牌,用 B 的 session_id 即可读到 B 的工作记忆。

    三重记录,缺一不可:
      - 响应码 200 且**响应体逐字含 B 的内容**(泄漏真的到了调用方,不是只到服务层);
      - 服务层恰被调用一次(**非恒真断言** —— 收紧后"未发出查询"若无人证今天这条,
        它就会在"桩没接上"的世界里永远成立,与本文件 test_same_owner_request_reaches_service
        是同一条禁令);
      - 到达服务层的参数只有 {session_id, limit}:属主**从未**穿过服务边界,这就是
        "无属主过滤"在 service 边界上的形状。收紧若选择"把 owner 喂进服务层",
        必须显式改这一条,而不是让它悄悄红。
    收紧落地时本条必须改:同请求断言被拒/空桶且 calls == [](副作用未发生),
    **禁止删除本测试**。
    """
    calls = _working_stub_factory(monkeypatch)
    resp = await probe_client.get(
        "/api/memory/working", params={"session_id": _SESSION_OF_B}, headers=_auth(USER_A)
    )
    assert resp.status_code == 200, f"现状应有记录:实得 {resp.status_code}"
    assert _B_SECRET_CONTENT in resp.text, "跨会话读没把 B 的内容带到响应体 ⇒ 桩没接上"
    assert len(calls) == 1 and calls[0]["session_id"] == _SESSION_OF_B
    assert set(calls[0].keys()) == {"session_id", "limit"}, (
        f"get_working 收到了本不该存在的第三参数:{calls[0]} —— 若为收紧而改签名,请显式更新本断言"
    )


async def test_working_same_owner_read_is_200(probe_client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """正向对照(自己读自己):今日 200,收紧落地后**必须仍是 200**。

    票面"刻意不当场修"的风险就钉在这里 —— 收紧若让真实会话读不到自己的 working
    记忆,本条第一个红;它是"绑定不是恒拒"的装车证明,收紧 PR 不得顺手删。
    """
    calls = _working_stub_factory(monkeypatch)
    resp = await probe_client.get(
        "/api/memory/working", params={"session_id": _OWN_SESSION_OF_A}, headers=_auth(USER_A)
    )
    assert resp.status_code == 200, f"自己读自己被拒(实得 {resp.status_code})"
    assert _A_OWN_CONTENT in resp.text
    assert len(calls) == 1 and calls[0]["session_id"] == _OWN_SESSION_OF_A


async def test_working_unknown_session_is_empty_today(probe_client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """现状钉桩②:"不存在"今日回 200 + 空 data —— 这就是收紧时**同形口径**的基准:
    "不是你的"应与"不存在"回同一形状(200+空桶),否则端点退化为存在性预言机
    (§5 认证≠授权条:两条同形的拒绝口径)。落地时在处理器注释里写明该差别与本条基准。
    """
    calls = _working_stub_factory(monkeypatch)
    resp = await probe_client.get(
        "/api/memory/working", params={"session_id": "no-such-session-anyone"}, headers=_auth(USER_A)
    )
    assert resp.status_code == 200 and resp.json()["data"] == []
    assert len(calls) == 1, "空桶语义今日就是'照样发查询'——收紧后此条随钉桩①b 一并改判"
