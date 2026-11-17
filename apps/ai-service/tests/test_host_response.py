# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R57 host_response 封闭集测试（统一工程规范；struct variant 逐字表 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.host_response import (
    HOST_RESPONSE_ELEMENTS,
    TERMINAL_RESPONSES,
    HostResponse,
    HostResponseError,
    ensure_host_response,
    expected_element_count,
    host_response_names,
    is_terminal_response,
    response_phase,
    validate_host_response,
)


class TestClosedSet:
    def test_member_count_is_4(self) -> None:
        assert len(HostResponse) == 4

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in HostResponse}
        assert got == set(HOST_RESPONSE_ELEMENTS)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"SessionReady", "SessionClosed", "ExecutionStarted", "WaitCompleted"} == {m.value for m in HostResponse}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"session_ready", "SessionClose", "ExecutionStart", "WaitComplete"}.isdisjoint({m.value for m in HostResponse})


class TestElementCounts:
    def test_verbatim_element_count_table(self) -> None:
        """反向变异：任一 with-N-element 被篡改 ⇒ 逐字表失配转红。"""
        assert HOST_RESPONSE_ELEMENTS == {"SessionReady": 1, "SessionClosed": 1, "ExecutionStarted": 1, "WaitCompleted": 1}

    @pytest.mark.parametrize("name,count", HOST_RESPONSE_ELEMENTS.items())
    def test_expected_element_count_matches(self, name, count) -> None:
        assert expected_element_count(name) == count

    def test_unknown_name_raises(self) -> None:
        with pytest.raises(HostResponseError):
            expected_element_count("bogus")


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", HOST_RESPONSE_ELEMENTS)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_host_response(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_variant", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(HostResponseError):
            ensure_host_response(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(HostResponseError, match="app/core/host_response.py"):
            ensure_host_response("bogus")


class TestClassification:
    @pytest.mark.parametrize("value,expected", [
    ("SessionReady", "ready"),
    ("SessionClosed", "closed"),
    ("ExecutionStarted", "started"),
    ("WaitCompleted", "wait"),
    ])
    def test_family(self, value, expected) -> None:
        assert response_phase(value) == expected

    def test_family_rejects_unregistered(self) -> None:
        with pytest.raises(HostResponseError):
            response_phase("bogus")


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", HOST_RESPONSE_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_host_response(name, count) == name

    @pytest.mark.parametrize("name,count", HOST_RESPONSE_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(HostResponseError, match="元素数应为"):
            validate_host_response(name, count + 1)

    def test_names_returns_copy(self) -> None:
        a = host_response_names()
        assert set(a) == set(HOST_RESPONSE_ELEMENTS)

    def test_is_terminal_response(self):
        assert is_terminal_response("SessionClosed") is True
        for v in ["SessionReady", "ExecutionStarted", "WaitCompleted"]:
            assert is_terminal_response(v) is False
        assert frozenset({"SessionClosed"}) == TERMINAL_RESPONSES


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self) -> None:
        assert len(HostResponse) == len(HOST_RESPONSE_ELEMENTS) == 4
        assert {m.value for m in HostResponse} == set(HOST_RESPONSE_ELEMENTS)

    def test_case_sensitive_wire_names(self) -> None:
        """variant 名大小写敏感（Rust struct variant 逐字，小写形态非登记值）。"""
        first = "SessionReady"
        assert first in HOST_RESPONSE_ELEMENTS
        assert first.lower() not in HOST_RESPONSE_ELEMENTS
