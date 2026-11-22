# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R57 handshake_reject_reason 封闭集测试（统一工程规范；struct variant 逐字表 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.handshake_reject_reason import (
    HANDSHAKE_REJECT_ELEMENTS,
    HandshakeRejectReason,
    HandshakeRejectReasonError,
    ensure_handshake_reject_reason,
    expected_element_count,
    reject_reason_family,
    reject_reason_names,
    validate_reject_reason,
)


class TestClosedSet:
    def test_member_count_is_3(self) -> None:
        assert len(HandshakeRejectReason) == 3

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in HandshakeRejectReason}
        assert got == set(HANDSHAKE_REJECT_ELEMENTS)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"InvalidHello", "NoCompatibleVersion", "MissingRequiredCapability"} == {m.value for m in HandshakeRejectReason}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"invalid_hello", "InvalidHandshake", "NoCompatible", "MissingCapability"}.isdisjoint({m.value for m in HandshakeRejectReason})


class TestElementCounts:
    def test_verbatim_element_count_table(self) -> None:
        """反向变异：任一 with-N-element 被篡改 ⇒ 逐字表失配转红。"""
        assert HANDSHAKE_REJECT_ELEMENTS == {"InvalidHello": 1, "NoCompatibleVersion": 1, "MissingRequiredCapability": 1}

    @pytest.mark.parametrize("name,count", HANDSHAKE_REJECT_ELEMENTS.items())
    def test_expected_element_count_matches(self, name, count) -> None:
        assert expected_element_count(name) == count

    def test_unknown_name_raises(self) -> None:
        with pytest.raises(HandshakeRejectReasonError):
            expected_element_count("bogus")


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", HANDSHAKE_REJECT_ELEMENTS)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_handshake_reject_reason(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_variant", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(HandshakeRejectReasonError):
            ensure_handshake_reject_reason(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(HandshakeRejectReasonError, match="app/core/handshake_reject_reason.py"):
            ensure_handshake_reject_reason("bogus")


class TestClassification:
    @pytest.mark.parametrize("value,expected", [
    ("InvalidHello", "hello_malformed"),
    ("NoCompatibleVersion", "version"),
    ("MissingRequiredCapability", "capability"),
    ])
    def test_family(self, value, expected) -> None:
        assert reject_reason_family(value) == expected

    def test_family_rejects_unregistered(self) -> None:
        with pytest.raises(HandshakeRejectReasonError):
            reject_reason_family("bogus")


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", HANDSHAKE_REJECT_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_reject_reason(name, count) == name

    @pytest.mark.parametrize("name,count", HANDSHAKE_REJECT_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(HandshakeRejectReasonError, match="元素数应为"):
            validate_reject_reason(name, count + 1)

    def test_names_returns_copy(self) -> None:
        a = reject_reason_names()
        assert set(a) == set(HANDSHAKE_REJECT_ELEMENTS)

    def test_names_mutable_copy(self):
        a = reject_reason_names()
        assert set(a) == set(HANDSHAKE_REJECT_ELEMENTS)
        a.append("bogus")
        assert "bogus" not in HANDSHAKE_REJECT_ELEMENTS


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self) -> None:
        assert len(HandshakeRejectReason) == len(HANDSHAKE_REJECT_ELEMENTS) == 3
        assert {m.value for m in HandshakeRejectReason} == set(HANDSHAKE_REJECT_ELEMENTS)

    def test_case_sensitive_wire_names(self) -> None:
        """variant 名大小写敏感（Rust struct variant 逐字，小写形态非登记值）。"""
        first = "InvalidHello"
        assert first in HANDSHAKE_REJECT_ELEMENTS
        assert first.lower() not in HANDSHAKE_REJECT_ELEMENTS
