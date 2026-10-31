# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""腿2(2026-10-31 接线):准入留痕与断流续传收成 `sse_contract` 单一状态机。

一手现读(接线前,`git grep -n ... HEAD -- apps/ai-service`):
  · `sse_contract.mark_admission_acked` / `begin_recovery` / `end_recovery` **零生产调用方**
    (前两个只被 tests/test_sse_stream_watermark_b76_08a.py 直接调,`end_recovery` 连测试都没调)
    ⇒ "恢复态"从未被进入,票面那句"断流续传走状态机"是空话;
  · 而 `app/routers/llm.py` 另自持一份模块级 `_admission_seen: dict[str, dict[str, None]]`
    写准入留痕 —— 同一件事的第二份真相(账本在路由、判据在路由、状态机在契约却没人走)。

本文件钉四格:
  ① 第二份真相已收掉:`llm._admission_seen` 与 `sse_contract.ADMISSION_SEEN` 是**同一个对象**,
     且路由源码里不再自建账本(dict 字面量 / setdefault / get 都不许出现在它身上);
  ② 准入 acked → 断流 → 恢复,走的正是那三个出口,且作用在**同一条状态对象**上(ACK≠base);
  ③ 对外协议语义不变:真跑一条流,admission 帧形状/档位与帧水位四维逐帧齐备且连续;
  ④ 跑两次同结果,不留跨会话脏状态。

测试隔离(AGENTS §5):LLM 出口 monkeypatch,不连 PG(8810)/Redis(8811)、不发上游请求。
"""

from __future__ import annotations

import json
import pathlib
import uuid
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import sse_contract as sc
from app.core.sse_frames import begin_stream_watermark, end_stream_watermark, with_frame_watermark
from app.routers import llm as llm_router

LLM_SOURCE = (
    pathlib.Path(llm_router.__file__).read_text(encoding="utf-8")
)

# 刻意**不**在模块顶层 `from app.main import app`:conftest 的 autouse 限流隔离夹具判的是
# "app.main 已入 sys.modules ⇒ 必须能解包到 RateLimitMiddleware",而 Starlette 的中间件链
# 要等第一次真请求才建 —— 顶层导入会让本文件单独跑时每条用例都在夹具处报未判定(现成的例子:
# tests/test_admission_receipt_frame.py 单跑即九条全报)。用 conftest 的 `client` 夹具走惰性
# _get_app(),夹具在首请求前跳过、请求后中间件链已建,单跑与全量档同绿。


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for block in raw.split("\n\n"):
        if not block.strip():
            continue
        event_type: str | None = None
        data: Any = None
        for line in block.split("\n"):
            if line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                data_str = line[5:].strip()
                try:
                    data = json.loads(data_str)
                except (json.JSONDecodeError, ValueError):
                    data = data_str
        if event_type or data is not None:
            events.append({"event": event_type, "data": data})
    return events


async def _fake_gateway(monkeypatch) -> None:
    async def fake_astream(messages, model=None, owner_uuid=None):
        yield {"type": "chunk", "content": "好的"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)


def _spy_state_exits(monkeypatch) -> list[tuple[str, Any]]:
    """把三个状态出口在**路由层的调用点**包一层记录(真实效果照常执行)。"""
    calls: list[tuple[str, Any]] = []

    def _wrap(name: str) -> None:
        real = getattr(sc, name)

        def spy(state: sc.StreamWatermark, *a: Any, **k: Any) -> None:
            calls.append((name, state))
            real(state, *a, **k)

        monkeypatch.setattr(llm_router, name, spy)

    for _name in ("mark_admission_acked", "begin_recovery", "end_recovery"):
        _wrap(_name)
    return calls


class TestSingleSourceLedger:
    """① 第二份真相已收掉:账本只有一份,路由只经出口读写。"""

    def test_router_pointer_is_the_same_object(self) -> None:
        assert llm_router._admission_seen is sc.ADMISSION_SEEN, (
            "路由层的 `_admission_seen` 必须是指向单一来源的指针,不得是第二份 dict"
        )

    def test_router_no_longer_builds_or_touches_its_own_ledger(self) -> None:
        src = LLM_SOURCE
        # 接线前那三行自建账本/自写判据的形态一律不得回来
        assert "_admission_seen: dict[str, dict[str, None]] = {}" not in src
        assert "_admission_seen.setdefault(" not in src
        assert "_admission_seen.get(" not in src
        # 现在只剩:指针 + 转调单一来源的出口
        assert "_admission_seen = ADMISSION_SEEN" in src
        assert "take_admission(" in src
        assert "release_admission(" in src

    def test_accepted_then_duplicate_writes_the_one_ledger(self) -> None:
        conv = f"conv-{uuid.uuid4()}"
        try:
            assert llm_router._admission_disposition(conv, "i1") == "accepted"
            assert llm_router._admission_disposition(conv, "i1") == "duplicate"
            # 留痕落在单一来源上(不是路由自己的副本)
            assert "i1" in sc.ADMISSION_SEEN.get(conv, {})
            assert "i1" in llm_router._admission_seen.get(conv, {})
        finally:
            sc.ADMISSION_SEEN.pop(conv, None)

    def test_rejected_revoke_goes_through_the_single_source(self) -> None:
        conv = f"conv-{uuid.uuid4()}"
        try:
            assert llm_router._admission_disposition(conv, "i9") == "accepted"
            llm_router._admission_unseen(conv, "i9")
            assert "i9" not in sc.ADMISSION_SEEN.get(conv, {})
            # 撤痕后重试仍是 accepted(拒收不是准入)
            assert llm_router._admission_disposition(conv, "i9") == "accepted"
        finally:
            sc.ADMISSION_SEEN.pop(conv, None)

    def test_cap_is_caller_policy_and_still_evicts_fifo(self, monkeypatch) -> None:
        conv = f"conv-{uuid.uuid4()}"
        monkeypatch.setattr(llm_router, "_ADMISSION_SEEN_LIMIT", 3)
        try:
            for i in range(4):
                assert llm_router._admission_disposition(conv, f"i{i}") == "accepted"
            assert llm_router._admission_disposition(conv, "i0") == "accepted"
            assert llm_router._admission_disposition(conv, "i3") == "duplicate"
        finally:
            sc.ADMISSION_SEEN.pop(conv, None)

    def test_no_conversation_id_registers_nothing(self) -> None:
        assert llm_router._admission_disposition(None, "x") == "accepted"
        assert llm_router._admission_disposition("", "x") == "accepted"
        assert all("x" not in seen for seen in sc.ADMISSION_SEEN.values()), "不冒充判过 duplicate"


class TestRecoveryWindowLedger:
    """恢复窗口的三条纪律:没身份不记、过期即清、有上界。"""

    def test_empty_subscription_records_nothing(self) -> None:
        before = len(sc.RECOVERY_WINDOWS)
        sc.open_recovery_window("", deadline_ms=sc.recovery_clock_ms() + 1000)
        assert len(sc.RECOVERY_WINDOWS) == before
        assert sc.peek_recovery_window("") is None

    def test_expired_window_is_pruned_not_claimed(self) -> None:
        sid = f"sess-{uuid.uuid4()}"
        sc.open_recovery_window(sid, deadline_ms=sc.recovery_clock_ms() - 1)
        assert sid in sc.RECOVERY_WINDOWS
        assert sc.peek_recovery_window(sid) is None
        assert sid not in sc.RECOVERY_WINDOWS, "过期即摘除,不留腐烂条目"

    def test_window_count_is_bounded(self) -> None:
        ids = [f"sess-{uuid.uuid4()}" for _ in range(sc.RECOVERY_WINDOWS_LIMIT + 5)]
        deadline = sc.recovery_clock_ms() + 60_000
        try:
            for sid in ids:
                sc.open_recovery_window(sid, deadline_ms=deadline)
            assert len(sc.RECOVERY_WINDOWS) <= sc.RECOVERY_WINDOWS_LIMIT
        finally:
            for sid in ids:
                sc.RECOVERY_WINDOWS.pop(sid, None)


class TestAckedBreakRecoveryOnOneStateObject:
    """② acked → 断流 → 恢复:三个出口真被调用,且都在同一条状态对象上。"""

    def test_ack_alone_does_not_establish_base(self) -> None:
        sid = f"sess-{uuid.uuid4()}"
        begin_stream_watermark(sid)
        try:
            state = llm_router._current_stream_watermark()
            assert state is not None
            llm_router._mark_admission_acked()
            assert state.admission_acked is True
            assert state.has_applied_base is False, "ACK≠base:基线只能由 owned snapshot 建立"
        finally:
            end_stream_watermark()

    def test_break_then_reconnect_moves_the_single_state_machine(self) -> None:
        sid = f"sess-{uuid.uuid4()}"
        # —— 断流侧:准入已 ACK,随后客户端断开
        begin_stream_watermark(sid)
        try:
            first_state = llm_router._current_stream_watermark()
            assert first_state is not None
            # 先出一帧(生产出帧点):这帧是流上首个 owned snapshot,建立 base
            stamped = with_frame_watermark("chunk", {"content": "x"})
            assert stamped["toSeq"] == 1 and first_state.has_applied_base is True
            llm_router._mark_admission_acked()
            llm_router._open_recovery_window_on_break(sid)
            assert first_state.recovering is True, "断流这一刻必须经 begin_recovery 进恢复态"
            deadline = sc.peek_recovery_window(sid)
            assert deadline is not None
            assert first_state.assembly_deadline_ms == deadline
        finally:
            end_stream_watermark()

        # —— 续传侧:同一订阅重连(新流 = 新状态对象,与 sse_frames 的每流一份同纪律)
        begin_stream_watermark(sid)
        try:
            second_state = llm_router._current_stream_watermark()
            assert second_state is not first_state
            assert second_state.recovering is False
            entered = llm_router._enter_recovery_on_reconnect(sid)
            assert entered == sid, "窗口还开着 ⇒ 重连流必须认领并进入恢复态"
            assert second_state.recovering is True
            assert second_state.assembly_deadline_ms == deadline
            llm_router._end_recovery_window(entered)
            assert second_state.recovering is False
            assert sc.peek_recovery_window(sid) is None, "收口即清窗口(成对,不悬空)"
        finally:
            end_stream_watermark()
            sc.close_recovery_window(sid)

    def test_first_time_stream_does_not_enter_recovery(self) -> None:
        sid = f"sess-{uuid.uuid4()}"
        begin_stream_watermark(sid)
        try:
            assert llm_router._enter_recovery_on_reconnect(sid) is None
            state = llm_router._current_stream_watermark()
            assert state is not None and state.recovering is False
        finally:
            end_stream_watermark()

    def test_expired_window_is_not_claimed_by_reconnect(self) -> None:
        sid = f"sess-{uuid.uuid4()}"
        sc.open_recovery_window(sid, deadline_ms=sc.recovery_clock_ms() - 1)
        begin_stream_watermark(sid)
        try:
            assert llm_router._enter_recovery_on_reconnect(sid) is None
            state = llm_router._current_stream_watermark()
            assert state is not None and state.recovering is False
        finally:
            end_stream_watermark()
            sc.close_recovery_window(sid)

    def test_no_subscription_id_means_no_state_write(self) -> None:
        """没有流上下文 ⇒ `_current_stream_watermark()` 取不到 ⇒ 各出口整块零动作(不猜)。"""
        end_stream_watermark()  # 确保当前任务上下文没有流状态
        assert llm_router._current_stream_watermark() is None
        llm_router._mark_admission_acked()  # 不得抛
        llm_router._open_recovery_window_on_break(None)
        assert llm_router._enter_recovery_on_reconnect(None) is None
        llm_router._end_recovery_window(None)

    def test_run_twice_same_result(self) -> None:
        """④ 跑两次同结果(无跨轮状态)。"""
        outcomes: list[list[str]] = []
        for _ in range(2):
            sid = f"sess-{uuid.uuid4()}"
            seq: list[str] = []
            begin_stream_watermark(sid)
            try:
                state = llm_router._current_stream_watermark()
                assert state is not None
                llm_router._mark_admission_acked()
                seq.append(f"acked={state.admission_acked}")
                llm_router._open_recovery_window_on_break(sid)
                seq.append(f"break_recovering={state.recovering}")
            finally:
                end_stream_watermark()
            begin_stream_watermark(sid)
            try:
                state2 = llm_router._current_stream_watermark()
                assert state2 is not None
                entered = llm_router._enter_recovery_on_reconnect(sid)
                seq.append(f"entered={entered == sid}")
                seq.append(f"recovering={state2.recovering}")
                llm_router._end_recovery_window(entered)
                seq.append(f"exited={state2.recovering}")
                seq.append(f"window={sc.peek_recovery_window(sid) is None}")
            finally:
                end_stream_watermark()
                sc.close_recovery_window(sid)
            outcomes.append(seq)
        assert outcomes[0] == outcomes[1]
        assert outcomes[0] == [
            "acked=True",
            "break_recovering=True",
            "entered=True",
            "recovering=True",
            "exited=False",
            "window=True",
        ]


class TestWireSemanticsUnchanged:
    """③ 真跑一条流:admission 帧形状与帧水位四维都不因接线而变形。"""

    async def _drive_stream(self, client: AsyncClient, *, session: str, conv: str, input_id: str):
        resp = await client.post(
            "/api/llm/complete/stream",
            json={
                "messages": [{"role": "user", "content": "test"}],
                "inputId": input_id,
                "streamSessionId": session,
                "metadata": {"conversationId": conv, "messageId": "msg-1"},
            },
        )
        assert resp.status_code == 200
        return _parse_sse_events(resp.text)

    async def test_admission_acks_the_stream_state_and_watermark_stays_continuous(
        self, client: AsyncClient, monkeypatch
    ) -> None:
        await _fake_gateway(monkeypatch)
        calls = _spy_state_exits(monkeypatch)
        session = f"sess-{uuid.uuid4()}"
        conv = f"conv-{uuid.uuid4()}"
        try:
            events = await self._drive_stream(
                client, session=session, conv=conv, input_id="inp-single-1"
            )
        finally:
            sc.ADMISSION_SEEN.pop(conv, None)
            sc.close_recovery_window(session)

        names = [e["event"] for e in events if e["event"]]
        assert "admission" in names and names.index("admission") < names.index("chunk")
        adm = next(e["data"] for e in events if e["event"] == "admission")
        # 形状逐字(send-admission.ts L40-74,camelCase)—— 对外协议语义未动
        assert adm["type"] == "admission" and adm["inputId"] == "inp-single-1"
        assert adm["disposition"] == "accepted" and adm["messageId"] == "msg-1"

        # 状态机:ACK 记了一次;首次流没有窗口 ⇒ begin/end 都不被调用
        assert [name for name, _ in calls] == ["mark_admission_acked"]
        state = calls[0][1]
        assert isinstance(state, sc.StreamWatermark)
        assert state.admission_acked is True
        assert state.has_applied_base is True, "base 由出帧的 owned snapshot 建立,不是 ACK"
        assert state.recovering is False

        # 帧水位四维:逐帧齐备 + 首帧 snapshot + 连续推进(恢复态不得把水位写脏)
        wm = [
            (e["event"], e["data"]["fromSeq"], e["data"]["toSeq"])
            for e in events
            if isinstance(e["data"], dict) and set(sc.SSE_WATERMARK_PAYLOAD_KEYS) <= set(e["data"])
        ]
        assert wm, "带 streamSessionId 的流必须从首帧起有水位"
        assert len(wm) == len([e for e in events if isinstance(e["data"], dict)]), (
            "每帧都必须带齐四维:恢复态接线不得让任何一帧丢水位"
        )
        assert wm[0][1] == 0 and wm[0][2] == 1
        for prev, nxt in zip(wm, wm[1:], strict=False):
            assert nxt[1] == prev[2], f"{nxt[0]} 帧 fromSeq 不接续(消费侧会判 gap)"

    async def test_reconnect_inside_window_enters_and_exits_recovery(
        self, client: AsyncClient, monkeypatch
    ) -> None:
        await _fake_gateway(monkeypatch)
        session = f"sess-{uuid.uuid4()}"
        conv = f"conv-{uuid.uuid4()}"
        calls = _spy_state_exits(monkeypatch)
        deadline = sc.recovery_clock_ms() + 60_000
        try:
            # 第一轮:正常流(无窗口)
            first = await self._drive_stream(
                client, session=session, conv=conv, input_id="inp-reconnect-1"
            )
            # 模拟断流侧把恢复窗口挂到该订阅上(唯一写口)
            sc.open_recovery_window(session, deadline_ms=deadline)
            calls.clear()
            second = await self._drive_stream(
                client, session=session, conv=conv, input_id="inp-reconnect-1"
            )
        finally:
            sc.ADMISSION_SEEN.pop(conv, None)
            sc.close_recovery_window(session)

        # 进出成对,且顺序固定:进入在流上首帧之前、收口在 catch-up 面之后、ACK 在准入帧之后
        assert [name for name, _ in calls] == ["begin_recovery", "end_recovery", "mark_admission_acked"]
        # 三个出口作用在同一条状态对象上(单一状态机,不是影子状态)
        assert calls[0][1] is calls[1][1] is calls[2][1]
        state = calls[0][1]
        assert state.admission_acked is True
        assert state.recovering is False, "收口必须出态(与 begin 成对)"
        assert state.assembly_deadline_ms == deadline, "装配截止由窗口带来,不是调用方现编"
        assert sc.peek_recovery_window(session) is None, "窗口随收口清掉,不悬空"

        # 对外语义不变:同 inputId 重发仍是 duplicate,水位逐帧齐备连续
        adm1 = next(e["data"] for e in first if e["event"] == "admission")
        adm2 = next(e["data"] for e in second if e["event"] == "admission")
        assert (adm1["disposition"], adm2["disposition"]) == ("accepted", "duplicate")
        for events in (first, second):
            dicts = [e["data"] for e in events if isinstance(e["data"], dict)]
            assert all(set(sc.SSE_WATERMARK_PAYLOAD_KEYS) <= set(d) for d in dicts)
            seqs = [(d["fromSeq"], d["toSeq"]) for d in dicts]
            assert seqs[0] == (0, 1)
            for prev, nxt in zip(seqs, seqs[1:], strict=False):
                assert nxt[0] == prev[1]

    async def test_two_rounds_produce_identical_frames(
        self, client: AsyncClient, monkeypatch
    ) -> None:
        """④ 跑两次同结果:两轮的事件序列与档位完全一致(无跨轮脏状态)。"""
        await _fake_gateway(monkeypatch)
        rounds: list[list[tuple[str | None, Any]]] = []
        for _ in range(2):
            session = f"sess-{uuid.uuid4()}"
            conv = f"conv-{uuid.uuid4()}"
            try:
                events = await self._drive_stream(
                    client, session=session, conv=conv, input_id="inp-twice"
                )
            finally:
                sc.ADMISSION_SEEN.pop(conv, None)
                sc.close_recovery_window(session)
            rounds.append(
                [
                    (e["event"], e["data"].get("disposition") if isinstance(e["data"], dict) else None)
                    for e in events
                    if e["event"] in {"admission", "chunk", "done"}
                ]
            )
        assert rounds[0] == rounds[1]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
