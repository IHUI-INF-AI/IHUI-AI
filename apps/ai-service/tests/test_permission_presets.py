# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""权限预设纯函数 + 路由接线:默认目录、custom 推导、最小写入、非法选择。"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core.permission_axis import APPROVAL_PRESETS
from app.core.permission_axis_gate import AxisSource
from app.core.permission_presets import (
    DEFAULT_CATALOG,
    PresetCatalog,
    PresetEntry,
    PresetSelectionError,
    current_preset,
    switch_preset,
)
from app.routers.agents import (
    AgentExecuteRequest,
    _resolved_axis_resolution,
    list_permission_presets,
)


def test_default_catalog_mirrors_permission_axis() -> None:
    """默认目录的轴值必须逐字来自 APPROVAL_PRESETS,不另造第二份真源。"""
    names = [entry.name for entry in DEFAULT_CATALOG.entries]
    assert names == list(APPROVAL_PRESETS)
    for entry in DEFAULT_CATALOG.entries:
        assert (entry.sandbox_mode, entry.approval_policy) == APPROVAL_PRESETS[entry.name]
    assert DEFAULT_CATALOG.get("custom") is None
    assert DEFAULT_CATALOG.as_dict()["custom"]["selectable"] is False


def test_current_prefers_last_selection_over_first_match() -> None:
    """两条预设轴值相同时,最近一次记录选择胜出;没有记录才取目录第一条。"""
    catalog = PresetCatalog(
        entries=(
            PresetEntry("first", "read-only", "on-request"),
            PresetEntry("second", "read-only", "on-request"),
            PresetEntry("full", "danger-full-access", "never"),
        ),
        default_preset="first",
    )
    assert (
        current_preset(
            catalog,
            sandbox_mode="read-only",
            approval_policy="on-request",
            last_selected="second",
        )
        == "second"
    )
    assert (
        current_preset(
            catalog,
            sandbox_mode="read-only",
            approval_policy="on-request",
            last_selected=None,
        )
        == "first"
    )


def test_current_derives_custom_for_non_preset_combination() -> None:
    """任何不在目录里的组合只能是 custom;坏轴同样不猜预设。"""
    assert (
        current_preset(
            DEFAULT_CATALOG,
            sandbox_mode="workspace-write",
            approval_policy="never",
        )
        == "custom"
    )
    assert (
        current_preset(
            DEFAULT_CATALOG,
            sandbox_mode="not-a-mode",
            approval_policy="on-request",
        )
        == "custom"
    )


def test_switch_reports_only_changed_axes() -> None:
    """切换只返回真正变化的轴;同档重选是 no-op,不产生假变更。"""
    changed = switch_preset(
        DEFAULT_CATALOG,
        "readOnly",
        current_sandbox_mode="danger-full-access",
        current_approval_policy="never",
    )
    assert changed.changed_axes == ("sandbox", "approval")
    assert not changed.no_op

    same_sandbox = switch_preset(
        DEFAULT_CATALOG,
        "fullAccess",
        current_sandbox_mode="danger-full-access",
        current_approval_policy="on-request",
    )
    assert same_sandbox.changed_axes == ("approval",)

    noop = switch_preset(
        DEFAULT_CATALOG,
        "fullAccess",
        current_sandbox_mode="danger-full-access",
        current_approval_policy="never",
    )
    assert noop.no_op is True
    assert noop.as_dict()["changedAxes"] == []


def test_switch_rejects_custom_and_unknown() -> None:
    """custom 只能推导,不能作为目标;未知名也不静默折成默认档。"""
    for name in ("custom", "nope"):
        with pytest.raises(PresetSelectionError):
            switch_preset(
                DEFAULT_CATALOG,
                name,
                current_sandbox_mode="read-only",
                current_approval_policy="on-request",
            )


def test_catalog_rejects_duplicate_names_and_bad_default() -> None:
    with pytest.raises(PresetSelectionError, match="重名"):
        PresetCatalog(
            entries=(PresetEntry("x", "read-only", "never"), PresetEntry("x", "read-only", "never")),
            default_preset="x",
        )
    with pytest.raises(PresetSelectionError, match="默认预设"):
        PresetCatalog(entries=(PresetEntry("x", "read-only", "never"),), default_preset="y")


def test_agent_request_accepts_permission_preset_and_resolves_axes() -> None:
    """请求模型真的接住了字段,解析出口真的走 PRESET 来源。"""
    req = AgentExecuteRequest(goal="hi", permission_preset="fullAccess")
    res = _resolved_axis_resolution(
        req.sandbox_mode,
        req.approval_policy,
        req.permission_mode,
        permission_preset=req.permission_preset,
    )
    assert res is not None
    assert res.source == AxisSource.PRESET
    assert res.sandbox_mode == "danger-full-access"
    assert res.approval_policy == "never"


def test_preset_conflicts_with_explicit_axis_and_rejects_custom() -> None:
    """preset 与显式双轴同给、或试图选中 custom,都必须 400。"""
    with pytest.raises(HTTPException) as exc:
        _resolved_axis_resolution(
            "read-only", None, None, permission_preset="fullAccess"
        )
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc2:
        _resolved_axis_resolution(None, None, None, permission_preset="custom")
    assert exc2.value.status_code == 400


@pytest.mark.asyncio
async def test_catalog_endpoint_shape() -> None:
    """目录端点返回可选预设、默认项与仅展示的 custom。"""
    result = await list_permission_presets(current_user="u1")
    data = result["data"]
    assert [p["name"] for p in data["presets"]] == ["readOnly", "auto", "fullAccess"]
    assert data["defaultPreset"] == "auto"
    assert data["custom"]["selectable"] is False


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
