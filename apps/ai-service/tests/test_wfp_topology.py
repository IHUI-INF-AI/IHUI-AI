# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""wfp_topology 单测 — 钉住 Codex WFP 隔离拓扑纯逻辑行为。"""

from __future__ import annotations

import pytest

from app.services.wfp_topology import (
    ALE_LAYER_GUIDS,
    CODEX_PROVIDER_GUID,
    CODEX_SUBLAYER_GUID,
    REVERSE_ENGINEERED_LAYER_GUID,
    FilterAction,
    WfpFilter,
    action_of,
    filter_matches_codex,
    guid_from_str,
    guid_to_str,
    is_standard_well_known_layer,
    layer_name_of,
    reconcile_reverse_prediction,
)


def _codex_filter(layer: str, action: FilterAction = FilterAction.BLOCK, name: str = "f") -> WfpFilter:
    return WfpFilter(
        name=name,
        filter_key="AAAAAA00-0000-0000-0000-000000000000",
        sublayer_key=CODEX_SUBLAYER_GUID,
        layer_key=layer,
        action=action,
        num_conditions=1,
    )


class TestGuid:
    def test_roundtrip_standard(self) -> None:
        g = guid_from_str(CODEX_PROVIDER_GUID)
        assert g == CODEX_PROVIDER_GUID.upper()

    def test_accepts_braces(self) -> None:
        assert guid_from_str("{2E31D31C-3948-4753-9117-E5D1A6496F41}") == CODEX_PROVIDER_GUID

    def test_accepts_lowercase(self) -> None:
        assert guid_from_str(CODEX_PROVIDER_GUID.lower()) == CODEX_PROVIDER_GUID

    @pytest.mark.parametrize("bad", ["", "nope", "2E31D31C-3948-4753-9117", "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"])
    def test_invalid_returns_none(self, bad: str) -> None:
        assert guid_from_str(bad) is None

    def test_brace_format(self) -> None:
        out = guid_to_str(CODEX_SUBLAYER_GUID)
        assert out == "{E65054FD-4D32-4C7C-95EF-621F0CF6431A}"


class TestAction:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            (0x00000001, FilterAction.BLOCK),
            (0x00000002, FilterAction.PERMIT),
            (0x00000003, FilterAction.OTHER),
            (99, FilterAction.OTHER),
        ],
    )
    def test_action_of(self, raw: int, expected: FilterAction) -> None:
        assert action_of(raw) == expected

    def test_action_block_with_terminating_flag(self) -> None:
        # R11 实测: 真实 filter 的 action.type = 0x1001 (BLOCK | 终止标志)
        assert action_of(0x1001) == FilterAction.BLOCK

    def test_action_permit_with_terminating_flag(self) -> None:
        assert action_of(0x1002) == FilterAction.PERMIT


class TestLayerName:
    def test_known_ale_layer(self) -> None:
        v4 = next(g for g, n in ALE_LAYER_GUIDS.items() if n == "ALE_AUTH_CONNECT_V4")
        assert layer_name_of(v4) == "ALE_AUTH_CONNECT_V4"

    def test_reverse_layer_is_unknown_std(self) -> None:
        # 自定义 layer 不在 ALE 标准表 → UNKNOWN
        assert layer_name_of(REVERSE_ENGINEERED_LAYER_GUID) == "UNKNOWN"

    def test_invalid(self) -> None:
        assert layer_name_of("bad") == "UNKNOWN"


class TestCodexMembership:
    def test_codex_sublayer_matches(self) -> None:
        assert filter_matches_codex(_codex_filter(REVERSE_ENGINEERED_LAYER_GUID)) is True

    def test_other_sublayer_no_match(self) -> None:
        f = WfpFilter("x", "K", sublayer_key="00000000-0000-0000-0000-000000000000", layer_key=REVERSE_ENGINEERED_LAYER_GUID, action=FilterAction.BLOCK)
        assert filter_matches_codex(f) is False


class TestReconcilePrediction:
    def test_all_match_holds(self) -> None:
        filters = [_codex_filter(REVERSE_ENGINEERED_LAYER_GUID, name=f"n{i}") for i in range(12)]
        v = reconcile_reverse_prediction(filters)
        assert v.codex_filter_count == 12
        assert v.layer_match_count == 12
        assert v.prediction_holds is True
        assert "预测成立" in v.summary

    def test_none_match_fails(self) -> None:
        filters = [_codex_filter("1247d66d-0b60-4a15-8d44-7155d0f53a0c")]
        v = reconcile_reverse_prediction(filters)
        assert v.layer_match_count == 0
        assert v.prediction_holds is False
        assert "重审" in v.summary

    def test_partial_match(self) -> None:
        filters = [
            _codex_filter(REVERSE_ENGINEERED_LAYER_GUID, name="a"),
            _codex_filter("1247d66d-0b60-4a15-8d44-7155d0f53a0c", name="b"),
        ]
        v = reconcile_reverse_prediction(filters)
        assert v.layer_match_count == 1
        assert v.codex_filter_count == 2
        assert v.prediction_holds is False
        assert "部分匹配" in v.summary

    def test_ignores_non_codex_filters(self) -> None:
        # 非 Codex sublayer 的 filter 不计入 codex_filter_count
        foreign = WfpFilter("x", "K", sublayer_key="00000000-0000-0000-0000-000000000000", layer_key=REVERSE_ENGINEERED_LAYER_GUID, action=FilterAction.BLOCK)
        v = reconcile_reverse_prediction([foreign])
        assert v.codex_filter_count == 0
        assert v.prediction_holds is False

    def test_empty(self) -> None:
        v = reconcile_reverse_prediction([])
        assert v.codex_filter_count == 0
        assert v.prediction_holds is False


class TestStandardWellKnownLayer:
    """R11 实测验证: 12 条 filter 落标准 well-known layer, 非自定义。"""

    @pytest.mark.parametrize(
        "g",
        [
            "c38d57d1-05a7-4c33-904f-7fbceee60e82",  # ALE_AUTH_CONNECT_V4
            "4a72393b-319f-44bc-84c3-ba54dcb3b6b4",  # ALE_AUTH_CONNECT_V6
            "1247d66d-0b60-4a15-8d44-7155d0f53a0c",  # ALE_RESOURCE_ASSIGNMENT_V4
            "55a650e1-5f0a-4eca-a653-88f53b26aa8c",  # ALE_RESOURCE_ASSIGNMENT_V6
        ],
    )
    def test_standard_ale_layer(self, g: str) -> None:
        assert is_standard_well_known_layer(g) is True

    def test_reverse_guid_is_not_standard(self) -> None:
        # R11 推翻: {9EFF6C8C} 非 layer, 更非标准 well-known layer
        assert is_standard_well_known_layer(REVERSE_ENGINEERED_LAYER_GUID) is False

    def test_invalid(self) -> None:
        assert is_standard_well_known_layer("bad") is False


class TestConstants:
    def test_provider_shape(self) -> None:
        assert guid_from_str(CODEX_PROVIDER_GUID) is not None

    def test_sublayer_shape(self) -> None:
        assert guid_from_str(CODEX_SUBLAYER_GUID) is not None

    def test_reverse_layer_shape(self) -> None:
        assert guid_from_str(REVERSE_ENGINEERED_LAYER_GUID) is not None

    def test_four_ale_layers(self) -> None:
        assert len(ALE_LAYER_GUIDS) == 4
