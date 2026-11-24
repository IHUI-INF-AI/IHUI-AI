# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R59 pytest: response_item_wire protocol-surface closed set.

Covers: verbatim element-count table, semantic domain classification, executable
reverse lookup, consistency gate, plus reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.response_item_wire import (
    RESPONSE_ITEM_DOMAIN,
    RESPONSE_ITEM_ELEMENTS,
    ResponseItemWire,
    ResponseItemWireError,
    ensure_response_item_wire,
    expected_response_item_element_count,
    is_response_item_wire,
    response_item_domain,
    response_item_domain_members,
    response_item_names,
    validate_response_item,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert RESPONSE_ITEM_ELEMENTS == {"AdditionalTools": 3, "AgentMessage": 5, "Compaction": 3, "ConfigurationUpdate": 1, "CustomToolCall": 8, "CustomToolCallOutput": 5, "FunctionCall": 9, "FunctionCallOutput": 6, "ImageGenerationCall": 6, "LocalShellCall": 6, "Message": 7, "Reasoning": 5, "ToolSearchCall": 7, "ToolSearchOutput": 6}

    def test_closed_set_cardinality(self) -> None:
        assert len(ResponseItemWire) == len(RESPONSE_ITEM_ELEMENTS) == 14

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in ResponseItemWire} == set(RESPONSE_ITEM_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in RESPONSE_ITEM_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(RESPONSE_ITEM_DOMAIN) == set(RESPONSE_ITEM_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('Compaction', 'compaction'), ('AdditionalTools', 'config'), ('CustomToolCall', 'function'), ('AgentMessage', 'message'), ('ImageGenerationCall', 'tool')])
    def test_domain(self, name, expected) -> None:
        assert response_item_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(ResponseItemWireError):
            response_item_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(RESPONSE_ITEM_DOMAIN.values()):
            seen.extend(response_item_domain_members(domain))
        assert sorted(seen) == sorted(RESPONSE_ITEM_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(ResponseItemWireError):
            response_item_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_response_item_wire(nm) for nm in RESPONSE_ITEM_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "AdditionalTools"
        assert first in RESPONSE_ITEM_ELEMENTS
        assert not is_response_item_wire(first.lower())
        assert not is_response_item_wire("bogus")

    def test_names_returns_copy(self) -> None:
        a = response_item_names()
        a.append("bogus")
        assert "bogus" not in RESPONSE_ITEM_ELEMENTS
        assert set(response_item_names()) == set(RESPONSE_ITEM_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(RESPONSE_ITEM_DOMAIN.values())))
        a = response_item_domain_members(domain)
        assert isinstance(a, tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", RESPONSE_ITEM_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_response_item(name, count) == name

    @pytest.mark.parametrize("name,count", RESPONSE_ITEM_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ResponseItemWireError, match="元素数应为"):
            validate_response_item(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(ResponseItemWireError):
            ensure_response_item_wire("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(ResponseItemWireError):
            expected_response_item_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("AdditionalTools", "AgentMessage"):
            assert nm in RESPONSE_ITEM_ELEMENTS
            assert nm.lower() not in RESPONSE_ITEM_ELEMENTS

    def test_element_counts_not_all_identical_sentinel(self) -> None:
        """差异化元素数族必须真的有 >1 种取值；恒 2 族由本断言钉住不能伪装差异化。"""
        counts = set(RESPONSE_ITEM_ELEMENTS.values())
        assert counts == {1, 3, 5, 6, 7, 8, 9}
