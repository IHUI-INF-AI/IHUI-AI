# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R132: the field-level facts behind the 329 object schemas."""

from __future__ import annotations

import pytest

from app.core import app_server_field_contracts as fc


def test_scale_is_accounted_for() -> None:
    assert fc.OBJECTS_WITH_PROPERTIES + fc.OBJECTS_WITHOUT_PROPERTIES == fc.STABLE_OBJECT_COUNT
    assert fc.STABLE_OBJECT_COUNT == 329
    assert fc.OBJECTS_WITH_PROPERTIES == 285
    assert fc.OBJECTS_WITHOUT_PROPERTIES == 44


def test_required_is_declared_by_most_objects() -> None:
    assert fc.OBJECTS_WITH_REQUIRED == 259
    assert fc.REQUIRED_FIELD_TOTAL == 521
    assert fc.REQUIRED_FIELD_TOTAL >= fc.OBJECTS_WITH_REQUIRED


def test_field_slots_and_names() -> None:
    assert fc.FIELD_SLOT_TOTAL == 863
    assert fc.DISTINCT_FIELD_NAME_COUNT == 349
    assert fc.DESCRIBED_FIELD_COUNT == 312
    assert fc.NULLABLE_UNION_COUNT == 223


def test_type_distribution_is_complete() -> None:
    assert sum(fc.TYPE_DISTRIBUTION.values()) == fc.FIELD_SLOT_TOTAL
    assert fc.TYPE_DISTRIBUTION["string"] == 283
    assert fc.TYPE_DISTRIBUTION["no-type"] == fc.NO_TYPE_TOTAL
    assert fc.TYPE_DISTRIBUTION["bool-schema"] == 13


def test_untyped_fields_are_composed_not_forgotten() -> None:
    assert fc.NO_TYPE_TOTAL == 194
    assert sum(fc.NO_TYPE_BY_COMPOSER.values()) == fc.NO_TYPE_TOTAL
    assert fc.NO_TYPE_BY_COMPOSER["$ref"] == 92
    assert fc.NO_TYPE_BY_COMPOSER["anyOf"] == 71
    assert fc.NO_TYPE_BY_COMPOSER["allOf"] == 26
    assert fc.NO_TYPE_BY_COMPOSER["bare"] == 5


def test_the_only_snake_case_field_is_mcp_meta() -> None:
    assert fc.CAMEL_CASE_SLOTS + fc.SNAKE_CASE_SLOTS == fc.FIELD_SLOT_TOTAL
    assert fc.SNAKE_CASE_SLOTS == 4
    assert fc.SNAKE_CASE_FIELD_NAMES == ("_meta",)
    assert len(fc.SNAKE_CASE_OWNING_OBJECTS) == 4
    assert all(name.startswith("Mcp") for name in fc.SNAKE_CASE_OWNING_OBJECTS)


def test_naming_rule() -> None:
    assert fc.field_name_is_expected("threadId")
    assert fc.field_name_is_expected("_meta")
    assert not fc.field_name_is_expected("thread_id")
    assert fc.is_snake_case_field("_meta")
    assert not fc.is_snake_case_field("threadId")


def test_families() -> None:
    assert sum(fc.FAMILY_OBJECT_COUNTS.values()) == fc.FAMILY_TOTAL_ACROSS_LISTED == 168
    assert fc.family_object_count("Thread") == 91
    assert fc.family_object_count("Plugin") == 24
    assert fc.family_object_count("Account") == 3
    assert fc.family_object_count("Unlisted") == 0


def test_biggest_objects() -> None:
    assert fc.object_field_count("TurnStartParams") == 19
    assert fc.object_field_count("ThreadStartParams") == 15
    assert fc.object_field_count("ThreadForkParams") == 15
    assert fc.object_field_count("Nope") == -1


def test_turn_start_requires_only_input_and_thread() -> None:
    assert fc.TURN_START_PARAMS_FIELD_COUNT == len(fc.TURN_START_PARAMS_FIELDS) == 19
    assert fc.TURN_START_PARAMS_REQUIRED == ("input", "threadId")
    assert fc.required_is_subset_of_fields(
        "TurnStartParams", fc.TURN_START_PARAMS_FIELDS, fc.TURN_START_PARAMS_REQUIRED
    )
    assert "serviceTier" in fc.TURN_START_PARAMS_FIELDS
    assert "serviceTierForTurn" in fc.TURN_START_PARAMS_FIELDS


def test_thread_start_requires_nothing() -> None:
    assert fc.THREAD_START_PARAMS_FIELD_COUNT == len(fc.THREAD_START_PARAMS_FIELDS) == 15
    assert fc.THREAD_START_PARAMS_REQUIRED == ()
    assert fc.THREAD_START_REQUIRES_NOTHING is True
    assert fc.THREAD_START_PARAMS_FIELDS[6] == "ephemeral"
    assert fc.THREAD_START_CONFIG_IS_AN_OPEN_BAG is True


def test_thread_fork_requires_only_thread_id() -> None:
    assert fc.THREAD_FORK_PARAMS_FIELD_COUNT == len(fc.THREAD_FORK_PARAMS_FIELDS) == 15
    assert fc.THREAD_FORK_PARAMS_REQUIRED == ("threadId",)
    assert "ephemeral" in fc.THREAD_FORK_PARAMS_FIELDS
    assert fc.required_is_subset_of_fields(
        "ThreadForkParams", fc.THREAD_FORK_PARAMS_FIELDS, fc.THREAD_FORK_PARAMS_REQUIRED
    )


def test_coverage_shape() -> None:
    cov = fc.coverage()
    assert cov["objects"] == 329
    assert cov["field_slots"] == 863
    assert cov["snake_case"] == 4
    assert set(cov) == {
        "objects",
        "objects_with_properties",
        "field_slots",
        "distinct_names",
        "required_fields",
        "snake_case",
        "no_type",
        "nullable",
    }


def test_contract_holds() -> None:
    assert fc.validate_contract() == []


def test_contract_catches_drifted_slots(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fc, "TYPE_DISTRIBUTION", {**fc.TYPE_DISTRIBUTION, "string": 284})
    problems = fc.validate_contract()
    assert any("sum to 863" in p for p in problems)


def test_contract_catches_a_second_snake_field(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fc, "SNAKE_CASE_FIELD_NAMES", ("_meta", "thread_id"))
    problems = fc.validate_contract()
    assert any("_meta is the only snake_case" in p for p in problems)


def test_contract_catches_required_naming_an_undeclared_field(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fc, "TURN_START_PARAMS_REQUIRED", ("input", "threadId", "modelName"))
    problems = fc.validate_contract()
    assert any("does not declare" in p for p in problems)


def test_contract_catches_thread_start_claiming_a_requirement(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fc, "THREAD_START_PARAMS_REQUIRED", ("model",))
    problems = fc.validate_contract()
    assert any("requires nothing" in p for p in problems)


def test_contract_catches_family_sum_drift(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        fc, "FAMILY_OBJECT_COUNTS", {**fc.FAMILY_OBJECT_COUNTS, "Thread": 92}
    )
    problems = fc.validate_contract()
    assert any("Thread must remain" in p or "sum to their pinned total" in p for p in problems)


def test_contract_catches_untyped_total_drift(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fc, "NO_TYPE_BY_COMPOSER", {"$ref": 93, "anyOf": 71, "allOf": 26, "bare": 5})
    problems = fc.validate_contract()
    assert any("composer breakdown" in p for p in problems)


def test_value_sets_are_a_level_below_properties() -> None:
    assert fc.ENUM_DEFINITION_COUNT == 131
    assert len(fc.ENUM_DEFINITIONS) == 131
    assert fc.ENUM_DEFINITION_OCCURRENCES == 700
    assert fc.ENUM_SUBSCHEMA_TOTAL == fc.INLINE_ENUM_SUBSCHEMAS + fc.ENUM_DEFINITION_SUBTREE_TOTAL


def test_no_const_in_the_dictionary() -> None:
    assert fc.CONST_DEFINITIONS == 0


def test_most_embedded_enum() -> None:
    assert fc.enum_values("ImageDetail") == ("auto", "low", "high", "original")
    assert fc.MOST_REPEATED_ENUMS[0] == ("ImageDetail", 24)


def test_a_one_value_enum_is_a_constant() -> None:
    assert fc.is_single_value_enum("AgentMessageDelivery")
    assert fc.enum_values("AgentMessageDelivery") == ("async",)
    assert not fc.is_single_value_enum("ImageDetail")
    assert fc.SINGLE_VALUE_ENUM_OCCURRENCES == 56


def test_widest_enum() -> None:
    name, width = fc.WIDEST_ENUM
    assert width == 35
    assert len(fc.enum_values(name)) == width


def test_unknown_enum_resolves_empty() -> None:
    assert fc.enum_values("NopeEnum") == ()
    assert not fc.is_single_value_enum("NopeEnum")


def test_the_dictionary_is_permissive_about_extra_fields() -> None:
    assert fc.ADDITIONAL_PROPERTIES_FALSE == 1
    assert (
        fc.ADDITIONAL_PROPERTIES_FALSE
        + fc.ADDITIONAL_PROPERTIES_TRUE
        + fc.ADDITIONAL_PROPERTIES_ABSENT
        == fc.STABLE_OBJECT_COUNT
    )
    assert fc.extra_fields_are_permitted() is True
    assert fc.PROPERTY_LEVEL_ADDITIONAL_PROPERTIES == 13


def test_value_surface_catches_a_renamed_enum(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        fc, "ENUM_DEFINITIONS", {**fc.ENUM_DEFINITIONS, "ImageDetail": ("auto", "low")}
    )
    problems = fc.validate_value_surface()
    assert any("ImageDetail" in p for p in problems)


def test_value_surface_catches_bucket_drift(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fc, "ADDITIONAL_PROPERTIES_FALSE", 2)
    problems = fc.validate_value_surface()
    assert any("forbids extra fields" in p for p in problems)


def test_the_one_strict_object_is_the_provider_write_path() -> None:
    assert fc.STRICT_OBJECT == "ModelProviderConfigWriteParams"
    assert fc.STRICT_OBJECT_FIELDS == ("settings",)
    assert fc.STRICT_OBJECT_REQUIRED == ("settings",)
    assert fc.required_is_subset_of_fields(
        fc.STRICT_OBJECT, fc.STRICT_OBJECT_FIELDS, fc.STRICT_OBJECT_REQUIRED
    )


def test_reference_surface() -> None:
    assert fc.REF_DIRECT_COUNT == 92
    assert fc.NO_TYPE_BY_COMPOSER["$ref"] == fc.REF_DIRECT_COUNT
    assert fc.REF_DIRECT_DISTINCT_TARGETS == 61
    assert fc.REF_IN_ANYOF == 71
    assert fc.REF_IN_ALLOF == 26
    assert fc.REF_RECURSIVE_TOTAL == 4586
    assert sum(count for _, count in fc.TOP_REF_TARGETS) <= fc.REF_DIRECT_COUNT
    assert ("AbsolutePathBuf", 7) in fc.TOP_REF_TARGETS
    assert ("Thread", 7) in fc.TOP_REF_TARGETS


def test_prose_surface() -> None:
    assert fc.DESCRIPTION_COUNT == fc.DESCRIBED_FIELD_COUNT == 312
    assert fc.DESCRIPTION_OPTIONAL_PREFIX == 59
    assert fc.DESCRIPTION_WITH_CONDITIONAL == 93
    assert fc.DESCRIPTION_MEDIAN_LENGTH == 72
    assert fc.DESCRIPTION_MAX_LENGTH == 726
    assert fc.DESCRIPTION_WITH_CONDITIONAL > fc.DESCRIPTION_OPTIONAL_PREFIX


def test_contract_catches_ref_total_drift(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fc, "REF_DIRECT_COUNT", 93)
    problems = fc.validate_contract()
    assert any("already counted as untyped" in p for p in problems)


def test_contract_catches_prose_drift(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fc, "DESCRIPTION_COUNT", 311)
    problems = fc.validate_contract()
    assert any("prose surface" in p for p in problems)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
