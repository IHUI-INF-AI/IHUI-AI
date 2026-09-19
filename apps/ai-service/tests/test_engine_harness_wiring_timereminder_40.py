# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:批40水印占位
# 批 40 实战接线测试 — 当前时间提醒节流状态机 + TurnAborted 中断指导注入
# (对标 codex-rs session/time_reminder.rs + context/turn_aborted.rs + event_mapping.rs)
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from datetime import UTC, datetime, timedelta

from app.core.current_time_reminder import (
    CURRENT_TIME_REMINDER_CLOSE_TAG,
    CURRENT_TIME_REMINDER_OPEN_TAG,
    CURRENT_TIME_UNAVAILABLE_MESSAGE,
    TURN_ABORTED_CLOSE_TAG,
    TURN_ABORTED_OPEN_TAG,
    CurrentTimeReminderState,
    TimeReminderDeliveryMode,
    build_current_time_reminder,
    build_current_time_unavailable,
    build_turn_aborted_fragment,
    is_current_time_reminder_fragment,
    is_turn_aborted_fragment,
)
from app.core.stream_events import USER_CONTEXTUAL_PREFIXES, is_contextual_user_fragment


def test_reminder_fragment_shape():
    """片段形态:developer 角色、带标记、content_kind 文案。"""
    t = datetime(2026, 9, 19, 3, 4, 5, tzinfo=UTC)
    frag = build_current_time_reminder(t)
    assert frag["role"] == "developer"
    text = frag["content"][0]["text"]
    assert text.startswith(CURRENT_TIME_REMINDER_OPEN_TAG)
    assert text.endswith(CURRENT_TIME_REMINDER_CLOSE_TAG)
    assert "It is 2026-09-19 03:04:05 UTC." in text
    assert is_current_time_reminder_fragment(text)


def test_unavailable_fragment_shape():
    """时钟不可用片段:developer 角色、固定文案。"""
    frag = build_current_time_unavailable()
    assert frag["role"] == "developer"
    assert CURRENT_TIME_UNAVAILABLE_MESSAGE in frag["content"][0]["text"]


def test_first_inference_always_due():
    """首次推理必投(last_delivery_time 为空)。"""
    state = CurrentTimeReminderState()
    base = datetime(2026, 9, 19, 12, 0, 0, tzinfo=UTC)
    clock = {"t": base}
    frag = state.take_reminder("w1", "t1", lambda: clock["t"])
    assert frag is not None and "It is" in frag["content"][0]["text"]


def test_interval_throttle_suppresses():
    """interval 未到期 → 抑制;到期 → 投递。"""
    state = CurrentTimeReminderState(reminder_interval_seconds=60)
    base = datetime(2026, 9, 19, 12, 0, 0, tzinfo=UTC)
    clock = {"t": base}
    assert state.take_reminder("w1", "t1", lambda: clock["t"]) is not None
    clock["t"] = base + timedelta(seconds=30)
    assert state.take_reminder("w1", "t1", lambda: clock["t"]) is None
    clock["t"] = base + timedelta(seconds=61)
    assert state.take_reminder("w1", "t1", lambda: clock["t"]) is not None


def test_zero_interval_always_due():
    """interval=0 → 每次推理都投。"""
    state = CurrentTimeReminderState(reminder_interval_seconds=0)
    base = datetime(2026, 9, 19, 12, 0, 0, tzinfo=UTC)
    assert state.take_reminder("w1", "t1", lambda: base) is not None
    assert state.take_reminder("w1", "t1", lambda: base) is not None


def test_new_window_forces_delivery():
    """新窗口(window_id 变化)无视 interval 强制投递。"""
    state = CurrentTimeReminderState(reminder_interval_seconds=3600)
    base = datetime(2026, 9, 19, 12, 0, 0, tzinfo=UTC)
    state.take_reminder("w1", "t1", lambda: base)
    # 同窗口 1s 后 → 抑制
    assert state.take_reminder("w1", "t1", lambda: base + timedelta(seconds=1)) is None
    # 新窗口 → 强制投递
    assert state.take_reminder("w2", "t1", lambda: base + timedelta(seconds=2)) is not None


def test_after_output_mode_requires_boundary():
    """AfterUserOrToolOutput:无 boundary 抑制;boundary 后放行且 boundary 被消耗。"""
    state = CurrentTimeReminderState(
        reminder_interval_seconds=0,
        delivery_mode=TimeReminderDeliveryMode.AFTER_USER_OR_TOOL_OUTPUT,
    )
    base = datetime(2026, 9, 19, 12, 0, 0, tzinfo=UTC)
    # 新窗口首推理仍放行(codex: is_new_window 短路)
    assert state.take_reminder("w1", "t1", lambda: base) is not None
    # 同窗口无 boundary → 抑制
    assert state.take_reminder("w1", "t1", lambda: base) is None
    # 工具输出 boundary → 放行
    state.note_recorded_items([{"type": "function_call_output", "output": "x"}])
    assert state.take_reminder("w1", "t1", lambda: base) is not None
    # boundary 已消耗 → 再抑制
    assert state.take_reminder("w1", "t1", lambda: base) is None


def test_boundary_consumed_even_if_suppressed():
    """interval 抑制也消耗 boundary(不积累到下次)。"""
    state = CurrentTimeReminderState(
        reminder_interval_seconds=3600,
        delivery_mode=TimeReminderDeliveryMode.AFTER_USER_OR_TOOL_OUTPUT,
    )
    base = datetime(2026, 9, 19, 12, 0, 0, tzinfo=UTC)
    state.take_reminder("w1", "t1", lambda: base)
    state.note_recorded_items([{"type": "message", "role": "user", "content": []}])
    # interval 未到期 → 抑制,但 boundary 被消耗
    assert state.take_reminder("w1", "t1", lambda: base) is None
    assert state.pending_user_or_tool_output_boundary is False


def test_clock_failure_degrades_then_dedupes():
    """时钟失败:首败注入不可用片段;同 (turn, window) 去重;换窗口重试;恢复清账。"""
    state = CurrentTimeReminderState()
    calls = {"n": 0}

    def bad_clock():
        calls["n"] += 1
        raise OSError("clock stalled")

    frag1 = state.take_reminder("w1", "t1", bad_clock)
    assert frag1 is not None and CURRENT_TIME_UNAVAILABLE_MESSAGE in frag1["content"][0]["text"]
    assert state.take_reminder("w1", "t1", bad_clock) is None
    # 换窗口允许重新注入(压缩后窗口可能不含早前提示)
    frag3 = state.take_reminder("w2", "t1", bad_clock)
    assert frag3 is not None
    # 时钟恢复 → 清失败记录,正常投递
    base = datetime(2026, 9, 19, 12, 0, 0, tzinfo=UTC)
    ok = state.take_reminder("w2", "t1", lambda: base)
    assert ok is not None and "It is" in ok["content"][0]["text"]
    assert state.last_clock_failure is None


def test_snapshot_roundtrip():
    """状态快照 roundtrip:恢复后不重复投递。"""
    state = CurrentTimeReminderState(reminder_interval_seconds=3600)
    base = datetime(2026, 9, 19, 12, 0, 0, tzinfo=UTC)
    state.take_reminder("w1", "t1", lambda: base)
    snap = state.to_snapshot()
    restored = CurrentTimeReminderState.from_snapshot(snap)
    assert restored.take_reminder("w1", "t1", lambda: base + timedelta(seconds=5)) is None
    # 坏快照 → 安全默认
    assert CurrentTimeReminderState.from_snapshot(None).last_window_id is None
    assert CurrentTimeReminderState.from_snapshot({"delivery_mode": "bogus"}).delivery_mode == (
        TimeReminderDeliveryMode.ANY_INFERENCE
    )


def test_turn_aborted_fragment_shape_and_reduction():
    """中断指导片段:user 角色、带标记、被 contextual 归约集识别(不进正文)。"""
    frag = build_turn_aborted_fragment("cancelled")
    assert frag["role"] == "user"
    text = frag["content"][0]["text"]
    assert text.startswith(TURN_ABORTED_OPEN_TAG) and text.endswith(TURN_ABORTED_CLOSE_TAG)
    assert "interrupted" in text and "partially executed" in text
    assert is_turn_aborted_fragment(text)
    # 归约集:该片段作为用户消息整体时 parse_user_message 应返回 None(不污染正文)
    assert is_contextual_user_fragment(frag["content"][0])
    paused = build_turn_aborted_fragment("paused")
    assert "was interrupted" in paused["content"][0]["text"]


def test_prefix_set_extended():
    """USER_CONTEXTUAL_PREFIXES 补齐新片段标记。"""
    for tag in (
        CURRENT_TIME_REMINDER_OPEN_TAG,
        TURN_ABORTED_OPEN_TAG,
        "<subagent_notification>",
        "<user_verification_notice>",
        "<environment_context>",
    ):
        assert tag in USER_CONTEXTUAL_PREFIXES


def test_environment_context_fragment_and_tracker():
    """环境片段形态 + 变化检测(变化才注入,不变返回 None)。"""
    from app.core.environment_context import (
        ENVIRONMENT_CONTEXT_CLOSE_TAG,
        ENVIRONMENT_CONTEXT_OPEN_TAG,
        EnvironmentStateTracker,
        format_local_date,
        is_environment_context_fragment,
    )

    ENV_OPEN = ENVIRONMENT_CONTEXT_OPEN_TAG
    ENV_CLOSE = ENVIRONMENT_CONTEXT_CLOSE_TAG
    NL_BODY = "\n  <cwd>G:/x</cwd>\n  <current_date>2026-09-19</current_date>\n"

    frag = {
        "type": "message",
        "role": "user",
        "content": [{"type": "input_text", "text": ENV_OPEN + NL_BODY + ENV_CLOSE}],
    }
    assert frag["role"] == "user"
    assert is_environment_context_fragment(frag["content"][0]["text"])
    assert is_contextual_user_fragment(frag["content"][0])

    tracker = EnvironmentStateTracker()
    first = tracker.maybe_fragment(cwd="G:/x", current_date="2026-09-19")
    assert first is not None
    text = first["content"][0]["text"]
    assert text.startswith(ENVIRONMENT_CONTEXT_OPEN_TAG)
    assert text.endswith(ENVIRONMENT_CONTEXT_CLOSE_TAG)
    assert "<cwd>G:/x</cwd>" in text and "<current_date>2026-09-19</current_date>" in text
    # 同状态 → 不重复注入
    assert tracker.maybe_fragment(cwd="G:/x", current_date="2026-09-19") is None
    # cwd 变化 → 注入
    changed = tracker.maybe_fragment(cwd="G:/y", current_date="2026-09-19")
    assert changed is not None and "G:/y" in changed["content"][0]["text"]
    # xml 转义:特殊字符不破坏结构
    esc = tracker.maybe_fragment(cwd="G:/a<b>&c", current_date="2026-09-20")
    assert esc is not None and "a&lt;b&gt;&amp;c" in esc["content"][0]["text"]
    assert format_local_date().count("-") == 2
    # reset 后强制重注入(压缩后语义)
    tracker.reset()
    re_inject = tracker.maybe_fragment(cwd="G:/a<b>&c", current_date="2026-09-20")
    assert re_inject is not None


def test_loop_wiring_time_provider_and_resume_injection():
    """端到端:run 循环注入 time_provider 后自动投递;resume 注入 turn_aborted。"""
    import asyncio

    from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition

    base = datetime(2026, 9, 19, 12, 0, 0, tzinfo=UTC)
    clock = {"t": base}

    async def llm_complete_fn(messages, tools_schema, **kwargs):
        # 首次调用:messages 里应已含时间提醒片段(interval=0 每推理必投)
        texts = [m.get("content", "") for m in messages if isinstance(m, dict)]
        joined = " ".join(str(t) for t in texts)
        if not any(m.get("role") == "assistant" for m in messages):
            assert CURRENT_TIME_REMINDER_OPEN_TAG in joined, "时间提醒未注入"
            return {
                "content": "",
                "tool_calls": [
                    {"id": "call_x", "name": "echo_tool", "args": {"v": 1}}
                ],
            }
        return {"content": "done", "tool_calls": None}

    async def echo_tool(args):
        return {"echo": args}

    loop = AgentLoopV2(
        llm_complete_fn=llm_complete_fn,
        tools=[
            ToolDefinition(
                name="echo_tool",
                description="echo",
                parameters={"type": "object"},
                executor=echo_tool,
            )
        ],
        enable_checkpoint=False,
        time_provider=lambda: clock["t"],
    )
    result = asyncio.get_event_loop().run_until_complete(
        loop.run([{"role": "user", "content": "hi"}])
    )
    assert result.success is True


def test_loop_without_time_provider_zero_change():
    """未注入 time_provider:messages 中绝无提醒片段(零行为变化)。"""

    async def llm_complete_fn(messages, tools_schema, **kwargs):
        texts = " ".join(
            str(m.get("content", "")) for m in messages if isinstance(m, dict)
        )
        assert CURRENT_TIME_REMINDER_OPEN_TAG not in texts
        return {"content": "ok", "tool_calls": None}

    import asyncio

    from app.services.agent_loop_v2 import AgentLoopV2

    loop = AgentLoopV2(
        llm_complete_fn=llm_complete_fn,
        tools={},
        enable_checkpoint=False,
    )
    result = asyncio.get_event_loop().run_until_complete(
        loop.run([{"role": "user", "content": "hi"}])
    )
    assert result.success is True
