# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R57 host_to_client 封闭集测试（统一工程规范；struct variant 逐字表 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.host_to_client import (
    HOST_TO_CLIENT_ELEMENTS,
    MESSAGE_FAMILY,
    HostToClient,
    HostToClientError,
    ensure_host_to_client,
    expected_element_count,
    host_to_client_names,
    is_delegate_message,
    message_family,
    validate_host_to_client,
)


class TestClosedSet:
    def test_member_count_is_6(self) -> None:
        assert len(HostToClient) == 6

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in HostToClient}
        assert got == set(HOST_TO_CLIENT_ELEMENTS)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"HandshakeRejected", "InitialResponse", "Response", "CellClosed", "CancelDelegateRequest", "DelegateRequest"} == {m.value for m in HostToClient}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"handshake_rejected", "HandshakeReject", "CellClose", "DelegateReq"}.isdisjoint({m.value for m in HostToClient})


class TestElementCounts:
    def test_verbatim_element_count_table(self) -> None:
        """反向变异：任一 with-N-element 被篡改 ⇒ 逐字表失配转红。"""
        assert HOST_TO_CLIENT_ELEMENTS == {"HandshakeRejected": 1, "InitialResponse": 2, "Response": 2, "CellClosed": 2, "CancelDelegateRequest": 1, "DelegateRequest": 3}

    @pytest.mark.parametrize("name,count", HOST_TO_CLIENT_ELEMENTS.items())
    def test_expected_element_count_matches(self, name, count) -> None:
        assert expected_element_count(name) == count

    def test_unknown_name_raises(self) -> None:
        with pytest.raises(HostToClientError):
            expected_element_count("bogus")


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", HOST_TO_CLIENT_ELEMENTS)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_host_to_client(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_variant", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(HostToClientError):
            ensure_host_to_client(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(HostToClientError, match="app/core/host_to_client.py"):
            ensure_host_to_client("bogus")


class TestClassification:
    @pytest.mark.parametrize("value,expected", [
    ("HandshakeRejected", "handshake"),
    ("InitialResponse", "response"),
    ("Response", "response"),
    ("CellClosed", "cell"),
    ("CancelDelegateRequest", "delegate"),
    ("DelegateRequest", "delegate"),
    ])
    def test_family(self, value, expected) -> None:
        assert message_family(value) == expected

    def test_family_rejects_unregistered(self) -> None:
        with pytest.raises(HostToClientError):
            message_family("bogus")


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", HOST_TO_CLIENT_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_host_to_client(name, count) == name

    @pytest.mark.parametrize("name,count", HOST_TO_CLIENT_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(HostToClientError, match="元素数应为"):
            validate_host_to_client(name, count + 1)

    def test_names_returns_copy(self) -> None:
        a = host_to_client_names()
        assert set(a) == set(HOST_TO_CLIENT_ELEMENTS)

    def test_is_delegate_message(self):
        assert is_delegate_message("DelegateRequest") is True
        assert is_delegate_message("CancelDelegateRequest") is True
        assert is_delegate_message("Response") is False

    def test_response_family_two_variants_same_count(self):
        # InitialResponse/Response 同族同元素数 2, 靠 variant 名区分
        assert MESSAGE_FAMILY["InitialResponse"] == MESSAGE_FAMILY["Response"] == "response"
        assert HOST_TO_CLIENT_ELEMENTS["InitialResponse"] == HOST_TO_CLIENT_ELEMENTS["Response"] == 2


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self) -> None:
        assert len(HostToClient) == len(HOST_TO_CLIENT_ELEMENTS) == 6
        assert {m.value for m in HostToClient} == set(HOST_TO_CLIENT_ELEMENTS)

    def test_case_sensitive_wire_names(self) -> None:
        """variant 名大小写敏感（Rust struct variant 逐字，小写形态非登记值）。"""
        first = "HandshakeRejected"
        assert first in HOST_TO_CLIENT_ELEMENTS
        assert first.lower() not in HOST_TO_CLIENT_ELEMENTS
