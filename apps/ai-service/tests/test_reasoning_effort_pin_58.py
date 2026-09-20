# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:placeholder
"""reasoning_effort_pin 测试(批58十二,对标 codex reasoning_effort_tests.rs)。"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.core.reasoning_effort_pin import (  # noqa: E402
    ReasoningEffortPin,
    RequestEffortUsage,
)


def _make(enabled: bool = True, models: tuple[str, ...] = ("gpt-5",)) -> ReasoningEffortPin:
    return ReasoningEffortPin(
        override_enabled=enabled,
        allowed_models=frozenset(models),
    )


# --- 三态状态机:get/pin 粘滞/退役 ---


def test_get_unset_and_compacted_and_model_mismatch_return_none():
    s = _make().state
    assert s.get("gpt-5") is None  # Unset
    s.pin("gpt-5", "medium")
    s.retire_to_compacted()
    assert s.get("gpt-5") is None  # Compacted
    s2 = _make().state
    s2.pin("gpt-5", "medium")
    assert s2.get("other") is None  # 异模型 Active


def test_pin_sticky_same_model():
    s = _make().state
    assert s.pin("gpt-5", "medium") == "medium"
    assert s.pin("gpt-5", "high") == "medium"  # 已钉不覆盖


def test_pin_establishes_after_compacted():
    s = _make().state
    s.pin("gpt-5", "medium")
    s.retire_to_compacted()
    assert s.pin("gpt-5", "high") == "high"  # Compacted 允许重建
    assert not s.compacted


def test_reset_unset_clears_all():
    s = _make().state
    s.pin("gpt-5", "low")
    s.reset_unset()
    assert s.get("gpt-5") is None and not s.compacted


# --- 请求档位解析(codex reasoning_effort_for_request 逐分支) ---


def test_override_disabled_passthrough():
    p = _make(enabled=False)
    assert (
        p.reasoning_effort_for_request("gpt-5", "high", RequestEffortUsage.SAMPLING) == "high"
    )
    assert p.state.get("gpt-5") is None


def test_compaction_pin_hit_wins_and_does_not_mutate():
    p = _make()
    p.state.pin("gpt-5", "low")
    # fallback 模型压缩请求:钉扎异模型未命中 → 返回解析档位
    assert (
        p.reasoning_effort_for_request("fallback", "medium", RequestEffortUsage.COMPACTION)
        == "medium"
    )
    assert p.state.get("gpt-5") == "low"  # 活钉扎未被 fallback 改动
    # 同模型压缩请求:钉扎命中优先于新选定档位
    assert (
        p.reasoning_effort_for_request("gpt-5", "high", RequestEffortUsage.COMPACTION) == "low"
    )


def test_compaction_without_pin_returns_effort_without_state_write():
    p = _make()
    assert (
        p.reasoning_effort_for_request("gpt-5", "high", RequestEffortUsage.COMPACTION) == "high"
    )
    assert p.state.get("gpt-5") is None  # Compaction 永不写状态


def test_sampling_without_effort_resets_pin():
    p = _make()
    p.state.pin("gpt-5", "low")
    assert p.reasoning_effort_for_request("gpt-5", None, RequestEffortUsage.SAMPLING) is None
    assert p.state.get("gpt-5") is None  # Unset


def test_sampling_establishes_pin():
    p = _make()
    assert p.reasoning_effort_for_request("gpt-5", "high", RequestEffortUsage.SAMPLING) == "high"
    assert p.state.get("gpt-5") == "high"


# --- 有效档位三道门(effort_for_configuration_update) ---


def test_gates_model_whitelist_and_unknown_effort():
    p = _make(models=("gpt-5",))
    assert p.effort_for_configuration_update("other", "high") is None  # 模型门
    assert p.effort_for_configuration_update("gpt-5", "custom-x") is None  # 已知模式门
    assert p.effort_for_configuration_update("gpt-5", None) is None  # 无档位
    assert p.effort_for_configuration_update("gpt-5", "minimal") == "minimal"


# --- 覆盖项记录判定(record_reasoning_effort_override) ---


def test_record_skip_when_tail_override_matches():
    p = _make()
    # 尾项 index==0 且档位一致 → 跳过(恢复重放复用)
    assert p.record_reasoning_effort_override("gpt-5", "high", (0, "high")) is None
    assert p.state.get("gpt-5") is None


def test_record_appends_when_tail_differs():
    p = _make()
    effort = p.record_reasoning_effort_override("gpt-5", "high", (2, "low"))
    assert effort == "high"
    assert p.state.get("gpt-5") == "high"


def test_record_compacted_allows_repin_without_update():
    p = _make()
    p.state.pin("gpt-5", "low")
    p.retire_on_compaction()
    # Compacted:重钉返回 None(无新增覆盖项),但钉扎已重建
    assert p.record_reasoning_effort_override("gpt-5", "high", None) is None
    assert p.state.get("gpt-5") == "high"


def test_record_none_when_gates_fail():
    p = _make(models=("gpt-5",))
    assert p.record_reasoning_effort_override("other", "high", None) is None
    assert p.state.get("other") is None


# --- 官方测试语义等价(两用例移植) ---


def test_initial_replay_preserves_prewarmed_effort():
    """官方用例:prewarm 先钉 medium,恢复历史后换 high 请求仍返回 medium。"""
    p = _make()
    # prewarm(Sampling)建立钉扎
    assert p.reasoning_effort_for_request("gpt-5", "medium", RequestEffortUsage.SAMPLING) == "medium"
    # 恢复/换档请求:钉扎粘滞胜出
    assert p.reasoning_effort_for_request("gpt-5", "high", RequestEffortUsage.SAMPLING) == "medium"


def test_compaction_effort_lookup_preserves_pin_for_fallback_models():
    """官方用例:fallback 模型压缩查找不改活钉扎(钉 original=low,查 fallback)。"""
    p = _make()
    p.state.pin("original", "low")
    # fallback 模型压缩请求:钉扎未命中(fallback 不在白名单)→ 解析档位 medium
    assert (
        p.reasoning_effort_for_request("fallback", "medium", RequestEffortUsage.COMPACTION)
        == "medium"
    )
    assert p.state.get("original") == "low"


# --- 模块级便捷入口 ---


def test_module_level_entry_accepts_string_usage():
    p = _make()
    from app.core.reasoning_effort_pin import reasoning_effort_for_request as rfr

    assert rfr(p, "gpt-5", "high", "sampling") == "high"
    assert p.state.get("gpt-5") == "high"
    assert rfr(p, "gpt-5", "low", "compaction") == "high"  # 钉扎命中
