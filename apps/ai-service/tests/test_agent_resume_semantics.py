# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""agent_resume_semantics.py 纯函数单测。

这些用例只钉判定口径,不碰存储与工具执行 —— 跨进程行为由
tests/test_agent_crossprocess_resume.py 覆盖。所有用例都走默认严格路径
(`IHUI_AGENT_RESUME_RECEIPTS` 不设 = 默认 1),不靠关闭开关变绿。
"""

from __future__ import annotations

import pytest

from app.services import agent_resume_semantics as sem


def _receipt(
    *,
    state: str = sem.RECEIPT_STATE_SETTLED_OK,
    args: dict | None = None,
    tool: str = "write_file",
    mutating: bool = True,
    result_message: dict | None = None,
    attempt_seq: int = 1,
) -> dict:
    return sem.ToolReceipt(
        state=state,
        scope=sem.describe_tool_scope(tool).scope,
        mutating=mutating,
        args_digest=sem.args_digest(args or {"path": "a.txt", "content": "x"}),
        attempt_seq=attempt_seq,
        result_message=result_message,
    ).to_dict()


def test_scope_mutating_is_fail_closed_for_other():
    assert sem.describe_tool_scope("read_file").mutating is False
    assert sem.describe_tool_scope("write_file").mutating is True
    assert sem.describe_tool_scope("run_command").mutating is True
    # 未知工具归 other:注解没有明说只读,就按副作用面处理
    assert sem.describe_tool_scope("get_weather").mutating is True
    assert sem.describe_tool_scope("some_mcp_tool").scope == "other"


def test_scope_read_only_hint_only_trusts_true():
    assert sem.describe_tool_scope("some_mcp_tool", read_only_hint=True).mutating is False
    assert sem.describe_tool_scope("some_mcp_tool", read_only_hint=False).mutating is True
    assert sem.describe_tool_scope("some_mcp_tool", read_only_hint=None).mutating is True


def test_args_digest_is_key_order_stable_and_value_sensitive():
    a = sem.args_digest({"b": 2, "a": 1})
    b = sem.args_digest({"a": 1, "b": 2})
    c = sem.args_digest({"a": 1, "b": 3})
    assert a == b
    assert a != c


def test_receipt_roundtrip_and_invalid_state():
    rec = sem.ToolReceipt(
        state=sem.RECEIPT_STATE_SETTLED_ERROR,
        scope="exec",
        mutating=True,
        args_digest="d",
        attempt_seq=2,
        result_message={"role": "tool", "content": "x"},
    )
    assert sem.ToolReceipt.from_dict(rec.to_dict()) == rec
    with pytest.raises(ValueError):
        sem.ToolReceipt(
            state="unknown",
            scope="exec",
            mutating=True,
            args_digest="d",
            attempt_seq=1,
        )


def test_settled_with_result_replays_even_mutating():
    args = {"path": "a.txt", "content": "x"}
    decision = sem.decide_step(
        tool_call_id="c1",
        tool_name="write_file",
        args=args,
        receipt=_receipt(args=args, result_message={"role": "tool", "content": "ok"}),
        has_history_result=True,
    )
    assert decision.action == sem.STEP_ACTION_REPLAY
    assert decision.reason_code == sem.REASON_REPLAYED_VOUCHER


def test_settled_without_output_blocks_mutating_but_reexecutes_readonly():
    args = {"path": "a.txt"}
    mutating = sem.decide_step(
        tool_call_id="c1",
        tool_name="write_file",
        args=args,
        receipt=_receipt(args=args, tool="write_file", mutating=True),
        has_history_result=True,
    )
    readonly = sem.decide_step(
        tool_call_id="c2",
        tool_name="read_file",
        args=args,
        receipt=_receipt(args=args, tool="read_file", mutating=False),
        has_history_result=True,
    )
    assert mutating.action == sem.STEP_ACTION_BLOCK_CONFIRM
    assert mutating.reason_code == sem.REASON_COMPLETED_OUTPUT_UNAVAILABLE
    assert readonly.action == sem.STEP_ACTION_EXECUTE


def test_attempting_is_uncertain_and_blocks_mutating():
    args = {"command": "rm -rf x"}
    decision = sem.decide_step(
        tool_call_id="c1",
        tool_name="run_command",
        args=args,
        receipt=_receipt(state=sem.RECEIPT_STATE_ATTEMPTING, args=args, tool="run_command"),
        has_history_result=False,
    )
    assert decision.action == sem.STEP_ACTION_BLOCK_CONFIRM
    assert decision.reason_code == sem.REASON_UNCERTAIN

    readonly = sem.decide_step(
        tool_call_id="c2",
        tool_name="read_file",
        args=args,
        receipt=_receipt(
            state=sem.RECEIPT_STATE_ATTEMPTING, args=args, tool="read_file", mutating=False
        ),
        has_history_result=False,
    )
    assert readonly.action == sem.STEP_ACTION_EXECUTE
    assert readonly.reason_code == sem.REASON_READONLY_SAFE_REEXECUTE


def test_not_attempted_executes():
    args = {"path": "a.txt", "content": "x"}
    decision = sem.decide_step(
        tool_call_id="c1",
        tool_name="write_file",
        args=args,
        receipt=_receipt(state=sem.RECEIPT_STATE_NOT_ATTEMPTED, args=args),
        has_history_result=False,
    )
    assert decision.action == sem.STEP_ACTION_EXECUTE
    assert decision.reason_code == sem.REASON_NOT_ATTEMPTED


def test_no_receipt_with_history_result_is_unverified_for_mutating():
    args = {"path": "a.txt"}
    mutating = sem.decide_step(
        tool_call_id="c1",
        tool_name="write_file",
        args=args,
        receipt=None,
        has_history_result=True,
    )
    readonly = sem.decide_step(
        tool_call_id="c2",
        tool_name="read_file",
        args=args,
        receipt=None,
        has_history_result=True,
    )
    assert mutating.action == sem.STEP_ACTION_BLOCK_CONFIRM
    assert mutating.reason_code == sem.REASON_UNVERIFIED
    assert readonly.action == sem.STEP_ACTION_EXECUTE
    assert readonly.reason_code == sem.REASON_READONLY_SAFE_REEXECUTE


def test_no_receipt_without_history_result_continues():
    decision = sem.decide_step(
        tool_call_id="c1",
        tool_name="write_file",
        args={"path": "a.txt"},
        receipt=None,
        has_history_result=False,
    )
    assert decision.action == sem.STEP_ACTION_EXECUTE
    assert decision.reason_code == sem.REASON_NOT_ATTEMPTED


def test_args_mismatch_is_never_replayed():
    receipt = _receipt(args={"path": "a.txt", "content": "x"})
    decision = sem.decide_step(
        tool_call_id="c1",
        tool_name="write_file",
        args={"path": "a.txt", "content": "y"},
        receipt=receipt,
        has_history_result=True,
    )
    assert decision.action == sem.STEP_ACTION_BLOCK_CONFIRM
    assert decision.reason_code == sem.REASON_ARGS_MISMATCH


def test_plan_round_preflight_is_ordered_and_zero_execution():
    calls = [
        {"id": "c1", "name": "read_file", "args": {"path": "a.txt"}},
        {"id": "c2", "name": "write_file", "args": {"path": "a.txt", "content": "x"}},
        {"id": "c3", "name": "run_command", "args": {"command": "echo hi"}},
    ]
    receipts = {
        "c1": _receipt(tool="read_file", args={"path": "a.txt"}, mutating=False,
                       result_message={"role": "tool", "content": "ok"}),
        "c3": _receipt(state=sem.RECEIPT_STATE_ATTEMPTING, tool="run_command",
                       args={"command": "echo hi"}),
    }
    plan = sem.plan_round_resume(
        tool_calls=calls,
        receipts=receipts,
        history_results={"c1": True, "c2": True},
    )
    assert [d.tool_call_id for d in plan.decisions] == ["c1", "c2", "c3"]
    assert plan.decisions[0].action == sem.STEP_ACTION_REPLAY
    assert plan.decisions[1].action == sem.STEP_ACTION_BLOCK_CONFIRM
    assert plan.decisions[2].action == sem.STEP_ACTION_BLOCK_CONFIRM
    assert plan.needs_confirmation is True
    assert {d.tool_call_id for d in plan.blocked} == {"c2", "c3"}


def test_confirmations_reject_unknown_ids_and_keep_missing_pending():
    blocked = (
        sem.StepDecision("c1", "write_file", sem.STEP_ACTION_BLOCK_CONFIRM,
                         sem.REASON_UNCERTAIN, "fs_write", True, "evidence"),
    )
    with pytest.raises(sem.UnknownConfirmationError):
        sem.resolve_confirmations(blocked=blocked, confirmations={"c9": "retry"})
    with pytest.raises(ValueError):
        sem.resolve_confirmations(blocked=blocked, confirmations={"c1": "yes"})
    assert sem.resolve_confirmations(blocked=blocked, confirmations={}) == {}


def test_confirmation_payload_has_all_four_actions_and_truthful_evidence():
    blocked = (
        sem.StepDecision("c1", "write_file", sem.STEP_ACTION_BLOCK_CONFIRM,
                         sem.REASON_UNCERTAIN, "fs_write", True, "崩溃时可能已产生副作用"),
    )
    payload = sem.build_confirmation_payload(
        checkpoint_id="ck",
        iteration=3,
        blocked=blocked,
        args_by_call={"c1": {"path": "a.txt"}},
    )
    assert payload["code"] == "AGENT_RESUME_REQUIRES_CONFIRMATION"
    assert payload["allowed_decisions"] == ["retry", "skip", "accept", "abort"]
    assert payload["blocked"][0]["reason_code"] == sem.REASON_UNCERTAIN
    assert payload["blocked"][0]["args_summary"].startswith("{")
    # 两种处置的真实说明:skip 不许写成成功,accept 必须写"输出丢失"。
    assert "未执行" in sem.SKIP_RESULT_TEXT and "结果未知" in sem.SKIP_RESULT_TEXT
    assert "输出不可恢复" in sem.ACCEPT_RESULT_TEXT
    assert "成功" not in sem.ACCEPT_RESULT_TEXT.replace("不伪造成功结果", "")
