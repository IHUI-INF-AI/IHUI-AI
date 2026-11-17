# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R61 pytest: file_change protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.file_change import (
    FILE_CHANGE_DOMAIN,
    FILE_CHANGE_ELEMENTS,
    FileChange,
    FileChangeError,
    ensure_file_change,
    expected_file_change_element_count,
    file_change_domain,
    file_change_domain_members,
    file_change_names,
    is_file_change,
    validate_file_change,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert FILE_CHANGE_ELEMENTS == {"Add": 1, "Delete": 1, "Update": 2}

    def test_closed_set_cardinality(self) -> None:
        assert len(FileChange) == len(FILE_CHANGE_ELEMENTS) == 3

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in FileChange} == set(FILE_CHANGE_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in FILE_CHANGE_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(FILE_CHANGE_DOMAIN) == set(FILE_CHANGE_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('Add', 'create'), ('Delete', 'delete'), ('Update', 'update')])
    def test_domain(self, name, expected) -> None:
        assert file_change_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(FileChangeError):
            file_change_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(FILE_CHANGE_DOMAIN.values()):
            seen.extend(file_change_domain_members(domain))
        assert sorted(seen) == sorted(FILE_CHANGE_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(FileChangeError):
            file_change_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_file_change(nm) for nm in FILE_CHANGE_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "Add"
        assert first in FILE_CHANGE_ELEMENTS
        assert not is_file_change(first.lower())
        assert not is_file_change("bogus")

    def test_names_returns_copy(self) -> None:
        a = file_change_names()
        a.append("bogus")
        assert "bogus" not in FILE_CHANGE_ELEMENTS
        assert set(file_change_names()) == set(FILE_CHANGE_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(FILE_CHANGE_DOMAIN.values())))
        assert isinstance(file_change_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", FILE_CHANGE_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_file_change(name, count) == name

    @pytest.mark.parametrize("name,count", FILE_CHANGE_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(FileChangeError, match="元素数应为"):
            validate_file_change(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(FileChangeError):
            ensure_file_change("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(FileChangeError):
            expected_file_change_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("Add", "Delete"):
            assert nm in FILE_CHANGE_ELEMENTS
            assert nm.lower() not in FILE_CHANGE_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(FILE_CHANGE_ELEMENTS.values()) == {1, 2}
