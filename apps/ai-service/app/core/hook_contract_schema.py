# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""hook 命令 schema 字段契约（23 段 JSON Schema） —— 统一工程规范 R63（字段级 wire 契约·hook command JSON Schema）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE）：允许多行的 mmap ASCII 抽取 → 花括号配对 →
``json.loads`` 成功且含 ``type``/``properties``/``title`` 的块，逐字提取 23 段内嵌 JSON Schema
（12 hook 家族 × input/output）。字段名是 schema ``properties`` 的逐字键（snake_case 与 camelCase
混合），``required`` 是经 ``required ⊆ properties`` 自证的必填子集。全部机器派生，零手敲字段名。

一轴超越：23 段 schema 的逐字 properties 字段名序列 + required 必填子集双表钉死；``validate_hook_schema(title, fields, required)`` 同时校验两段序列与子集关系，input 全 snake / output 含 camel 的原生差异逐字保留。

诚实边界：字段名与 required 全部来自 codex.exe 内嵌 JSON Schema 的逐字键，required⊆properties 已自证；字段**类型**（type/format）未纳入本轴（可后续扩展），``title`` 是 schema 自带标识非本仓命名。

源证据：``scripts/evidence`` 同型探针产物 ``R63/schemas.json``；报告 ``docs/engineering/round11-reverse/R63-*.md``。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "HookContractSchema",
    "HookContractSchemaError",
    "HOOK_SCHEMA_FIELDS",
    "HOOK_SCHEMA_REQUIRED",
    "HOOK_SCHEMA_NAMES",
    "hook_schema_names",
    "expected_hook_schema_fields",
    "expected_hook_schema_required",
    "hook_schema_field_count",
    "validate_hook_schema",
    "is_hook_schema",
    "ensure_hook_schema",
]

# 逐字 schema title → properties 字段名元组（键顺序逐字保留）。
HOOK_SCHEMA_FIELDS: Final[dict[str, tuple[str, ...]]] = {
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

# 逐字 schema title → required 字段名元组（已自证 required ⊆ properties）。
HOOK_SCHEMA_REQUIRED: Final[dict[str, tuple[str, ...]]] = {
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

HOOK_SCHEMA_NAMES: Final[frozenset[str]] = frozenset(HOOK_SCHEMA_FIELDS)


class HookContractSchema(StrEnum):
    """23 段 hook command JSON Schema title（逐字登记，真相源）。"""

    INTERRUPT_COMMAND_INPUT = "interrupt.command.input"
    INTERRUPT_COMMAND_OUTPUT = "interrupt.command.output"
    PERMISSION_REQUEST_COMMAND_INPUT = "permission-request.command.input"
    PERMISSION_REQUEST_COMMAND_OUTPUT = "permission-request.command.output"
    POST_COMPACT_COMMAND_INPUT = "post-compact.command.input"
    POST_COMPACT_COMMAND_OUTPUT = "post-compact.command.output"
    POST_TOOL_USE_COMMAND_INPUT = "post-tool-use.command.input"
    POST_TOOL_USE_COMMAND_OUTPUT = "post-tool-use.command.output"
    PRE_COMPACT_COMMAND_INPUT = "pre-compact.command.input"
    PRE_COMPACT_COMMAND_OUTPUT = "pre-compact.command.output"
    PRE_TOOL_USE_COMMAND_INPUT = "pre-tool-use.command.input"
    PRE_TOOL_USE_COMMAND_OUTPUT = "pre-tool-use.command.output"
    SESSION_END_COMMAND_INPUT = "session-end.command.input"
    SESSION_START_COMMAND_INPUT = "session-start.command.input"
    SESSION_START_COMMAND_OUTPUT = "session-start.command.output"
    STOP_COMMAND_INPUT = "stop.command.input"
    STOP_COMMAND_OUTPUT = "stop.command.output"
    SUBAGENT_START_COMMAND_INPUT = "subagent-start.command.input"
    SUBAGENT_START_COMMAND_OUTPUT = "subagent-start.command.output"
    SUBAGENT_STOP_COMMAND_INPUT = "subagent-stop.command.input"
    SUBAGENT_STOP_COMMAND_OUTPUT = "subagent-stop.command.output"
    USER_PROMPT_SUBMIT_COMMAND_INPUT = "user-prompt-submit.command.input"
    USER_PROMPT_SUBMIT_COMMAND_OUTPUT = "user-prompt-submit.command.output"


class HookContractSchemaError(ValueError):
    """未登记的 schema title / 字段或 required 不一致抛错。"""


def hook_schema_names() -> list[str]:
    """逐字 schema title 列表副本（顺序稳定）。"""
    return list(HOOK_SCHEMA_FIELDS)


def expected_hook_schema_fields(title: str) -> tuple[str, ...]:
    if title not in HOOK_SCHEMA_NAMES:
        raise HookContractSchemaError(f"未登记 schema: {title!r}")
    return HOOK_SCHEMA_FIELDS[title]


def expected_hook_schema_required(title: str) -> tuple[str, ...]:
    if title not in HOOK_SCHEMA_NAMES:
        raise HookContractSchemaError(f"未登记 schema: {title!r}")
    return HOOK_SCHEMA_REQUIRED[title]


def hook_schema_field_count(title: str) -> int:
    return len(expected_hook_schema_fields(title))


def is_hook_schema(value: str) -> bool:
    return isinstance(value, str) and value in HOOK_SCHEMA_NAMES


def ensure_hook_schema(value: str) -> str:
    if not is_hook_schema(value):
        raise HookContractSchemaError(f"未登记 schema: {value!r}")
    return value


def validate_hook_schema(
    title: str, fields: tuple[str, ...], required: tuple[str, ...]
) -> str:
    """一致性守门：字段名序列与 required 序列都须逐字匹配，且 required ⊆ fields。"""
    ensure_hook_schema(title)
    exp_f = HOOK_SCHEMA_FIELDS[title]
    exp_r = HOOK_SCHEMA_REQUIRED[title]
    if tuple(fields) != exp_f:
        raise HookContractSchemaError(f"{title!r} 字段名序列应为 {exp_f!r}，实得 {tuple(fields)!r}")
    if tuple(required) != exp_r:
        raise HookContractSchemaError(f"{title!r} required 应为 {exp_r!r}，实得 {tuple(required)!r}")
    if not set(required) <= set(fields):
        raise HookContractSchemaError(f"{title!r} required 非 fields 子集")
    return title

