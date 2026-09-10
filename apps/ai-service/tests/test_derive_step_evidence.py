# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

from app.services.agent_loop_v2 import ToolResult, _derive_step_decision, derive_step_evidence


def test_edit_file_derives_diff_and_checkpoint_rollback() -> None:
    evidence = derive_step_evidence(
        "edit_file",
        {"path": "src/app.py", "oldText": "old", "newText": "new"},
        {"ok": True},
        checkpoint_id="cp-1",
    )
    assert evidence["diff"] == {
        "tool": "edit_file",
        "path": "src/app.py",
        "before": "old",
        "after": "new",
    }
    assert evidence["rollback"] == {
        "kind": "checkpoint",
        "checkpoint_id": "cp-1",
        "path": "src/app.py",
        "available": True,
    }
    assert evidence["test"] is None


def test_write_file_derives_new_file_diff_without_rollback() -> None:
    evidence = derive_step_evidence(
        "write_file",
        {"file_path": "src/new.py", "content": "print('hi')"},
        {"ok": True},
    )
    assert evidence["diff"] == {
        "tool": "write_file",
        "path": "src/new.py",
        "before": "",
        "after": "print('hi')",
    }
    assert evidence["rollback"] is None


def test_run_command_derives_test_evidence() -> None:
    evidence = derive_step_evidence(
        "run_command",
        {"command": "pnpm test"},
        {"exitCode": 1, "passed": 10, "failed": 2},
    )
    assert evidence["test"] == {
        "command": "pnpm test",
        "exit_code": 1,
        "passed": 10,
        "failed": 2,
    }
    assert evidence["diff"] is None
    assert evidence["rollback"] is None


def test_unknown_tool_has_no_derived_evidence() -> None:
    evidence = derive_step_evidence("read_file", {"path": "a.py"}, {"content": "x"})
    assert evidence == {"diff": None, "test": None, "rollback": None}


# ---- 1-1 全可解释:_derive_step_decision 决策推导(2026-09-08 立) ----


def _tr(**kw: object) -> ToolResult:
    """构造 ToolResult(默认成功无重试)。"""
    base: dict[str, object] = {
        "tool_call_id": "t1",
        "name": "edit_file",
        "result": {"ok": True},
    }
    base.update(kw)
    return ToolResult(**base)  # type: ignore[arg-type]


def test_decision_success_plain() -> None:
    decision, reason = _derive_step_decision(_tr())
    assert decision == "execute_tool"
    assert reason == ""


def test_decision_plan_blocked() -> None:
    decision, reason = _derive_step_decision(
        _tr(error="permission_mode=plan", error_type="permission_denied")
    )
    assert decision == "plan_blocked"
    assert "只读白名单" in reason


def test_decision_user_rejected() -> None:
    decision, _ = _derive_step_decision(
        _tr(error="User rejected tool call", error_type="user_rejected")
    )
    assert decision == "rejected_by_user"


def test_decision_approval_timeout() -> None:
    decision, _ = _derive_step_decision(_tr(error="Approval timeout", error_type="approval_timeout"))
    assert decision == "approval_timeout"


def test_decision_tool_missing() -> None:
    decision, _ = _derive_step_decision(_tr(error="工具 foo 不存在", error_type="unknown"))
    assert decision == "tool_missing"


def test_decision_failed_carries_reason() -> None:
    decision, reason = _derive_step_decision(_tr(error="boom", error_type="timeout"))
    assert decision == "execute_tool_failed"
    assert "timeout" in reason
    assert "boom" in reason


def test_decision_retried_success() -> None:
    decision, reason = _derive_step_decision(_tr(retry_count=2))
    assert decision == "execute_tool_retried"
    assert "2" in reason
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
