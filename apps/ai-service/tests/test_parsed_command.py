# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R61 pytest: parsed_command protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.parsed_command import (
    PARSED_COMMAND_DOMAIN,
    PARSED_COMMAND_ELEMENTS,
    ParsedCommand,
    ParsedCommandError,
    ensure_parsed_command,
    expected_parsed_command_element_count,
    is_parsed_command,
    parsed_command_domain,
    parsed_command_domain_members,
    parsed_command_names,
    validate_parsed_command,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert PARSED_COMMAND_ELEMENTS == {"ListFiles": 2, "Read": 3, "Search": 3, "Unknown": 1}

    def test_closed_set_cardinality(self) -> None:
        assert len(ParsedCommand) == len(PARSED_COMMAND_ELEMENTS) == 4

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in ParsedCommand} == set(PARSED_COMMAND_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in PARSED_COMMAND_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(PARSED_COMMAND_DOMAIN) == set(PARSED_COMMAND_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('Search', 'discovery'), ('Unknown', 'fallback'), ('ListFiles', 'filesystem')])
    def test_domain(self, name, expected) -> None:
        assert parsed_command_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(ParsedCommandError):
            parsed_command_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(PARSED_COMMAND_DOMAIN.values()):
            seen.extend(parsed_command_domain_members(domain))
        assert sorted(seen) == sorted(PARSED_COMMAND_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(ParsedCommandError):
            parsed_command_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_parsed_command(nm) for nm in PARSED_COMMAND_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "ListFiles"
        assert first in PARSED_COMMAND_ELEMENTS
        assert not is_parsed_command(first.lower())
        assert not is_parsed_command("bogus")

    def test_names_returns_copy(self) -> None:
        a = parsed_command_names()
        a.append("bogus")
        assert "bogus" not in PARSED_COMMAND_ELEMENTS
        assert set(parsed_command_names()) == set(PARSED_COMMAND_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(PARSED_COMMAND_DOMAIN.values())))
        assert isinstance(parsed_command_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", PARSED_COMMAND_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_parsed_command(name, count) == name

    @pytest.mark.parametrize("name,count", PARSED_COMMAND_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ParsedCommandError, match="元素数应为"):
            validate_parsed_command(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(ParsedCommandError):
            ensure_parsed_command("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(ParsedCommandError):
            expected_parsed_command_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("ListFiles", "Read"):
            assert nm in PARSED_COMMAND_ELEMENTS
            assert nm.lower() not in PARSED_COMMAND_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(PARSED_COMMAND_ELEMENTS.values()) == {1, 2, 3}
