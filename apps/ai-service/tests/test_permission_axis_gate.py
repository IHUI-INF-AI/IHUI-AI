# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""79 号票第二刀:权限双轴消费面接线的验收(2026-10-18 立)。

钉的是三件事,方向两两相反,缺一即只是把功能改坏了:

1. **收紧方向**:read-only 轴 + 写类工具 ⇒ FORBID(不是弹审批,是结构性拒绝);
   untrusted 审批轴 + 外联 ⇒ REQUIRE_APPROVAL(抬升)。
2. **不放宽方向(本票最关键的一条)**:approval_policy=never 到达裁决器时
   **不产生免审批**,danger-full-access 也不产生放行 —— 双轴是外部输入,
   若它的放行能压过既有审批链,客户端多带两个字段就等于关掉审批门。
   断言形态:never + 写类工具 ⇒ ALLOW(不介入),交既有链路照旧判定。
3. **零变化方向**:不带双轴(现网所有调用方的现状)⇒ resolve 返回 None、
   裁决为 ALLOW ⇒ 调用方整段跳过,行为与接线前逐字节相同。

另有三条"判据有牙 / fail-closed"的锁:
- 把裁决器换成恒 ALLOW ⇒ FORBID 必须消失(证明拦下来的是这个出口);
- Legacy 映射为 null 的两档(acceptEdits / manual)**不得**回退到预设 ⇒ None;
- config profile 里"给了但认不出"⇒ None(不静默补默认),而"没给"⇒ 补默认。

隔离:纯函数模块,无 IO、无 DB、无网络。
"""

from __future__ import annotations

import pytest

from app.core.permission_axis_gate import (
    AxisDecision,
    AxisSource,
    axis_dims_from_mcp_annotations,
    axis_gate_decision,
    axis_gate_hint,
    resolve_axis_resolution,
)


# =============================================================================
# 1. 解析:来源与 fail-closed
# =============================================================================


def test_explicit_axis_leaves_unspecified_axis_empty():
    """只给一个轴 ⇒ 另一个轴为 None(未指定),**绝不补默认档**。

    这条是 2026-10-18 实测订正的落点:补 read-only 默认会把"只声明审批轴"的
    请求读成"禁止一切写操作"(方向相反的失真,且用户看不出来)。
    """
    res = resolve_axis_resolution(sandbox_mode="read-only")
    assert res is not None
    assert res.sandbox_mode == "read-only"
    assert res.approval_policy is None
    assert res.source == AxisSource.EXPLICIT


def test_unspecified_sandbox_does_not_forbid_writes():
    """沙箱轴未指定 ⇒ 不因它禁止写操作(未指定 = 该轴无发言权)。"""
    res = resolve_axis_resolution(approval_policy="on-request")
    assert res.sandbox_mode is None
    assert axis_gate_decision(res, writes=True, network=False) == AxisDecision.ALLOW


def test_explicit_axis_unknown_value_is_failure():
    """半边认不出 ⇒ 整段 None:半个双轴不算双轴,拿默认值冒充用户选择是失真。"""
    assert resolve_axis_resolution(sandbox_mode="read-only", approval_policy="nope") is None
    assert resolve_axis_resolution(sandbox_mode="totally-wrong") is None


def test_preset_source():
    res = resolve_axis_resolution(preset="fullAccess")
    assert res is not None
    assert (res.sandbox_mode, res.approval_policy) == ("danger-full-access", "never")
    assert res.source == AxisSource.PRESET
    assert resolve_axis_resolution(preset="no-such-preset") is None


def test_config_profile_missing_vs_unknown():
    """没给 ⇒ 该轴 None(未指定);给了但认不出 ⇒ 整段 None。两件事必须分开。"""
    ok = resolve_axis_resolution(profile={"sandbox_mode": "workspace-write"})
    assert ok is not None
    assert ok.sandbox_mode == "workspace-write"
    assert ok.approval_policy is None
    assert resolve_axis_resolution(profile={"sandbox_mode": "nope"}) is None
    # 空档案 = 两轴都未指定 ⇒ 解析成功但无轴可发言
    empty = resolve_axis_resolution(profile={})
    assert empty is not None
    assert (empty.sandbox_mode, empty.approval_policy) == (None, None)


def test_legacy_mode_mapped_and_unmapped():
    mapped = resolve_axis_resolution(permission_mode="plan")
    assert mapped is not None
    assert (mapped.sandbox_mode, mapped.approval_policy) == ("read-only", "on-request")
    assert mapped.source == AxisSource.LEGACY_MODE
    # acceptEdits / manual 在契约层显式为 None ⇒ 不回退到任一预设
    assert resolve_axis_resolution(permission_mode="acceptEdits") is None
    assert resolve_axis_resolution(permission_mode="manual") is None


def test_no_axis_input_returns_none():
    """现网调用方一个双轴字段都不带 ⇒ None(调用方整段跳过 ⇒ 零行为变化)。"""
    assert resolve_axis_resolution() is None


# =============================================================================
# 2. 裁决:收紧
# =============================================================================


def test_read_only_forbids_write_and_network():
    res = resolve_axis_resolution(sandbox_mode="read-only")
    assert axis_gate_decision(res, writes=True, network=False) == AxisDecision.FORBID
    assert axis_gate_decision(res, writes=False, network=True) == AxisDecision.FORBID


def test_read_only_allows_pure_read():
    """明确只读工具(两维都已知且为假)⇒ 不介入。否则本门只是在削功能。"""
    res = resolve_axis_resolution(sandbox_mode="read-only")
    assert axis_gate_decision(res, writes=False, network=False) == AxisDecision.ALLOW


def test_unknown_dimension_escalates_not_passes():
    """维度未知 ⇒ 抬升为需批,绝不因元数据缺失放行(保守语义同 MCP 注解门)。"""
    res = resolve_axis_resolution(sandbox_mode="read-only")
    assert axis_gate_decision(res, writes=None, network=False) == AxisDecision.REQUIRE_APPROVAL
    res2 = resolve_axis_resolution(approval_policy="untrusted")
    assert axis_gate_decision(res2, writes=False, network=None) == AxisDecision.REQUIRE_APPROVAL


def test_workspace_write_escalates_network_only():
    res = resolve_axis_resolution(sandbox_mode="workspace-write")
    assert axis_gate_decision(res, writes=False, network=True) == AxisDecision.REQUIRE_APPROVAL
    assert axis_gate_decision(res, writes=True, network=False) == AxisDecision.ALLOW


# =============================================================================
# 3. 裁决:不放宽(本票最关键的一条)
# =============================================================================


def test_never_does_not_widen():
    """never 到达本裁决器 ⇒ ALLOW(不介入),绝不产出"免审批"。"""
    res = resolve_axis_resolution(approval_policy="never")
    assert axis_gate_decision(res, writes=True, network=True) == AxisDecision.ALLOW


def test_danger_full_access_does_not_widen():
    res = resolve_axis_resolution(sandbox_mode="danger-full-access", approval_policy="never")
    assert axis_gate_decision(res, writes=True, network=True) == AxisDecision.ALLOW


def test_no_axis_is_allow():
    assert axis_gate_decision(None, writes=True, network=True) == AxisDecision.ALLOW


# =============================================================================
# 4. 判据有牙 + 留痕
# =============================================================================


def test_gate_has_teeth():
    """把裁决器换成恒 ALLOW ⇒ 拦截必须消失(证明拦下的是这个出口,不是别的巧合)。"""
    res = resolve_axis_resolution(sandbox_mode="read-only")

    def always_allow(_res, *, writes, network):
        return AxisDecision.ALLOW

    assert axis_gate_decision(res, writes=True, network=False) == AxisDecision.FORBID
    assert always_allow(res, writes=True, network=False) != AxisDecision.FORBID


def test_hint_records_source():
    res = resolve_axis_resolution(sandbox_mode="read-only")
    key, text = axis_gate_hint(res, AxisDecision.FORBID)
    assert key == "axis_sandbox_forbid"
    assert "read-only" in text
    assert axis_gate_hint(res, AxisDecision.ALLOW) is None
    assert axis_gate_hint(None, AxisDecision.FORBID) is None


def test_annotation_dims_mapping():
    """MCP 三 hint → (writes, network) 两维;缺/非布尔 ⇒ 未知(None)。"""
    assert axis_dims_from_mcp_annotations(None) == (None, None)
    assert axis_dims_from_mcp_annotations({}) == (None, None)
    assert axis_dims_from_mcp_annotations({"read_only_hint": True, "open_world_hint": False}) == (
        False,
        False,
    )
    assert axis_dims_from_mcp_annotations({"read_only_hint": False}) == (True, None)
    # destructive_hint 刻意不参与本推导(它与联网正交,且既有保守门已单独用它判必批)
    assert axis_dims_from_mcp_annotations({"read_only_hint": True, "destructive_hint": True}) == (
        False,
        None,
    )
    # 非布尔(字符串/数字)一律按未知处理,不猜
    assert axis_dims_from_mcp_annotations({"read_only_hint": "yes"}) == (None, None)


def test_all_members_are_reachable():
    """三态必须各自有至少一个输入能触达 —— 枚举里躺着永不产出的值是设计缺陷。"""
    read_only = resolve_axis_resolution(sandbox_mode="read-only")
    untrusted = resolve_axis_resolution(approval_policy="untrusted")
    reached = {
        AxisDecision.FORBID: axis_gate_decision(read_only, writes=True, network=False),
        AxisDecision.REQUIRE_APPROVAL: axis_gate_decision(untrusted, writes=True, network=False),
        AxisDecision.ALLOW: axis_gate_decision(read_only, writes=False, network=False),
    }
    for want, got in reached.items():
        assert got == want
    assert len(set(reached.values())) == 3
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
