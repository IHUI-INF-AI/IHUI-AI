# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""V3 #80 Guardian 独立复核代理测试(2026-09-27 立)。

零网络、零生产 DB:
- 复核走注入 judge(离线);默认 judge 的"无凭据"分支用 monkeypatch 替换
  llm_gateway.complete 为 stub 返回来实测,不真发请求;
- 审批持久层按 test_approval_scope_d84 同款 fixture 指到 tmp_path。

三态判据是本文件的主角:not_reviewed 必须永远带原因,任何失败分支都不得
被折叠成"已复核/无风险"(本仓最高频失效型)。
"""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace
from typing import Any

import pytest

from app.services import guardian_review as gr
from app.services.completion_verification import JudgeResponse


@pytest.fixture()
def persist(monkeypatch, tmp_path):
    """审批持久层独立 db(隔离真实 data/),对齐 test_approval_scope_d84。"""
    from app.services import approval_persistence as ap

    ap.set_db_path(tmp_path / "grants.db")
    yield ap
    ap.close()
    ap.set_db_path(ap.DEFAULT_DB_PATH)


def _fake_judge(payload: dict[str, Any], model: str = "reviewer-1"):
    async def _call(messages: list[dict[str, str]]) -> JudgeResponse:
        return JudgeResponse(content=json.dumps(payload, ensure_ascii=False), model=model)

    return _call


def _fake_judge_text(text: str):
    async def _call(messages: list[dict[str, str]]) -> JudgeResponse:
        return JudgeResponse(content=text, model="reviewer-1")

    return _call


# ==================== 纯函数:输入构造与解析 ====================


def test_build_review_messages_zero_chain_context():
    """复核提示词只含 system+user 两条,且不含执行链上下文。"""
    msgs = gr.build_review_messages(
        "delete_file", {"path": "/srv/app/data/*.log", "recursive": True}
    )
    assert len(msgs) == 2
    assert msgs[0]["role"] == "system"
    user = msgs[1]["content"]
    # 判据输入三要素:工具名 / 参数摘要 / 影响面
    assert "delete_file" in user
    assert "/srv/app/data/*.log" in user
    assert "入参字段" in user
    assert "静态扫描" in user


def test_summarize_impact_reports_machine_scan():
    text = gr.summarize_impact("fetch_url", {"url": "http://127.0.0.1:8810/x"})
    assert "dangerous=True" in text
    assert "ssrf_loopback" in text


def test_parse_guardian_verdict_accepts_code_fence():
    raw = "```json\n" + json.dumps(
        {"has_safer_path": False, "safer_summary": "", "alternative": None, "risk_note": ""}
    ) + "\n```"
    v = gr.parse_guardian_verdict(raw)
    assert v["has_safer_path"] is False
    assert v["alternative"] is None


@pytest.mark.parametrize(
    "bad",
    [
        "not json at all",
        json.dumps({"safer_summary": "缺 has_safer_path"}),
        json.dumps({"has_safer_path": "yes"}),  # 不是布尔
        json.dumps({"has_safer_path": True, "alternative": "字符串"}),
        json.dumps([1, 2]),
    ],
)
def test_parse_guardian_verdict_rejects_contract_violation(bad: str):
    with pytest.raises(gr.GuardianResponseInvalid):
        gr.parse_guardian_verdict(bad)


def test_validate_alternative_rejects_dangerous_suggestion():
    alt = gr.validate_alternative(
        "run_command", {"args": {"command": "rm -rf /"}, "rationale": "x"}
    )
    assert alt is not None
    assert alt.applicable is False
    assert alt.rejected_reason and alt.rejected_reason.startswith("alternative_scans_dangerous")


def test_validate_alternative_rejects_non_object_args():
    alt = gr.validate_alternative("delete_file", {"args": "path", "rationale": ""})
    assert alt is not None and alt.applicable is False
    assert alt.rejected_reason == "args_not_object"


def test_validate_alternative_accepts_narrower_same_tool_args():
    src_args = {"path": "tmp/build.log", "recursive": False}
    alt = gr.validate_alternative(
        "delete_file", {"args": src_args, "rationale": "只删单文件"}
    )
    assert alt is not None and alt.applicable is True
    assert alt.tool_name == "delete_file"
    # 归一化深拷贝(json 往返):后续执行侧接管这份对象,不得与入参共享
    src_args["path"] = "tampered"
    assert alt.args["path"] == "tmp/build.log"


# ==================== request_guardian_review 三态 ====================


def test_disabled_still_returns_explicit_not_reviewed(monkeypatch):
    monkeypatch.delenv("GUARDIAN_REVIEW_ENABLED", raising=False)
    res = asyncio.run(gr.request_guardian_review("write_file", {"path": "a.txt"}))
    assert res.status == gr.GUARDIAN_REVIEW_STATUS_NOT_REVIEWED
    assert res.unavailable_reason == "disabled"
    assert res.reviewed is False
    payload = res.to_event_payload()
    assert payload["status"] == "not_reviewed"
    assert payload["unavailable_reason"] == "disabled"


def test_reviewed_no_alternative():
    judge = _fake_judge(
        {"has_safer_path": False, "safer_summary": "", "alternative": None, "risk_note": "不可逆"}
    )
    res = asyncio.run(
        gr.request_guardian_review("read_file", {"path": "a.txt"}, judge=judge, enabled=True)
    )
    assert res.status == gr.GUARDIAN_REVIEW_STATUS_NO_ALTERNATIVE
    assert res.independent_request_made is True
    assert res.risk_note == "不可逆"
    assert res.applicable_alternative("read_file") is None


def test_reviewed_alternative_found_and_applicable():
    judge = _fake_judge(
        {
            "has_safer_path": True,
            "safer_summary": "有更安全路径:仅删除单个日志文件而非整个目录",
            "alternative": {
                "args": {"path": "tmp/build.log", "recursive": False},
                "rationale": "更小删除面",
            },
            "risk_note": "",
        }
    )
    res = asyncio.run(
        gr.request_guardian_review(
            "delete_file", {"path": "tmp/", "recursive": True}, judge=judge, enabled=True
        )
    )
    assert res.status == gr.GUARDIAN_REVIEW_STATUS_ALTERNATIVE_FOUND
    alt = res.applicable_alternative("delete_file")
    assert alt is not None and alt.applicable is True
    assert alt.args == {"path": "tmp/build.log", "recursive": False}
    # 工具名不符 → 绝不套用(服务端钉死同工具)
    assert res.applicable_alternative("other_tool") is None
    payload = res.to_event_payload()
    assert payload["safer_alternative"]["applicable"] is True
    # 事件面只带预览,不带全量参数对象
    assert "args_preview" in payload["safer_alternative"]
    assert "args" not in payload["safer_alternative"]


def test_alternative_inapplicable_stays_suggestion_only():
    judge = _fake_judge(
        {
            "has_safer_path": True,
            "safer_summary": "建议(不可机器执行):先归档再删除",
            "alternative": {"args": {"command": "rm -rf /"}, "rationale": "假想坏建议"},
            "risk_note": "",
        }
    )
    res = asyncio.run(
        gr.request_guardian_review("run_command", {"command": "rm -rf /var"}, judge=judge, enabled=True)
    )
    assert res.status == gr.GUARDIAN_REVIEW_STATUS_ALTERNATIVE_FOUND
    assert res.applicable_alternative("run_command") is None
    assert res.alternative is not None and res.alternative.applicable is False


def test_timeout_is_not_reviewed_never_no_risk():
    async def hang(messages: list[dict[str, str]]) -> JudgeResponse:
        await asyncio.sleep(5)
        raise AssertionError("不可达")

    res = asyncio.run(
        gr.request_guardian_review("delete_file", {"path": "x"}, judge=hang, enabled=True, timeout_s=0.05)
    )
    assert res.status == gr.GUARDIAN_REVIEW_STATUS_NOT_REVIEWED
    assert res.unavailable_reason == "timeout"
    assert res.independent_request_made is False


def test_judge_unavailable_no_credentials_maps_to_not_reviewed():
    async def down(messages: list[dict[str, str]]) -> JudgeResponse:
        raise gr.GuardianJudgeUnavailable("no_credentials", "网关处于 stub 模式")

    res = asyncio.run(
        gr.request_guardian_review("delete_file", {"path": "x"}, judge=down, enabled=True)
    )
    assert res.status == gr.GUARDIAN_REVIEW_STATUS_NOT_REVIEWED
    assert res.unavailable_reason == "no_credentials"


def test_malformed_response_is_not_reviewed():
    res = asyncio.run(
        gr.request_guardian_review(
            "delete_file", {"path": "x"}, judge=_fake_judge_text("我拒绝以 JSON 回答"), enabled=True
        )
    )
    assert res.status == gr.GUARDIAN_REVIEW_STATUS_NOT_REVIEWED
    assert res.unavailable_reason == "malformed_response"


def test_no_credentials_branch_via_default_judge_stub_gateway(monkeypatch):
    """本机实测分支:网关 stub(无凭据)⇒ 显式 not_reviewed("no_credentials")。

    monkeypatch 替换 llm_gateway.complete —— 不发任何真实网络请求,
    但走的就是生产默认 judge 函数体(独立请求 → stub 检测 → 不可用归因)。
    """
    from app.core import llm_gateway as gw_mod

    async def fake_complete(messages: Any, model: Any = None, **kw: Any) -> dict[str, Any]:
        return {"content": "stub 固定回复", "model": "stub", "stub": True}

    monkeypatch.setattr(gw_mod.llm_gateway, "complete", fake_complete)
    res = asyncio.run(
        gr.request_guardian_review("delete_file", {"path": "x"}, enabled=True, timeout_s=2.0)
    )
    assert res.status == gr.GUARDIAN_REVIEW_STATUS_NOT_REVIEWED
    assert res.unavailable_reason == "no_credentials"
    assert res.independent_request_made is False


def test_gateway_exception_maps_to_gateway_error(monkeypatch):
    from app.core import llm_gateway as gw_mod

    async def boom(messages: Any, model: Any = None, **kw: Any) -> dict[str, Any]:
        raise RuntimeError("connection refused")

    monkeypatch.setattr(gw_mod.llm_gateway, "complete", boom)
    res = asyncio.run(
        gr.request_guardian_review("delete_file", {"path": "x"}, enabled=True, timeout_s=2.0)
    )
    assert res.status == gr.GUARDIAN_REVIEW_STATUS_NOT_REVIEWED
    assert res.unavailable_reason == "gateway_error"


# ==================== 审批链接线(行为改变面) ====================


def _clean_registry():
    from app.services import agent_loop_v2 as v2

    v2._approval_registry.clear()
    v2._approval_persist_keys.clear()
    return v2


class _StubCall:
    def __init__(self) -> None:
        self.id = "tc_gr"
        self.name = "delete_file"
        self.args: dict[str, Any] = {"path": "tmp/", "recursive": True}


class _StubLoop:
    """AgentLoopV2._request_approval 的最小鸭子 self(对齐 d84 测试形态)。"""

    def __init__(self) -> None:
        self._decision_hints: dict[str, tuple[str, str]] = {}
        self._user_id = "user-1"
        self._session_id = "sess-1"
        self._approval_timeout = 5
        self.emitted: list[dict[str, Any]] = []
        self._events = SimpleNamespace(tool_approval=self._emit)

    async def _emit(self, **kwargs: Any) -> None:
        self.emitted.append(kwargs)


def _drive(v2, monkeypatch, review: gr.GuardianReviewResult, decision: str, accept: bool):
    """驱动真实 _request_approval:注入复核结论 → 结算决策 → 返回(结果, stub, tc)。"""

    async def _fake_review(tool_name: str, args: dict[str, Any], **kw: Any) -> gr.GuardianReviewResult:
        return review

    monkeypatch.setattr(v2, "request_guardian_review", _fake_review)
    stub = _StubLoop()
    tc = _StubCall()

    async def scenario():
        task = asyncio.create_task(v2.AgentLoopV2._request_approval(stub, tc))
        for _ in range(400):
            if v2._approval_registry:
                break
            await asyncio.sleep(0.005)
        approval_id = next(iter(v2._approval_registry))
        outcome = v2.resolve_approval_for_requester(
            approval_id, decision, "user-1", scope="once", accept_alternative=accept
        )
        assert outcome is v2.ApprovalOutcome.APPLIED
        return await task

    result = asyncio.run(scenario())
    return result, stub, tc


def _alt_found_review() -> gr.GuardianReviewResult:
    alt = gr.SaferAlternative(
        tool_name="delete_file",
        args={"path": "tmp/one.log", "recursive": False},
        rationale="只删单文件",
        applicable=True,
    )
    return gr.GuardianReviewResult(
        status=gr.GUARDIAN_REVIEW_STATUS_ALTERNATIVE_FOUND,
        summary="有更安全路径:仅删单文件,是否改用?",
        alternative=alt,
        reviewer_model="reviewer-1",
        independent_request_made=True,
    )


def test_wiring_payload_carries_three_state_even_when_disabled(persist, monkeypatch):
    """无弹窗数据即不可分辨 = 没有;disabled 也必须以 not_reviewed 出现在事件面。"""
    v2 = _clean_registry()
    monkeypatch.delenv("GUARDIAN_REVIEW_ENABLED", raising=False)
    stub = _StubLoop()
    tc = _StubCall()

    async def scenario():
        task = asyncio.create_task(v2.AgentLoopV2._request_approval(stub, tc))
        for _ in range(400):
            if v2._approval_registry:
                break
            await asyncio.sleep(0.005)
        approval_id = next(iter(v2._approval_registry))
        v2.resolve_approval_for_requester(approval_id, "reject", "user-1", scope="once")
        return await task

    denial = asyncio.run(scenario())
    assert denial == "user_rejected"
    gr_payload = stub.emitted[0]["guardian_review"]
    assert gr_payload["status"] == "not_reviewed"
    assert gr_payload["unavailable_reason"] == "disabled"


def test_wiring_accept_alternative_replaces_args(persist, monkeypatch):
    v2 = _clean_registry()
    result, stub, tc = _drive(v2, monkeypatch, _alt_found_review(), "approve", True)
    assert result is None  # 已批准
    assert tc.args == {"path": "tmp/one.log", "recursive": False}
    assert stub._decision_hints[tc.id][0] == "guardian_review_alternative_applied"
    assert stub.emitted[0]["guardian_review"]["safer_alternative"]["applicable"] is True


def test_wiring_approve_without_accept_keeps_original(persist, monkeypatch):
    """维持原请求是一条合法出口:未勾选就一字不改。"""
    v2 = _clean_registry()
    result, _stub, tc = _drive(v2, monkeypatch, _alt_found_review(), "approve", False)
    assert result is None
    assert tc.args == {"path": "tmp/", "recursive": True}


def test_wiring_accept_flag_on_not_reviewed_changes_nothing(persist, monkeypatch):
    """未复核时 accept 标志必须不产生任何替换(没判就没结论)。"""
    v2 = _clean_registry()
    review = gr.GuardianReviewResult(
        status=gr.GUARDIAN_REVIEW_STATUS_NOT_REVIEWED, unavailable_reason="timeout"
    )
    result, _stub, tc = _drive(v2, monkeypatch, review, "approve", True)
    assert result is None
    assert tc.args == {"path": "tmp/", "recursive": True}


def test_wiring_suggestion_hint_recorded_even_if_not_accepted(persist, monkeypatch):
    v2 = _clean_registry()
    _result, stub, tc = _drive(v2, monkeypatch, _alt_found_review(), "approve", False)
    assert stub._decision_hints[tc.id][0] == "guardian_review_suggested"
    assert "更安全路径" in stub._decision_hints[tc.id][1]


def test_wiring_env_switch_parsing(monkeypatch):
    monkeypatch.setenv("GUARDIAN_REVIEW_ENABLED", "1")
    assert gr.guardian_review_enabled_from_env() is True
    monkeypatch.setenv("GUARDIAN_REVIEW_ENABLED", "off")
    assert gr.guardian_review_enabled_from_env() is False
    monkeypatch.setenv("GUARDIAN_REVIEW_TIMEOUT_S", "999")
    assert gr.guardian_review_timeout_s_from_env() == gr._MAX_REVIEW_TIMEOUT_S
    monkeypatch.setenv("GUARDIAN_REVIEW_TIMEOUT_S", "bad")
    assert gr.guardian_review_timeout_s_from_env() == gr._DEFAULT_REVIEW_TIMEOUT_S
