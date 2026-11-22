# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""引擎 JSON-RPC 通道「谁在调用」= 承载层绑定的令牌主体(2026-09-27 立)。

根治的形状:结算/读写型处理器过去把 principal 建在**被操作记录**上 ——
`approval.respond` 的 principal 取自"被点名的那条线程"的 user_id,于是 bob 只要
点名 alice 的线程,引擎就把 principal 换成 "alice",属主比对变成"受害者 vs 受害者
自己",必然通过。同一枚结算还顺带走过两处**跨线程全局 dict**
(`_permission_requests` 的 future、`grant_tool_approval_persist` 的
sandbox_full_access 权限升级),那两处旧代码完全不做属主判定。

修法(本文件逐条验):
  · `_connection_principal(params)` 只读承载层写入的 params.userId;
  · `_thread_belongs` / `_principal_allows` 是属主判定的唯一实现(None 的一侧只表示
    "无从对账",不构成授权结论);
  · `_require_thread` 吃同一判据,越权与"线程不存在"**同码同形**;
  · 结算侧统一走同一个咽喉点:点名他人线程 ⇒ applied=False + **零副作用**;
  · `_permission_requests` 存带主记录(thread_id/user_id/future),"谁能结哪条"由构造决定;
  · `thread.list` 两分支都按属主过滤,`total`/`hasMore` 与被过滤的那批一致。
  · G-251 补第三张待决表:`_elicitation_requests` 同样存带主记录,陌生连接替别人
    回答 elicitation(= 往别人的模型回合里塞输入)被拒,且"没这条"与"不是你的"
    **同形回包**(elicitationId 是唯一把手,分出两态即成存在性预言机)。

控制测量(判据不是空转的证据):在实现之前,下面这几条越权用例的行为是
`applied=True` + alice 的审批/future 被结算 —— 当时由
`.ihui-agent/tmp/engine-ownership-probe/probe.py` 现跑记录为 VULNERABLE
(applied=True、alice 的 event 被 set、permission future done=True)。实现后同一
探针翻成 SAFE。因此本文件里凡是"被拒"的断言都必须与"同属主仍然通过"的断言成对
出现 —— 只留前者,门就可能只是把功能改坏了。

隔离策略(§5 测试隔离铁律):私有引擎实例 + 最小 app + 中间件注 request.state.user_id
(与 tests/test_engine_principal_binding_59.py 同构)。全程
AGENT_ENGINE_PERSIST=off,store 档只挂 tmp_path 里的私有 SQLite ——
不碰 data/sessions.db、不碰生产 PG(8810)/Redis(8811)。
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from fastapi import FastAPI, Request, Response
from httpx import ASGITransport, AsyncClient

from app.routers import engine as engine_router
from app.services import agent_loop_v2
from app.services.agent_engine import (
    THREAD_NOT_FOUND,
    AgentEngine,
    EngineThread,
    _PendingElicitationRequest,
    _PendingPermissionRequest,
)
from app.services.session_store import SessionStore
from tests.test_agent_engine_router import _engine, _Loop, _rpc

# ---------------------------------------------------------------------------
# 夹具与助手
# ---------------------------------------------------------------------------


def _app_for(principal: str | None, engine: AgentEngine) -> FastAPI:
    """最小 app:中间件模拟 JWT 中间件注入 request.state.user_id(生产同源字段)。

    传入的是**调用方带来的引擎**,所以两个不同 principal 的 client 可以共享同一台
    引擎里的同一批线程 —— 那才是"bob 点名 alice 的线程"的真实形状。
    """
    app = FastAPI()

    @app.middleware("http")
    async def _stub_auth(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if principal is not None:
            request.state.user_id = principal
        return await call_next(request)

    app.include_router(engine_router.router, prefix="/api")
    return app


def _client_for(principal: str | None, engine: AgentEngine) -> AsyncClient:
    return AsyncClient(
        transport=ASGITransport(app=_app_for(principal, engine)),
        base_url="http://ownership.test",
    )


@pytest.fixture
def engine_ref(monkeypatch: pytest.MonkeyPatch):
    """给出 build(store=None) → engine;默认关持久化并隔离模块级审批注册表。

    两种引擎共用同一个假主循环工厂(test_agent_engine_router._Loop):带 store 的那台
    只是多挂一个**私有 tmp SQLite**,判据路径完全同形 —— 否则"store 分支绿"就不能和
    "内存分支绿"互相引用。
    """
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")
    monkeypatch.setattr(agent_loop_v2, "_approval_registry", {})
    monkeypatch.setattr(agent_loop_v2, "_approval_persist_keys", {})

    async def _factory(spec: dict[str, Any], host_tools: list[Any]) -> Any:
        loop = _Loop()
        loop.spec = spec
        return loop

    def build(store: SessionStore | None = None) -> AgentEngine:
        # 路由的 handler 读的是**模块级 ENGINE**,不持有 app 级依赖 —— 所以必须显式
        # 把它换成本用例的私有引擎,否则请求会打到进程级单例上(线程落在另一台引擎里,
        # 断言读到的引擎与被测请求根本不是同一台;binding_59 同批夹具就是这么接的)。
        engine = AgentEngine(loop_factory=_factory, store=store) if store else _engine()
        monkeypatch.setattr(engine_router, "ENGINE", engine)
        return engine

    return build


async def _start_thread(client: AsyncClient, declared_user_id: str | None = None) -> str:
    """经承载层建线程;返回 threadId。params 里的自述 userId 会被绑定层覆盖。"""
    params: dict[str, Any] = {}
    if declared_user_id is not None:
        params["userId"] = declared_user_id
    resp = await client.post("/api/engine/rpc", json=_rpc("thread.start", params))
    body = resp.json()
    assert "error" not in body, body
    return str(body["result"]["threadId"])


async def _call(client: AsyncClient, method: str, params: dict[str, Any]) -> dict[str, Any]:
    resp = await client.post("/api/engine/rpc", json=_rpc(method, params))
    return resp.json()


def _register_approval(
    engine: AgentEngine,
    approval_id: str,
    *,
    owner: str | None,
    persist_key: str | None = None,
) -> asyncio.Future[str]:
    """登记一条待决审批 + 同 id 的 permission 请求(与生产登记点同形)。

    返回该请求的 future —— 断言"未发出副作用"就是断言它 `not done()`。
    """
    entry = agent_loop_v2._ApprovalEntry(
        event=asyncio.Event(), decision=None, owner_user_id=owner
    )
    agent_loop_v2._approval_registry[approval_id] = entry
    if persist_key is not None:
        agent_loop_v2._approval_persist_keys[approval_id] = persist_key
    future: asyncio.Future[str] = asyncio.get_running_loop().create_future()
    engine._permission_requests[approval_id] = _PendingPermissionRequest(
        thread_id="thr-registry-side", user_id=owner, future=future
    )
    return future


@pytest.fixture
def grant_spy(monkeypatch: pytest.MonkeyPatch):
    """把 sandbox_full_access 权限升级落点换成记录器(绝不写 approval_grants.db)。"""
    calls: list[tuple[str, str]] = []

    def _fake(approval_id: str, scope: str) -> bool:
        calls.append((approval_id, scope))
        return True

    monkeypatch.setattr(agent_loop_v2, "grant_tool_approval_persist", _fake)
    return calls


def _thread_of(engine: AgentEngine, thread_id: str) -> EngineThread:
    thread = engine._threads.get(thread_id)
    assert thread is not None, "线程未登记"
    return thread


# ---------------------------------------------------------------------------
# 1. 同属主正常路径仍然通过(防止"把漏洞修成把功能改坏")
# ---------------------------------------------------------------------------


async def test_owner_resolves_own_approval_and_grant_path_still_works(
    engine_ref, grant_spy
) -> None:
    engine = engine_ref()
    alice = _client_for("alice", engine)
    async with alice:
        tid = await _start_thread(alice)
        assert _thread_of(engine, tid).user_id == "alice"
        future = _register_approval(
            engine, "apr_own", owner="alice", persist_key="tool\x1fown"
        )
        body = await _call(
            alice,
            "approval.respond",
            {
                "threadId": tid,
                "approvalId": "apr_own",
                "decision": "approve",
                "persist": "always",
            },
        )
    result = body["result"]
    assert result["applied"] is True, result
    assert result["persisted"] == "always"
    entry = agent_loop_v2._approval_registry["apr_own"]
    assert entry.event.is_set() and entry.decision == "approve"
    assert future.done() and future.result() == "approve"
    # 权限升级落点被调用一次,且是这条审批 —— 批准链路未被削弱
    assert grant_spy == [("apr_own", "always")]


# ---------------------------------------------------------------------------
# 2+3. bob 点名 alice 的线程 / bob 只猜 approvalId ⇒ 拒绝且零副作用
# ---------------------------------------------------------------------------


async def test_foreign_named_thread_yields_no_side_effects(engine_ref, grant_spy) -> None:
    engine = engine_ref()
    alice = _client_for("alice", engine)
    bob = _client_for("bob", engine)
    async with alice, bob:
        alice_tid = await _start_thread(alice)
        future = _register_approval(
            engine, "apr_victim", owner="alice", persist_key="tool\x1fvictim"
        )
        body = await _call(
            bob,
            "approval.respond",
            {
                "threadId": alice_tid,
                "approvalId": "apr_victim",
                "decision": "approve",
                "persist": "always",
            },
        )
    result = body["result"]
    # ① 结论:未生效,并点名原因
    assert result["applied"] is False and result["reason"] == "foreign_thread", result
    # ② "未发出副作用"——本仓 §5 的取证口径:断言查询/写入**没发生**,不是只断言状态码
    entry = agent_loop_v2._approval_registry["apr_victim"]
    assert not entry.event.is_set(), "alice 的审批等待事件被陌生连接唤醒了"
    assert entry.decision is None, "决策被写进了别人名下的审批条目"
    assert not future.done(), "alice 名下的 permission future 被 resolve/reject 了"
    assert grant_spy == [], "越权尝试触发了 sandbox_full_access 权限升级"


async def test_guessing_approval_id_without_threadid_cannot_settle(
    engine_ref, grant_spy
) -> None:
    engine = engine_ref()
    alice = _client_for("alice", engine)
    bob = _client_for("bob", engine)
    async with alice, bob:
        await _start_thread(alice)  # 让引擎里确有线程(排除"因为没线程所以碰不到")
        future = _register_approval(engine, "apr_guess", owner="alice")
        body = await _call(
            bob, "approval.respond", {"approvalId": "apr_guess", "decision": "approve"}
        )
    assert body["result"]["applied"] is False, body["result"]
    entry = agent_loop_v2._approval_registry["apr_guess"]
    assert not entry.event.is_set() and entry.decision is None
    assert not future.done()
    assert grant_spy == []


# ---------------------------------------------------------------------------
# 4. tools.result:不得结算别人的 pending
# ---------------------------------------------------------------------------


async def test_foreign_tools_result_is_not_settled(engine_ref) -> None:
    engine = engine_ref()
    alice = _client_for("alice", engine)
    bob = _client_for("bob", engine)
    async with alice, bob:
        alice_tid = await _start_thread(alice)
        thread = _thread_of(engine, alice_tid)
        pending: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
        thread.pending["call_foreign"] = pending
        # ① 不带 threadId:只在 bob 名下的线程里找 ⇒ 找不到,且 alice 的表未动
        blind = await _call(
            bob, "tools.result", {"requestId": "call_foreign", "result": "ok"}
        )
        assert blind["result"]["applied"] is False, blind["result"]
        assert blind["result"]["reason"] == "unknown_request"
        assert not pending.done() and "call_foreign" in thread.pending
        # ② 带 alice 的 threadId:与"线程不存在"同码同形,不得回显别人的 threadId
        named = await _call(
            bob,
            "tools.result",
            {"threadId": alice_tid, "requestId": "call_foreign", "result": "ok"},
        )
        assert named["error"]["code"] == THREAD_NOT_FOUND, named
        assert "result" not in named
        assert not pending.done() and "call_foreign" in thread.pending
        # ③ alice 自己回传:仍然生效(正向对照)
        mine = await _call(
            alice,
            "tools.result",
            {"threadId": alice_tid, "requestId": "call_foreign", "result": "ok"},
        )
        assert mine["result"]["applied"] is True
        assert mine["result"]["threadId"] == alice_tid
    assert pending.done() and pending.result() == "ok"


# ---------------------------------------------------------------------------
# 5. thread.list 按属主过滤 + 计数诚实性(内存模式与 store 模式各一条)
# ---------------------------------------------------------------------------


async def test_thread_list_memory_branch_scoped_and_total_honest(engine_ref) -> None:
    engine = engine_ref()  # AGENT_ENGINE_PERSIST=off ⇒ 走内存分支
    alice = _client_for("alice", engine)
    bob = _client_for("bob", engine)
    async with alice, bob:
        alice_tids = [await _start_thread(alice) for _ in range(2)]
        bob_tid = await _start_thread(bob)

        listing = (await _call(alice, "thread.list", {"limit": 50}))["result"]
        assert {t["threadId"] for t in listing["threads"]} == set(alice_tids)
        # 计数诚实性:total/hasMore 说的是"过滤后的那批",不是全量
        assert listing["total"] == 2 and listing["hasMore"] is False
        bob_listing = (await _call(bob, "thread.list", {"limit": 50}))["result"]
        assert [t["threadId"] for t in bob_listing["threads"]] == [bob_tid]
        assert bob_listing["total"] == 1


async def test_thread_list_store_branch_filters_and_keeps_total_consistent(
    engine_ref, tmp_path
) -> None:
    store = SessionStore(str(tmp_path / "ownership.db"))
    engine = engine_ref(store)
    alice = _client_for("alice", engine)
    async with alice:
        alice_tids = [await _start_thread(alice) for _ in range(2)]
        bob_tid = (
            await _call(_client_for("bob", engine), "thread.start", {})
        )["result"]["threadId"]
        # 历史行:metadata 里没有 userId ⇒ 带身份时排除,不带身份时照给
        store.create_thread(thread_id="thr_legacy", title="legacy", metadata={})

        page1 = (await _call(alice, "thread.list", {"limit": 1, "offset": 0}))["result"]
        assert [t["threadId"] for t in page1["threads"]] == [alice_tids[1]]
        assert page1["total"] == 2, "total 必须是过滤后的计数,不是全库计数"
        assert page1["hasMore"] is True
        page2 = (await _call(alice, "thread.list", {"limit": 1, "offset": 1}))["result"]
        assert [t["threadId"] for t in page2["threads"]] == [alice_tids[0]]
        assert page2["total"] == 2 and page2["hasMore"] is False

        # bob 只看得到自己那一条(且 alice 的两条不在集合里)
        bob_page = (await _call(_client_for("bob", engine), "thread.list", {}))["result"]
        assert [t["threadId"] for t in bob_page["threads"]] == [bob_tid]

    # 未鉴权通道:维持改动前的"全给"(含无 userId 的历史行)
    anon = _client_for(None, engine)
    async with anon:
        anon_page = (await _call(anon, "thread.list", {"limit": 50}))["result"]
    ids = {t["threadId"] for t in anon_page["threads"]}
    assert {"thr_legacy", bob_tid, *alice_tids} <= ids
    assert anon_page["total"] == len(anon_page["threads"]) == 4


# ---------------------------------------------------------------------------
# 6. 重启恢复后仍带属主(持久 metadata 是属主判据的前提)
# ---------------------------------------------------------------------------


async def test_owner_survives_restart_and_foreign_caller_is_rejected(
    engine_ref, tmp_path
) -> None:
    store = SessionStore(str(tmp_path / "restart.db"))
    engine = engine_ref(store)
    alice = _client_for("alice", engine)
    bob = _client_for("bob", engine)
    async with alice, bob:
        tid = await _start_thread(alice, declared_user_id="mallory")
        # 承载层绑定优先:谎报值不得落进 metadata
        assert store.get_thread(tid).metadata["userId"] == "alice"
        # 批 60(G-249)之前这里挂着一格未收口:`thread/metadata` 的 merge=False 整写
        # 会把持久化 metadata 里的 userId/roleId 一起冲掉 ⇒ 重启恢复出的线程无属主。
        # 现在身份键在引擎侧与存储侧都盖不穿(同一份 IDENTITY_METADATA_KEYS),所以这里
        # 顺手做一次整写再重启:属主必须还在,外来调用必须被拒。
        patched = await _call(alice, "thread.metadata", {"threadId": tid, "patch": {"biz": 1}, "merge": False})
        assert "error" not in patched, patched
        engine._threads.clear()  # 模拟进程重启:内存线程全丢,只剩库里的 metadata
        denied = await _call(bob, "thread.state", {"threadId": tid})
        assert denied["error"]["code"] == THREAD_NOT_FOUND, denied
        ok = await _call(alice, "thread.state", {"threadId": tid})
        assert "error" not in ok, ok
    assert _thread_of(engine, tid).user_id == "alice"
    assert store.get_thread(tid).metadata["userId"] == "alice"


# ---------------------------------------------------------------------------
# 7. 反向对照:未鉴权通道(principal=None)行为与改动前逐字相同
# ---------------------------------------------------------------------------


async def test_unauthenticated_channel_is_unchanged(engine_ref, grant_spy) -> None:
    engine = engine_ref()
    anon = _client_for(None, engine)
    async with anon:
        tid = await _start_thread(anon, declared_user_id="declared-x")
        # 历史语义:无已验证身份时保留自述值(不新增权限,也不假装绑定)
        assert _thread_of(engine, tid).user_id == "declared-x"
        future = _register_approval(
            engine, "apr_anon", owner="declared-x", persist_key="tool\x1fanon"
        )
        body = await _call(
            anon,
            "approval.respond",
            {
                "threadId": tid,
                "approvalId": "apr_anon",
                "decision": "approve",
                "persist": "session",
            },
        )
        result = body["result"]
        # 与改动前同形:四个键、applied=True、**没有** reason 这一新字段
        assert result == {
            "approvalId": "apr_anon",
            "decision": "approve",
            "applied": True,
            "persisted": "session",
        }
        assert future.done() and future.result() == "approve"
        assert grant_spy == [("apr_anon", "session")]
        # _require_thread / thread.list / tools.result 三条闸在无身份时一律不改变行为
        assert "error" not in await _call(anon, "thread.state", {"threadId": tid})
        listing = (await _call(anon, "thread.list", {"limit": 50}))["result"]
        assert [t["threadId"] for t in listing["threads"]] == [tid]
        pending: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
        _thread_of(engine, tid).pending["call_anon"] = pending
        settled = await _call(anon, "tools.result", {"requestId": "call_anon", "result": 1})
        assert settled["result"]["applied"] is True
    assert pending.done()


# ---------------------------------------------------------------------------
# 8. 带主记录由**注册点**盖章(不是测试替身造的),且同属主仍能结掉
# ---------------------------------------------------------------------------


def _find_builtin(engine: AgentEngine, thread: EngineThread, name: str) -> Any:
    for definition in engine._builtin_tool_definitions(thread):
        if getattr(definition, "name", "") == name:
            return definition
    raise AssertionError(f"内置工具未注入: {name}")


async def test_permission_request_registration_stamps_owner(engine_ref) -> None:
    engine = engine_ref()
    alice = _client_for("alice", engine)
    async with alice:
        tid = await _start_thread(alice)
        thread = _thread_of(engine, tid)
        requests: list[dict[str, Any]] = []

        async def _emit(message: dict[str, Any]) -> None:
            if message.get("method") == "approval/request":
                requests.append(message["params"])

        thread.emit = _emit
        tool = _find_builtin(engine, thread, "request_permissions")
        task = asyncio.create_task(
            tool.executor({"permissions": ["network"], "reason": "需要联网"})
        )
        for _ in range(200):
            if engine._permission_requests:
                break
            await asyncio.sleep(0.01)
        assert engine._permission_requests, "request_permissions 未登记待决请求"
        record = next(iter(engine._permission_requests.values()))
        # "哪条线程/哪个用户能结哪条"由构造决定:注册点在 thread 闭包里就取到属主
        assert record.thread_id == tid and record.user_id == "alice"
        request_id = requests[0]["requestId"]
        assert not record.future.done()
        body = await _call(
            alice, "approval.respond", {"approvalId": request_id, "decision": "approve"}
        )
        assert body["result"]["applied"] is True
        granted = await task
    assert granted["granted"] is True and granted["decision"] == "approve"


# ---------------------------------------------------------------------------
# 9. G-251:elicitation 待决提问(第三张跨线程全局 dict)必须带主
# ---------------------------------------------------------------------------


async def _ask_user_input(
    engine: AgentEngine, thread: EngineThread
) -> tuple[str, asyncio.Task[Any]]:
    """真走**注册点**发起一次 elicitation(不手搓待决表条目)。

    刻意不用 `engine._elicitation_requests[x] = ...` 造现场:那样即使注册点退回裸
    future,本组用例仍然全绿 —— 而"带主注册"正是本票要钉住的那一半。
    """
    requests: list[dict[str, Any]] = []

    async def _emit(message: dict[str, Any]) -> None:
        if message.get("method") == "elicitation/request":
            requests.append(message["params"])

    thread.emit = _emit
    tool = _find_builtin(engine, thread, "request_user_input")
    task: asyncio.Task[Any] = asyncio.create_task(
        tool.executor({"question": "选择部署区域?"})
    )
    for _ in range(200):
        if engine._elicitation_requests:
            break
        await asyncio.sleep(0.01)
    assert engine._elicitation_requests, "request_user_input 未登记待决提问"
    assert len(requests) == 1, requests
    return str(requests[0]["elicitationId"]), task


async def test_elicitation_registration_stamps_owner(engine_ref) -> None:
    """属主由注册点盖章:记录里的 thread_id/user_id 与线程同源(装车证明)。"""
    engine = engine_ref()
    alice = _client_for("alice", engine)
    async with alice:
        tid = await _start_thread(alice)
        elicitation_id, task = await _ask_user_input(engine, _thread_of(engine, tid))
        record = engine._elicitation_requests[elicitation_id]
        assert isinstance(record, _PendingElicitationRequest)
        assert record.thread_id == tid and record.user_id == "alice"
        assert not record.future.done()
        body = await _call(
            alice,
            "elicitation.respond",
            {"elicitationId": elicitation_id, "value": {"region": "cn-north"}},
        )
        assert body["result"]["applied"] is True, body["result"]
        outcome = await task
    assert outcome == {"responded": True, "value": {"region": "cn-north"}}
    # 结算后注册点自己清账(finally pop),不得留下跨连接可读的残留把手
    assert engine._elicitation_requests == {}


async def test_foreign_connection_cannot_answer_elicitation(engine_ref) -> None:
    """bob 猜中 elicitationId ⇒ 被拒且**零副作用**;alice 仍能正常答(正向对照)。

    修复前的行为由 `.ihui-agent/tmp/b59/probe-before.txt` 记录:同一请求
    `applied=True` 且 alice 的工具直接拿到 bob 塞进去的值 —— 后果是
    **别人的模型回合里出现攻击者提供的输入**,比读到别人的数据更重。
    """
    engine = engine_ref()
    alice = _client_for("alice", engine)
    bob = _client_for("bob", engine)
    async with alice, bob:
        tid = await _start_thread(alice)
        elicitation_id, task = await _ask_user_input(engine, _thread_of(engine, tid))
        stolen = await _call(
            bob,
            "elicitation.respond",
            {"elicitationId": elicitation_id, "value": "STOLEN"},
        )
        assert stolen["result"]["applied"] is False, stolen["result"]
        await asyncio.sleep(0)
        assert not task.done(), "陌生连接唤醒了 alice 名下的待决提问"
        answered = await _call(
            alice,
            "elicitation.respond",
            {"elicitationId": elicitation_id, "value": {"region": "cn"}},
        )
        assert answered["result"]["applied"] is True
        outcome = await task
    assert outcome == {"responded": True, "value": {"region": "cn"}}


async def test_elicitation_rejection_is_not_an_existence_oracle(engine_ref) -> None:
    """"这条不是你的"与"根本没有这条"必须**同形回包**。

    elicitationId 是该端点唯一的把手,分出两态就把它变成存在性预言机(与
    `_require_thread` 的"不给可枚举信号"同一条口径;`approval.respond` 那侧刻意不同,
    因为那里的请求本身就点名了 threadId,再说一次不增加信息)。
    """
    engine = engine_ref()
    alice = _client_for("alice", engine)
    bob = _client_for("bob", engine)
    async with alice, bob:
        tid = await _start_thread(alice)
        elicitation_id, task = await _ask_user_input(engine, _thread_of(engine, tid))
        foreign = await _call(
            bob, "elicitation.respond", {"elicitationId": elicitation_id, "value": 1}
        )
        missing = await _call(
            bob,
            "elicitation.respond",
            {"elicitationId": "eli_nope_000000", "value": 1},
        )
        assert {k: v for k, v in foreign["result"].items() if k != "elicitationId"} == {
            k: v for k, v in missing["result"].items() if k != "elicitationId"
        }, (foreign["result"], missing["result"])
        assert not task.done()
        await _call(
            alice,
            "elicitation.respond",
            {"elicitationId": elicitation_id, "value": None},
        )
        await task


async def test_elicitation_named_foreign_thread_yields_no_side_effects(
    engine_ref,
) -> None:
    """bob 点名 alice 的线程去答她的提问 ⇒ reason=foreign_thread 且待决表未被触碰。"""
    engine = engine_ref()
    alice = _client_for("alice", engine)
    bob = _client_for("bob", engine)
    async with alice, bob:
        alice_tid = await _start_thread(alice)
        elicitation_id, task = await _ask_user_input(engine, _thread_of(engine, alice_tid))
        before = dict(engine._elicitation_requests)
        body = await _call(
            bob,
            "elicitation.respond",
            {"threadId": alice_tid, "elicitationId": elicitation_id, "value": "STOLEN"},
        )
        assert body["result"]["applied"] is False
        assert body["result"]["reason"] == "foreign_thread", body["result"]
        assert dict(engine._elicitation_requests) == before, "越权尝试动过别人的待决表"
        await asyncio.sleep(0)
        assert not task.done()
        await _call(
            alice,
            "elicitation.respond",
            {"elicitationId": elicitation_id, "value": "ok"},
        )
        assert await task == {"responded": True, "value": "ok"}


async def test_elicitation_unauthenticated_channel_is_unchanged(engine_ref) -> None:
    """principal=None(未鉴权/dev 通道)⇒ 与改动前逐字相同,直接结算。

    这一条是**反向锁**:本票只收紧"带身份的调用",不得把 harness 既有链路
    (tests/test_engine_harness_fourth.py 里不带 userId 的用法)改坏。
    """
    engine = engine_ref()
    anon = _client_for(None, engine)
    async with anon:
        tid = await _start_thread(anon, declared_user_id="declared-y")
        elicitation_id, task = await _ask_user_input(engine, _thread_of(engine, tid))
        body = await _call(
            anon, "elicitation.respond", {"elicitationId": elicitation_id, "value": 42}
        )
        assert body["result"] == {"elicitationId": elicitation_id, "applied": True}
        assert await task == {"responded": True, "value": 42}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
