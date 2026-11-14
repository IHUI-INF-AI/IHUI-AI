# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Auto 档逐工具审查闸测试(2026-11-14 立)。

零网络、零 DB:审查走注入 judge;默认 judge 的不可用分支直接抛
`GuardianJudgeUnavailable`,不需要真实网关。

判据主旋律(与 guardian 同源):
- 任何失败/不确定都必须 `escalate`,不得折叠成 `allow`;
- 本地静态扫描命中 dangerous 时,模型 allow 也必须降级为 `escalate`;
- 只有确定性 allow/deny 进缓存,escalate 不缓存;
- 接线位置必须晚于污点/双轴/策略等安全地板(源码顺序守门)。
"""

from __future__ import annotations

import asyncio
import inspect
import json
from typing import Any

import pytest

from app.services import tool_auto_review as ar
from app.services.completion_verification import JudgeResponse
from app.services.guardian_review import GuardianJudgeUnavailable


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    """每个用例从干净缓存与默认关闭开始,避免串味。"""
    ar.clear_auto_review_cache()
    monkeypatch.delenv("TOOL_AUTO_REVIEW_ENABLED", raising=False)
    monkeypatch.delenv("TOOL_AUTO_REVIEW_TIMEOUT_S", raising=False)
    monkeypatch.delenv("TOOL_AUTO_REVIEW_CACHE_MAX", raising=False)
    yield
    ar.clear_auto_review_cache()


def _judge(payload: dict[str, Any] | str, model: str = "reviewer-1", calls: list[int] | None = None):
    async def _call(messages: list[dict[str, str]]) -> JudgeResponse:
        assert messages and messages[0]["role"] == "system"
        if calls is not None:
            calls.append(1)
        content = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
        return JudgeResponse(content=content, model=model)

    return _call


def test_disabled_by_default_escalates():
    result = asyncio.run(ar.request_tool_auto_review("write_file", {"path": "a.txt"}))
    assert result.decision == "escalate"
    assert result.fail_reason == "disabled"
    assert result.independent_request_made is False
    assert result.to_event_payload()["decision"] == "escalate"


def test_allow_verdict_is_reported():
    result = asyncio.run(
        ar.request_tool_auto_review(
            "read_file",
            {"path": "a.txt"},
            enabled=True,
            judge=_judge({"decision": "allow", "reason": "只读", "risk": "low"}),
        )
    )
    assert result.decision == "allow"
    assert result.reason == "只读"
    assert result.risk == "low"
    assert result.reviewer_model == "reviewer-1"
    assert result.independent_request_made is True
    assert result.cached is False
    payload = result.to_event_payload()
    assert payload["decision"] == "allow"
    assert payload["fail_reason"] is None


def test_deny_verdict_is_reported():
    result = asyncio.run(
        ar.request_tool_auto_review(
            "delete_file",
            {"path": "important.txt"},
            enabled=True,
            judge=_judge({"decision": "deny", "reason": "不可逆删除", "risk": "high"}),
        )
    )
    assert result.decision == "deny"
    assert result.risk == "high"


def test_deterministic_allow_is_cached_regardless_of_arg_order():
    calls: list[int] = []
    judge = _judge({"decision": "allow", "reason": "只读", "risk": "low"}, calls=calls)
    first = asyncio.run(
        ar.request_tool_auto_review("read_file", {"a": 1, "b": 2}, enabled=True, judge=judge)
    )
    second = asyncio.run(
        ar.request_tool_auto_review("read_file", {"b": 2, "a": 1}, enabled=True, judge=judge)
    )
    assert first.cached is False
    assert second.cached is True
    assert len(calls) == 1


def test_escalate_is_not_cached():
    calls: list[int] = []
    judge = _judge({"decision": "escalate", "reason": "不确定", "risk": "medium"}, calls=calls)
    asyncio.run(ar.request_tool_auto_review("x", {"a": 1}, enabled=True, judge=judge))
    asyncio.run(ar.request_tool_auto_review("x", {"a": 1}, enabled=True, judge=judge))
    assert len(calls) == 2


def test_static_scan_blocks_model_allow():
    result = asyncio.run(
        ar.request_tool_auto_review(
            "run_command",
            {"command": "cat /etc/passwd; whoami"},
            enabled=True,
            judge=_judge({"decision": "allow", "reason": "看起来安全", "risk": "low"}),
        )
    )
    assert result.decision == "escalate"
    assert result.fail_reason == "static_scan_dangerous"


def test_timeout_escalates():
    async def slow_judge(messages: list[dict[str, str]]) -> JudgeResponse:
        await asyncio.sleep(0.5)
        return JudgeResponse(content='{"decision":"allow","reason":"x","risk":"low"}', model="m")

    result = asyncio.run(
        ar.request_tool_auto_review("read_file", {"path": "a"}, enabled=True, timeout_s=0.1, judge=slow_judge)
    )
    assert result.decision == "escalate"
    assert result.fail_reason == "timeout"


def test_gateway_unavailable_escalates():
    async def unavailable(messages: list[dict[str, str]]) -> JudgeResponse:
        raise GuardianJudgeUnavailable("no_credentials", "stub")

    result = asyncio.run(
        ar.request_tool_auto_review("read_file", {"path": "a"}, enabled=True, judge=unavailable)
    )
    assert result.decision == "escalate"
    assert result.fail_reason == "no_credentials"


@pytest.mark.parametrize(
    "raw",
    [
        "not json",
        "{}",
        '{"decision":"maybe","reason":"x"}',
        '{"decision":"allow"}',
        '{"decision":"allow","reason":"x","risk":"critical"}',
    ],
)
def test_malformed_response_escalates(raw: str):
    result = asyncio.run(
        ar.request_tool_auto_review("read_file", {"path": "a"}, enabled=True, judge=_judge(raw))
    )
    assert result.decision == "escalate"
    assert result.fail_reason == "malformed_response"


def test_parse_accepts_fenced_json():
    decision, reason, risk = ar.parse_auto_review_verdict(
        '```json\n{"decision":"deny","reason":"外送数据","risk":"high"}\n```'
    )
    assert (decision, reason, risk) == ("deny", "外送数据", "high")


def test_env_parsing_clamps():
    import os

    os.environ["TOOL_AUTO_REVIEW_ENABLED"] = "on"
    os.environ["TOOL_AUTO_REVIEW_TIMEOUT_S"] = "999"
    os.environ["TOOL_AUTO_REVIEW_CACHE_MAX"] = "9999"
    try:
        assert ar.auto_review_enabled_from_env() is True
        assert ar.auto_review_timeout_s_from_env() == 20.0
        assert ar.auto_review_cache_max_from_env() == 2000
    finally:
        del os.environ["TOOL_AUTO_REVIEW_ENABLED"]
        del os.environ["TOOL_AUTO_REVIEW_TIMEOUT_S"]
        del os.environ["TOOL_AUTO_REVIEW_CACHE_MAX"]


def test_agent_loop_tool_approval_carries_auto_review(monkeypatch):
    """agent 任务流的 tool.approval 载荷必须能携带 auto_review(可选键)。"""
    from app.services import agent_loop_v2 as loop_mod

    captured: list[tuple[str, dict[str, Any]]] = []

    async def fake_emit(event: str, payload: dict[str, Any]) -> None:
        captured.append((event, payload))

    monkeypatch.setattr(loop_mod.hook_engine, "emit", fake_emit)
    stream = loop_mod.AgentEventStream()
    asyncio.run(
        stream.tool_approval(
            approval_id="appr_1",
            tool_name="write_file",
            tool_call_id="tc1",
            args_preview='{"path":"a.txt"}',
            session_id="s1",
            auto_review={"decision": "escalate", "reason": "需要人工", "fail_reason": "disabled"},
        )
    )
    assert captured[-1][0] == "tool.approval"
    assert captured[-1][1]["auto_review"]["decision"] == "escalate"

    captured.clear()
    asyncio.run(
        stream.tool_approval(
            approval_id="appr_2",
            tool_name="read_file",
            tool_call_id="tc2",
            args_preview="{}",
            session_id="s1",
        )
    )
    assert "auto_review" not in captured[-1][1]


def test_wiring_sits_after_safety_floors():
    """源码顺序守门:审查闸必须晚于污点/双轴/策略等安全地板,且早于最终审批调用。"""
    from app.services import agent_loop_v2 as loop_mod
    from app.routers import llm as llm_mod

    loop_src = inspect.getsource(loop_mod)
    taint_pos = loop_src.index("taint_egress_gate")
    gate_pos = loop_src.index("request_tool_auto_review")
    approval_pos = loop_src.index("_request_approval(tc, auto_review=auto_review_payload)")
    assert taint_pos < gate_pos < approval_pos

    llm_src = inspect.getsource(llm_mod)
    grant_pos = llm_src.index("_network_grant_hits")
    llm_gate_pos = llm_src.index("request_tool_auto_review")
    assert grant_pos < llm_gate_pos
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
