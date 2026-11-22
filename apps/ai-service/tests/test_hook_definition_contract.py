# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R64 pytest: hook_definition_contract enum/object wire contract. Watermark by build.py."""
from __future__ import annotations

import pytest

from app.core.hook_definition_contract import (
    HOOK_DEFINITION_ENUMS,
    HOOK_DEFINITION_NAMES,
    HOOK_DEFINITION_NULLABLE,
    HOOK_DEFINITION_OBJECTS,
    HookDefinitionError,
    definition_enum_names,
    definition_object_names,
    ensure_hook_definition,
    expected_definition_enum,
    expected_definition_object,
    is_hook_definition,
    validate_definition_enum,
    validate_definition_object,
)

EXPECT_ENUMS = {
    'BlockDecisionWire': ('block',),
    'PermissionRequestBehaviorWire': ('allow', 'deny'),
    'PreToolUseDecisionWire': ('approve', 'block'),
    'PreToolUsePermissionDecisionWire': ('allow', 'deny', 'ask'),
}
EXPECT_OBJECTS = {
    'PostToolUseHookSpecificOutputWire': (('additionalContext', 'hookEventName', 'updatedMCPToolOutput'), ('hookEventName',)),
    'PermissionRequestDecisionWire': (('behavior', 'interrupt', 'message', 'updatedInput', 'updatedPermissions'), ('behavior',)),
    'PermissionRequestHookSpecificOutputWire': (('decision', 'hookEventName'), ('hookEventName',)),
    'PreToolUseHookSpecificOutputWire': (('additionalContext', 'hookEventName', 'permissionDecision', 'permissionDecisionReason', 'updatedInput'), ('hookEventName',)),
    'SessionStartHookSpecificOutputWire': (('additionalContext', 'hookEventName'), ('hookEventName',)),
    'SubagentStartHookSpecificOutputWire': (('additionalContext', 'hookEventName'), ('hookEventName',)),
    'UserPromptSubmitHookSpecificOutputWire': (('additionalContext', 'hookEventName'), ('hookEventName',)),
}
class TestDefinitionsExact:
    def test_enums_exact(self) -> None:
        assert HOOK_DEFINITION_ENUMS == EXPECT_ENUMS
    def test_objects_exact(self) -> None:
        assert HOOK_DEFINITION_OBJECTS == EXPECT_OBJECTS
    def test_nullable_exact(self) -> None:
        assert set(HOOK_DEFINITION_NULLABLE) == {"NullableString"}
    def test_names_union(self) -> None:
        union = set(EXPECT_ENUMS) | set(EXPECT_OBJECTS) | set(HOOK_DEFINITION_NULLABLE)
        assert set(HOOK_DEFINITION_NAMES) == union
    def test_enum_names(self) -> None:
        assert set(definition_enum_names()) == set(EXPECT_ENUMS)
    def test_object_names(self) -> None:
        assert set(definition_object_names()) == set(EXPECT_OBJECTS)
    def test_anchor_permission_decision(self) -> None:
        assert expected_definition_enum("PreToolUsePermissionDecisionWire") == ("allow", "deny", "ask")
    def test_anchor_pretool_decision(self) -> None:
        assert expected_definition_enum("PreToolUseDecisionWire") == ("approve", "block")
    def test_required_subset_for_all_objects(self) -> None:
        for name, (fields, required) in EXPECT_OBJECTS.items():
            assert set(required) <= set(fields), name
class TestValidation:
    def test_valid_enum_passes(self) -> None:
        for name, vals in EXPECT_ENUMS.items():
            assert validate_definition_enum(name, vals) == name
    def test_wrong_enum_rejected(self) -> None:
        with pytest.raises(HookDefinitionError):
            validate_definition_enum("PreToolUsePermissionDecisionWire", ("allow", "deny"))
    def test_reordered_enum_rejected(self) -> None:
        with pytest.raises(HookDefinitionError):
            validate_definition_enum("PreToolUsePermissionDecisionWire", ("ask", "allow", "deny"))
    def test_valid_object_passes(self) -> None:
        for name, (f, r) in EXPECT_OBJECTS.items():
            assert validate_definition_object(name, f, r) == name
    def test_wrong_object_field_rejected(self) -> None:
        f, r = EXPECT_OBJECTS["PostToolUseHookSpecificOutputWire"]
        with pytest.raises(HookDefinitionError):
            validate_definition_object("PostToolUseHookSpecificOutputWire", f + ("bogus",), r)
    def test_wrong_required_rejected(self) -> None:
        f, _ = EXPECT_OBJECTS["PermissionRequestDecisionWire"]
        with pytest.raises(HookDefinitionError):
            validate_definition_object("PermissionRequestDecisionWire", f, ())
    def test_non_enum_as_enum_rejected(self) -> None:
        with pytest.raises(HookDefinitionError): expected_definition_enum("NullableString")
    def test_non_object_as_object_rejected(self) -> None:
        with pytest.raises(HookDefinitionError): expected_definition_object("BlockDecisionWire")
    def test_is_and_ensure(self) -> None:
        assert is_hook_definition("BlockDecisionWire") and not is_hook_definition("bogus")
        assert ensure_hook_definition("NullableString") == "NullableString"
        with pytest.raises(HookDefinitionError): ensure_hook_definition("bogus")
