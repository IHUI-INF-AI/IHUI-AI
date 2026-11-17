# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R61 pytest: wire_result protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.wire_result import (
    WIRE_RESULT_DOMAIN,
    WIRE_RESULT_ELEMENTS,
    WireResult,
    WireResultError,
    ensure_wire_result,
    expected_wire_result_element_count,
    is_wire_result,
    validate_wire_result,
    wire_result_domain,
    wire_result_domain_members,
    wire_result_names,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert WIRE_RESULT_ELEMENTS == {"Err": 1, "Ok": 1}

    def test_closed_set_cardinality(self) -> None:
        assert len(WireResult) == len(WIRE_RESULT_ELEMENTS) == 2

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in WireResult} == set(WIRE_RESULT_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in WIRE_RESULT_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(WIRE_RESULT_DOMAIN) == set(WIRE_RESULT_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('Err', 'failure'), ('Ok', 'success')])
    def test_domain(self, name, expected) -> None:
        assert wire_result_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(WireResultError):
            wire_result_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(WIRE_RESULT_DOMAIN.values()):
            seen.extend(wire_result_domain_members(domain))
        assert sorted(seen) == sorted(WIRE_RESULT_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(WireResultError):
            wire_result_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_wire_result(nm) for nm in WIRE_RESULT_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "Err"
        assert first in WIRE_RESULT_ELEMENTS
        assert not is_wire_result(first.lower())
        assert not is_wire_result("bogus")

    def test_names_returns_copy(self) -> None:
        a = wire_result_names()
        a.append("bogus")
        assert "bogus" not in WIRE_RESULT_ELEMENTS
        assert set(wire_result_names()) == set(WIRE_RESULT_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(WIRE_RESULT_DOMAIN.values())))
        assert isinstance(wire_result_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", WIRE_RESULT_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_wire_result(name, count) == name

    @pytest.mark.parametrize("name,count", WIRE_RESULT_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(WireResultError, match="元素数应为"):
            validate_wire_result(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(WireResultError):
            ensure_wire_result("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(WireResultError):
            expected_wire_result_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("Err", "Ok"):
            assert nm in WIRE_RESULT_ELEMENTS
            assert nm.lower() not in WIRE_RESULT_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(WIRE_RESULT_ELEMENTS.values()) == {1}
