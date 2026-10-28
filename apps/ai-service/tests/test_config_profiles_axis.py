# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""79 号票遗留格:config profiles 读取面 + 双轴接线(2026-10-25)。

三格验收逐条对应:
① 从 config_profiles 取到自定义轴配置 ⇒ 生效(source=config_profile);
② 取不到 / 为空 / 档位不存在 ⇒ 回退"不介入"(None,拒绝默认档冒充);
③ 非法值(坏文本 / 认不出的轴值)⇒ 不崩、回落 None。
"""

from __future__ import annotations

import pytest

from app.core.config import settings
from app.core.config_profiles import (
    configured_axis_resolution,
    load_config_profiles,
    resolve_profile_axis,
    select_profile,
)
from app.core.permission_axis_gate import AxisSource


def _set_profiles(monkeypatch: pytest.MonkeyPatch, raw: str, selected: str = "") -> None:
    """替换 Settings 上的两个配置源(本票唯一来源,不碰 env/DB)。"""
    monkeypatch.setattr(settings, "config_profiles", raw)
    monkeypatch.setattr(settings, "config_profile", selected)


# ---------------------------------------------------------------------------
# ① 自定义档案生效
# ---------------------------------------------------------------------------


def test_custom_profile_axis_takes_effect(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_profiles(
        monkeypatch,
        '{"profile": "review", "profiles": {"review": '
        '{"sandbox_mode": "workspace-write", "approval_policy": "on-request", '
        '"model": "any"}}}',
    )

    res = configured_axis_resolution()

    assert res is not None
    assert res.source is AxisSource.CONFIG_PROFILE
    assert res.profile_name == "review"
    assert (res.sandbox_mode, res.approval_policy) == ("workspace-write", "on-request")


def test_toml_document_and_aliases_are_normalized(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_profiles(
        monkeypatch,
        'profile = "review"\n[profiles.review]\nsandbox_mode = "readonly"\n'
        'approval_policy = "unless-trusted"\n',
    )

    res = configured_axis_resolution()

    assert res is not None
    assert (res.sandbox_mode, res.approval_policy) == ("read-only", "untrusted")


def test_config_profile_setting_overrides_document_profile(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_profiles(
        monkeypatch,
        '{"profile": "a", "profiles": {'
        '"a": {"sandbox_mode": "read-only"}, '
        '"b": {"sandbox_mode": "danger-full-access"}}}',
        selected="b",
    )

    res = configured_axis_resolution()

    assert res is not None
    assert res.profile_name == "b"
    assert res.sandbox_mode == "danger-full-access"


def test_partial_profile_keeps_other_axis_unspecified(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_profiles(
        monkeypatch,
        '{"profile": "only-approval", "profiles": {"only-approval": '
        '{"approval_policy": "untrusted"}}}',
    )

    res = configured_axis_resolution()

    assert res is not None
    assert res.sandbox_mode is None
    assert res.approval_policy == "untrusted"


# ---------------------------------------------------------------------------
# ② 取不到 / 为空 / 档位不存在 ⇒ 回退不介入
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "   ",
        "{}",
        '{"profiles": {}}',
        '[profiles.other]\nsandbox_mode = "read-only"\n',
    ],
)
def test_absent_or_empty_profiles_fall_back_to_no_axis(
    monkeypatch: pytest.MonkeyPatch, raw: str
) -> None:
    _set_profiles(monkeypatch, raw)

    assert configured_axis_resolution() is None


def test_unknown_selected_profile_falls_back_to_no_axis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_profiles(
        monkeypatch,
        '{"profiles": {"review": {"sandbox_mode": "read-only"}}}',
        selected="missing",
    )

    assert configured_axis_resolution() is None


def test_profile_without_axis_keys_is_not_a_resolution(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_profiles(
        monkeypatch,
        '{"profile": "model-only", "profiles": {"model-only": {"model": "x"}}}',
    )

    assert configured_axis_resolution() is None


def test_select_profile_returns_none_without_config() -> None:
    config = load_config_profiles("")
    assert config.profiles == {}
    assert select_profile(config) is None
    assert resolve_profile_axis(config) is None


# ---------------------------------------------------------------------------
# ③ 非法值 ⇒ 不崩 + 回落默认(不介入)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw",
    [
        "{not json",
        "[profiles.broken\n",  # 缺闭合括号的 TOML
        '{"profiles": "not-a-table"}',
        '{"profile": "bad", "profiles": {"bad": {"sandbox_mode": "root"}}}',
        '{"profile": "bad", "profiles": {"bad": {"approval_policy": "always"}}}',
        '{"profile": "bad", "profiles": {"bad": {"sandbox_mode": ""}}}',
    ],
)
def test_invalid_profiles_fall_back_without_raising(
    monkeypatch: pytest.MonkeyPatch, raw: str
) -> None:
    _set_profiles(monkeypatch, raw)

    assert configured_axis_resolution() is None


def test_non_mapping_profile_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_profiles(
        monkeypatch,
        '{"profile": "bad", "profiles": {"bad": "read-only"}}',
    )

    assert configured_axis_resolution() is None


# ---------------------------------------------------------------------------
# 接线:wire 显式双轴仍优先;config profiles 只在 wire 未携带双轴时接管
# ---------------------------------------------------------------------------


def test_router_reads_profiles_only_when_wire_axes_absent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.routers.agents import _resolved_axis_resolution

    _set_profiles(
        monkeypatch,
        '{"profile": "review", "profiles": {"review": '
        '{"sandbox_mode": "read-only", "approval_policy": "never"}}}',
    )

    from_profile = _resolved_axis_resolution(None, None, None)
    assert from_profile is not None
    assert from_profile.source is AxisSource.CONFIG_PROFILE
    assert (from_profile.sandbox_mode, from_profile.approval_policy) == (
        "read-only",
        "never",
    )

    explicit = _resolved_axis_resolution("danger-full-access", None, None)
    assert explicit is not None
    assert explicit.source is AxisSource.EXPLICIT
    assert explicit.sandbox_mode == "danger-full-access"


def test_router_does_not_400_on_broken_profile_config(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.routers.agents import _resolved_axis_resolution

    _set_profiles(monkeypatch, "{broken")

    assert _resolved_axis_resolution(None, None, None) is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
