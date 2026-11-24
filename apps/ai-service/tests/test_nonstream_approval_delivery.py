# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""非流式 execute 的审批投递通道(2026-11-09)端到端 + 反例测试。

接线口径(本文件钉的就是这三条):
  ① `POST /api/agents/execute` 的 400 判据从"非 default 档一律拒"收窄为
     **只拒"没有投递地址"的请求**:带 `session_id` 时审批条目以
     thread_id=session_id 登记;
  ② `GET /api/agent/decisions/pending?session_id=…` 按 thread_id **精确相等**取件
     (不传 = 原行为),属主过滤一字未改;
  ③ `POST /api/agents/approval-response` 把 already_settled / superseded /
     snapshot_mismatch 三类"没写进去"的结算结论映射成 409,不再 fall-through 成
     200 accepted=true。

隔离纪律(§5b):不真起 shell、不调真实 LLM、不连 Redis/生产库 ——
  * `_new_v2_loop` 换成构造"真 AgentLoopV2 + 假 LLM + 假 run_command 执行器"的
    替身:审批门、注册表、属主、一次性结算全部走真实现,只有工具和模型是假的;
  * 审批注册表 / 持久层 / 属主登记表逐用例隔离(与 test_agents_authz_59.py 同款);
  * 身份由 `dependency_overrides` 提供,角色档由测试中间件注入(角色门本身由
    tests/test_engine_role_parity.py 覆盖,不是本文件的考点)。
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import get_current_user_id, require_request_user_id
from app.routers import agents as agents_router
from app.routers import decisions as decisions_router
from app.routers import engine as engine_router
from app.services import agent_loop_v2 as alv2
from app.services.agent_loop_v2 import AgentLoopV2, ApprovalOutcome, ToolDefinition

USER_A = "user-a-delivery1109"  # 非 UUID ⇒ 安全偏好解析不打库(见 agent_security_prefs)
USER_B = "user-b-delivery1109"
SESSION = "sess-delivery-1109"

EXECUTE_URL = "/api/agents/execute"
APPROVAL_URL = "/api/agents/approval-response"
PENDING_URL = "/api/agent/decisions/pending"


# =============================================================================
# 最小 app:两个 router + 固定身份 + 角色档
# =============================================================================


def _mk_app(uid: str) -> FastAPI:
    """只挂 agents/decisions 两个 router,身份走 dependency_overrides。

    角色档用测试中间件注入 role_id=1:高危样本 `run_command` 在 admin 专属名单里,
    角色闸排在审批闸之前(V3 #47 第二格)。本文件测的是"审批能不能送达/回执",
    所以把前置条件显式满足掉,而不是把 role 判据削掉。
    """
    app = FastAPI()
    app.include_router(agents_router.router, prefix="/api")
    app.include_router(decisions_router.router, prefix="/api")

    @app.middleware("http")
    async def _inject_role(request, call_next):  # type: ignore[no-untyped-def]
        request.state.role_id = 1
        return await call_next(request)

    async def _fake_user_id() -> str:
        return uid

    app.dependency_overrides[require_request_user_id] = _fake_user_id
    app.dependency_overrides[get_current_user_id] = _fake_user_id
    return app


def _client(uid: str = USER_A) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=_mk_app(uid)), base_url="http://delivery.test")


# =============================================================================
# fixtures / helpers
# =============================================================================


@pytest.fixture(autouse=True)
def _isolated_registry(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """审批注册表换成本用例独占的空 dict(与 test_agents_authz_59.py 同款)。"""
    registry: dict[str, Any] = {}
    monkeypatch.setattr(alv2, "_approval_registry", registry)
    monkeypatch.setattr(alv2, "_approval_persist_keys", {})
    return registry


@pytest.fixture(autouse=True)
def _quiet_hook_engine(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    """hook_engine 换成只记录不广播的替身(不真跑 hook/SSE),并收下审批事件。"""
    emitted: list[dict[str, Any]] = []

    class _FakeHookEngine:
        async def emit(self, event: str, context: dict[str, Any]) -> list[dict[str, Any]]:
            emitted.append({"event": event, **context})
            return []

    monkeypatch.setattr(alv2, "hook_engine", _FakeHookEngine())
    return emitted


def _install_fake_loop(
    monkeypatch: pytest.MonkeyPatch,
    *,
    executed: list[dict[str, Any]],
    built: list[dict[str, Any]],
) -> None:
    """把 `_new_v2_loop` 换成"真循环 + 假模型 + 假工具"的构造替身。

    审批门(`_request_approval`)、注册表、属主、一次性结算全部是生产实现;
    模型只回一次 `run_command` 调用,工具执行器只记录参数并回一个固定结果
    —— 绝不真起 shell(§5b)。
    """

    async def _fake_new_v2_loop(**kwargs: Any) -> AgentLoopV2:
        built.append(kwargs)
        calls = {"n": 0}

        async def _fake_llm(messages: list[dict[str, Any]], tools: Any) -> dict[str, Any]:
            calls["n"] += 1
            if calls["n"] == 1:
                return {
                    "content": "需要执行命令",
                    "tool_calls": [
                        {
                            "id": "call-delivery-1",
                            "name": "run_command",
                            "args": {"command": "echo delivery"},
                        }
                    ],
                }
            return {"content": "已执行完毕", "tool_calls": None}

        async def _exec(args: dict[str, Any]) -> dict[str, Any]:
            executed.append(dict(args))
            return {"ok": True, "stdout": "delivery"}

        tool = ToolDefinition(
            name="run_command",
            description="假命令执行器(只记录参数,不起进程)",
            parameters={
                "type": "object",
                "properties": {"command": {"type": "string"}},
                "required": ["command"],
            },
            executor=_exec,
        )
        return AgentLoopV2(
            _fake_llm,
            [tool],
            max_iterations=kwargs.get("max_iterations") or 3,
            approval_enabled=True,
            approval_timeout=10,
            session_id=kwargs.get("session_id"),
            user_id=kwargs.get("current_user"),
            user_role=kwargs.get("user_role") or 0,
            permission_mode=kwargs.get("permission_mode"),
            axis_resolution=kwargs.get("axis_resolution"),
        )

    monkeypatch.setattr(agents_router, "_new_v2_loop", _fake_new_v2_loop)


async def _wait_for_pending(
    client: AsyncClient, session_id: str, *, timeout: float = 5.0
) -> list[dict[str, Any]]:
    """轮询收件箱直到该 thread 的条目出现(run 在审批窗口内停住)。"""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    while loop.time() < deadline:
        res = await client.get(PENDING_URL, params={"session_id": session_id})
        assert res.status_code == 200, res.text
        items = res.json()["data"]["items"]
        if items:
            return items
        await asyncio.sleep(0.01)
    raise AssertionError("审批条目在超时窗口内没有出现在 decisions/pending")


# =============================================================================
# 1) 端到端正路:带 session_id + 非 default 档 → 取件 → 回执 → 工具继续执行
# =============================================================================


async def test_execute_with_session_id_delivers_and_settles_approval(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """run 进行中经 decisions/pending 取到审批,回执后工具真的继续执行。"""
    monkeypatch.setenv("AGENT_EXECUTOR", "loop_v2")
    executed: list[dict[str, Any]] = []
    built: list[dict[str, Any]] = []
    _install_fake_loop(monkeypatch, executed=executed, built=built)

    async with _client(USER_A) as client:
        run_task = asyncio.create_task(
            client.post(
                EXECUTE_URL,
                json={
                    "goal": "跑一下命令",
                    "session_id": SESSION,
                    "permission_mode": "acceptEdits",  # 非 default 档:此前一律 400
                    "tools": ["run_command"],
                },
            )
        )
        try:
            items = await _wait_for_pending(client, SESSION)
            assert [i["threadId"] for i in items] == [SESSION], items
            assert [i["type"] for i in items] == ["tool_approval"]
            assert "run_command" in items[0]["summary"]
            approval_id = items[0]["id"]
            assert approval_id.startswith("appr_")
            # 审批窗口内工具必须还没跑(有回执通道 ≠ 已经放行)
            assert executed == []

            resp = await client.post(
                APPROVAL_URL,
                json={"approval_id": approval_id, "decision": "approve", "scope": "once"},
            )
            assert resp.status_code == 200, resp.text
            assert resp.json()["data"]["accepted"] is True

            exec_resp = await asyncio.wait_for(run_task, 10)
        finally:
            if not run_task.done():
                run_task.cancel()

    assert exec_resp.status_code == 200, exec_resp.text
    payload = exec_resp.json()
    # 响应键集不变(见 _v2_result_to_execute_payload):只用既有键做断言
    assert payload["session_id"] == SESSION
    assert payload["status"] == "completed"
    tool_steps = [s for s in payload["steps"] if s["type"] == "tool"]
    assert [s["tool_name"] for s in tool_steps] == ["run_command"]
    assert tool_steps[0]["status"] == "completed"
    # 工具确实在回执之后执行了,且参数原样落地
    assert executed == [{"command": "echo delivery"}]
    # 档位与地址都真的进了执行内核(不是"发了≠生效")
    assert built and built[-1]["session_id"] == SESSION
    assert built[-1]["permission_mode"] == "acceptEdits"


# =============================================================================
# 2) 反路:无 session_id + 非 default 档 / untrusted 审批轴 ⇒ 400
# =============================================================================


@pytest.mark.parametrize(
    "extra",
    [
        {"permission_mode": "acceptEdits"},
        {"permission_mode": "bypassPermissions"},
        {"approval_policy": "untrusted"},
    ],
    ids=["acceptEdits", "bypassPermissions", "untrusted"],
)
async def test_execute_without_session_id_is_rejected(
    monkeypatch: pytest.MonkeyPatch, extra: dict[str, str]
) -> None:
    """没有投递地址 ⇒ 仍是 400,且文案点明"要 session_id 当地址";内核不被构造。"""
    monkeypatch.setenv("AGENT_EXECUTOR", "loop_v2")
    executed: list[dict[str, Any]] = []
    built: list[dict[str, Any]] = []
    _install_fake_loop(monkeypatch, executed=executed, built=built)

    async with _client(USER_A) as client:
        body = {"goal": "跑一下命令", "tools": ["run_command"], **extra}
        res = await client.post(EXECUTE_URL, json=body)

    assert res.status_code == 400, res.text
    detail = res.json()["detail"]
    assert "session_id" in detail and "审批投递地址" in detail, detail
    assert built == [], "被拒的请求不该构造执行内核"
    assert executed == []


async def test_blank_session_id_counts_as_no_address(monkeypatch: pytest.MonkeyPatch) -> None:
    """空白 session_id 等于没给(strip 后为空),不得被当作可寻址地址放行。"""
    monkeypatch.setenv("AGENT_EXECUTOR", "loop_v2")
    executed: list[dict[str, Any]] = []
    built: list[dict[str, Any]] = []
    _install_fake_loop(monkeypatch, executed=executed, built=built)

    async with _client(USER_A) as client:
        res = await client.post(
            EXECUTE_URL,
            json={
                "goal": "跑一下命令",
                "session_id": "   ",
                "permission_mode": "acceptEdits",
                "tools": ["run_command"],
            },
        )

    assert res.status_code == 400, res.text
    assert built == []


# =============================================================================
# 3) 跨属主 ⇒ 403 且条目零改写
# =============================================================================


def _register(approval_id: str, owner: str | None, thread_id: str | None = None) -> asyncio.Event:
    """手工登记一条待决审批(等价 _request_approval 的登记动作,不触弹窗)。"""
    ev = asyncio.Event()
    alv2._approval_registry[approval_id] = alv2._ApprovalEntry(
        event=ev,
        decision=None,
        owner_user_id=owner,
        thread_id=thread_id,
        tool_name="run_command",
        args_preview='{"command": "echo delivery"}',
        created_at="2026-11-09T00:00:00Z",
    )
    return ev


async def test_cross_owner_approval_is_403_and_entry_untouched() -> None:
    """别人的审批不能被点头:403,决策未写、事件未置、条目仍待决。"""
    ev = _register("appr_cross_owner", USER_A, SESSION)

    async with _client(USER_B) as client:
        res = await client.post(
            APPROVAL_URL, json={"approval_id": "appr_cross_owner", "decision": "approve"}
        )
        # 顺带确认跨属主取件也看不到(属主过滤没被 session_id 参数放宽)
        pending = await client.get(PENDING_URL, params={"session_id": SESSION})

    assert res.status_code == 403, res.text
    assert alv2._approval_registry["appr_cross_owner"].decision is None
    assert not ev.is_set()
    assert pending.json()["data"]["items"] == []


# =============================================================================
# 4) decisions/pending?session_id= 只返回该 thread 的条目
# =============================================================================


def _approval_snapshot(approval_id: str, thread_id: str | None) -> dict[str, Any]:
    return {
        "id": approval_id,
        "owner_user_id": USER_A,
        "thread_id": thread_id,
        "tool_name": "run_command",
        "args_preview": "{}",
        "created_at": "2026-11-09T00:00:00Z",
    }


class _DoneFuture:
    def done(self) -> bool:
        return False


async def test_pending_scoped_by_session_id(monkeypatch: pytest.MonkeyPatch) -> None:
    """传 session_id ⇒ 只这一 thread;不传 ⇒ 原样全量(含引擎侧两个来源)。"""
    monkeypatch.setattr(
        alv2,
        "list_pending_approvals",
        lambda: [
            _approval_snapshot("appr_thr1", "thr_1"),
            _approval_snapshot("appr_thr2", "thr_2"),
            _approval_snapshot("appr_nothr", None),
        ],
    )
    monkeypatch.setattr(
        engine_router,
        "ENGINE",
        SimpleNamespace(
            _permission_requests={
                "req_thr1": SimpleNamespace(
                    user_id=USER_A, thread_id="thr_1", future=_DoneFuture()
                ),
                "req_thr2": SimpleNamespace(
                    user_id=USER_A, thread_id="thr_2", future=_DoneFuture()
                ),
            },
            _elicitation_requests={},
        ),
    )

    async with _client(USER_A) as client:
        scoped = await client.get(PENDING_URL, params={"session_id": "thr_1"})
        everything = await client.get(PENDING_URL)

    assert scoped.status_code == 200
    items = scoped.json()["data"]["items"]
    assert sorted((i["id"], i["threadId"]) for i in items) == [
        ("appr_thr1", "thr_1"),
        ("req_thr1", "thr_1"),
    ]
    assert scoped.json()["data"]["total"] == 2

    all_items = everything.json()["data"]["items"]
    assert sorted(i["id"] for i in all_items) == [
        "appr_nothr",
        "appr_thr1",
        "appr_thr2",
        "req_thr1",
        "req_thr2",
    ]


# =============================================================================
# 5) 409 三态:already_settled / superseded / snapshot_mismatch
# =============================================================================


async def test_second_approval_response_is_409_already_settled() -> None:
    """真实现:同一 approval_id 应答两次,第一次 200,第二次 409 already_settled。"""
    _register("appr_settle_once", USER_A, SESSION)

    async with _client(USER_A) as client:
        first = await client.post(
            APPROVAL_URL, json={"approval_id": "appr_settle_once", "decision": "approve"}
        )
        second = await client.post(
            APPROVAL_URL, json={"approval_id": "appr_settle_once", "decision": "reject"}
        )

    assert first.status_code == 200, first.text
    assert second.status_code == 409, second.text
    detail = second.json()["detail"]
    assert detail["code"] == "already_settled"
    assert "已经" in detail["message"] or "第一次" in detail["message"]
    # 一次性结算语义不变:第二次没把决策改写掉
    assert alv2._approval_registry["appr_settle_once"].decision == "approve"


@pytest.mark.parametrize(
    "outcome",
    [ApprovalOutcome.SUPERSEDED, ApprovalOutcome.SNAPSHOT_MISMATCH],
    ids=["superseded", "snapshot_mismatch"],
)
async def test_cas_rejection_is_409(
    monkeypatch: pytest.MonkeyPatch, outcome: ApprovalOutcome
) -> None:
    """代际 CAS 两码:HTTP 形状是 409 + 原 code,不是 200 accepted=true。

    这两态在服务层的唯一触发路径是"持章结算"(generation + snapshot_digest 同时
    携带),而本端点的请求模型不携带持章字段 —— 所以这里按"结算结论 → HTTP 码"
    的映射层打桩:验的是端点不再 fall-through,不是重造 CAS(其 12 例单测在
    tests/test_approval_generation_cas.py)。
    """
    _register("appr_cas", USER_A, SESSION)
    monkeypatch.setattr(alv2, "resolve_approval_for_requester", lambda *a, **k: outcome)

    async with _client(USER_A) as client:
        res = await client.post(
            APPROVAL_URL, json={"approval_id": "appr_cas", "decision": "approve"}
        )

    assert res.status_code == 409, res.text
    assert res.json()["detail"]["code"] == outcome.value
    assert res.json()["detail"]["message"]


async def test_unknown_and_ownerless_keep_their_codes() -> None:
    """409 映射不得吞掉既有分流:不存在仍 404,无属主(非 HTTP 上下文创建)仍 403。"""
    _register("appr_orphan", None, SESSION)

    async with _client(USER_A) as client:
        missing = await client.post(
            APPROVAL_URL, json={"approval_id": "appr_never_existed", "decision": "approve"}
        )
        ownerless = await client.post(
            APPROVAL_URL, json={"approval_id": "appr_orphan", "decision": "approve"}
        )

    assert missing.status_code == 404, missing.text
    assert ownerless.status_code == 403, ownerless.text
    assert alv2._approval_registry["appr_orphan"].decision is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
