# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D690(方案 A)幂等判据:断线 → 重连 → 重放待决审批,重复重连不重复入队/执行。

与同批的 `test_d690_chat_reconnect_approval_replay.py` 分工(两份都保留,判断面不同):
- 那一份钉**出口形状与取数闸**(帧 wire 键集、属主/过期/缺字段的反例、契约两侧同值、
  gen() 接线位);
- 本份钉**时间维与取用点闸**:① 断线→重连的先后顺序(断线本身不写表 ⇒ 重连必须能
  把仍待决条目再投递一次);② 重复重连 N 次的幂等 —— 每次连接各得一帧(投递语义),
  但登记表**一个字节都不变**(不新增条目、不置 event、不写 decision) ⇒ 同一 approval_id
  重放两次不制造第二个等待者,用户点两下也只执行一次;③ agent 任务流取用点的
  "会话恢复"形态(有 session_id、无续传游标)也必须重放。

已知边界(与设计同向,不在本份判红):主对话流帧仍不带 `id:`(B 档未选),重放不依赖
续传锚点,幂等键是 approval_id;可兑现性由"条目只活在活等待者名下"保证(原生成器被
取消时 wait 段 finally 已 pop,表里剩的必然有人等)—— 取消竞态由网关"等新生流首字节
再 abort 原上游"解掉(见 `apps/api/src/routes/ai-chat-stream.ts` 的复用臂头注)。

测试隔离(AGENTS §5):全程纯内存,**不连 PostgreSQL / Redis**;`app.routers.llm`
的取面与 D131/D690 既有取证同规(该模块可纯函数取用,不触发建池);注册表用后即清。
"""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from app.core.sse_contract import SSE_APPROVAL_REPLAY_PAYLOAD_KEY
from app.routers.llm import (
    _approval_replay_frames,
    _approval_sessions,
    post_tool_approval_response,
)

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
AGENTS_PY = AI_SERVICE_ROOT / "app" / "routers" / "agents.py"

_SESSION = "d690-idem-sess"
_OWNER = "user-A"
_APPR = "appr_idem0000001"


def _entry(
    *,
    owner: str | None = _OWNER,
    decision: str | None = None,
    set_event: bool = False,
    created_at: str | None = None,
) -> dict[str, Any]:
    """按 `llm.py` 生产条目形状造一条(键集与 D1047 diff① 补齐后的登记处一致)。"""
    ev = asyncio.Event()
    if set_event:
        ev.set()
    return {
        "event": ev,
        "decision": decision,
        "scope": None,
        "reason": None,
        "argv": ["ls"],
        "tool_name": "run_command",
        "net_fact": None,
        "tool_call_id": "call-1",
        "args_preview": '{"argv":["ls"]}',
        "danger_level": "high",
        "owner_user_id": owner,
        "created_at": created_at or datetime.now(UTC).isoformat(),
    }


@pytest.fixture()
def bucket():
    """在 `_approval_sessions` 里开一格(只碰本用例的会话格,用后即清)。"""
    _approval_sessions.pop(_SESSION, None)
    cell: dict[str, dict[str, Any]] = {}
    _approval_sessions[_SESSION] = cell
    yield cell
    _approval_sessions.pop(_SESSION, None)


def _fake_request(user_id: str | None = None) -> Any:
    """承载层身份入参替身(D-07 起 `post_tool_approval_response` 第一个形参是 Request)。

    `_resolve_owner_uuid` 只读 `request.state.user_id`;不给 ⇒ 未启用 JWT 的开发态同形。
    """
    from types import SimpleNamespace

    state = SimpleNamespace()
    if user_id is not None:
        state.user_id = user_id
    return SimpleNamespace(state=state)


def _payloads(frames: list[str]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for frame in frames:
        assert frame.startswith("event: tool-approval\ndata: "), f"重放帧形状漂了: {frame[:60]!r}"
        out.append(json.loads(frame.split("data: ", 1)[1].strip()))
    return out


# ── ① 断线 → 重连 → 仍待决条目被重放 ─────────────────────────────────────────


def test_disconnect_then_reconnect_replays_the_still_pending_approval(bucket) -> None:
    """断线窗口里条目仍在表(等待者还挂在 Event 上)⇒ 复用同一 streamSessionId 重连必须重放。"""
    entry = _entry()
    bucket[_APPR] = entry
    # 断线动作本身不写表(取消只发生在原生成器被真正回收时;网关在新生流首字节到达前不 abort)
    assert _approval_sessions[_SESSION][_APPR] is entry

    frames = _approval_replay_frames(_SESSION, _OWNER)

    payloads = _payloads(frames)
    assert len(payloads) == 1, f"断线后重连应重放恰一帧,实得 {len(payloads)}"
    assert payloads[0]["approval_id"] == _APPR
    assert payloads[0]["session_id"] == _SESSION
    assert payloads[0][SSE_APPROVAL_REPLAY_PAYLOAD_KEY] is True, "重放帧必须带 replay 标记"
    # 重连只读:没有替用户"答应"掉这条 —— 等待者醒没醒是用户应答的唯一判据
    assert entry["decision"] is None
    assert not entry["event"].is_set()


# ── ② 已决条目不被重放 ───────────────────────────────────────────────────────


def test_decided_approval_is_not_replayed_on_later_reconnect(bucket) -> None:
    """用户已应答(decision 写入 ∧ event 置位)后再重连 ⇒ 零帧(重放 = 二次弹窗 = 副作用)。"""
    entry = _entry()
    bucket[_APPR] = entry
    answered = asyncio.run(
        post_tool_approval_response(_fake_request(), _SESSION, {"approval_id": _APPR, "decision": "approve"})
    )
    assert answered["ok"] is True
    assert entry["decision"] == "approve" and entry["event"].is_set()

    assert _approval_replay_frames(_SESSION, _OWNER) == []


def test_half_written_decision_without_event_is_not_replayed(bucket) -> None:
    """半写形态(decision 已落、event 未置):判据是"或",任一命中即不重放。"""
    bucket[_APPR] = _entry(decision="reject")
    assert _approval_replay_frames(_SESSION, _OWNER) == []


# ── ③ 重复重连:每次投递一帧,但绝不重复入队 ─────────────────────────────────


def test_repeated_reconnects_deliver_one_frame_per_connection_without_requeue(bucket) -> None:
    """连续三次重连各得一帧(每连接一次投递),登记表零变化(未重复入队、未复制条目)。"""
    entry = _entry()
    bucket[_APPR] = entry

    reconnects = [_approval_replay_frames(_SESSION, _OWNER) for _ in range(3)]

    assert [len(frames) for frames in reconnects] == [1, 1, 1], "每次重连都应恰好一帧"
    ids = {_payloads(frames)[0]["approval_id"] for frames in reconnects}
    assert ids == {_APPR}, f"重放的 approval_id 漂了: {ids}"
    # 入队面:表里仍只有一条、仍是同一个对象、同一把 Event
    assert list(bucket) == [_APPR], f"重放不得新增条目: {list(bucket)}"
    assert bucket[_APPR] is entry
    assert entry["decision"] is None and not entry["event"].is_set()


def test_answering_after_repeated_reconnects_executes_exactly_once(bucket) -> None:
    """两次重连各弹一次窗、用户点两下 ⇒ 等待方只被唤醒一次、只执行一次。"""
    entry = _entry()
    bucket[_APPR] = entry
    for _ in range(2):
        assert _approval_replay_frames(_SESSION, _OWNER) != []

    async def _waiter() -> int:
        """生产等待循环的摘录:`asyncio.wait_for(_approval_ev.wait(), ...)` 醒来即执行一次。"""
        await entry["event"].wait()
        return 1

    async def _scenario() -> tuple[dict[str, Any], int, dict[str, Any]]:
        waiter = asyncio.create_task(_waiter())
        await asyncio.sleep(0)  # 让等待者先挂上 Event(与"断线前就已在下发帧后等待"同序)
        first = await post_tool_approval_response(
            _fake_request(), _SESSION, {"approval_id": _APPR, "decision": "approve"}
        )
        executions = await asyncio.wait_for(waiter, timeout=1)
        # 生产 finally:决策/超时后条目由等待方摘除(防内存泄漏)
        bucket.pop(_APPR, None)
        # 迟到的第二次点击(用户对两张重放弹窗都点了)
        late = await post_tool_approval_response(
            _fake_request(), _SESSION, {"approval_id": _APPR, "decision": "reject"}
        )
        return first, executions, late

    first, executions, late = asyncio.run(_scenario())

    assert first["ok"] is True
    assert executions == 1, "重放不得制造第二个等待者:重复点击只执行一次"
    assert late["ok"] is False, "执行完(条目已被等待方摘除)后的迟到应答不得再结算"
    assert _approval_replay_frames(_SESSION, _OWNER) == [], "已执行后重连不得再弹"


# ── ④ agent 任务流取用点:会话恢复(有会话键、无续传游标)也必须重放 ───────────


def test_agents_replay_gate_no_longer_requires_a_resume_cursor() -> None:
    """取用点闸只看 session_id。

    游标是客户端内存变量(刷新即失),而服务端待决条目活过页面刷新 —— 若闸仍要求
    `last_event_id`,则"刷新后恢复会话"这一形态不重放,弹窗照样丢。放宽不扩权:
    取数侧 `pending_approval_replays` 仍是 session_id 精确相等 ∧ 属主精确相等 ∧
    仍待决三道 fail-closed 闸,且纯只读。
    """
    lines = AGENTS_PY.read_text(encoding="utf-8").splitlines()
    call_site = "from ..services.agent_loop_v2 import pending_approval_replays"
    idx = next((i for i, ln in enumerate(lines) if call_site in ln), None)
    assert idx is not None, "agents.py 的待决重放调用点不见了(判据失效,不是通过)"
    guard = lines[idx - 1].strip()
    assert guard == "if req.session_id:", f"重放闸漂了: {guard!r}"
    assert "last_event_id" not in guard, "重放闸又把续传游标当前置了:刷新恢复会话会丢弹窗"


def test_agents_pending_replay_is_read_only_and_repeatable() -> None:
    """任务流取数侧重复调用幂等:同一请求重试两次结果逐字段相同,注册表零变化。"""
    from app.services import agent_loop_v2 as v2

    v2._approval_registry.clear()
    entry = v2._ApprovalEntry(
        event=asyncio.Event(),
        owner_user_id="user-A",
        thread_id="s1",
        tool_name="run_command",
        args_preview='{"cmd": "ls"}',
        created_at="2026-10-22T00:00:00Z",
    )
    v2._approval_registry["appr_task000001"] = entry
    try:
        first = v2.pending_approval_replays(session_id="s1", owner_user_id="user-A")
        second = v2.pending_approval_replays(session_id="s1", owner_user_id="user-A")

        assert first == second, "重复订阅(重试)读到的载荷必须逐字段相同"
        assert [p["approval_id"] for p in first] == ["appr_task000001"]
        assert list(v2._approval_registry) == ["appr_task000001"], "取数不得新增/复制条目"
        assert v2._approval_registry["appr_task000001"] is entry
        assert entry.decision is None and not entry.event.is_set()

        # 已决 ⇒ 不重放(与主对话流同判据)
        entry.decision = "approve"
        assert v2.pending_approval_replays(session_id="s1", owner_user_id="user-A") == []
    finally:
        v2._approval_registry.clear()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
