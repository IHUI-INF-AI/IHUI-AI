# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R60 pytest: user_input protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.user_input import (
    USER_INPUT_DOMAIN,
    USER_INPUT_ELEMENTS,
    UserInput,
    UserInputError,
    ensure_user_input,
    expected_user_input_element_count,
    is_user_input,
    user_input_domain,
    user_input_domain_members,
    user_input_names,
    validate_user_input,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert USER_INPUT_ELEMENTS == {"LocalAudio": 1, "LocalImage": 2, "Mention": 2, "Skill": 2, "Text": 2}

    def test_closed_set_cardinality(self) -> None:
        assert len(UserInput) == len(USER_INPUT_ELEMENTS) == 5

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in UserInput} == set(USER_INPUT_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in USER_INPUT_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(USER_INPUT_DOMAIN) == set(USER_INPUT_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('LocalAudio', 'media'), ('Mention', 'reference'), ('Text', 'text')])
    def test_domain(self, name, expected) -> None:
        assert user_input_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(UserInputError):
            user_input_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(USER_INPUT_DOMAIN.values()):
            seen.extend(user_input_domain_members(domain))
        assert sorted(seen) == sorted(USER_INPUT_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(UserInputError):
            user_input_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_user_input(nm) for nm in USER_INPUT_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "LocalAudio"
        assert first in USER_INPUT_ELEMENTS
        assert not is_user_input(first.lower())
        assert not is_user_input("bogus")

    def test_names_returns_copy(self) -> None:
        a = user_input_names()
        a.append("bogus")
        assert "bogus" not in USER_INPUT_ELEMENTS
        assert set(user_input_names()) == set(USER_INPUT_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(USER_INPUT_DOMAIN.values())))
        assert isinstance(user_input_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", USER_INPUT_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_user_input(name, count) == name

    @pytest.mark.parametrize("name,count", USER_INPUT_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(UserInputError, match="元素数应为"):
            validate_user_input(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(UserInputError):
            ensure_user_input("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(UserInputError):
            expected_user_input_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("LocalAudio", "LocalImage"):
            assert nm in USER_INPUT_ELEMENTS
            assert nm.lower() not in USER_INPUT_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(USER_INPUT_ELEMENTS.values()) == {1, 2}
