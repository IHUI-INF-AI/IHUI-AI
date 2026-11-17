# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R61 pytest: plugin_source protocol-surface closed set (medium manifest family).

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.plugin_source import (
    PLUGIN_SOURCE_DOMAIN,
    PLUGIN_SOURCE_ELEMENTS,
    PluginSource,
    PluginSourceError,
    ensure_plugin_source,
    expected_plugin_source_element_count,
    is_plugin_source,
    plugin_source_domain,
    plugin_source_domain_members,
    plugin_source_names,
    validate_plugin_source,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert PLUGIN_SOURCE_ELEMENTS == {"Git": 4, "Local": 1, "Npm": 3}

    def test_closed_set_cardinality(self) -> None:
        assert len(PluginSource) == len(PLUGIN_SOURCE_ELEMENTS) == 3

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in PluginSource} == set(PLUGIN_SOURCE_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in PLUGIN_SOURCE_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(PLUGIN_SOURCE_DOMAIN) == set(PLUGIN_SOURCE_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('Local', 'local'), ('Git', 'remote')])
    def test_domain(self, name, expected) -> None:
        assert plugin_source_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(PluginSourceError):
            plugin_source_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(PLUGIN_SOURCE_DOMAIN.values()):
            seen.extend(plugin_source_domain_members(domain))
        assert sorted(seen) == sorted(PLUGIN_SOURCE_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(PluginSourceError):
            plugin_source_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_plugin_source(nm) for nm in PLUGIN_SOURCE_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "Git"
        assert first in PLUGIN_SOURCE_ELEMENTS
        assert not is_plugin_source(first.lower())
        assert not is_plugin_source("bogus")

    def test_names_returns_copy(self) -> None:
        a = plugin_source_names()
        a.append("bogus")
        assert "bogus" not in PLUGIN_SOURCE_ELEMENTS
        assert set(plugin_source_names()) == set(PLUGIN_SOURCE_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(PLUGIN_SOURCE_DOMAIN.values())))
        assert isinstance(plugin_source_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", PLUGIN_SOURCE_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_plugin_source(name, count) == name

    @pytest.mark.parametrize("name,count", PLUGIN_SOURCE_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(PluginSourceError, match="元素数应为"):
            validate_plugin_source(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(PluginSourceError):
            ensure_plugin_source("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(PluginSourceError):
            expected_plugin_source_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("Git", "Local"):
            assert nm in PLUGIN_SOURCE_ELEMENTS
            assert nm.lower() not in PLUGIN_SOURCE_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(PLUGIN_SOURCE_ELEMENTS.values()) == {1, 3, 4}
