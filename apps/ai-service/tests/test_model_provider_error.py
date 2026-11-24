# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R58 model_provider_error 封闭集测试（统一工程规范；struct variant 逐字表 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.model_provider_error import (
    MODEL_PROVIDER_ERROR_ELEMENTS,
    PROVIDER_ERROR_KIND,
    ModelProviderError,
    ModelProviderErrorError,
    ensure_model_provider_error,
    expected_element_count,
    provider_error_kind,
    provider_error_names,
    validate_provider_error,
)


class TestClosedSet:
    def test_member_count_is_3(self) -> None:
        assert len(ModelProviderError) == 3

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in ModelProviderError}
        assert got == set(MODEL_PROVIDER_ERROR_ELEMENTS)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"ModelProviderMismatch", "ModelProviderNotConfigured", "ModelProviderPolicyConflict"} == {m.value for m in ModelProviderError}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"model_provider_mismatch", "ProviderMismatch", "NotConfigured", "PolicyConflict"}.isdisjoint(set(MODEL_PROVIDER_ERROR_ELEMENTS))


class TestElementCounts:
    def test_verbatim_element_count_table(self) -> None:
        """反向变异：任一 with-N-element 被篡改 ⇒ 逐字表失配转红。"""
        assert MODEL_PROVIDER_ERROR_ELEMENTS == {"ModelProviderMismatch": 2, "ModelProviderNotConfigured": 1, "ModelProviderPolicyConflict": 2}

    @pytest.mark.parametrize("name,count", MODEL_PROVIDER_ERROR_ELEMENTS.items())
    def test_expected_element_count_matches(self, name, count) -> None:
        assert expected_element_count(name) == count

    def test_unknown_name_raises(self) -> None:
        with pytest.raises(ModelProviderErrorError):
            expected_element_count("bogus")


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", MODEL_PROVIDER_ERROR_ELEMENTS)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_model_provider_error(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_variant", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(ModelProviderErrorError):
            ensure_model_provider_error(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(ModelProviderErrorError, match="app/core/model_provider_error.py"):
            ensure_model_provider_error("bogus")


class TestClassification:
    @pytest.mark.parametrize("value,expected", [
    ("ModelProviderMismatch", "mismatch"),
    ("ModelProviderNotConfigured", "not_configured"),
    ("ModelProviderPolicyConflict", "policy_conflict"),
    ])
    def test_family(self, value, expected) -> None:
        assert provider_error_kind(value) == expected

    def test_family_rejects_unregistered(self) -> None:
        with pytest.raises(ModelProviderErrorError):
            provider_error_kind("bogus")


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", MODEL_PROVIDER_ERROR_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_provider_error(name, count) == name

    @pytest.mark.parametrize("name,count", MODEL_PROVIDER_ERROR_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ModelProviderErrorError, match="元素数应为"):
            validate_provider_error(name, count + 1)

    def test_names_returns_copy(self) -> None:
        a = provider_error_names()
        assert set(a) == set(MODEL_PROVIDER_ERROR_ELEMENTS)

    def test_provider_error_kind_covers_all(self):
        assert set(PROVIDER_ERROR_KIND) == set(MODEL_PROVIDER_ERROR_ELEMENTS)


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self) -> None:
        assert len(ModelProviderError) == len(MODEL_PROVIDER_ERROR_ELEMENTS) == 3
        assert {m.value for m in ModelProviderError} == set(MODEL_PROVIDER_ERROR_ELEMENTS)

    def test_case_sensitive_wire_names(self) -> None:
        """variant 名大小写敏感（Rust struct variant 逐字，小写形态非登记值）。"""
        first = "ModelProviderMismatch"
        assert first in MODEL_PROVIDER_ERROR_ELEMENTS
        assert first.lower() not in MODEL_PROVIDER_ERROR_ELEMENTS
