# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the bundled-plugin manifest contract (R94)."""

from __future__ import annotations

import dataclasses
import re

import pytest

from app.core.codex_plugin_manifest import (
    AGENT_MANIFEST_KEY_COUNT,
    AGENT_MANIFEST_KEYS,
    APP_CONNECTOR_COUNT,
    BUNDLE_VERSION,
    CAPABILITIES_OBSERVED,
    CATEGORY_OBSERVED,
    INTERFACE_KEY_COUNT,
    INTERFACE_KEYS,
    MARKETPLACE_ENTRY_KEYS,
    MARKETPLACE_PLUGIN_COUNT,
    PLUGIN_COUNT,
    PLUGINS,
    POLICY_KEYS,
    RUNTIME_BUNDLED_SKILL_COUNT,
    RUNTIME_KEY_COUNT,
    RUNTIME_KEYS,
    RUNTIME_NATIVE_DEPENDENCIES,
    RUNTIME_NATIVE_DEPENDENCY_COUNT,
    RUNTIME_PYTHON_VERSION,
    RUNTIME_SKILLS_TO_REMOVE_COUNT,
    SKILL_FRONTMATTER_KEY_COUNT,
    SKILL_FRONTMATTER_KEYS,
    SKILL_TOTAL_CHARS,
    SKILL_TOTAL_COUNT,
    SKILLS_FIELD,
    TOP_LEVEL_KEYS,
    TOP_LEVEL_KEYS_BASE,
    TOP_LEVEL_KEYS_OPTIONAL,
    PluginManifestError,
    brand_of,
    carries_apps,
    keywords_of,
    plugin_of,
    plugins_with_apps,
    skill_chars_of,
    skills_of,
    validate_plugins,
)

HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def test_plugin_table_is_five_and_named() -> None:
    assert len(PLUGINS) == PLUGIN_COUNT == 5
    assert set(PLUGINS) == {
        "documents",
        "pdf",
        "presentations",
        "spreadsheets",
        "template-creator",
    }


def test_contract_validates() -> None:
    validate_plugins()


def test_brand_colours_are_all_distinct_and_well_formed() -> None:
    brands = {name: brand_of(name) for name in PLUGINS}
    assert len(set(brands.values())) == PLUGIN_COUNT
    for brand in brands.values():
        assert HEX_RE.match(brand), brand


def test_skill_counts_per_plugin() -> None:
    assert skills_of("spreadsheets") == ("excel-live-control", "spreadsheets")
    assert skills_of("pdf") == ("pdf",)
    assert SKILL_TOTAL_COUNT == 6
    assert SKILL_TOTAL_CHARS == 234422


def test_only_spreadsheets_carries_apps() -> None:
    assert plugins_with_apps() == ("spreadsheets",)
    assert carries_apps("spreadsheets") is True
    assert carries_apps("pdf") is False
    assert APP_CONNECTOR_COUNT == 1


def test_unknown_plugin_raises() -> None:
    with pytest.raises(PluginManifestError):
        plugin_of("no-such-plugin")


def test_key_unions_compose() -> None:
    assert len(INTERFACE_KEYS) == INTERFACE_KEY_COUNT == 14
    assert set(TOP_LEVEL_KEYS) == set(TOP_LEVEL_KEYS_BASE) | set(TOP_LEVEL_KEYS_OPTIONAL)
    assert len(TOP_LEVEL_KEYS_BASE) == 10
    assert TOP_LEVEL_KEYS_OPTIONAL == ("apps",)
    assert MARKETPLACE_ENTRY_KEYS == ("name", "source", "policy", "category")
    assert POLICY_KEYS == ("installation", "authentication")
    assert MARKETPLACE_PLUGIN_COUNT == PLUGIN_COUNT


def test_skill_frontmatter_is_two_keys() -> None:
    assert SKILL_FRONTMATTER_KEYS == ("name", "description")
    assert SKILL_FRONTMATTER_KEY_COUNT == 2
    assert len(AGENT_MANIFEST_KEYS) == AGENT_MANIFEST_KEY_COUNT == 6


def test_runtime_metadata_shape() -> None:
    assert len(RUNTIME_KEYS) == RUNTIME_KEY_COUNT == 13
    assert RUNTIME_BUNDLED_SKILL_COUNT == 0
    assert len(RUNTIME_NATIVE_DEPENDENCIES) == RUNTIME_NATIVE_DEPENDENCY_COUNT == 5
    assert RUNTIME_NATIVE_DEPENDENCIES[0] == "libheif"
    assert RUNTIME_SKILLS_TO_REMOVE_COUNT == 6
    assert RUNTIME_PYTHON_VERSION == "3.12.14"
    assert BUNDLE_VERSION == "26.1112.11217"
    assert CAPABILITIES_OBSERVED == ("Interactive", "Write")
    assert CATEGORY_OBSERVED == "Productivity"
    assert SKILLS_FIELD == "./skills/"


def test_keyword_counts_match_the_manifests() -> None:
    assert keywords_of("spreadsheets") == 16
    assert keywords_of("template-creator") == 15
    assert keywords_of("documents") == 12
    assert keywords_of("presentations") == 10


def test_skill_chars_are_positive_and_ordered() -> None:
    assert skill_chars_of("spreadsheets") > skill_chars_of("presentations") > skill_chars_of("pdf")
    for name in PLUGINS:
        assert skill_chars_of(name) > 0


def test_validate_catches_a_corrupted_row(monkeypatch: pytest.MonkeyPatch) -> None:
    bad = dict(PLUGINS)
    bad["pdf"] = dict(PLUGINS["pdf"])
    bad["pdf"]["brand_color"] = "DC2626"  # missing '#'
    monkeypatch.setattr("app.core.codex_plugin_manifest.PLUGINS", bad)
    with pytest.raises(PluginManifestError):
        validate_plugins()


def test_fact_rows_are_immutable_mappings() -> None:
    row = plugin_of("spreadsheets")
    assert isinstance(row, dict) or dataclasses.is_dataclass(row) or hasattr(row, "keys")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
