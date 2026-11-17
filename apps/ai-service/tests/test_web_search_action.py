# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R61 pytest: web_search_action protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.web_search_action import (
    WEB_SEARCH_ACTION_DOMAIN,
    WEB_SEARCH_ACTION_ELEMENTS,
    WebSearchAction,
    WebSearchActionError,
    ensure_web_search_action,
    expected_web_search_action_element_count,
    is_web_search_action,
    validate_web_search_action,
    web_search_action_domain,
    web_search_action_domain_members,
    web_search_action_names,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert WEB_SEARCH_ACTION_ELEMENTS == {"FindInPage": 2, "OpenPage": 1, "Search": 2}

    def test_closed_set_cardinality(self) -> None:
        assert len(WebSearchAction) == len(WEB_SEARCH_ACTION_ELEMENTS) == 3

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in WebSearchAction} == set(WEB_SEARCH_ACTION_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in WEB_SEARCH_ACTION_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(WEB_SEARCH_ACTION_DOMAIN) == set(WEB_SEARCH_ACTION_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('Search', 'discovery'), ('FindInPage', 'navigation')])
    def test_domain(self, name, expected) -> None:
        assert web_search_action_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(WebSearchActionError):
            web_search_action_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(WEB_SEARCH_ACTION_DOMAIN.values()):
            seen.extend(web_search_action_domain_members(domain))
        assert sorted(seen) == sorted(WEB_SEARCH_ACTION_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(WebSearchActionError):
            web_search_action_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_web_search_action(nm) for nm in WEB_SEARCH_ACTION_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "FindInPage"
        assert first in WEB_SEARCH_ACTION_ELEMENTS
        assert not is_web_search_action(first.lower())
        assert not is_web_search_action("bogus")

    def test_names_returns_copy(self) -> None:
        a = web_search_action_names()
        a.append("bogus")
        assert "bogus" not in WEB_SEARCH_ACTION_ELEMENTS
        assert set(web_search_action_names()) == set(WEB_SEARCH_ACTION_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(WEB_SEARCH_ACTION_DOMAIN.values())))
        assert isinstance(web_search_action_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", WEB_SEARCH_ACTION_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_web_search_action(name, count) == name

    @pytest.mark.parametrize("name,count", WEB_SEARCH_ACTION_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(WebSearchActionError, match="元素数应为"):
            validate_web_search_action(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(WebSearchActionError):
            ensure_web_search_action("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(WebSearchActionError):
            expected_web_search_action_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("FindInPage", "OpenPage"):
            assert nm in WEB_SEARCH_ACTION_ELEMENTS
            assert nm.lower() not in WEB_SEARCH_ACTION_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(WEB_SEARCH_ACTION_ELEMENTS.values()) == {1, 2}
