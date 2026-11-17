# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R64 pytest: hook_field_type_contract field-type signature contract. Watermark by build.py."""
from __future__ import annotations

import pytest

from app.core.hook_field_type_contract import (
    HOOK_FIELD_TYPE_SCHEMA_NAMES,
    HOOK_FIELD_TYPES,
    HookFieldTypeError,
    ensure_hook_field_type_schema,
    field_type_signature,
    fields_with_signature_kind,
    hook_field_type_schema_names,
    is_hook_field_type_schema,
    validate_hook_field_types,
)

EXPECTED = {
    'post-tool-use.command.input': {
        'agent_id': 'type=string',
        'agent_type': 'type=string',
        'cwd': 'type=string',
        'hook_event_name': 'type=string,const="PostToolUse"',
        'model': 'type=string',
        'permission_mode': 'type=string,enum=default|acceptEdits|plan|dontAsk|bypassPermissions',
        'session_id': 'type=string',
        'tool_input': 'any',
        'tool_name': 'type=string',
        'tool_response': 'any',
        'tool_use_id': 'type=string',
        'transcript_path': 'ref=NullableString',
        'turn_id': 'type=string',
    },
    'post-tool-use.command.output': {
        'continue': 'type=boolean,default=true',
        'decision': 'allOf=BlockDecisionWire,default=null',
        'hookSpecificOutput': 'allOf=PostToolUseHookSpecificOutputWire,default=null',
        'reason': 'type=string,default=null',
        'stopReason': 'type=string,default=null',
        'suppressOutput': 'type=boolean,default=false',
        'systemMessage': 'type=string,default=null',
    },
    'permission-request.command.input': {
        'agent_id': 'type=string',
        'agent_type': 'type=string',
        'cwd': 'type=string',
        'hook_event_name': 'type=string,const="PermissionRequest"',
        'model': 'type=string',
        'permission_mode': 'type=string,enum=default|acceptEdits|plan|dontAsk|bypassPermissions',
        'session_id': 'type=string',
        'tool_input': 'any',
        'tool_name': 'type=string',
        'transcript_path': 'ref=NullableString',
        'turn_id': 'type=string',
    },
    'permission-request.command.output': {
        'continue': 'type=boolean,default=true',
        'hookSpecificOutput': 'allOf=PermissionRequestHookSpecificOutputWire,default=null',
        'stopReason': 'type=string,default=null',
        'suppressOutput': 'type=boolean,default=false',
        'systemMessage': 'type=string,default=null',
    },
    'post-compact.command.input': {
        'agent_id': 'type=string',
        'agent_type': 'type=string',
        'cwd': 'type=string',
        'hook_event_name': 'type=string,const="PostCompact"',
        'model': 'type=string',
        'session_id': 'type=string',
        'transcript_path': 'ref=NullableString',
        'trigger': 'type=string,enum=manual|auto',
        'turn_id': 'type=string',
    },
    'post-compact.command.output': {
        'continue': 'type=boolean,default=true',
        'stopReason': 'type=string,default=null',
        'suppressOutput': 'type=boolean,default=false',
        'systemMessage': 'type=string,default=null',
    },
    'pre-tool-use.command.input': {
        'agent_id': 'type=string',
        'agent_type': 'type=string',
        'cwd': 'type=string',
        'hook_event_name': 'type=string,const="PreToolUse"',
        'model': 'type=string',
        'permission_mode': 'type=string,enum=default|acceptEdits|plan|dontAsk|bypassPermissions',
        'session_id': 'type=string',
        'tool_input': 'any',
        'tool_name': 'type=string',
        'tool_use_id': 'type=string',
        'transcript_path': 'ref=NullableString',
        'turn_id': 'type=string',
    },
    'pre-tool-use.command.output': {
        'continue': 'type=boolean,default=true',
        'decision': 'allOf=PreToolUseDecisionWire,default=null',
        'hookSpecificOutput': 'allOf=PreToolUseHookSpecificOutputWire,default=null',
        'reason': 'type=string,default=null',
        'stopReason': 'type=string,default=null',
        'suppressOutput': 'type=boolean,default=false',
        'systemMessage': 'type=string,default=null',
    },
    'pre-compact.command.input': {
        'agent_id': 'type=string',
        'agent_type': 'type=string',
        'cwd': 'type=string',
        'hook_event_name': 'type=string,const="PreCompact"',
        'model': 'type=string',
        'session_id': 'type=string',
        'transcript_path': 'ref=NullableString',
        'trigger': 'type=string,enum=manual|auto',
        'turn_id': 'type=string',
    },
    'pre-compact.command.output': {
        'continue': 'type=boolean,default=true',
        'stopReason': 'type=string,default=null',
        'suppressOutput': 'type=boolean,default=false',
        'systemMessage': 'type=string,default=null',
    },
    'session-start.command.input': {
        'cwd': 'type=string',
        'hook_event_name': 'type=string,const="SessionStart"',
        'model': 'type=string',
        'permission_mode': 'type=string,enum=default|acceptEdits|plan|dontAsk|bypassPermissions',
        'session_id': 'type=string',
        'source': 'type=string,enum=startup|resume|clear|compact|fork',
        'transcript_path': 'ref=NullableString',
    },
    'session-start.command.output': {
        'continue': 'type=boolean,default=true',
        'hookSpecificOutput': 'allOf=SessionStartHookSpecificOutputWire,default=null',
        'stopReason': 'type=string,default=null',
        'suppressOutput': 'type=boolean,default=false',
        'systemMessage': 'type=string,default=null',
    },
    'session-end.command.input': {
        'cwd': 'type=string',
        'hook_event_name': 'type=string,const="SessionEnd"',
        'reason': 'type=string,const="other"',
        'session_id': 'type=string',
        'transcript_path': 'ref=NullableString',
    },
    'subagent-start.command.input': {
        'agent_id': 'type=string',
        'agent_type': 'type=string',
        'cwd': 'type=string',
        'hook_event_name': 'type=string,const="SubagentStart"',
        'model': 'type=string',
        'permission_mode': 'type=string,enum=default|acceptEdits|plan|dontAsk|bypassPermissions',
        'session_id': 'type=string',
        'transcript_path': 'ref=NullableString',
        'turn_id': 'type=string',
    },
    'subagent-start.command.output': {
        'continue': 'type=boolean,default=true',
        'hookSpecificOutput': 'allOf=SubagentStartHookSpecificOutputWire,default=null',
        'stopReason': 'type=string,default=null',
        'suppressOutput': 'type=boolean,default=false',
        'systemMessage': 'type=string,default=null',
    },
    'subagent-stop.command.input': {
        'agent_id': 'type=string',
        'agent_transcript_path': 'ref=NullableString',
        'agent_type': 'type=string',
        'cwd': 'type=string',
        'hook_event_name': 'type=string,const="SubagentStop"',
        'last_assistant_message': 'ref=NullableString',
        'model': 'type=string',
        'permission_mode': 'type=string,enum=default|acceptEdits|plan|dontAsk|bypassPermissions',
        'session_id': 'type=string',
        'stop_hook_active': 'type=boolean',
        'transcript_path': 'ref=NullableString',
        'turn_id': 'type=string',
    },
    'subagent-stop.command.output': {
        'continue': 'type=boolean,default=true',
        'decision': 'allOf=BlockDecisionWire,default=null',
        'reason': 'type=string,default=null',
        'stopReason': 'type=string,default=null',
        'suppressOutput': 'type=boolean,default=false',
        'systemMessage': 'type=string,default=null',
    },
    'user-prompt-submit.command.input': {
        'agent_id': 'type=string',
        'agent_type': 'type=string',
        'cwd': 'type=string',
        'hook_event_name': 'type=string,const="UserPromptSubmit"',
        'model': 'type=string',
        'permission_mode': 'type=string,enum=default|acceptEdits|plan|dontAsk|bypassPermissions',
        'prompt': 'type=string',
        'session_id': 'type=string',
        'transcript_path': 'ref=NullableString',
        'turn_id': 'type=string',
    },
    'user-prompt-submit.command.output': {
        'continue': 'type=boolean,default=true',
        'decision': 'allOf=BlockDecisionWire,default=null',
        'hookSpecificOutput': 'allOf=UserPromptSubmitHookSpecificOutputWire,default=null',
        'reason': 'type=string,default=null',
        'stopReason': 'type=string,default=null',
        'suppressOutput': 'type=boolean,default=false',
        'systemMessage': 'type=string,default=null',
    },
    'stop.command.input': {
        'cwd': 'type=string',
        'hook_event_name': 'type=string,const="Stop"',
        'last_assistant_message': 'ref=NullableString',
        'model': 'type=string',
        'permission_mode': 'type=string,enum=default|acceptEdits|plan|dontAsk|bypassPermissions',
        'session_id': 'type=string',
        'stop_hook_active': 'type=boolean',
        'transcript_path': 'ref=NullableString',
        'turn_id': 'type=string',
    },
    'stop.command.output': {
        'continue': 'type=boolean,default=true',
        'decision': 'allOf=BlockDecisionWire,default=null',
        'reason': 'type=string,default=null',
        'stopReason': 'type=string,default=null',
        'suppressOutput': 'type=boolean,default=false',
        'systemMessage': 'type=string,default=null',
    },
    'interrupt.command.input': {
        'cwd': 'type=string',
        'hook_event_name': 'type=string,const="Interrupt"',
        'model': 'type=string',
        'permission_mode': 'type=string,enum=default|acceptEdits|plan|dontAsk|bypassPermissions',
        'session_id': 'type=string',
        'transcript_path': 'ref=NullableString',
        'turn_id': 'type=string',
    },
    'interrupt.command.output': {
        'systemMessage': 'type=string,default=null',
    },
}
ANCHOR = "post-tool-use.command.input"
class TestFieldTypesExact:
    def test_all_field_types_exact(self) -> None:
        assert HOOK_FIELD_TYPES == EXPECTED
    def test_name_set_matches(self) -> None:
        assert HOOK_FIELD_TYPE_SCHEMA_NAMES == set(EXPECTED) == set(hook_field_type_schema_names())
    def test_anchor_permission_mode_enum(self) -> None:
        assert field_type_signature(ANCHOR, "permission_mode") == "type=string,enum=default|acceptEdits|plan|dontAsk|bypassPermissions"
    def test_hook_event_name_const(self) -> None:
        assert 'const="PostToolUse"' in field_type_signature(ANCHOR, "hook_event_name")
    def test_transcript_path_nullable_ref(self) -> None:
        assert field_type_signature(ANCHOR, "transcript_path") == "ref=NullableString"
    def test_any_bool_fields(self) -> None:
        assert field_type_signature(ANCHOR, "tool_input") == "any"
        assert field_type_signature(ANCHOR, "tool_response") == "any"
    def test_output_default(self) -> None:
        assert field_type_signature("post-tool-use.command.output", "continue") == "type=boolean,default=true"
    def test_reverse_lookup_const(self) -> None:
        assert fields_with_signature_kind(ANCHOR, "const=") == ("hook_event_name",)
    def test_names_returns_copy(self) -> None:
        a = hook_field_type_schema_names(); a.append("bogus")
        assert "bogus" not in HOOK_FIELD_TYPE_SCHEMA_NAMES
class TestValidation:
    def test_valid_passes(self) -> None:
        assert validate_hook_field_types(ANCHOR, HOOK_FIELD_TYPES[ANCHOR]) == ANCHOR
    def test_bad_title_rejected(self) -> None:
        with pytest.raises(HookFieldTypeError): validate_hook_field_types("bogus", {})
    def test_missing_field_rejected(self) -> None:
        m = dict(HOOK_FIELD_TYPES[ANCHOR]); m.pop("cwd")
        with pytest.raises(HookFieldTypeError): validate_hook_field_types(ANCHOR, m)
    def test_extra_field_rejected(self) -> None:
        m = dict(HOOK_FIELD_TYPES[ANCHOR]); m["bogus"] = "type=string"
        with pytest.raises(HookFieldTypeError): validate_hook_field_types(ANCHOR, m)
    def test_wrong_signature_rejected(self) -> None:
        m = dict(HOOK_FIELD_TYPES[ANCHOR]); m["permission_mode"] = "type=integer"
        with pytest.raises(HookFieldTypeError): validate_hook_field_types(ANCHOR, m)
    def test_is_and_ensure(self) -> None:
        assert is_hook_field_type_schema(ANCHOR) and not is_hook_field_type_schema("bogus")
        assert ensure_hook_field_type_schema(ANCHOR) == ANCHOR
        with pytest.raises(HookFieldTypeError): ensure_hook_field_type_schema("bogus")
    def test_unknown_field_rejected(self) -> None:
        with pytest.raises(HookFieldTypeError): field_type_signature(ANCHOR, "bogus")
