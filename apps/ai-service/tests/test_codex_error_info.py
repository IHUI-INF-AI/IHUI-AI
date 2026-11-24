# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R58 codex_error_info 封闭集测试（统一工程规范；struct variant 逐字表 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.codex_error_info import (
    CODEX_ERROR_INFO_ELEMENTS,
    ERROR_INFO_FAMILY,
    CodexErrorInfo,
    CodexErrorInfoError,
    ensure_codex_error_info,
    error_info_family,
    error_info_names,
    expected_element_count,
    validate_error_info,
)


class TestClosedSet:
    def test_member_count_is_5(self) -> None:
        assert len(CodexErrorInfo) == 5

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in CodexErrorInfo}
        assert got == set(CODEX_ERROR_INFO_ELEMENTS)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"ActiveTurnNotSteerable", "HttpConnectionFailed", "ResponseStreamConnectionFailed", "ResponseStreamDisconnected", "ResponseTooManyFailedAttempts"} == {m.value for m in CodexErrorInfo}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"active_turn_not_steerable", "ActiveTurnNotSteerableError", "HttpConnectionFail", "ResponseStreamFailed", "TooManyRetries"}.isdisjoint(set(CODEX_ERROR_INFO_ELEMENTS))


class TestElementCounts:
    def test_verbatim_element_count_table(self) -> None:
        """反向变异：任一 with-N-element 被篡改 ⇒ 逐字表失配转红。"""
        assert CODEX_ERROR_INFO_ELEMENTS == {"ActiveTurnNotSteerable": 1, "HttpConnectionFailed": 1, "ResponseStreamConnectionFailed": 1, "ResponseStreamDisconnected": 1, "ResponseTooManyFailedAttempts": 1}

    @pytest.mark.parametrize("name,count", CODEX_ERROR_INFO_ELEMENTS.items())
    def test_expected_element_count_matches(self, name, count) -> None:
        assert expected_element_count(name) == count

    def test_unknown_name_raises(self) -> None:
        with pytest.raises(CodexErrorInfoError):
            expected_element_count("bogus")


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", CODEX_ERROR_INFO_ELEMENTS)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_codex_error_info(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_variant", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(CodexErrorInfoError):
            ensure_codex_error_info(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(CodexErrorInfoError, match="app/core/codex_error_info.py"):
            ensure_codex_error_info("bogus")


class TestClassification:
    @pytest.mark.parametrize("value,expected", [
    ("ActiveTurnNotSteerable", "not_steerable"),
    ("HttpConnectionFailed", "http_connection"),
    ("ResponseStreamConnectionFailed", "stream_connection"),
    ("ResponseStreamDisconnected", "stream_disconnect"),
    ("ResponseTooManyFailedAttempts", "retry_exhausted"),
    ])
    def test_family(self, value, expected) -> None:
        assert error_info_family(value) == expected

    def test_family_rejects_unregistered(self) -> None:
        with pytest.raises(CodexErrorInfoError):
            error_info_family("bogus")


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", CODEX_ERROR_INFO_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_error_info(name, count) == name

    @pytest.mark.parametrize("name,count", CODEX_ERROR_INFO_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(CodexErrorInfoError, match="元素数应为"):
            validate_error_info(name, count + 1)

    def test_names_returns_copy(self) -> None:
        a = error_info_names()
        assert set(a) == set(CODEX_ERROR_INFO_ELEMENTS)

    def test_error_info_family_covers_all(self):
        assert set(ERROR_INFO_FAMILY) == set(CODEX_ERROR_INFO_ELEMENTS)


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self) -> None:
        assert len(CodexErrorInfo) == len(CODEX_ERROR_INFO_ELEMENTS) == 5
        assert {m.value for m in CodexErrorInfo} == set(CODEX_ERROR_INFO_ELEMENTS)

    def test_case_sensitive_wire_names(self) -> None:
        """variant 名大小写敏感（Rust struct variant 逐字，小写形态非登记值）。"""
        first = "ActiveTurnNotSteerable"
        assert first in CODEX_ERROR_INFO_ELEMENTS
        assert first.lower() not in CODEX_ERROR_INFO_ELEMENTS
