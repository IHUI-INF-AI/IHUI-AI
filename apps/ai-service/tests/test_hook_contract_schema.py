# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R63 pytest: hook_contract_schema field-level wire contract. Watermark by build.py."""
from __future__ import annotations

import pytest

from app.core.hook_contract_schema import (
    HOOK_SCHEMA_FIELDS,
    HOOK_SCHEMA_REQUIRED,
    HookContractSchema,
    HookContractSchemaError,
    ensure_hook_schema,
    expected_hook_schema_fields,
    expected_hook_schema_required,
    hook_schema_field_count,
    hook_schema_names,
    is_hook_schema,
    validate_hook_schema,
)

ANCHOR = 'interrupt.command.input'
class TestVerbatimSchema:
    def test_fields_exact(self) -> None:
        assert HOOK_SCHEMA_FIELDS == {
    "interrupt.command.input": ('cwd', 'hook_event_name', 'model', 'permission_mode', 'session_id', 'transcript_path', 'turn_id'),
    "interrupt.command.output": ('systemMessage',),
    "permission-request.command.input": ('agent_id', 'agent_type', 'cwd', 'hook_event_name', 'model', 'permission_mode', 'session_id', 'tool_input', 'tool_name', 'transcript_path', 'turn_id'),
    "permission-request.command.output": ('continue', 'hookSpecificOutput', 'stopReason', 'suppressOutput', 'systemMessage'),
    "post-compact.command.input": ('agent_id', 'agent_type', 'cwd', 'hook_event_name', 'model', 'session_id', 'transcript_path', 'trigger', 'turn_id'),
    "post-compact.command.output": ('continue', 'stopReason', 'suppressOutput', 'systemMessage'),
    "post-tool-use.command.input": ('agent_id', 'agent_type', 'cwd', 'hook_event_name', 'model', 'permission_mode', 'session_id', 'tool_input', 'tool_name', 'tool_response', 'tool_use_id', 'transcript_path', 'turn_id'),
    "post-tool-use.command.output": ('continue', 'decision', 'hookSpecificOutput', 'reason', 'stopReason', 'suppressOutput', 'systemMessage'),
    "pre-compact.command.input": ('agent_id', 'agent_type', 'cwd', 'hook_event_name', 'model', 'session_id', 'transcript_path', 'trigger', 'turn_id'),
    "pre-compact.command.output": ('continue', 'stopReason', 'suppressOutput', 'systemMessage'),
    "pre-tool-use.command.input": ('agent_id', 'agent_type', 'cwd', 'hook_event_name', 'model', 'permission_mode', 'session_id', 'tool_input', 'tool_name', 'tool_use_id', 'transcript_path', 'turn_id'),
    "pre-tool-use.command.output": ('continue', 'decision', 'hookSpecificOutput', 'reason', 'stopReason', 'suppressOutput', 'systemMessage'),
    "session-end.command.input": ('cwd', 'hook_event_name', 'reason', 'session_id', 'transcript_path'),
    "session-start.command.input": ('cwd', 'hook_event_name', 'model', 'permission_mode', 'session_id', 'source', 'transcript_path'),
    "session-start.command.output": ('continue', 'hookSpecificOutput', 'stopReason', 'suppressOutput', 'systemMessage'),
    "stop.command.input": ('cwd', 'hook_event_name', 'last_assistant_message', 'model', 'permission_mode', 'session_id', 'stop_hook_active', 'transcript_path', 'turn_id'),
    "stop.command.output": ('continue', 'decision', 'reason', 'stopReason', 'suppressOutput', 'systemMessage'),
    "subagent-start.command.input": ('agent_id', 'agent_type', 'cwd', 'hook_event_name', 'model', 'permission_mode', 'session_id', 'transcript_path', 'turn_id'),
    "subagent-start.command.output": ('continue', 'hookSpecificOutput', 'stopReason', 'suppressOutput', 'systemMessage'),
    "subagent-stop.command.input": ('agent_id', 'agent_transcript_path', 'agent_type', 'cwd', 'hook_event_name', 'last_assistant_message', 'model', 'permission_mode', 'session_id', 'stop_hook_active', 'transcript_path', 'turn_id'),
    "subagent-stop.command.output": ('continue', 'decision', 'reason', 'stopReason', 'suppressOutput', 'systemMessage'),
    "user-prompt-submit.command.input": ('agent_id', 'agent_type', 'cwd', 'hook_event_name', 'model', 'permission_mode', 'prompt', 'session_id', 'transcript_path', 'turn_id'),
    "user-prompt-submit.command.output": ('continue', 'decision', 'hookSpecificOutput', 'reason', 'stopReason', 'suppressOutput', 'systemMessage'),
}
    def test_required_exact(self) -> None:
        assert HOOK_SCHEMA_REQUIRED == {
    "interrupt.command.input": ('cwd', 'hook_event_name', 'model', 'permission_mode', 'session_id', 'transcript_path', 'turn_id'),
    "interrupt.command.output": (),
    "permission-request.command.input": ('cwd', 'hook_event_name', 'model', 'permission_mode', 'session_id', 'tool_input', 'tool_name', 'transcript_path', 'turn_id'),
    "permission-request.command.output": (),
    "post-compact.command.input": ('cwd', 'hook_event_name', 'model', 'session_id', 'transcript_path', 'trigger', 'turn_id'),
    "post-compact.command.output": (),
    "post-tool-use.command.input": ('cwd', 'hook_event_name', 'model', 'permission_mode', 'session_id', 'tool_input', 'tool_name', 'tool_response', 'tool_use_id', 'transcript_path', 'turn_id'),
    "post-tool-use.command.output": (),
    "pre-compact.command.input": ('cwd', 'hook_event_name', 'model', 'session_id', 'transcript_path', 'trigger', 'turn_id'),
    "pre-compact.command.output": (),
    "pre-tool-use.command.input": ('cwd', 'hook_event_name', 'model', 'permission_mode', 'session_id', 'tool_input', 'tool_name', 'tool_use_id', 'transcript_path', 'turn_id'),
    "pre-tool-use.command.output": (),
    "session-end.command.input": ('cwd', 'hook_event_name', 'reason', 'session_id', 'transcript_path'),
    "session-start.command.input": ('cwd', 'hook_event_name', 'model', 'permission_mode', 'session_id', 'source', 'transcript_path'),
    "session-start.command.output": (),
    "stop.command.input": ('cwd', 'hook_event_name', 'last_assistant_message', 'model', 'permission_mode', 'session_id', 'stop_hook_active', 'transcript_path', 'turn_id'),
    "stop.command.output": (),
    "subagent-start.command.input": ('agent_id', 'agent_type', 'cwd', 'hook_event_name', 'model', 'permission_mode', 'session_id', 'transcript_path', 'turn_id'),
    "subagent-start.command.output": (),
    "subagent-stop.command.input": ('agent_id', 'agent_transcript_path', 'agent_type', 'cwd', 'hook_event_name', 'last_assistant_message', 'model', 'permission_mode', 'session_id', 'stop_hook_active', 'transcript_path', 'turn_id'),
    "subagent-stop.command.output": (),
    "user-prompt-submit.command.input": ('cwd', 'hook_event_name', 'model', 'permission_mode', 'prompt', 'session_id', 'transcript_path', 'turn_id'),
    "user-prompt-submit.command.output": (),
}
    def test_enum_matches_tables(self) -> None:
        assert {m.value for m in HookContractSchema} == set(HOOK_SCHEMA_FIELDS) == set(HOOK_SCHEMA_REQUIRED)
        assert len(HookContractSchema) == 23
    def test_required_subset_properties(self) -> None:
        for title, fields in HOOK_SCHEMA_FIELDS.items():
            assert set(HOOK_SCHEMA_REQUIRED[title]) <= set(fields), title
    def test_names_returns_copy(self) -> None:
        a = hook_schema_names(); a.append("bogus")
        assert "bogus" not in HOOK_SCHEMA_FIELDS
class TestAccessors:
    def test_fields_required_accessors(self) -> None:
        assert expected_hook_schema_fields(ANCHOR) == HOOK_SCHEMA_FIELDS[ANCHOR]
        assert expected_hook_schema_required(ANCHOR) == HOOK_SCHEMA_REQUIRED[ANCHOR]
        assert hook_schema_field_count(ANCHOR) == len(HOOK_SCHEMA_FIELDS[ANCHOR])
    def test_rejects_unregistered(self) -> None:
        for fn in (expected_hook_schema_fields, expected_hook_schema_required, hook_schema_field_count, ensure_hook_schema):
            with pytest.raises(HookContractSchemaError): fn("bogus")
    def test_membership(self) -> None:
        assert is_hook_schema(ANCHOR) and not is_hook_schema("bogus")
class TestConsistencyGate:
    @pytest.mark.parametrize("title", sorted(HOOK_SCHEMA_FIELDS))
    def test_validate_ok(self, title: str) -> None:
        assert validate_hook_schema(title, HOOK_SCHEMA_FIELDS[title], HOOK_SCHEMA_REQUIRED[title]) == title
    def test_validate_rejects_wrong_fields(self) -> None:
        with pytest.raises(HookContractSchemaError, match="字段名序列"):
            validate_hook_schema(ANCHOR, ("bogus",), HOOK_SCHEMA_REQUIRED[ANCHOR])
    def test_validate_rejects_wrong_required(self) -> None:
        with pytest.raises(HookContractSchemaError, match="required 应为"):
            validate_hook_schema(ANCHOR, HOOK_SCHEMA_FIELDS[ANCHOR], ("bogus",))
    def test_input_has_required_output_empty(self) -> None:
        assert HOOK_SCHEMA_REQUIRED['post-tool-use.command.input']
        assert not HOOK_SCHEMA_REQUIRED['post-tool-use.command.output']
