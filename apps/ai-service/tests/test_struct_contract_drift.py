# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R66 pytest: struct_contract_drift（非 hook struct 字段名契约的漂移哨兵）。

基线 = R65 的 44 个结构 / 455 字段 + sha256 指纹。本测试用「喂入观测值」的方式覆盖
unchanged / reordered / reshaped / renamed / added / removed 六类结论与零漂移守门。
"""

from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from app.core.struct_contract_drift import (
    EXPECTED_STRUCT_FINGERPRINTS,
    StructContractDriftError,
    StructDriftReport,
    assert_contract_matches_arity,
    assert_no_struct_drift,
    classify_struct_drift,
)
from app.core.struct_field_name_contract import (
    STRUCT_FIELD_NAMES,
    fields_of,
    struct_fingerprint,
)


def observed_from_contract() -> dict[str, tuple[str, ...]]:
    return {name: tuple(fields) for name, fields in STRUCT_FIELD_NAMES.items()}


class TestBaseline:
    def test_fingerprint_registry_matches_contract(self) -> None:
        assert set(EXPECTED_STRUCT_FINGERPRINTS) == set(STRUCT_FIELD_NAMES)
        for name in STRUCT_FIELD_NAMES:
            assert EXPECTED_STRUCT_FINGERPRINTS[name] == struct_fingerprint(name)

    def test_contract_arity_selfcheck_passes(self) -> None:
        assert_contract_matches_arity()


class TestNoDrift:
    def test_identity_is_ok(self) -> None:
        report = classify_struct_drift(observed_from_contract())
        assert report.ok
        assert len(report.unchanged) == len(STRUCT_FIELD_NAMES)
        assert report.drifted == ()

    def test_zero_drift_gate_passes(self) -> None:
        report = classify_struct_drift(observed_from_contract())
        assert assert_no_struct_drift(report) is report

    def test_summary_shape(self) -> None:
        report = classify_struct_drift(observed_from_contract())
        assert report.summary().startswith("漂移哨兵: unchanged=")
        assert "renamed=0" in report.summary()


class TestSingleCategoryDrifts:
    def test_renamed_field(self) -> None:
        obs = observed_from_contract()
        fields = list(obs["ModelProviderInfo"])
        fields[0] = "display_name"
        obs["ModelProviderInfo"] = tuple(fields)
        report = classify_struct_drift(obs)
        assert report.renamed == ("ModelProviderInfo",)
        assert report.missing_fields("ModelProviderInfo") == ("name",)
        assert report.unknown_fields("ModelProviderInfo") == ("display_name",)
        assert not report.ok

    def test_reordered_fields(self) -> None:
        obs = observed_from_contract()
        obs["AgentRoleToml"] = tuple(reversed(obs["AgentRoleToml"]))
        report = classify_struct_drift(obs)
        assert report.reordered == ("AgentRoleToml",)
        assert report.missing_fields("AgentRoleToml") == ()
        assert report.unknown_fields("AgentRoleToml") == ()
        assert not report.ok

    def test_reshaped_dropped_field(self) -> None:
        obs = observed_from_contract()
        obs["ConfigToml"] = tuple(obs["ConfigToml"][:-1])
        report = classify_struct_drift(obs)
        assert report.reshaped == ("ConfigToml",)
        assert report.missing_fields("ConfigToml") == ("oss_provider",)

    def test_reshaped_extra_field(self) -> None:
        obs = observed_from_contract()
        obs["OtelConfigToml"] = (*obs["OtelConfigToml"], "brand_new_field")
        report = classify_struct_drift(obs)
        assert report.reshaped == ("OtelConfigToml",)
        assert report.unknown_fields("OtelConfigToml") == ("brand_new_field",)

    def test_removed_struct(self) -> None:
        obs = observed_from_contract()
        removed = obs.pop("BrowserUseConfigToml")
        assert removed
        report = classify_struct_drift(obs)
        assert report.removed == ("BrowserUseConfigToml",)
        assert report.ok is False

    def test_added_struct(self) -> None:
        obs = observed_from_contract()
        obs["ThreadStartParams"] = ("some_field", "another_field")
        report = classify_struct_drift(obs)
        assert report.added == ("ThreadStartParams",)
        assert "ThreadStartParams" in report.drifted


class TestGate:
    def test_gate_raises_and_names_struct(self) -> None:
        obs = observed_from_contract()
        obs["FsCopyParams"] = ("only_one",)
        report = classify_struct_drift(obs)
        with pytest.raises(StructContractDriftError) as exc:
            assert_no_struct_drift(report)
        assert "FsCopyParams" in str(exc.value)

    def test_gate_reports_removed(self) -> None:
        obs = observed_from_contract()
        obs.pop("TurnError")
        report = classify_struct_drift(obs)
        with pytest.raises(StructContractDriftError) as exc:
            assert_no_struct_drift(report)
        assert "基线登记但新版本未扫到" in str(exc.value)

    def test_report_is_frozen(self) -> None:
        report = classify_struct_drift(observed_from_contract())
        with pytest.raises(FrozenInstanceError):
            report.unchanged = ("x",)  # type: ignore[misc]

    def test_drifted_is_sorted_and_deduplicated(self) -> None:
        obs = observed_from_contract()
        obs["AgentRoleToml"] = tuple(reversed(obs["AgentRoleToml"]))
        obs["TurnError"] = tuple(reversed(obs["TurnError"]))
        report = classify_struct_drift(obs)
        assert report.drifted == ("AgentRoleToml", "TurnError")


class TestAnchorsUnequal:
    def test_anchor_fields_preserved_via_fingerprint(self) -> None:
        obs = observed_from_contract()
        assert struct_fingerprint("ConfigToml") == EXPECTED_STRUCT_FINGERPRINTS["ConfigToml"]
        assert tuple(obs["ConfigToml"]) == fields_of("ConfigToml")

    def test_report_type(self) -> None:
        assert isinstance(classify_struct_drift(observed_from_contract()), StructDriftReport)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
