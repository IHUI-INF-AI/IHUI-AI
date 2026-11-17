# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R61 pytest: exec_permission_profile protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.exec_permission_profile import (
    EXEC_PERMISSION_PROFILE_DOMAIN,
    EXEC_PERMISSION_PROFILE_ELEMENTS,
    ExecPermissionProfile,
    ExecPermissionProfileError,
    ensure_exec_permission_profile,
    exec_permission_profile_domain,
    exec_permission_profile_domain_members,
    exec_permission_profile_names,
    expected_exec_permission_profile_element_count,
    is_exec_permission_profile,
    validate_exec_permission_profile,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert EXEC_PERMISSION_PROFILE_ELEMENTS == {"External": 1, "Managed": 2}

    def test_closed_set_cardinality(self) -> None:
        assert len(ExecPermissionProfile) == len(EXEC_PERMISSION_PROFILE_ELEMENTS) == 2

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in ExecPermissionProfile} == set(EXEC_PERMISSION_PROFILE_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in EXEC_PERMISSION_PROFILE_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(EXEC_PERMISSION_PROFILE_DOMAIN) == set(EXEC_PERMISSION_PROFILE_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('External', 'external'), ('Managed', 'managed')])
    def test_domain(self, name, expected) -> None:
        assert exec_permission_profile_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(ExecPermissionProfileError):
            exec_permission_profile_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(EXEC_PERMISSION_PROFILE_DOMAIN.values()):
            seen.extend(exec_permission_profile_domain_members(domain))
        assert sorted(seen) == sorted(EXEC_PERMISSION_PROFILE_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(ExecPermissionProfileError):
            exec_permission_profile_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_exec_permission_profile(nm) for nm in EXEC_PERMISSION_PROFILE_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "External"
        assert first in EXEC_PERMISSION_PROFILE_ELEMENTS
        assert not is_exec_permission_profile(first.lower())
        assert not is_exec_permission_profile("bogus")

    def test_names_returns_copy(self) -> None:
        a = exec_permission_profile_names()
        a.append("bogus")
        assert "bogus" not in EXEC_PERMISSION_PROFILE_ELEMENTS
        assert set(exec_permission_profile_names()) == set(EXEC_PERMISSION_PROFILE_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(EXEC_PERMISSION_PROFILE_DOMAIN.values())))
        assert isinstance(exec_permission_profile_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", EXEC_PERMISSION_PROFILE_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_exec_permission_profile(name, count) == name

    @pytest.mark.parametrize("name,count", EXEC_PERMISSION_PROFILE_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ExecPermissionProfileError, match="元素数应为"):
            validate_exec_permission_profile(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(ExecPermissionProfileError):
            ensure_exec_permission_profile("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(ExecPermissionProfileError):
            expected_exec_permission_profile_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("External", "Managed"):
            assert nm in EXEC_PERMISSION_PROFILE_ELEMENTS
            assert nm.lower() not in EXEC_PERMISSION_PROFILE_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(EXEC_PERMISSION_PROFILE_ELEMENTS.values()) == {1, 2}
