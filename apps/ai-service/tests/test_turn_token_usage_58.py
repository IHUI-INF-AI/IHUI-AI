# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:turn_token_usage + tool_call_trace 测试 — 对标 codex state/turn_token_usage.rs + tools/call_trace.rs。"""

from __future__ import annotations

from app.core.tool_call_trace import (
    EVENT_RECEIVED,
    EVENT_RESULT_READY,
    SOURCE_CODE_MODE,
    SOURCE_DIRECT,
    received,
    result_ready,
)
from app.core.turn_token_usage import (
    TOKEN_TYPES,
    TURN_TOKEN_USAGE_METRIC,
    TurnTokenUsage,
)


class TestTurnTokenUsage:
    def test_record_groups_by_model(self) -> None:
        t = TurnTokenUsage()
        t.record("m1", total_tokens=10, input_tokens=5, output_tokens=5)
        t.record("m2", total_tokens=3, output_tokens=3)
        assert t.models() == ["m1", "m2"]

    def test_record_accumulates_per_model(self) -> None:
        t = TurnTokenUsage()
        t.record("m1", total_tokens=10)
        t.record("m1", total_tokens=5, output_tokens=2)
        samples = t.samples()
        totals = [s for s in samples if s["token_type"] == "total"]
        assert len(totals) == 1
        assert totals[0]["value"] == 15
        outs = [s for s in samples if s["token_type"] == "output"]
        assert outs[0]["value"] == 2

    def test_samples_six_token_types_per_model(self) -> None:
        t = TurnTokenUsage()
        t.record("m", total_tokens=1)
        samples = t.samples()
        assert len(samples) == len(TOKEN_TYPES)
        labels = {s["token_type"] for s in samples}
        assert labels == {label for label, _ in TOKEN_TYPES}

    def test_samples_empty_uses_fallback_zero_sample(self) -> None:
        t = TurnTokenUsage()
        samples = t.samples(fallback_telemetry={"model": "fallback"})
        assert len(samples) == len(TOKEN_TYPES)
        assert all(s["value"] == 0 for s in samples)
        assert samples[0]["telemetry"] == {"model": "fallback"}

    def test_samples_empty_no_fallback(self) -> None:
        assert TurnTokenUsage().samples() == []

    def test_negative_clamped_to_zero(self) -> None:
        t = TurnTokenUsage()
        t.record("m", total_tokens=-5)
        samples = [s for s in t.samples() if s["token_type"] == "total"]
        assert samples[0]["value"] == 0

    def test_metric_name_and_reset(self) -> None:
        t = TurnTokenUsage()
        t.record("m", total_tokens=1)
        assert TURN_TOKEN_USAGE_METRIC == "turn_token_usage"
        t.reset()
        assert t.models() == []
        assert t.samples() == []


class TestToolCallTrace:
    def test_received_direct_carries_turn_id(self) -> None:
        ev = received("t1", "update_plan", "c1", turn_id="turn-9")
        assert ev.name == EVENT_RECEIVED
        d = ev.as_dict()
        assert d["turn_id"] == "turn-9"
        assert d["tool_source"] == SOURCE_DIRECT
        assert d["tool_namespace"] == "default"

    def test_received_code_mode_no_turn_id(self) -> None:
        ev = received(
            "t1", "run_code", "c2", source=SOURCE_CODE_MODE,
            cell_id="cell-3", runtime_tool_call_id="rtc-1",
        )
        d = ev.as_dict()
        assert d["tool_source"] == SOURCE_CODE_MODE
        assert "turn_id" not in d
        assert d["cell.id"] == "cell-3"
        assert d["runtime_tool_call_id"] == "rtc-1"

    def test_namespace_extraction(self) -> None:
        ev = received("t1", "clock.sleep", "c3")
        assert ev.tool_namespace == "clock"

    def test_result_ready(self) -> None:
        ev = result_ready("t1", "turn-1", "clock.sleep", "c4")
        assert ev.name == EVENT_RESULT_READY
        assert ev.as_dict()["turn_id"] == "turn-1"

    def test_no_arguments_or_output_in_events(self) -> None:
        # 红线:trace 事件绝不含参数或输出
        ev = received("t1", "run_command", "c5", turn_id="x")
        assert "arguments" not in ev.as_dict()
        assert "output" not in ev.as_dict()
