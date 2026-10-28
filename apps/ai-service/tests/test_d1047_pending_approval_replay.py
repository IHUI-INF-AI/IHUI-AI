# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D1047(机主 2026-10-10 拍板口径 A)—— agent 任务流"重连重放仍待决审批"。

D131 取证①(`test_d131_pending_approval_resume.py`)量出的病灶:任务流续传按
游标只补"锚点之后",审批帧几乎总在锚点之前 ⇒ 弹窗在断线窗口里丢。本票的修法
分两半:
- **agent 任务流侧(本文件钉的这半)**:`agent_loop_v2.pending_approval_replays()`
  显式查待决注册表,agents.py 在重连(start 帧之后)把仍待决条目以同形
  tool-approval 帧重发(replay:true 标记)。
- **主对话流侧(llm.py::_approval_sessions)**:有僵尸 run 问题(重放答复会驱动
  孤儿生成器继续执行),须与 sse_contract 同批,不在本笔射程(票行内已注记)。

判据(与审批结算同一族,精确相等、fail-closed):
① 仍待决(decision 未写 ∧ 事件未置)且 thread_id==session_id 且属主==调用者 ⇒ 重放;
② 已决/已结算 ⇒ 不重放(二次弹窗=副作用);
③ 跨会话 / 跨属主 ⇒ 不重放(不串门);
④ 请求者无身份(None)只能拿到属主同为 None 的条目;session_id 为 None ⇒ 恒空;
⑤ 历史二元组形态(无展示字段)不参与 —— 与 list_pending_approvals 同口径。

测试隔离(AGENTS §5):全程纯内存,不连 PostgreSQL / Redis;注册表用后即清。
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app.services import agent_loop_v2 as v2


def _entry(
    *,
    thread_id: str | None = "sess-1",
    owner: str | None = "user-A",
    decision: str | None = None,
    set_event: bool = False,
) -> v2._ApprovalEntry:
    ev = asyncio.Event()
    if set_event:
        ev.set()
    return v2._ApprovalEntry(
        event=ev,
        decision=decision,
        owner_user_id=owner,
        thread_id=thread_id,
        tool_name="run_command",
        args_preview='{"cmd": "ls"}',
        created_at="2026-10-13T00:00:00Z",
    )


@pytest.fixture(autouse=True)
def _clean_registry():
    v2._approval_registry.clear()
    yield
    v2._approval_registry.clear()


def test_pending_same_session_same_owner_is_replayable() -> None:
    """① 命中:待决 + 同会话 + 同属主 ⇒ 重放载荷字段齐全。"""
    v2._approval_registry["appr_aaa000000001"] = _entry()
    v2._approval_registry["appr_bbb000000002"] = _entry(
        thread_id="sess-1", owner="user-A", decision=None
    )
    out = v2.pending_approval_replays(session_id="sess-1", owner_user_id="user-A")
    assert sorted(p["approval_id"] for p in out) == ["appr_aaa000000001", "appr_bbb000000002"]
    first = out[0]
    assert first["tool_name"] == "run_command"
    assert first["thread_id"] == "sess-1"
    assert first["args_preview"] == '{"cmd": "ls"}'
    assert first["created_at"] == "2026-10-13T00:00:00Z"


def test_decided_or_settled_is_not_replayed() -> None:
    """② 已决(decision 写入)或已唤醒(事件置位)⇒ 不重放,防二次弹窗。"""
    v2._approval_registry["appr_dec000000001"] = _entry(decision="approve")
    v2._approval_registry["appr_set000000002"] = _entry(set_event=True)
    assert v2.pending_approval_replays(session_id="sess-1", owner_user_id="user-A") == []


def test_cross_session_and_cross_owner_are_excluded() -> None:
    """③ 跨会话/跨属主一概不重放(不串门)。"""
    v2._approval_registry["appr_oth000000001"] = _entry(thread_id="sess-OTHER")
    v2._approval_registry["appr_owr000000002"] = _entry(owner="user-B")
    assert v2.pending_approval_replays(session_id="sess-1", owner_user_id="user-A") == []


def test_identity_less_caller_sees_only_identity_less_entries() -> None:
    """④ fail-closed:无身份调用者只拿到属主同为 None 的条目(与结算判据同向)。"""
    v2._approval_registry["appr_anon00000001"] = _entry(owner=None)
    v2._approval_registry["appr_own00000002"] = _entry(owner="user-A")
    out = v2.pending_approval_replays(session_id="sess-1", owner_user_id=None)
    assert [p["approval_id"] for p in out] == ["appr_anon00000001"]


def test_none_session_returns_empty_without_touching_registry() -> None:
    """④ 补:session_id 为 None(无可过滤键)⇒ 恒空,短路与全量两态一致。"""
    v2._approval_registry["appr_xxx00000001"] = _entry()
    assert v2.pending_approval_replays(session_id=None, owner_user_id="user-A") == []


def test_legacy_tuple_records_are_skipped() -> None:
    """⑤ 历史二元组形态((event, decision))不参与重放 —— 与收件箱同口径。"""
    ev = asyncio.Event()
    v2._approval_registry["appr_old00000001"] = (ev, None)
    assert v2.pending_approval_replays(session_id="sess-1", owner_user_id="user-A") == []


def test_stream_endpoint_wires_replay_after_start_frame() -> None:
    """接线钉:agents.py 事件流在 start 帧之后显式调 pending_approval_replays。

    (D131 取证的镜像风格:以源码面文本钉接线位,防止助手提交时只落了取数侧
    忘了接线 —— 取数侧单测全绿而端点不调,弹窗照样丢。)
    """
    src = (Path(__file__).resolve().parents[1] / "app" / "routers" / "agents.py").read_text(
        encoding="utf-8"
    )
    assert "pending_approval_replays(" in src, "agents.py 未接线重放出口"
    # 接线必须在 start 帧下发之后(客户端先拿到 resume 三态,再收重放弹窗)
    assert src.index("yield _format_sse(eid, start_event)") < src.index(
        "pending_approval_replays("
    ), "重放必须在 start 帧(_format_sse(eid, start_event))之后下发"
    # replay 标记必须带(前端按 approvalId 幂等渲染的判别位)
    assert '"replay": True' in src
