# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

r"""B04(2026-10-27 立)工具调用明细账摄入腿回归。

载体先例:`tests/test_mcp_status_d154.py`(monkeypatch `_dispatch` 成记录器 +
autouse 清计数);接线先例:`tests/test_agent_security_prefs_per_user.py`
(直接实例化 AgentLoopV2 并调 `_maybe_record_step`)。

钉住的格子,每格对应一种"账面与循环面脱节"的失效:
 A 词汇封闭集镜像:与 apps/api tool-approval-audit.ts / ledger schema 逐项对应;
   越界 decision/state **不得**派发(发出去也是服务端 400,整行丢)。
 B 主体纪律:user_id 非 UUID ⇒ 视同拿不到主体,跳过并计数,绝不编造。
 C 空 session/tool ⇒ 就地拒(必 400 的请求不浪费),计数出声。
 D 越界 cause ⇒ 降级为"无成因"但**行照派**(denied 事实本身仍是证据)。
 E 载荷形态:camelCase 键、input 恒在(哪怕 None)、traceId 只带 32 位小写 hex、
   includeRaw 不下发(原文不出进程,服务端默认只存摘要)。
 F invocation_id 每次 uuid4 唯一(账侧幂等键)。
 G `_dispatch` 网络失败/非 2xx ⇒ 吞掉 + 计数,绝不穿透。
 H 端到端(循环面):摄入与 `_pipeline_record_active` 开关无关(证据面独立);
   权限词汇从既有 hint/error_type 面取;派发入口炸了也不许打断 `_maybe_record_step`。

不连库、不发真网络(§5 测试隔离铁律)。
"""

from __future__ import annotations

import asyncio
from typing import Any
from uuid import uuid4

import pytest

from app.services import agent_loop_v2 as alv2
from app.services import tool_invocation_ledger as tll
from app.services.agent_loop_v2 import AgentLoopV2, ToolCall, ToolDefinition, ToolResult

USER = str(uuid4())


@pytest.fixture(autouse=True)
def _clean_stats():
    tll.reset_dispatch_ledger()
    yield
    tll.reset_dispatch_ledger()


@pytest.fixture
def recorder(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    """把网络派发换成记录器:只留"这一行交出去了没有"的信号。"""
    sent: list[dict[str, Any]] = []

    async def _fake(principal: str, payload: dict[str, Any]) -> None:
        sent.append({"principal": principal, **payload})

    monkeypatch.setattr(tll, "_dispatch", _fake)
    return sent


def _good(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "user_id": USER,
        "session_id": "sess-1",
        "invocation_id": str(uuid4()),
        "tool_name": "shell",
        "permission_decision": "approved",
        "state": "settled",
        "ok": True,
        "input_summary": "ls -la",
        "output_summary": "total 3",
    }
    base.update(over)
    return base


@pytest.mark.asyncio
async def test_a_closed_set_mirrors_ts(recorder: list[dict[str, Any]]) -> None:
    """A 词汇封闭集与 TS 权威逐项对应;越界档不派发且计数。"""
    assert tll.TOOL_APPROVAL_ROUTES == ("flag", "approved", "denied")
    assert tll.TOOL_APPROVAL_DENY_CAUSES == (
        "no-prompt",
        "prompt-declined",
        "prompt-empty",
        "prompt-error",
    )
    assert tll.LEDGER_STATES == ("registered", "started", "settled", "lost")
    await asyncio.sleep(0)
    assert tll.record_tool_invocation(**_good(permission_decision="always_allow")) is False
    assert tll.record_tool_invocation(**_good(state="finished")) is False
    assert tll.dispatch_stats()["rejected_vocab"] == 2
    assert recorder == []


@pytest.mark.asyncio
async def test_b_non_uuid_principal_skipped_and_counted(
    recorder: list[dict[str, Any]]
) -> None:
    """B 非 UUID 主体(含空)⇒ 跳过 + 计数,绝不派发。"""
    await asyncio.sleep(0)
    assert tll.record_tool_invocation(**_good(user_id="user-victim")) is False
    assert tll.record_tool_invocation(**_good(user_id=None)) is False
    assert recorder == []
    assert tll.dispatch_stats()["skipped_no_principal"] == 2, "跳过必须留痕,不得静默"


@pytest.mark.asyncio
async def test_c_incomplete_identity_rejected(recorder: list[dict[str, Any]]) -> None:
    """C 空 session/tool ⇒ 必 400 的请求不发,计数出声。"""
    await asyncio.sleep(0)
    assert tll.record_tool_invocation(**_good(session_id="  ")) is False
    assert tll.record_tool_invocation(**_good(tool_name="")) is False
    assert recorder == []
    assert tll.dispatch_stats()["rejected_incomplete"] == 2


@pytest.mark.asyncio
async def test_d_unknown_cause_degrades_but_row_still_goes(
    recorder: list[dict[str, Any]]
) -> None:
    """D 越界 cause ⇒ 按无成因落账,denied 事实本身不许丢。"""
    await asyncio.sleep(0)
    assert (
        tll.record_tool_invocation(
            **_good(permission_decision="denied", permission_cause="timeout")
        )
        is True
    )
    await asyncio.sleep(0)
    assert len(recorder) == 1
    assert recorder[0]["permissionDecision"] == "denied"
    assert "permissionCause" not in recorder[0]


@pytest.mark.asyncio
async def test_e_payload_shape(recorder: list[dict[str, Any]]) -> None:
    """E 载荷形态:camelCase、input 恒在、脏 traceId 不带、includeRaw 不下发。"""
    await asyncio.sleep(0)
    assert tll.record_tool_invocation(
        **_good(input_summary=None, output_summary=None, trace_id="XYZ-not-hex")
    ) is True
    assert (
        tll.record_tool_invocation(
            **_good(invocation_id=str(uuid4()), trace_id="a" * 32, output_summary=None)
        )
        is True
    )
    await asyncio.sleep(0)
    assert len(recorder) == 2
    first, second = recorder
    assert "input" in first and first["input"] is None, "input 键必须恒在(schema refine 硬要求)"
    assert "traceId" not in first, "非 32 位小写 hex 的 trace 不得外发"
    assert "output" not in first
    assert "includeRaw" not in first and "includeRaw" not in second, "原文落库是显式 opt-in,默认关"
    assert second["traceId"] == "a" * 32
    assert second["sessionId"] == "sess-1"
    assert second["principal"] == USER


@pytest.mark.asyncio
async def test_f_invocation_ids_are_unique(recorder: list[dict[str, Any]]) -> None:
    """F 循环侧每次调用 uuid4 现生成:同参数两行也必须不同 id(幂等键不撞)。"""
    await asyncio.sleep(0)
    assert tll.record_tool_invocation(**_good()) is True
    assert tll.record_tool_invocation(**_good()) is True
    await asyncio.sleep(0)
    ids = [r["invocationId"] for r in recorder]
    assert len(ids) == 2 and ids[0] != ids[1]


@pytest.mark.asyncio
async def test_g_dispatch_failure_swallowed_and_counted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """G 真 `_dispatch`:网络炸/非 2xx 只计数,绝不向上抛;2xx 计 sent。

    打桩只动 `tll` 命名空间里的 `httpx` 名字(不碰全局 httpx 模块属性,
    避免跨用例串染)。
    """

    class _BoomClient:
        def __init__(self, *_a: Any, **_k: Any) -> None:
            pass

        async def __aenter__(self) -> _BoomClient:
            return self

        async def __aexit__(self, *_e: Any) -> bool:
            return False

        async def post(self, *_a: Any, **_k: Any) -> Any:
            raise RuntimeError("网络断了")

    class _HttpxStub:
        AsyncClient = _BoomClient

    monkeypatch.setattr(tll, "httpx", _HttpxStub)
    await tll._dispatch(USER, {"toolName": "shell"})
    assert tll.dispatch_stats()["failed"] == 1

    class _Status400(_BoomClient):
        async def post(self, *_a: Any, **_k: Any) -> Any:
            class _R:
                status_code = 400

            return _R()

    class _HttpxStub400:
        AsyncClient = _Status400

    monkeypatch.setattr(tll, "httpx", _HttpxStub400)
    await tll._dispatch(USER, {"toolName": "shell"})
    assert tll.dispatch_stats()["failed"] == 2
    assert tll.dispatch_stats()["sent"] == 0


def _make_loop(user_id: str | None) -> AgentLoopV2:
    async def executor(args: dict) -> dict:
        return {"ok": True}

    tool = ToolDefinition(
        name="echo_tool", description="echo", parameters={"type": "object"}, executor=executor
    )

    async def mock_llm(messages, tools):  # noqa: ANN001, ANN202
        return {"content": "done", "tool_calls": None}

    return AgentLoopV2(
        mock_llm, [tool], max_iterations=1, approval_enabled=False, user_id=user_id
    )


@pytest.mark.asyncio
async def test_h_loop_ingests_regardless_of_record_switch(
    recorder: list[dict[str, Any]]
) -> None:
    """H1 账是证据面:`_pipeline_record_active` 关着也照派(step 录制与账行正交)。"""
    loop = _make_loop(USER)
    loop._session_id = "sess-loop"
    loop._pipeline_record_active = False
    tc = ToolCall(id="c1", name="echo_tool", args={"q": "hi"})
    tr = ToolResult(tool_call_id=tc.id, name=tc.name, result={"ok": True}, duration_ms=1.0)
    loop._maybe_record_step(tc, tr)
    await asyncio.sleep(0)
    assert len(recorder) == 1
    assert recorder[0]["sessionId"] == "sess-loop"
    assert recorder[0]["permissionDecision"] == "approved"
    assert recorder[0]["state"] == "settled"
    assert recorder[0]["ok"] is True


@pytest.mark.asyncio
async def test_h2_permission_vocabulary_from_existing_surfaces(
    recorder: list[dict[str, Any]]
) -> None:
    """H2 权限词汇只从既有 hint/error_type 面取:拒绝⇒denied+prompt-declined,
    plan 拦截⇒denied 无成因,免审批⇒flag。"""
    loop = _make_loop(USER)
    loop._session_id = "sess-vocab"

    tc = ToolCall(id="c1", name="echo_tool", args={})
    tr_reject = ToolResult(
        tool_call_id="c1", name="echo_tool", result=None, error="用户拒绝", error_type="user_rejected"
    )
    loop._maybe_record_step(tc, tr_reject)

    tc2 = ToolCall(id="c2", name="echo_tool", args={})
    tr_plan = ToolResult(
        tool_call_id="c2", name="echo_tool", result=None, error="plan 拦截", error_type="permission_denied"
    )
    loop._maybe_record_step(tc2, tr_plan)

    tc3 = ToolCall(id="c3", name="echo_tool", args={})
    tr_ok = ToolResult(tool_call_id="c3", name="echo_tool", result={"ok": True})
    loop._decision_hints[tc3.id] = ("auto_skip_approval", "auto 模式只读免审批")
    loop._maybe_record_step(tc3, tr_ok)

    await asyncio.sleep(0)
    assert [r["permissionDecision"] for r in recorder] == ["denied", "denied", "flag"]
    assert recorder[0]["permissionCause"] == "prompt-declined"
    assert "permissionCause" not in recorder[1], "词汇无对应档 ⇒ 不冒充成因"
    assert recorder[2]["ok"] is True


@pytest.mark.asyncio
async def test_h3_ingest_entry_exception_does_not_pierce_loop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """H3 派发入口本身炸(而非派发腿炸)也不许打断 _maybe_record_step。"""

    def _boom(**_kw: Any) -> bool:
        raise RuntimeError("摄入腿构造失败")

    monkeypatch.setattr(alv2, "record_tool_invocation", _boom)
    loop = _make_loop(USER)
    tc = ToolCall(id="c1", name="echo_tool", args={})
    tr = ToolResult(tool_call_id=tc.id, name=tc.name, result={"ok": True})
    loop._maybe_record_step(tc, tr)  # 不抛 = 通过
