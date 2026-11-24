# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""hook_exit_contract 判据测试 —— 14 项封闭集 + exit-code 契约 + 反向变异。"""

from __future__ import annotations

import pytest

from app.core.hook_exit_contract import (
    CODEX_ERR_EXIT2_NO_BLOCKING_REASON,
    CODEX_ERR_EXIT2_NO_CONTINUATION,
    CODEX_ERR_EXIT2_NO_DENIAL_REASON,
    CODEX_ERR_EXIT2_NO_FEEDBACK,
    CODEX_ERR_EXIT_NO_STATUS,
    CODEX_HOOK_EVENT_TOTAL,
    CodexHookEvent,
    check_hook_exit,
    required_stderr_payload,
)


def _ok(event: CodexHookEvent, **kw):
    base = {
        "event": event, "has_status_code": True, "exit_code": 0,
        "stderr_has_payload": False, "json_valid": True,
    }
    base.update(kw)
    return check_hook_exit(**base)


def test_event_total_is_14():
    assert CODEX_HOOK_EVENT_TOTAL == 14
    assert len(set(CodexHookEvent)) == 14


def test_ours_missing_8_covered():
    """本仓 HookKind 缺失的 8 项必须都在 Codex 封闭集内。"""
    ours = {"session_start", "user_prompt_submit", "pre_tool_use",
            "pre_compact", "post_compact", "stop"}
    all_events = {e.value for e in CodexHookEvent}
    assert ours <= all_events
    assert len(all_events - ours) == 8


def test_no_status_code_violation():
    v = _ok(CodexHookEvent.PRE_TOOL_USE, has_status_code=False, exit_code=None)
    assert not v.ok and v.codex_error == CODEX_ERR_EXIT_NO_STATUS


def test_exit0_clean():
    v = _ok(CodexHookEvent.PRE_TOOL_USE)
    assert v.ok


@pytest.mark.parametrize("event,anchor", [
    (CodexHookEvent.PRE_TOOL_USE, CODEX_ERR_EXIT2_NO_BLOCKING_REASON),
    (CodexHookEvent.PERMISSION_REQUEST, CODEX_ERR_EXIT2_NO_DENIAL_REASON),
    (CodexHookEvent.POST_TOOL_USE, CODEX_ERR_EXIT2_NO_FEEDBACK),
    (CodexHookEvent.STOP, CODEX_ERR_EXIT2_NO_CONTINUATION),
    (CodexHookEvent.SUBAGENT_STOP, CODEX_ERR_EXIT2_NO_CONTINUATION),
])
def test_exit2_requires_stderr(event, anchor):
    v = _ok(event, exit_code=2)
    assert not v.ok and v.codex_error == anchor


def test_exit2_with_stderr_ok():
    v = _ok(CodexHookEvent.PRE_TOOL_USE, exit_code=2, stderr_has_payload=True)
    assert v.ok


def test_exit2_no_required_payload_ok():
    """SESSION_START exit 2 无 stderr 载荷要求，合规。"""
    v = _ok(CodexHookEvent.SESSION_START, exit_code=2)
    assert v.ok


def test_required_payload_none_for_unseen():
    assert required_stderr_payload(CodexHookEvent.SESSION_START) is None


def test_invalid_json_on_nonexit2():
    v = _ok(CodexHookEvent.POST_TOOL_USE, exit_code=0, json_valid=False)
    assert not v.ok and "invalid post_tool_use JSON" in (v.codex_error or "")


# —— 反向变异 ——
def test_mutation_exit2_without_stderr_passes():
    """若契约漏判 exit2 缺 stderr，PRE_TOOL_USE 必须仍违约。"""
    v = _ok(CodexHookEvent.PRE_TOOL_USE, exit_code=2, stderr_has_payload=False)
    assert v.codex_error == CODEX_ERR_EXIT2_NO_BLOCKING_REASON


def test_mutation_stop_subagentstop_confused():
    """STOP 与 SUBAGENT_STOP 同属 continuation prompt 契约，不得混淆成 feedback。"""
    v = _ok(CodexHookEvent.SUBAGENT_STOP, exit_code=2)
    assert v.codex_error == CODEX_ERR_EXIT2_NO_CONTINUATION
    assert v.codex_error != CODEX_ERR_EXIT2_NO_FEEDBACK


def test_mutation_event_total_wrong():
    """封闭集总数必须 14，误删任一事件即失败。"""
    assert CODEX_HOOK_EVENT_TOTAL == 14
    assert "interrupt" in {e.value for e in CodexHookEvent}
    assert "permission_request" in {e.value for e in CodexHookEvent}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
