# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""O19 第三段(2026-09-21):引擎通道 thread 属主的**连接层绑定**测试。

根治的敞口:引擎 JSON-RPC 的 `thread.start` 过去直接采用客户端自述的 `params.userId`
作线程属主,而 `approval.respond` 又以该值作 principal 结算高危审批 ⇒ 在**已鉴权**的
连接上谎报他人 userId,即可解掉"该他人"名下的审批。修法是在承载层把已验证身份
写回 params.userId(`_bind_principal`),谎报值在进入引擎前就被丢弃。

隔离策略沿用 test_agent_engine_router:私有引擎实例 + 最小 app,不碰进程级 ENGINE。
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from fastapi import FastAPI, Request, Response
from httpx import ASGITransport, AsyncClient
from starlette.testclient import TestClient

from app.routers import engine as engine_router
from app.services.agent_engine import AgentEngine

from tests.test_agent_engine_router import _engine, _rpc


def _app_with_principal(principal: str | None) -> tuple[FastAPI, AgentEngine]:
    """最小 app:用中间件模拟 JWT 中间件注入 request.state.user_id(生产同源字段)。"""
    engine = _engine()

    app = FastAPI()

    @app.middleware("http")
    async def _stub_auth(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        if principal is not None:
            request.state.user_id = principal
        return await call_next(request)

    app.include_router(engine_router.router, prefix="/api")
    return app, engine


@pytest.fixture
def rpc_ctx(monkeypatch: pytest.MonkeyPatch):
    """返回 build(principal) → (client, engine):principal 模拟已鉴权身份,None = 匿名。"""

    def build(principal: str | None) -> tuple[AsyncClient, AgentEngine]:
        app, engine = _app_with_principal(principal)
        monkeypatch.setattr(engine_router, "ENGINE", engine)
        client = AsyncClient(
            transport=ASGITransport(app=app), base_url="http://rpc59.test"
        )
        return client, engine

    return build


async def _started_user_id(client: AsyncClient, engine: AgentEngine, declared: str) -> str | None:
    resp = await client.post(
        "/api/engine/rpc", json=_rpc("thread.start", {"userId": declared})
    )
    thread_id = resp.json()["result"]["threadId"]
    thread = engine._threads.get(thread_id)
    assert thread is not None, "thread.start 未创建线程"
    return thread.user_id


# ---------------------------------------------------------------------------
# 1. HTTP /rpc:已鉴权连接的谎报必须被丢弃
# ---------------------------------------------------------------------------


async def test_authenticated_rpc_ignores_self_declared_user_id(rpc_ctx) -> None:
    client, engine = rpc_ctx("alice")
    async with client:
        assert await _started_user_id(client, engine, "mallory") == "alice"


async def test_unauthenticated_rpc_keeps_declared_user_id(rpc_ctx) -> None:
    """无已验证身份时保留原行为(自述值),不新增权限也不假装绑定。"""
    client, engine = rpc_ctx(None)
    async with client:
        assert await _started_user_id(client, engine, "declared-x") == "declared-x"


async def test_batch_rpc_binds_every_message(rpc_ctx) -> None:
    client, engine = rpc_ctx("alice")
    async with client:
        batch = [
            _rpc("thread.start", {"userId": "bob"}, rid=1),
            _rpc("thread.start", {"userId": "carol"}, rid=2),
        ]
        resp = await client.post("/api/engine/rpc", json=batch)
        ids = [item["result"]["threadId"] for item in resp.json()]
        assert [engine._threads[i].user_id for i in ids] == ["alice", "alice"]


async def test_streaming_rpc_also_binds_principal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """SSE 分支(流式方法)与单发共用同一绑定入口 —— 不因分支遗漏留口子。"""
    seen: list[dict[str, Any]] = []

    class _Recorder:
        async def handle_message(self, raw: Any, emit: Any = None) -> None:
            seen.append(raw if isinstance(raw, dict) else json.loads(raw))
            return None

    app, _engine_obj = _app_with_principal("alice")
    monkeypatch.setattr(engine_router, "ENGINE", _Recorder())
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://sse59.test"
    ) as client:
        resp = await client.post(
            "/api/engine/rpc",
            json=_rpc("thread.prompt", {"threadId": "t1", "userId": "mallory"}),
        )
        assert resp.status_code == 200
    assert seen and seen[0]["params"]["userId"] == "alice"


# ---------------------------------------------------------------------------
# 2. WS:握手身份即本连接全部帧的 principal
# ---------------------------------------------------------------------------


def test_ws_frame_binds_handshake_identity(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = _engine()
    monkeypatch.setattr(engine_router, "ENGINE", engine)
    monkeypatch.setattr(engine_router, "verify_access_token", lambda _t: {"sub": "u-ws"})
    app = FastAPI()
    app.include_router(engine_router.router, prefix="/api")
    with TestClient(app) as tc:
        with tc.websocket_connect("/api/engine/ws?token=ok") as ws:
            ws.send_text(
                json.dumps(_rpc("thread.start", {"userId": "someone-else"}))
            )
            reply = ws.receive_json()
    thread_id = reply["result"]["threadId"]
    assert engine._threads[thread_id].user_id == "u-ws"


# ---------------------------------------------------------------------------
# 3. 绑定助手自身的边界(不得凭空造 params、不得改写非报文对象)
# ---------------------------------------------------------------------------


def test_bind_principal_edge_shapes() -> None:
    principal = "alice"
    # params 缺失 / 非 dict → 原样返回,不凭空造结构
    assert engine_router._bind_principal({"method": "x"}, principal) == {"method": "x"}
    assert engine_router._bind_principal({"params": "str"}, principal) == {"params": "str"}
    # principal 缺失 → userId 不动(未鉴权通道与结算通道同一信任级,历史语义不变);
    # 但 roleId 一律被绑成 0 —— 见下面 V3 #47 第二格那两条,角色是授权输入,不认自述值。
    msg = {"params": {"userId": "declared"}}
    assert engine_router._bind_principal(msg, None) is msg
    assert msg["params"]["userId"] == "declared"
    # 正常路径:覆盖自述值,其余参数不受影响
    msg2: dict[str, Any] = {"params": {"userId": "declared", "model": "m"}}
    engine_router._bind_principal(msg2, principal)
    # ⚠️ 本行断言于 2026-09-26 由 {"userId","model"} 改为含 "roleId":
    # 旧写法把"_bind_principal 只绑 userId、不绑角色"当成了规格,而那正是 V3 #47 第二格
    # 判为缺陷的形态(引擎自带工具因此完全不经 _ADMIN_ONLY_TOOLS 角色矩阵)。
    # 改的是夹具以匹配新契约,不是削判据:角色的正反例见下面两条新增断言。
    assert msg2["params"] == {"userId": "alice", "model": "m", "roleId": 0}
    # V3 #47 第二格 · 自述角色必须被验证角色覆盖(否则"谎报 role=1"即提权旁路)
    msg3: dict[str, Any] = {"params": {"userId": "declared", "roleId": 9}}
    engine_router._bind_principal(msg3, principal, 1)
    assert msg3["params"]["roleId"] == 1
    # V3 #47 第二格 · 未鉴权通道(principal=None)仍落 0,而不是保留客户端自述的 9
    msg4: dict[str, Any] = {"params": {"userId": "declared", "roleId": 9}}
    engine_router._bind_principal(msg4, None)
    assert msg4["params"]["roleId"] == 0
    assert msg4["params"]["userId"] == "declared"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
