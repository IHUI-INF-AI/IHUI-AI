# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""上下文压力五判据 + micro-compaction 工具计数(2026-10-31 立)。

钉住三件事:
1. assess_context_pressure:warning/error/autoCompact/blocking 四道阈值两侧取值,
   percent_left 0/100 边界与超窗钳位,窗口缺失记 None(未判定);
2. compress_messages_if_needed 出口只增五个只读字段 —— 既有 info 键集/取值与
   tuple 返回形态逐项不变(legacy 路径零改动);
3. micro_compact_messages 的 tools_kept / tools_removed 计数,且该计数并进
   compaction_metrics 既有事件维度(metric dict + report.tools + by_trigger),
   不新增第二套 Prometheus 指标。
"""

from __future__ import annotations

from typing import Any

import pytest
from prometheus_client import REGISTRY

from app.core.context_compaction import (
    CONTEXT_ERROR_PERCENT_LEFT,
    CONTEXT_WARNING_PERCENT_LEFT,
    MICRO_COMPACT_PLACEHOLDER,
    assess_context_pressure,
    compress_messages_if_needed,
    estimate_messages_tokens,
    micro_compact_messages,
)
from app.services import compaction_metrics as cm

#: 只读判据的五个新增字段(compress 出口只允许比旧版多这五个键)
PRESSURE_KEYS = {
    "percent_left",
    "is_above_warning",
    "is_above_error",
    "is_above_auto_compact",
    "is_at_blocking",
}
#: 改动前 compress_messages_if_needed 的 info 键集(legacy 形态,一个都不许少/改名)
LEGACY_INFO_KEYS = {
    "compressed",
    "original_tokens",
    "compressed_tokens",
    "removed_count",
    "usage_ratio",
    "trigger",
}


# =============================================================================
# 一、五判据:四道阈值两侧
# =============================================================================


def test_percent_left_boundaries_zero_and_hundred():
    """percent_left 边界:空上下文 = 100,满窗 = 0,超窗钳到 0(不返回负数)。"""
    assert assess_context_pressure(0, 10000)["percent_left"] == 100.0
    assert assess_context_pressure(10000, 10000)["percent_left"] == 0.0
    assert assess_context_pressure(12000, 10000)["percent_left"] == 0.0
    # 负数已用按 0 处理(不出现 >100 的剩余)
    assert assess_context_pressure(-5, 10000)["percent_left"] == 100.0


def test_percent_left_rounding_and_clamp():
    """percent_left 展示舍入到 2 位,且始终落在 [0, 100]。"""
    result = assess_context_pressure(3333, 10000)
    assert result["percent_left"] == 66.67
    assert 0.0 <= result["percent_left"] <= 100.0


def test_warning_threshold_both_sides():
    """warning:剩余 40%(已用 60%)恰好踩线不算越线,再多 1 token 才算。"""
    limit = 10000
    at_line = assess_context_pressure(int(limit * (1 - CONTEXT_WARNING_PERCENT_LEFT / 100)), limit)
    assert at_line["percent_left"] == 40.0
    assert at_line["is_above_warning"] is False
    assert assess_context_pressure(6001, limit)["is_above_warning"] is True
    assert assess_context_pressure(5999, limit)["is_above_warning"] is False


def test_error_threshold_both_sides():
    """error:剩余 20%(已用 80%)两侧。"""
    limit = 10000
    at_line = assess_context_pressure(int(limit * (1 - CONTEXT_ERROR_PERCENT_LEFT / 100)), limit)
    assert at_line["percent_left"] == 20.0
    assert at_line["is_above_error"] is False
    assert assess_context_pressure(8001, limit)["is_above_error"] is True
    assert assess_context_pressure(7999, limit)["is_above_error"] is False


def test_auto_compact_threshold_both_sides():
    """auto_compact:默认 trigger_ratio=0.88 ⇒ 已用 88% 不触发,88%+1 token 触发。"""
    limit = 10000
    at_line = assess_context_pressure(8800, limit)
    assert at_line["percent_left"] == 12.0
    assert at_line["is_above_auto_compact"] is False
    assert assess_context_pressure(8801, limit)["is_above_auto_compact"] is True
    assert assess_context_pressure(8799, limit)["is_above_auto_compact"] is False


def test_auto_compact_respects_custom_trigger_ratio():
    """auto_compact 阈值随调用方 trigger_ratio 走(与压缩触发同源)。"""
    limit = 10000
    assert assess_context_pressure(8500, limit, trigger_ratio=0.85)["is_above_auto_compact"] is False
    assert assess_context_pressure(8501, limit, trigger_ratio=0.85)["is_above_auto_compact"] is True


def test_blocking_threshold_both_sides():
    """blocking:剩余 0% 即 true(满窗/超窗),只差 1 token 时仍 false。"""
    limit = 10000
    assert assess_context_pressure(9999, limit)["is_at_blocking"] is False
    assert assess_context_pressure(10000, limit)["is_at_blocking"] is True
    assert assess_context_pressure(15000, limit)["is_at_blocking"] is True


def test_pressure_ladder_is_monotonic():
    """四道阈值的阶梯关系:越接近满窗,越靠后的判据依次点亮。"""
    limit = 10000
    ladder = [
        (5000, (False, False, False, False)),
        (6500, (True, False, False, False)),
        (8500, (True, True, False, False)),
        (9000, (True, True, True, False)),
        (10000, (True, True, True, True)),
    ]
    for used, expected in ladder:
        p = assess_context_pressure(used, limit)
        got = (
            p["is_above_warning"],
            p["is_above_error"],
            p["is_above_auto_compact"],
            p["is_at_blocking"],
        )
        assert got == expected, f"used={used}"


def test_missing_window_is_undetermined_not_zero():
    """窗口取不到(limit<=0)⇒ percent_left=None 未判定,四布尔全 False(不冒绿也不冒红)。"""
    for limit in (0, -100):
        p = assess_context_pressure(500, limit)
        assert p["percent_left"] is None
        assert p["is_above_warning"] is False
        assert p["is_above_error"] is False
        assert p["is_above_auto_compact"] is False
        assert p["is_at_blocking"] is False


# =============================================================================
# 二、compress 出口:纯增量字段 + legacy 零改动
# =============================================================================


def _head_heavy_messages() -> list[dict[str, Any]]:
    """head 长 tail 短的可压缩消息(与既有测试同构)。"""
    return [{"role": "system", "content": "sys"}] + [
        {"role": "user", "content": "x" * 5000} for _ in range(4)
    ] + [{"role": "user", "content": "t" * 100} for _ in range(6)]


def test_compress_info_only_adds_pressure_keys():
    """触发压缩:info 键集 = 旧六键 + 五判据,一个不多一个不少。"""
    msgs = _head_heavy_messages()
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    assert set(info) == LEGACY_INFO_KEYS | PRESSURE_KEYS
    assert isinstance(out, list)
    assert info["compressed"] is True
    assert info["trigger"] == "ratio"
    assert info["removed_count"] == 4


def test_compress_pressure_reports_post_compaction_state():
    """出口判据按返回给调用方的消息报(压缩后),不是入口的原始占用。"""
    msgs = _head_heavy_messages()
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    expected = round((1 - info["compressed_tokens"] / 1000) * 100, 2)
    assert info["percent_left"] == expected
    assert info["percent_left"] > round((1 - info["original_tokens"] / 1000) * 100, 2)


def test_compress_not_triggered_keeps_identity_and_legacy_values():
    """未触发分支:返回原列表对象,既有 info 取值与语义逐项不变。"""
    msgs = [{"role": "user", "content": "hello"} for _ in range(3)]
    out, info = compress_messages_if_needed(msgs, context_limit=1_000_000)
    assert out is msgs
    assert info["compressed"] is False
    assert info["trigger"] == "none"
    assert info["original_tokens"] == info["compressed_tokens"]
    assert info["removed_count"] == 0
    assert info["usage_ratio"] == info["original_tokens"] / 1_000_000
    assert set(info) == LEGACY_INFO_KEYS | PRESSURE_KEYS
    # 远未到任何阈值
    assert info["percent_left"] is not None
    assert info["percent_left"] > 99.0
    assert info["is_above_warning"] is False
    assert info["is_at_blocking"] is False


def test_compress_zero_limit_returns_undetermined_pressure():
    """limit<=0 分支:既有权值全 0 不变,新增 percent_left=None 未判定。"""
    msgs = [{"role": "user", "content": "x"}]
    out, info = compress_messages_if_needed(msgs, context_limit=0)
    assert out is msgs
    assert info["original_tokens"] == 0
    assert info["compressed_tokens"] == 0
    assert info["usage_ratio"] == 0
    assert info["percent_left"] is None
    assert info["is_at_blocking"] is False


def test_compress_blocking_branch_marks_blocking():
    """窗口仅 1 token 且无法切分:返回原消息,出口判据为 blocking。"""
    msgs = [{"role": "user", "content": "hello world"}]
    out, info = compress_messages_if_needed(msgs, context_limit=1)
    assert out is msgs
    assert info["percent_left"] == 0.0
    assert info["is_at_blocking"] is True
    assert info["is_above_auto_compact"] is True


def test_truncate_fallback_pressure_uses_compressed_tokens():
    """截断降级分支:判据同样按压缩后 tokens 报,且 legacy 六键齐全。"""
    msgs = (
        [{"role": "system", "content": "sys"}]
        + [{"role": "user", "content": "x" * 5000} for _ in range(6)]
        + [{"role": "user", "content": "y" * 40000}]
    )
    out, info = compress_messages_if_needed(msgs, context_limit=5000)
    assert info["trigger"] == "truncated"
    assert set(info) == LEGACY_INFO_KEYS | PRESSURE_KEYS
    expected = round((1 - info["compressed_tokens"] / 5000) * 100, 2)
    assert info["percent_left"] == max(0.0, min(100.0, expected))
    # 截断到 target 阈值(≈60%)以下 ⇒ 出口已回落到 warning 线内
    assert info["is_above_warning"] is False
    assert info["is_at_blocking"] is False


# =============================================================================
# 三、micro-compaction:tools_kept / tools_removed
# =============================================================================


def _long_tool_content() -> str:
    return "hello world " * 500  # 远大于 RECLAIM_MIN_RESULT_TOKENS(120)


def _three_rounds() -> list[dict[str, Any]]:
    """3 轮 assistant+tool;最近 1 轮应受保护,前 2 轮可回收。"""
    msgs: list[dict[str, Any]] = []
    for idx in range(3):
        msgs.append(
            {
                "role": "assistant",
                "content": f"step {idx}",
                "tool_calls": [
                    {
                        "id": f"call_{idx}",
                        "type": "function",
                        "function": {"name": "read_file", "arguments": "{}"},
                    }
                ],
            }
        )
        msgs.append(
            {"role": "tool", "tool_call_id": f"call_{idx}", "content": _long_tool_content()}
        )
    return msgs


def test_micro_compact_reclaims_old_tool_results():
    """旧 tool 结果被占位替换:条数不变、配对 id 保留、最近轮原样。"""
    msgs = _three_rounds()
    out, info = micro_compact_messages(msgs, keep_recent_rounds=1)
    assert info["compressed"] is True
    assert info["trigger"] == "micro"
    assert info["tools_kept"] == 1
    assert info["tools_removed"] == 2
    assert info["removed_count"] == 0  # 不删消息
    assert len(out) == len(msgs)
    # 前两轮 tool 结果被回收,最近一轮原样
    assert out[1]["content"] == MICRO_COMPACT_PLACEHOLDER
    assert out[3]["content"] == MICRO_COMPACT_PLACEHOLDER
    assert out[5]["content"] == msgs[5]["content"]
    # 配对字段保留,assistant 未被改写
    assert out[1]["tool_call_id"] == "call_0"
    assert out[2] == msgs[2]
    assert info["compressed_tokens"] < info["original_tokens"]


def test_micro_compact_does_not_mutate_input():
    """micro 只返回新列表,输入消息对象逐条不变。"""
    msgs = _three_rounds()
    before = [dict(m) for m in msgs]
    micro_compact_messages(msgs, keep_recent_rounds=1)
    assert msgs == before
    assert msgs[1]["content"] == _long_tool_content()


def test_micro_compact_protects_recent_rounds():
    """全部结果都在最近 N 轮内 ⇒ 一条不回收。"""
    msgs = _three_rounds()
    out, info = micro_compact_messages(msgs, keep_recent_rounds=10)
    assert out is msgs
    assert info["compressed"] is False
    assert info["trigger"] == "none"
    assert info["tools_kept"] == 3
    assert info["tools_removed"] == 0


def test_micro_compact_skips_short_results():
    """短工具结果(< min_result_tokens)不值得改写。"""
    msgs = [
        {"role": "assistant", "content": "a"},
        {"role": "tool", "tool_call_id": "c1", "content": "ok"},
        {"role": "assistant", "content": "b"},
        {"role": "tool", "tool_call_id": "c2", "content": "fine"},
        {"role": "assistant", "content": "c"},
        {"role": "tool", "tool_call_id": "c3", "content": _long_tool_content()},
    ]
    out, info = micro_compact_messages(msgs, keep_recent_rounds=1)
    assert out is msgs
    assert info["tools_kept"] == 3
    assert info["tools_removed"] == 0


def test_micro_compact_requires_min_saved_tokens():
    """总节省低于 min_saved_tokens ⇒ 整批不落(不白破前缀缓存)。"""
    msgs = _three_rounds()
    out, info = micro_compact_messages(
        msgs, keep_recent_rounds=1, min_saved_tokens=10**9
    )
    assert out is msgs
    assert info["compressed"] is False
    assert info["tools_kept"] == 3
    assert info["tools_removed"] == 0


def test_micro_compact_attaches_pressure_when_limit_given():
    """传了窗口大小才报判据;不传记 None(未判定),不拿 0 冒充。"""
    msgs = _three_rounds()
    _, no_limit = micro_compact_messages(msgs, keep_recent_rounds=1)
    assert no_limit["percent_left"] is None
    _, with_limit = micro_compact_messages(msgs, keep_recent_rounds=1, context_limit=100000)
    assert with_limit["percent_left"] is not None
    assert with_limit["is_at_blocking"] is False


# =============================================================================
# 四、指标:并进 compaction_metrics 既有维度
# =============================================================================


@pytest.fixture(autouse=True)
def _reset_metrics():
    """进程内存储隔离(与既有 test_compaction_metrics 同法)。"""
    cm.reset_compaction_metrics()
    yield
    cm.reset_compaction_metrics()


def _prom_count(name: str, labels: dict[str, str]) -> float:
    return float(REGISTRY.get_sample_value(name, labels) or 0.0)


def test_record_micro_event_carries_tool_counts():
    """micro info 进既有事件:metric dict 带计数,report.tools 与 by_trigger 同源聚合。"""
    msgs = _three_rounds()
    _, info = micro_compact_messages(msgs, keep_recent_rounds=1)
    metric = cm.record_compaction_event(session_id="s1", info=info, source="micro")
    assert metric["trigger"] == "micro"
    assert metric["tools_kept"] == 1
    assert metric["tools_removed"] == 2
    report = cm.get_compaction_metrics_report()
    assert report["tools"] == {"events": 1, "kept": 1, "removed": 2}
    assert report["by_trigger"]["micro"] == 1
    assert report["events_total"] == 1


def test_record_micro_event_uses_existing_prometheus_dimension():
    """计数走既有 ihui_compaction_events_total 的 trigger 维度,不新建指标。"""
    labels = {"trigger": "micro", "llm_summary": "False"}
    before = _prom_count("ihui_compaction_events_total", labels)
    cm.record_compaction_event(
        session_id="s1",
        info={
            "compressed": True,
            "original_tokens": 4000,
            "compressed_tokens": 1500,
            "trigger": "micro",
            "tools_kept": 1,
            "tools_removed": 2,
        },
    )
    assert _prom_count("ihui_compaction_events_total", labels) == before + 1
    # 没有第二套 micro 专用计数器
    assert REGISTRY.get_sample_value("ihui_micro_compaction_tools_total") is None


def test_legacy_event_has_no_tool_dimension():
    """legacy 压缩事件不带该维度 ⇒ metric 记 None,report 不计入(tools.events=0)。"""
    metric = cm.record_compaction_event(
        session_id="s1",
        info={
            "compressed": True,
            "original_tokens": 10000,
            "compressed_tokens": 6000,
            "trigger": "ratio",
        },
    )
    assert metric["tools_kept"] is None
    assert metric["tools_removed"] is None
    report = cm.get_compaction_metrics_report()
    assert report["tools"] == {"events": 0, "kept": 0, "removed": 0}


def test_zero_tool_counts_are_valid_readings():
    """tools_kept=0 是有效读数(该事件确实 0 件工具),不是「缺维度」。"""
    metric = cm.record_compaction_event(
        session_id="s1",
        info={
            "compressed": False,
            "original_tokens": 100,
            "compressed_tokens": 100,
            "trigger": "none",
            "tools_kept": 0,
            "tools_removed": 0,
        },
    )
    assert metric["tools_kept"] == 0
    assert metric["tools_removed"] == 0
    assert cm.get_compaction_metrics_report()["tools"]["events"] == 1


def test_micro_compact_token_accounting_matches_estimator():
    """micro 前后 token 读数与公共估算器一致(计数不是另算的一套)。"""
    msgs = _three_rounds()
    out, info = micro_compact_messages(msgs, keep_recent_rounds=1)
    assert info["original_tokens"] == estimate_messages_tokens(msgs)
    assert info["compressed_tokens"] == estimate_messages_tokens(out)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
