# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""G-753 收口回归:`/api/workflows/*` 的端点级主体绑定与属主闸。

立项事实(2026-09-29 普查现读):`app/routers/workflow.py` 的 12 个端点**一个都不取身份**,
`app/services/workflow_engine.py` 把定义/实例存在进程内单例字典里、行上没有属主字段,
于是任何已登录用户拿到别人的 `wf-*` / `wi-*` 就能读详情、改名、删除、触发、取消、重试;
而引擎执行 `tool` 步骤时 `mcp_server.call_tool(...)` 也不带 `user_id`(第二承载)。
`/api/workflows` 不在 JWT 白名单 ⇒ 匿名进不来,但"认证 ≠ 授权"在这一族无人看守。

钉死五条(每条成对留正向对照 —— 只留前者,门就可能只是把功能改坏了):
  1. 无身份(bare app:不挂中间件 + 非空 jwt_secret)→ 401,且**引擎一次都没被调用**;
  2. 越权(A 的令牌动 B 的行)→ 与"资源不存在"**同码同响应体逐字等值**(不给存在性 oracle);
  3. 越权用例断言的是**副作用未发生**:字段没被改 / 行没被删 / 取消事件没被 set /
     实例数没涨 / `_running_instances` 没被占 —— 只断状态码会放过"先改了再抛 4xx";
  4. 正向对照:同属主仍能读改写跑通,且每一次带主体的访问**都真的带着令牌主体**
     (归属条件落在被发出的那次访问上,不是取回全量后在端点里 if);
  5. 无主 / dev 通道逐字未变:principal 归一为 None 时不加闸,无主行照旧可见,
     响应 shape 不多一个字段,`tool` 步骤仍传 `user_id=None`。

测试隔离(AGENTS §5):引擎按测试换成全新 `WorkflowEngine()`(模块单例被 monkeypatch),
`mcp_server.call_tool` 全部换成 spy,零 LLM / 零 PG / 零 Redis 触达(建池即报错)。
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import jwt
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core import jwt_auth
from app.core.config import settings
from app.routers import workflow as workflow_api
from app.services.workflow_engine import WorkflowEngine, WorkflowInstance, resolve_caller

pytestmark = pytest.mark.real_jwt

TEST_SECRET = "test-jwt-secret-for-workflow-authz-only"
USER_A = "user-a-workflow-authz"
USER_B = "user-b-workflow-authz"

#: 引擎侧全部归属型访问点 —— 每个测试换一份独立引擎并记录每一次调用。
ENGINE_METHODS: tuple[str, ...] = (
    "list_workflows",
    "create_workflow",
    "get_workflow",
    "update_workflow",
    "delete_workflow",
    "trigger_workflow",
    "list_instances",
    "get_instance",
    "get_instance_tasks",
    "get_instance_logs",
    "cancel_instance",
    "retry_instance",
)


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


def _principal_of(args: tuple[Any, ...], kwargs: dict[str, Any]) -> Any:
    """从一次引擎调用里取"带没带主体"—— 位置档与关键字档同视,否则换个写法就漏判。

    单位置参也要认:`list_workflows(principal)` / `get_instance(iid, principal)` 是位置调用,
    只按 kwargs 取会把"按主体查过"读成"没带主体"。
    """
    for key in ("principal", "owner"):
        if key in kwargs:
            return kwargs[key]
    if len(args) > 1:
        return args[1]
    if len(args) == 1 and isinstance(args[0], str):
        return args[0]
    return None


@pytest.fixture(autouse=True)
def _forbid_production_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """AGENTS §5 铁律:本文件用例零 DB 触达(建池即报错)。"""

    async def _no_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("属主对齐回归不得创建 asyncpg 连接池(生产库禁连)")

    monkeypatch.setattr("asyncpg.create_pool", _no_pool)


@pytest.fixture(autouse=True)
def _enforce_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    """非空 jwt_secret + 非 development ⇒ auth_globally_enforced() 为真,不允许 dev 降级身份。"""
    monkeypatch.setattr(settings, "jwt_secret", TEST_SECRET)
    monkeypatch.setattr(jwt_auth.settings, "jwt_secret", TEST_SECRET)
    monkeypatch.setattr(jwt_auth.settings, "node_env", "production")


@pytest.fixture
def engine(monkeypatch: pytest.MonkeyPatch) -> WorkflowEngine:
    """独占引擎 + 调用台账(副作用与"带没带主体"都从这一份量)。"""
    eng = WorkflowEngine()
    calls: list[tuple[str, tuple[Any, ...], dict[str, Any]]] = []

    def _wrap(label: str, orig: Any) -> Any:
        def _spy(*a: Any, **kw: Any) -> Any:
            calls.append((label, a, kw))
            # async 方法的 spy 返回协程对象,调用方 await 它 —— 同步/异步同一份包装,
            # 不在此处分支:分支会让"漏 await"与"没被调用"在台账里长得一样。
            return orig(*a, **kw)

        return _spy

    for name in ENGINE_METHODS:
        monkeypatch.setattr(eng, name, _wrap(name, getattr(eng, name)))
    eng.calls = calls  # type: ignore[attr-defined]
    monkeypatch.setattr(workflow_api, "workflow_engine", eng)
    return eng


def _app(*, with_middleware: bool) -> FastAPI:
    app = FastAPI()
    if with_middleware:
        app.add_middleware(jwt_auth.JWTAuthMiddleware)
    app.include_router(workflow_api.router, prefix="/api")
    return app


@pytest.fixture
async def client() -> Any:
    transport = ASGITransport(app=_app(with_middleware=True))
    async with AsyncClient(transport=transport, base_url="http://wf-authz") as ac:
        yield ac


@pytest.fixture
async def bare_client() -> Any:
    """不挂中间件的最小 app —— 白名单/中间件配错也漏不出"无身份也能动数据"。"""
    transport = ASGITransport(app=_app(with_middleware=False))
    async with AsyncClient(transport=transport, base_url="http://wf-authz-bare") as ac:
        yield ac


# ---------------------------------------------------------------------------
# 入口清单:12 个 HTTP 端点逐一登记(新增一个不登记就该被下面的参数化漏掉)
# ---------------------------------------------------------------------------

CREATE_PATH = "/api/workflows"
CREATE_BODY: dict[str, Any] = {"name": "wfA", "steps": []}

#: 动"某一行"的端点;{wid}=工作流 id,{iid}=实例 id
ROW_TARGETS: tuple[tuple[str, str], ...] = (
    ("get", "/api/workflows/{wid}"),
    ("put", "/api/workflows/{wid}"),
    ("delete", "/api/workflows/{wid}"),
    ("post", "/api/workflows/{wid}/trigger"),
    ("get", "/api/workflows/instances/{iid}"),
    ("get", "/api/workflows/instances/{iid}/tasks"),
    ("get", "/api/workflows/instances/{iid}/logs"),
    ("post", "/api/workflows/instances/{iid}/cancel"),
    ("post", "/api/workflows/instances/{iid}/retry"),
)

#: 集合型端点(列表 / 创建)
COLLECTION_TARGETS: tuple[tuple[str, str], ...] = (
    ("get", "/api/workflows"),
    ("post", "/api/workflows"),
    ("get", "/api/workflows/instances"),
)

ALL_ENTRYPOINTS: tuple[tuple[str, str], ...] = COLLECTION_TARGETS + ROW_TARGETS


def _detail_shape(resp: Any, ident: str) -> str:
    """把响应里回显的那个 id 换成占位符 —— 比的是消息模板,不是回显内容。

    少了这一步,"detail 里写着 wf-A"与"detail 里写着 wf-不存在"会被判成不同形,
    而那根本不是存在性 oracle(id 是调用方自己给的);模板不同才是。
    """
    payload = resp.json()
    text = str(payload["detail"]) if isinstance(payload, dict) and "detail" in payload else str(payload)
    return text.replace(ident, "<id>")


def _body_for(method: str, path: str) -> Any:
    """按端点既有契约给出请求体(get/delete 不发 body —— httpx 也不接受 json= None)。"""
    if method == "put":
        return {"name": "x"}
    if method == "post" and path.endswith("/workflows"):
        return CREATE_BODY
    if method in ("get", "delete"):
        return None
    return {}


async def _req(
    ac: Any,
    method: str,
    path: str,
    *,
    body: Any = None,
    headers: dict[str, str] | None = None,
) -> Any:
    fn = getattr(ac, method)
    if method in ("post", "put"):
        return await fn(path, json=body if body is not None else {}, headers=headers)
    return await fn(path, headers=headers)


def _seed_running_instance(eng: WorkflowEngine, wf_id: str, owner: str) -> WorkflowInstance:
    """直接登记一条 running 实例(不起后台 task)。

    为什么不靠 trigger:steps=[] 的实例会在任何断言之前跑完变成 completed,于是
    "cancel 被拒"可能来自状态判定而不是属主闸 —— 那样这条用例就不再证明顺序了。
    """
    inst = WorkflowInstance(
        id=f"wi-seed-{len(eng._instances) + 1}",
        workflowId=wf_id,
        workflowName="B的流程",
        status="running",
        startedAt="2026-01-01T00:00:00+00:00",
        userId=owner,
    )
    eng._instances[inst.id] = inst
    eng._cancel_events[inst.id] = asyncio.Event()
    return inst


async def _seed_b(eng: WorkflowEngine) -> tuple[str, str]:
    """B 名下的工作流 + 一条 running 实例(全部走引擎本身,不经 HTTP)。"""
    wf = eng.create_workflow(
        name="B的流程", description="", triggerType="manual", steps=[], owner=USER_B
    )
    inst = _seed_running_instance(eng, wf.id, USER_B)
    return wf.id, inst.id


# =========================================================================
# 1. 无身份 → 401,且引擎一次都没被调用
# =========================================================================


@pytest.mark.parametrize("method,path", ALL_ENTRYPOINTS)
async def test_no_identity_is_401_and_engine_untouched(
    bare_client: Any, engine: WorkflowEngine, method: str, path: str
) -> None:
    r = await _req(bare_client, method, path, body=_body_for(method, path))
    assert r.status_code == 401, f"{method.upper()} {path} 无身份应 401,实得 {r.status_code}"
    assert engine.calls == [], "401 之前不得已经打过引擎查询"  # type: ignore[attr-defined]


@pytest.mark.parametrize("method,path", ALL_ENTRYPOINTS)
async def test_missing_token_through_middleware_is_401(
    client: Any, engine: WorkflowEngine, method: str, path: str
) -> None:
    """挂了中间件也一样:缺令牌一律 401,且引擎零调用(两道防线不是彼此的替代)。"""
    r = await _req(
        client, method, path.format(wid="wf-x", iid="wi-x"), body=_body_for(method, path)
    )
    assert r.status_code == 401, f"{method.upper()} {path} 应 401,实得 {r.status_code}"
    assert engine.calls == []  # type: ignore[attr-defined]


# =========================================================================
# 2+3. 越权:同码同响应体 + 副作用未发生
# =========================================================================


async def test_foreign_rows_are_indistinguishable_from_missing(
    client: Any, engine: WorkflowEngine
) -> None:
    """A 的令牌动 B 的行 ⇒ 与"根本不存在"同码且响应体逐字等值(不给存在性预言机)。"""
    wid, iid = await _seed_b(engine)
    wf_missing = "wf-does-not-exist"
    wi_missing = "wi-does-not-exist"
    # (方法, 别人的路径, 不存在的路径, 前者含的 id, 后者含的 id)
    cases = [
        ("get", f"/api/workflows/{wid}", f"/api/workflows/{wf_missing}", wid, wf_missing),
        ("put", f"/api/workflows/{wid}", f"/api/workflows/{wf_missing}", wid, wf_missing),
        ("delete", f"/api/workflows/{wid}", f"/api/workflows/{wf_missing}", wid, wf_missing),
        ("post", f"/api/workflows/{wid}/trigger", f"/api/workflows/{wf_missing}/trigger", wid, wf_missing),
        ("get", f"/api/workflows/instances/{iid}", f"/api/workflows/instances/{wi_missing}", iid, wi_missing),
        ("get", f"/api/workflows/instances/{iid}/tasks", f"/api/workflows/instances/{wi_missing}/tasks", iid, wi_missing),
        ("get", f"/api/workflows/instances/{iid}/logs", f"/api/workflows/instances/{wi_missing}/logs", iid, wi_missing),
        ("post", f"/api/workflows/instances/{iid}/cancel", f"/api/workflows/instances/{wi_missing}/cancel", iid, wi_missing),
        ("post", f"/api/workflows/instances/{iid}/retry", f"/api/workflows/instances/{wi_missing}/retry", iid, wi_missing),
    ]
    for meth, foreign, missing, foreign_id, missing_id in cases:
        body = _body_for(meth, foreign)
        rf = await _req(client, meth, foreign, body=body, headers=_auth(USER_A))
        rm = await _req(client, meth, missing, body=body, headers=_auth(USER_A))
        assert rf.status_code == rm.status_code, f"{foreign}: {rf.status_code} vs {rm.status_code}"
        assert rf.status_code in (200, 400, 404), f"{foreign} 状态码形状超出既有口径"
        # "同消息形状"= 把调用方自己给的那个 id 归一化之后逐字等值。
        # 不归一化就是在比"消息里回显了哪个 id"(那不是 oracle);归一化后仍不等 = 模板不同 ⇒ 才是 oracle。
        assert _detail_shape(rf, foreign_id) == _detail_shape(rm, missing_id), (
            f"{foreign} 的消息形状与不存在的不同形 ⇒ 存在性 oracle:{rf.text} / {rm.text}"
        )


async def test_foreign_write_and_lifecycle_have_zero_side_effects(
    client: Any, engine: WorkflowEngine
) -> None:
    """本票的正文:断言的是"事情没发生",不是"回了个 4xx"。"""
    wid, iid = await _seed_b(engine)
    before_instances = set(engine._instances)
    before_name = engine._workflows[wid].name
    before_steps = engine._workflows[wid].steps
    engine._running_instances.discard(wid)
    cancel_event = engine._cancel_events[iid]

    r = await _req(
        client,
        "put",
        f"/api/workflows/{wid}",
        body={"name": "偷改", "steps": [{"type": "echo"}]},
        headers=_auth(USER_A),
    )
    assert r.status_code == 404
    assert engine._workflows[wid].name == before_name, "越权 PUT 却把名字改了 ⇒ 先写后拒"
    assert engine._workflows[wid].steps == before_steps, "越权 PUT 却替换了 steps"

    r = await _req(
        client, "post", f"/api/workflows/instances/{iid}/cancel", headers=_auth(USER_A)
    )
    assert r.status_code == 400
    assert engine._instances[iid].status == "running", "前置条件:实例必须仍可取消,否则这条断言没有牙"
    assert cancel_event.is_set() is False, (
        "越权 cancel 却把取消事件 set 了 ⇒ 属主闸排在状态判定之后(先动手再判该不该动)"
    )

    r = await _req(
        client, "post", f"/api/workflows/{wid}/trigger", body={"input": {}}, headers=_auth(USER_A)
    )
    assert r.status_code == 400
    assert set(engine._instances) == before_instances, "越权 trigger 却创建了实例"
    assert wid not in engine._running_instances, "越权 trigger 却占了运行中名额"

    # 把 B 的实例改成"可重试"态再试:如果闸在状态判定之后,这一步就会真创建新实例。
    engine._instances[iid].status = "failed"
    r = await _req(
        client, "post", f"/api/workflows/instances/{iid}/retry", headers=_auth(USER_A)
    )
    assert r.status_code == 400
    assert set(engine._instances) == before_instances, "越权 retry 却创建了实例"

    r = await _req(client, "delete", f"/api/workflows/{wid}", headers=_auth(USER_A))
    assert r.status_code == 404
    assert wid in engine._workflows, "越权 DELETE 却删了行"

    r = await _req(client, "get", f"/api/workflows/instances/{iid}", headers=_auth(USER_A))
    assert r.status_code == 404


async def test_list_endpoints_scope_to_owner(client: Any, engine: WorkflowEngine) -> None:
    """列表侧同样过滤 —— 否则"详情读不到但列表里看得见别人的 id 与名字"仍是泄露。"""
    wid, _ = await _seed_b(engine)
    r = await client.post(CREATE_PATH, json=CREATE_BODY, headers=_auth(USER_A))
    assert r.status_code == 201
    mine = r.json()["data"]["id"]

    r = await client.get("/api/workflows", headers=_auth(USER_A))
    assert [w["id"] for w in r.json()["data"]["list"]] == [mine], "A 的列表应当只含自己那一条"

    r = await client.get("/api/workflows/instances", headers=_auth(USER_A))
    assert r.json()["data"]["list"] == [], "A 不应看见 B 的实例"

    r = await client.get("/api/workflows", headers=_auth(USER_B))
    assert [w["id"] for w in r.json()["data"]["list"]] == [wid], "B 应当仍看得见自己的"


# =========================================================================
# 4. 正向对照:同属主跑通,且每次带主体的访问都真的带着令牌主体
# =========================================================================


async def test_owner_happy_path_still_works(client: Any, engine: WorkflowEngine) -> None:
    r = await client.post(CREATE_PATH, json=CREATE_BODY, headers=_auth(USER_A))
    assert r.status_code == 201
    wid = r.json()["data"]["id"]

    r = await client.put(f"/api/workflows/{wid}", json={"name": "自己改的名"}, headers=_auth(USER_A))
    assert r.status_code == 200 and r.json()["data"]["name"] == "自己改的名"

    r = await client.get(f"/api/workflows/{wid}", headers=_auth(USER_A))
    assert r.status_code == 200

    r = await client.post(f"/api/workflows/{wid}/trigger", json={"input": {}}, headers=_auth(USER_A))
    assert r.status_code == 200, r.text
    iid = r.json()["data"]["id"]

    r = await client.get(f"/api/workflows/instances/{iid}", headers=_auth(USER_A))
    assert r.status_code == 200
    r = await client.get(f"/api/workflows/instances/{iid}/tasks", headers=_auth(USER_A))
    assert r.status_code == 200
    r = await client.get(f"/api/workflows/instances/{iid}/logs", headers=_auth(USER_A))
    assert r.status_code == 200

    # 取消的正向对照必须落在一条仍可取消的实例上(steps=[] 的那条早已 completed,
    # 拿它断"200"会得到 400,而把断言改成"接受 400"就等于把这条判据作废)。
    running = _seed_running_instance(engine, wid, USER_A)
    r = await client.post(
        f"/api/workflows/instances/{running.id}/cancel", headers=_auth(USER_A)
    )
    assert r.status_code == 200, r.text
    assert engine._cancel_events[running.id].is_set() is True, "同属主取消却没置取消事件 ⇒ 功能被改坏"

    r = await client.delete(f"/api/workflows/{wid}", headers=_auth(USER_A))
    assert r.status_code == 200
    assert wid not in engine._workflows


@pytest.mark.parametrize("method,path", ALL_ENTRYPOINTS)
async def test_scoped_access_carries_the_principal(
    client: Any, engine: WorkflowEngine, method: str, path: str
) -> None:
    """归属条件落在**被发出的那次访问**上(本仓 SQL whereArgs 的等价物),不是取全量后在端点里 if。"""
    wid, iid = await _seed_b(engine)
    engine.calls.clear()  # type: ignore[attr-defined]
    url = path.format(wid=wid, iid=iid)
    r = await _req(client, method, url, body=_body_for(method, path), headers=_auth(USER_A))
    assert r.status_code in (200, 201, 400, 404), f"{method.upper()} {url} → {r.status_code}"

    scoped = list(engine.calls)  # type: ignore[attr-defined]
    assert scoped, f"{method.upper()} {path} 没有走任何引擎访问 ⇒ 本判据在空转"
    for label, args, kwargs in scoped:
        got = _principal_of(args, kwargs)
        assert got == USER_A, (
            f"{label} 未带令牌主体(实得 {got!r}):说明归属是"
            f"事后过滤或压根没带,不是落在被发出的那次访问上 args={args} kwargs={kwargs}"
        )


# =========================================================================
# 5. 无主 / dev 通道:行为逐字未变
# =========================================================================


async def test_unauthenticated_channel_is_not_gated_and_ownerless_rows_stay_visible(
    monkeypatch: pytest.MonkeyPatch, engine: WorkflowEngine
) -> None:
    """开发降级身份归一为 None ⇒ 不加闸:无主行照旧可见,响应 shape 不多一个字段。"""
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(jwt_auth.settings, "jwt_secret", "")
    monkeypatch.setattr(jwt_auth.settings, "node_env", "development")

    wf = engine.create_workflow(name="无主流程", description="", triggerType="manual", steps=[])
    assert wf.userId is None, "无身份通道不得写假主体当属主"

    transport = ASGITransport(app=_app(with_middleware=False))
    async with AsyncClient(transport=transport, base_url="http://wf-dev") as ac:
        r = await ac.get("/api/workflows")
        assert r.status_code == 200, r.text
        assert [w["id"] for w in r.json()["data"]["list"]] == [wf.id]
        r = await ac.get(f"/api/workflows/{wf.id}")
        assert r.status_code == 200
        assert set(r.json()["data"]["workflow"]) == {
            "id",
            "name",
            "description",
            "triggerType",
            "steps",
            "isActive",
            "createdAt",
            "updatedAt",
        }, "响应 shape 不得因本票多出字段(属主是授权事实不是对外字段)"
        r = await ac.post(f"/api/workflows/{wf.id}/trigger", json={"input": {}})
        assert r.status_code == 200, r.text
        assert r.json()["data"]["workflowId"] == wf.id


def test_resolve_caller_normalizes_only_the_dev_fallback() -> None:
    assert resolve_caller(None) is None
    assert resolve_caller(jwt_auth.DEV_ANONYMOUS_PRINCIPAL) is None
    assert resolve_caller(USER_A) == USER_A
    assert resolve_caller("") is None, "空串不是主体"


# =========================================================================
# 第二承载:引擎后台执行链的 tool 步骤必须带触发者身份
# =========================================================================

TOOL_STEP: dict[str, Any] = {"type": "tool", "config": {"tool": "analyze_code"}, "input": {"code": "x"}}
FORGED_STEP: dict[str, Any] = {
    "type": "tool",
    "config": {"tool": "analyze_code", "user": USER_B, "userId": USER_B},
    "input": {},
}


@pytest.mark.asyncio
async def test_tool_step_gets_the_instance_owner_not_the_step_author(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict[str, Any] = {}

    async def fake_call_tool(name: str, arguments: Any = None, **kwargs: Any) -> dict[str, Any]:
        captured["name"] = name
        captured["user_id"] = kwargs.get("user_id", "<缺席>")
        return {"ok": True}

    monkeypatch.setattr("app.services.mcp_server.mcp_server.call_tool", fake_call_tool)

    res = await engine._execute_step(TOOL_STEP, {}, "inst-1", user_id=USER_A)
    assert res.get("error") is None, res
    assert captured["user_id"] == USER_A, "身份没从承载层传到工具 ⇒ 第二承载仍在漏"

    captured.clear()
    res = await engine._execute_step(FORGED_STEP, {}, "inst-2", user_id=USER_A)
    assert res.get("error") is None, res
    assert captured["user_id"] == USER_A, "step.config.user 自报身份赢了 ⇒ 可把副作用记到别人头上"

    captured.clear()
    await engine._execute_step(TOOL_STEP, {}, "inst-3")
    assert captured["user_id"] is None, "无身份通道必须仍传 None(与改动前 call_tool 的默认同形)"


@pytest.mark.asyncio
async def test_background_execution_carries_owner(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """trigger → 实例带主体 → 后台执行链里的 tool 步骤拿到的是触发者,而不是 None。"""
    seen: list[Any] = []

    async def fake_call_tool(name: str, arguments: Any = None, **kwargs: Any) -> dict[str, Any]:
        seen.append(kwargs.get("user_id", "<缺席>"))
        return {"ok": True}

    monkeypatch.setattr("app.services.mcp_server.mcp_server.call_tool", fake_call_tool)
    wf = engine.create_workflow(
        name="带工具的流水",
        description="",
        triggerType="manual",
        steps=[{"type": "tool", "name": "t", "config": {"tool": "analyze_code"}, "input": {}}],
        owner=USER_A,
    )
    inst = await engine.trigger_workflow(wf.id, {"k": 1}, principal=USER_A)
    assert inst is not None and inst.userId == USER_A
    # 显式驱动后台执行链本身(不等 create_task 的调度时机 —— 时机型断言会随机闪红),
    # 证明 user_id 是从实例记录带进 _execute_step 的,而不是靠调用方顺手传。
    await engine._execute_instance(inst, engine._workflows[wf.id])
    assert seen, "tool 步骤一次都没被走到 ⇒ 本判据在空转"
    assert all(u == USER_A for u in seen), f"后台链上的工具身份不是触发者: {seen}"
    assert None not in seen and "<缺席>" not in seen, f"第二承载仍在漏身份: {seen}"

    # 定义行有主、但由无身份通道触发 ⇒ 实例继承定义行的属主,而不是落一个假主体或 None
    orphanless = await engine.trigger_workflow(wf.id, {"k": 2})
    assert orphanless is not None and orphanless.userId == USER_A
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
