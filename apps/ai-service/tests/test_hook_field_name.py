# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R63 pytest: hook_field_name closed set. Watermark by build.py."""
from __future__ import annotations

import pytest

from app.core.hook_field_name import (
    HOOK_FIELD_STYLES,
    HOOK_FIELD_USAGE,
    HookFieldName,
    HookFieldNameError,
    ensure_hook_field,
    expected_hook_field_style,
    hook_field_names,
    hook_fields_by_style,
    is_hook_field,
    validate_hook_field,
)

CAMEL = 'hookSpecificOutput'
SNAKE = 'agent_id'
class TestVerbatimFields:
    def test_styles_exact(self) -> None:
        assert HOOK_FIELD_STYLES == {
    "agent_id": "snake",
    "agent_transcript_path": "snake",
    "agent_type": "snake",
    "continue": "snake",
    "cwd": "snake",
    "decision": "snake",
    "hookSpecificOutput": "camel",
    "hook_event_name": "snake",
    "last_assistant_message": "snake",
    "model": "snake",
    "permission_mode": "snake",
    "prompt": "snake",
    "reason": "snake",
    "session_id": "snake",
    "source": "snake",
    "stopReason": "camel",
    "stop_hook_active": "snake",
    "suppressOutput": "camel",
    "systemMessage": "camel",
    "tool_input": "snake",
    "tool_name": "snake",
    "tool_response": "snake",
    "tool_use_id": "snake",
    "transcript_path": "snake",
    "trigger": "snake",
    "turn_id": "snake",
}
    def test_usage_exact(self) -> None:
        assert HOOK_FIELD_USAGE == {
    "agent_id": 8,
    "agent_transcript_path": 1,
    "agent_type": 8,
    "continue": 10,
    "cwd": 12,
    "decision": 5,
    "hookSpecificOutput": 6,
    "hook_event_name": 12,
    "last_assistant_message": 2,
    "model": 11,
    "permission_mode": 9,
    "prompt": 1,
    "reason": 6,
    "session_id": 12,
    "source": 1,
    "stopReason": 10,
    "stop_hook_active": 2,
    "suppressOutput": 10,
    "systemMessage": 11,
    "tool_input": 3,
    "tool_name": 3,
    "tool_response": 1,
    "tool_use_id": 2,
    "transcript_path": 12,
    "trigger": 2,
    "turn_id": 10,
}
    def test_enum_matches(self) -> None:
        assert {m.value for m in HookFieldName} == set(HOOK_FIELD_STYLES)
        assert len(HookFieldName) == 26
    def test_names_copy(self) -> None:
        a = hook_field_names(); a.append("bogus"); assert "bogus" not in HOOK_FIELD_STYLES
class TestStyleClassification:
    def test_camel_snake_partition(self) -> None:
        c = set(hook_fields_by_style("camel")); s = set(hook_fields_by_style("snake"))
        assert c <= set(HOOK_FIELD_STYLES) and s <= set(HOOK_FIELD_STYLES)
        assert not (c & s) and c | s == set(HOOK_FIELD_STYLES)
        assert len(c) == 4 and len(s) == 22
    def test_rejects_unknown_style(self) -> None:
        with pytest.raises(HookFieldNameError): hook_fields_by_style("bogus")
    def test_style_accessor(self) -> None:
        assert expected_hook_field_style(CAMEL) == "camel"
class TestConsistencyGate:
    @pytest.mark.parametrize("field", sorted(HOOK_FIELD_STYLES))
    def test_validate_ok(self, field: str) -> None:
        assert validate_hook_field(field, HOOK_FIELD_STYLES[field], HOOK_FIELD_USAGE[field]) == field
    def test_validate_rejects_wrong_style(self) -> None:
        with pytest.raises(HookFieldNameError, match="风格应为"):
            validate_hook_field(CAMEL, "snake", HOOK_FIELD_USAGE[CAMEL])
    def test_validate_rejects_wrong_usage(self) -> None:
        with pytest.raises(HookFieldNameError, match="出现数应为"):
            validate_hook_field(SNAKE, HOOK_FIELD_STYLES[SNAKE], 999)
    def test_rejects_unregistered(self) -> None:
        for fn in (ensure_hook_field, expected_hook_field_style):
            with pytest.raises(HookFieldNameError): fn("bogus")
    def test_membership(self) -> None:
        assert is_hook_field(CAMEL) and not is_hook_field("bogus")
