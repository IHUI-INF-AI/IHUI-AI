# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R60 pytest: tool_call_summary protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.tool_call_summary import (
    TOOL_CALL_SUMMARY_DOMAIN,
    TOOL_CALL_SUMMARY_ELEMENTS,
    ToolCallSummary,
    ToolCallSummaryError,
    ensure_tool_call_summary,
    expected_summary_element_count,
    is_tool_call_summary,
    tool_call_summary_domain,
    tool_call_summary_domain_members,
    tool_call_summary_names,
    validate_tool_call_summary,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert TOOL_CALL_SUMMARY_ELEMENTS == {"Agent": 3, "Generic": 3, "Terminal": 1, "WaitAgent": 2}

    def test_closed_set_cardinality(self) -> None:
        assert len(ToolCallSummary) == len(TOOL_CALL_SUMMARY_ELEMENTS) == 4

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in ToolCallSummary} == set(TOOL_CALL_SUMMARY_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in TOOL_CALL_SUMMARY_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(TOOL_CALL_SUMMARY_DOMAIN) == set(TOOL_CALL_SUMMARY_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('Agent', 'agent'), ('Generic', 'generic'), ('Terminal', 'terminal')])
    def test_domain(self, name, expected) -> None:
        assert tool_call_summary_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(ToolCallSummaryError):
            tool_call_summary_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(TOOL_CALL_SUMMARY_DOMAIN.values()):
            seen.extend(tool_call_summary_domain_members(domain))
        assert sorted(seen) == sorted(TOOL_CALL_SUMMARY_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(ToolCallSummaryError):
            tool_call_summary_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_tool_call_summary(nm) for nm in TOOL_CALL_SUMMARY_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "Agent"
        assert first in TOOL_CALL_SUMMARY_ELEMENTS
        assert not is_tool_call_summary(first.lower())
        assert not is_tool_call_summary("bogus")

    def test_names_returns_copy(self) -> None:
        a = tool_call_summary_names()
        a.append("bogus")
        assert "bogus" not in TOOL_CALL_SUMMARY_ELEMENTS
        assert set(tool_call_summary_names()) == set(TOOL_CALL_SUMMARY_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(TOOL_CALL_SUMMARY_DOMAIN.values())))
        assert isinstance(tool_call_summary_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", TOOL_CALL_SUMMARY_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_tool_call_summary(name, count) == name

    @pytest.mark.parametrize("name,count", TOOL_CALL_SUMMARY_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ToolCallSummaryError, match="元素数应为"):
            validate_tool_call_summary(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(ToolCallSummaryError):
            ensure_tool_call_summary("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(ToolCallSummaryError):
            expected_summary_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("Agent", "Generic"):
            assert nm in TOOL_CALL_SUMMARY_ELEMENTS
            assert nm.lower() not in TOOL_CALL_SUMMARY_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(TOOL_CALL_SUMMARY_ELEMENTS.values()) == {1, 2, 3}
