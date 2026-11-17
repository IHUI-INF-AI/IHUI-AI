# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""model_reroute_reason 测试（R26）——模型重路由事件契约。

含反向变异：reason 值域漂移 / 优先级链误序 / 三元素载荷字段名漂移，均须转红。
"""

from __future__ import annotations

import dataclasses

import pytest

from app.core.model_reroute_reason import (
    RerouteReason,
    build_reroute_event,
    classify_reroute_reason,
    event_to_dict,
)


# --- reason 封闭集 ------------------------------------------------------------
def test_reason_closed_set():
    """reason 值域逐字对照协议层 ModelRerouteEvent.reason 观察形态。"""
    assert {r.value for r in RerouteReason} == {
        "servererror",
        "provider",
        "agent",
        "user_shell",
        "sync",
        "async",
        "unknown",
    }


# --- classify 优先级链 --------------------------------------------------------
def test_user_shell_highest_priority():
    """user_shell 最优先（人意志 > 环境）。"""
    assert classify_reroute_reason(
        is_user_shell=True, is_agent_degrade=True, is_server_error=True
    ) is RerouteReason.USER_SHELL


def test_agent_over_server_error():
    """agent 主动降级优先于 servererror。"""
    assert classify_reroute_reason(
        is_agent_degrade=True, is_server_error=True
    ) is RerouteReason.AGENT


def test_server_error_over_provider():
    """servererror 优先于 provider 故障。"""
    assert classify_reroute_reason(
        is_server_error=True, is_provider_failure=True
    ) is RerouteReason.SERVERERROR


def test_provider_when_only_provider():
    """仅 provider 故障 ⇒ PROVIDER。"""
    assert classify_reroute_reason(is_provider_failure=True) is RerouteReason.PROVIDER


def test_sync_path():
    """call_path='sync' ⇒ SYNC。"""
    assert classify_reroute_reason(call_path="sync") is RerouteReason.SYNC


def test_async_path():
    """call_path='async' ⇒ ASYNC。"""
    assert classify_reroute_reason(call_path="async") is RerouteReason.ASYNC


def test_unknown_fallback():
    """无任何触发源 ⇒ UNKNOWN 兜底。"""
    assert classify_reroute_reason() is RerouteReason.UNKNOWN


def test_invalid_call_path_ignored():
    """call_path 非法值被忽略（防误用）⇒ 落 unknown。"""
    assert classify_reroute_reason(call_path="weird") is RerouteReason.UNKNOWN


# --- build + 序列化 -----------------------------------------------------------
def test_build_event_basic():
    """基本构造：from_model/to_model/reason 三元素。"""
    ev = build_reroute_event("gpt-4o", "glm-4.7-flash", RerouteReason.SERVERERROR)
    assert ev.from_model == "gpt-4o"
    assert ev.to_model == "glm-4.7-flash"
    assert ev.reason is RerouteReason.SERVERERROR


def test_build_event_from_none():
    """from_model=None（默认模型改道）。"""
    ev = build_reroute_event(None, "glm-4.7-flash", RerouteReason.SYNC)
    assert ev.from_model is None
    assert ev.to_model == "glm-4.7-flash"


def test_build_event_empty_target_falls_back():
    """to_model 空串归一化为 from_model（防无目标改道）。"""
    ev = build_reroute_event("gpt-4o", "", RerouteReason.AGENT)
    assert ev.to_model == "gpt-4o"


def test_event_dict_field_names():
    """序列化字段名逐字对照 from_model/to_model/reason。"""
    ev = build_reroute_event("gpt-4o", "glm-4.7-flash", RerouteReason.PROVIDER)
    d = event_to_dict(ev)
    assert set(d) == {"from_model", "to_model", "reason"}
    assert d["from_model"] == "gpt-4o"
    assert d["to_model"] == "glm-4.7-flash"
    assert d["reason"] == "provider"


def test_event_is_frozen():
    """事件不可变（frozen dataclass）。"""
    ev = build_reroute_event("a", "b", RerouteReason.SYNC)
    with pytest.raises(dataclasses.FrozenInstanceError):
        ev.reason = RerouteReason.ASYNC  # type: ignore[misc]


# --- 反向变异 -----------------------------------------------------------------
def test_reverse_priority_confusion():
    """反向变异：agent 与 servererror 优先级混淆须转红。"""
    # 本实现 agent 优先于 servererror；若混淆，此断言转红。
    assert classify_reroute_reason(
        is_agent_degrade=True, is_server_error=True
    ) is not RerouteReason.SERVERERROR


def test_reverse_unknown_not_defaulted():
    """反向变异：无触发源若误判为 sync（而非 unknown）须转红。"""
    assert classify_reroute_reason() is not RerouteReason.SYNC


def test_reason_no_overlap_with_fallback_reason():
    """reason 值域与 classify_fallback_reason 的异常标签轴不重叠（两轴互补）。"""
    # 本仓 classify_fallback_reason 值域：timeout/rate_limit/api_error/quota/unknown。
    # 本模块 reason 是重路由触发源轴，servererror/provider 等不属异常分类。
    reroute_vals = {r.value for r in RerouteReason}
    fallback_vals = {"timeout", "rate_limit", "api_error", "quota"}
    assert "servererror" not in fallback_vals
    assert reroute_vals & fallback_vals == set()  # 两轴值域零交集（unknown 除外已在 reroute）
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
