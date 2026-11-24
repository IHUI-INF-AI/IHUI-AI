# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R57 config_layer_source 封闭集测试（统一工程规范；struct variant 逐字表 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.config_layer_source import (
    CONFIG_LAYER_ELEMENTS,
    LAYER_PRIORITY,
    ConfigLayerSource,
    ConfigLayerSourceError,
    config_layer_names,
    ensure_config_layer_source,
    expected_element_count,
    is_managed_layer,
    layer_scope,
    validate_config_layer,
)


class TestClosedSet:
    def test_member_count_is_7(self) -> None:
        assert len(ConfigLayerSource) == 7

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in ConfigLayerSource}
        assert got == set(CONFIG_LAYER_ELEMENTS)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"EnterpriseManaged", "LegacyManagedConfigTomlFromFile", "Mdm", "PackagedDefaults", "Project", "System", "User"} == {m.value for m in ConfigLayerSource}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"enterprise_managed", "Enterprise", "LegacyManagedConfigToml", "UserConfig"}.isdisjoint({m.value for m in ConfigLayerSource})


class TestElementCounts:
    def test_verbatim_element_count_table(self) -> None:
        """反向变异：任一 with-N-element 被篡改 ⇒ 逐字表失配转红。"""
        assert CONFIG_LAYER_ELEMENTS == {"EnterpriseManaged": 2, "LegacyManagedConfigTomlFromFile": 1, "Mdm": 2, "PackagedDefaults": 1, "Project": 1, "System": 1, "User": 2}

    @pytest.mark.parametrize("name,count", CONFIG_LAYER_ELEMENTS.items())
    def test_expected_element_count_matches(self, name, count) -> None:
        assert expected_element_count(name) == count

    def test_unknown_name_raises(self) -> None:
        with pytest.raises(ConfigLayerSourceError):
            expected_element_count("bogus")


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", CONFIG_LAYER_ELEMENTS)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_config_layer_source(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_variant", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(ConfigLayerSourceError):
            ensure_config_layer_source(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(ConfigLayerSourceError, match="app/core/config_layer_source.py"):
            ensure_config_layer_source("bogus")


class TestClassification:
    @pytest.mark.parametrize("value,expected", [
    ("EnterpriseManaged", "managed"),
    ("Mdm", "managed"),
    ("LegacyManagedConfigTomlFromFile", "managed"),
    ("User", "user"),
    ("Project", "user"),
    ("System", "system"),
    ("PackagedDefaults", "system"),
    ])
    def test_family(self, value, expected) -> None:
        assert layer_scope(value) == expected

    def test_family_rejects_unregistered(self) -> None:
        with pytest.raises(ConfigLayerSourceError):
            layer_scope("bogus")


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", CONFIG_LAYER_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_config_layer(name, count) == name

    @pytest.mark.parametrize("name,count", CONFIG_LAYER_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ConfigLayerSourceError, match="元素数应为"):
            validate_config_layer(name, count + 1)

    def test_names_returns_copy(self) -> None:
        a = config_layer_names()
        assert set(a) == set(CONFIG_LAYER_ELEMENTS)

    @pytest.mark.parametrize("v", ["EnterpriseManaged", "Mdm", "LegacyManagedConfigTomlFromFile"])
    def test_is_managed_true(self, v):
        assert is_managed_layer(v) is True

    @pytest.mark.parametrize("v", ["User", "Project", "System", "PackagedDefaults"])
    def test_is_managed_false(self, v):
        assert is_managed_layer(v) is False

    def test_priority_covers_all_and_managed_highest(self):
        assert set(LAYER_PRIORITY) == set(CONFIG_LAYER_ELEMENTS)
        assert LAYER_PRIORITY["Mdm"] > LAYER_PRIORITY["User"] > LAYER_PRIORITY["System"]
        assert LAYER_PRIORITY["EnterpriseManaged"] == LAYER_PRIORITY["LegacyManagedConfigTomlFromFile"]


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self) -> None:
        assert len(ConfigLayerSource) == len(CONFIG_LAYER_ELEMENTS) == 7
        assert {m.value for m in ConfigLayerSource} == set(CONFIG_LAYER_ELEMENTS)

    def test_case_sensitive_wire_names(self) -> None:
        """variant 名大小写敏感（Rust struct variant 逐字，小写形态非登记值）。"""
        first = "EnterpriseManaged"
        assert first in CONFIG_LAYER_ELEMENTS
        assert first.lower() not in CONFIG_LAYER_ELEMENTS
