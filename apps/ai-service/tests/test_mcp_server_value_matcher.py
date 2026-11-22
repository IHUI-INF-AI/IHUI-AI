# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R58 mcp_server_value_matcher 封闭集测试（统一工程规范；struct variant 逐字表 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.mcp_server_value_matcher import (
    MATCHER_MODE,
    MCP_VALUE_MATCHER_ELEMENTS,
    McpServerValueMatcher,
    McpServerValueMatcherError,
    ensure_mcp_server_value_matcher,
    expected_element_count,
    match_value,
    matcher_mode,
    matcher_names,
    validate_matcher,
)


class TestClosedSet:
    def test_member_count_is_3(self) -> None:
        assert len(McpServerValueMatcher) == 3

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in McpServerValueMatcher}
        assert got == set(MCP_VALUE_MATCHER_ELEMENTS)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"Exact", "Prefix", "Regex"} == {m.value for m in McpServerValueMatcher}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"exact", "Exactly", "StartsWith", "RegExp", "Glob"}.isdisjoint(set(MCP_VALUE_MATCHER_ELEMENTS))


class TestElementCounts:
    def test_verbatim_element_count_table(self) -> None:
        """反向变异：任一 with-N-element 被篡改 ⇒ 逐字表失配转红。"""
        assert MCP_VALUE_MATCHER_ELEMENTS == {"Exact": 1, "Prefix": 1, "Regex": 1}

    @pytest.mark.parametrize("name,count", MCP_VALUE_MATCHER_ELEMENTS.items())
    def test_expected_element_count_matches(self, name, count) -> None:
        assert expected_element_count(name) == count

    def test_unknown_name_raises(self) -> None:
        with pytest.raises(McpServerValueMatcherError):
            expected_element_count("bogus")


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", MCP_VALUE_MATCHER_ELEMENTS)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_mcp_server_value_matcher(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_variant", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(McpServerValueMatcherError):
            ensure_mcp_server_value_matcher(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(McpServerValueMatcherError, match="app/core/mcp_server_value_matcher.py"):
            ensure_mcp_server_value_matcher("bogus")


class TestClassification:
    @pytest.mark.parametrize("value,expected", [
    ("Exact", "exact"),
    ("Prefix", "prefix"),
    ("Regex", "regex"),
    ])
    def test_family(self, value, expected) -> None:
        assert matcher_mode(value) == expected

    def test_family_rejects_unregistered(self) -> None:
        with pytest.raises(McpServerValueMatcherError):
            matcher_mode("bogus")


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", MCP_VALUE_MATCHER_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_matcher(name, count) == name

    @pytest.mark.parametrize("name,count", MCP_VALUE_MATCHER_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(McpServerValueMatcherError, match="元素数应为"):
            validate_matcher(name, count + 1)

    def test_names_returns_copy(self) -> None:
        a = matcher_names()
        assert set(a) == set(MCP_VALUE_MATCHER_ELEMENTS)

    def test_matcher_mode_covers_all(self):
        assert set(MATCHER_MODE) == set(MCP_VALUE_MATCHER_ELEMENTS)

    def test_match_value_exact(self):
        assert match_value("Exact", "abc", "abc") is True
        assert match_value("Exact", "abc", "abcd") is False

    def test_match_value_prefix(self):
        assert match_value("Prefix", "ab", "abcd") is True
        assert match_value("Prefix", "ab", "cab") is False

    def test_match_value_regex_fullmatch(self):
        assert match_value("Regex", r"a\d+", "a123") is True
        assert match_value("Regex", r"a\d+", "xa123") is False  # fullmatch 非 search

    def test_match_value_rejects_unknown_mode(self):
        with pytest.raises(McpServerValueMatcherError):
            match_value("bogus", "a", "a")


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self) -> None:
        assert len(McpServerValueMatcher) == len(MCP_VALUE_MATCHER_ELEMENTS) == 3
        assert {m.value for m in McpServerValueMatcher} == set(MCP_VALUE_MATCHER_ELEMENTS)

    def test_case_sensitive_wire_names(self) -> None:
        """variant 名大小写敏感（Rust struct variant 逐字，小写形态非登记值）。"""
        first = "Exact"
        assert first in MCP_VALUE_MATCHER_ELEMENTS
        assert first.lower() not in MCP_VALUE_MATCHER_ELEMENTS
