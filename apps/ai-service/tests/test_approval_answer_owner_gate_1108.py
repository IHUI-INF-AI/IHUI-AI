# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""审批代答收口夹具(2026-11-08)。

主对话流审批条目在发帧时已记 `owner_user_id`,但
`POST /llm/complete/stream/{session_id}/approval-response` 此前**从不比对**它 ——
任何拿到 approvalId(且知道 sessionId)的登录用户都能替别人批准一次高危工具
(shell 一类)。本夹具要证明的不是"回包 403",而是:
他人代答 ⇒ 条目一个字段都没改、等待侧那个 Event 没被置、上游命令根本没被执行;
而真属主稍后的应答照常生效(越权路径不 pop 待决项)。
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import pytest

from app.routers import llm as llm_router

_SESSION = "sess-gate-1108"
_APPR = "appr_gate11080001"
_OWNER = "user-owner-1108"
_INTRUDER = "user-intruder-1108"


def _request(user_id: str | None = None) -> SimpleNamespace:
    """承载层身份替身:`_resolve_owner_uuid` 只读 `request.state.user_id`。"""
    state = SimpleNamespace()
    if user_id is not None:
        state.user_id = user_id
    return SimpleNamespace(state=state)


def _entry(*, owner: str | None = _OWNER) -> dict[str, Any]:
    """按 llm.py 生产条目键集造一条待决审批(高危 shell 命令行)。"""
    return {
        "event": asyncio.Event(),
        "decision": None,
        "scope": None,
        "reason": None,
        "argv": ["bash", "-lc", "rm -rf /tmp/should-not-run"],
        "tool_name": "run_command",
        "net_fact": None,
        "tool_call_id": "call-gate",
        "args_preview": '{"argv":["bash","-lc","rm -rf /tmp/should-not-run"]}',
        "danger_level": "high",
        "owner_user_id": owner,
        "created_at": datetime.now(UTC).isoformat(),
    }


@pytest.fixture(autouse=True)
def _bucket():
    """只开本夹具的会话格,用后即清(全局单例,不许跨用例带脏行)。"""
    llm_router._approval_sessions.pop(_SESSION, None)
    yield
    llm_router._approval_sessions.pop(_SESSION, None)


async def _answer(
    user_id: str | None, decision: str = "approve", approval_id: str = _APPR
) -> dict[str, Any]:
    return await llm_router.post_tool_approval_response(
        _request(user_id), _SESSION, {"approvalId": approval_id, "decision": decision}
    )


async def test_intruder_cannot_answer_and_pending_is_untouched() -> None:
    """他人代答:拒绝且零副作用(不写 decision、不置 Event、不 pop 条目)。"""
    entry = _entry()
    llm_router._approval_sessions[_SESSION] = {_APPR: entry}

    out = await _answer(_INTRUDER)

    assert out["ok"] is False, out
    assert "not found or expired" in out["error"], out
    assert entry["decision"] is None, "越权应答把决策写进了条目"
    assert entry["event"].is_set() is False, "越权应答把等待侧唤醒了"
    assert llm_router._approval_sessions[_SESSION][_APPR] is entry, "越权应答摘掉了待决项"


async def test_intruder_answer_never_reaches_tool_execution() -> None:
    """攻击路径已封死:等待侧收不到事件 ⇒ 那条 shell 命令一次都没被执行。

    这条复刻 tool loop 的结算判据(`await wait_for(event.wait())` 返回后才调工具):
    若 Event 被越权置位,`executed` 里必然多一条 —— 断言的是"没跑",不是状态码。
    """
    executed: list[str] = []
    entry = _entry()
    llm_router._approval_sessions[_SESSION] = {_APPR: entry}

    async def _waiter() -> None:
        try:
            await asyncio.wait_for(entry["event"].wait(), timeout=0.15)
        except TimeoutError:
            return
        executed.append(str(entry["tool_name"]))  # 生产里下一行才真正调工具

    task = asyncio.create_task(_waiter())
    await _answer(_INTRUDER)
    assert await asyncio.wait_for(task, timeout=0.5) is None
    assert executed == [], f"越权应答导致上游命令被执行: {executed}"


async def test_real_owner_answer_still_lands_after_intruder_try() -> None:
    """真属主迟到的应答仍然生效:越权尝试不摘条目、不占结算名额。"""
    entry = _entry()
    llm_router._approval_sessions[_SESSION] = {_APPR: entry}

    first = await _answer(_INTRUDER)
    assert first["ok"] is False, first

    second = await _answer(_OWNER)
    assert second["ok"] is True, second
    assert entry["decision"] == "approve", entry
    assert entry["event"].is_set() is True, entry


async def test_ownerless_pending_entry_is_fail_closed_for_authenticated_caller() -> None:
    """带身份却撞上"无可证明属主"的条目 ⇒ fail-closed,不予结算。"""
    entry = _entry(owner=None)
    llm_router._approval_sessions[_SESSION] = {_APPR: entry}

    out = await _answer(_INTRUDER)

    assert out["ok"] is False, out
    assert entry["decision"] is None and entry["event"].is_set() is False, entry


async def test_missing_session_is_fail_closed_and_registers_nothing() -> None:
    """登记表丢失(进程重启)/过期已摘 ⇒ 只回过期噪声,不凭空造待决项。"""
    out = await _answer(_OWNER)

    assert out["ok"] is False, out
    assert llm_router._approval_sessions.get(_SESSION) in (None, {}), (
        "拒绝路径凭空写出了待决表"
    )


async def test_anonymous_in_process_caller_check_is_preserved() -> None:
    """正向对照:进程内/开发态(双方都无主体)的既有结算路径不被收紧。"""
    entry = _entry(owner=None)
    llm_router._approval_sessions[_SESSION] = {_APPR: entry}

    out = await _answer(None)

    assert out["ok"] is True, out
    assert entry["decision"] == "approve" and entry["event"].is_set(), entry
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
