# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""hook 命令 schema 字段类型签名契约（23 段 schema × 逐字段 type 约束） —— 统一工程规范 R64（字段级类型层 wire 契约）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE）：复用 R63 已从 PE 内嵌 JSON Schema 逐字提取的
``schemas.json``（23 段合法 schema，``json.loads`` + 三键校验通过）。本轮把每段 ``properties[f]``
的 JSON Schema 类型约束规范化为确定性签名：``type``（含 ``["string","null"]`` 联合）、``$ref``、
``allOf``、``const``、``enum``、``default``、任意类型 ``true``。全部机器派生，零手敲字段/值。

一轴超越：R63 只钉死字段名与 required；本轴再钉死每个字段的类型签名——``permission_mode`` 的
5 值 enum、``hook_event_name`` 的 13 个 const、``transcript_path`` 的 NullableString ref、output
字段的 default 值等，全部逐字固化。``validate_hook_field_types(title, mapping)`` 同时校验 title、
字段集合与逐字段签名。

诚实边界：``description``（自由文本）不纳入类型签名（不影响 wire 语义且含换行长文本）；字段名
与 required 属 R63 正交层，本模块不重复登记。title 是 schema 自带标识。

源证据：``R63/schemas.json``；报告 ``docs/engineering/round11-reverse/R64-*.md``。
"""

from __future__ import annotations

from typing import Final

__all__ = [
    "HOOK_FIELD_TYPES",
    "HOOK_FIELD_TYPE_SCHEMA_NAMES",
    "HookFieldTypeError",
    "hook_field_type_schema_names",
    "field_type_signature",
    "fields_with_signature_kind",
    "validate_hook_field_types",
    "is_hook_field_type_schema",
    "ensure_hook_field_type_schema",
]

# 逐字 schema title → {字段名: 规范化类型签名}（键顺序逐字保留）。
HOOK_FIELD_TYPES: Final[dict[str, dict[str, str]]] = {
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

HOOK_FIELD_TYPE_SCHEMA_NAMES: Final[frozenset[str]] = frozenset(HOOK_FIELD_TYPES)


class HookFieldTypeError(ValueError):
    """未登记 schema / 字段或类型签名不一致时抛错。"""


def hook_field_type_schema_names() -> list[str]:
    """逐字 schema title 列表副本（顺序稳定）。"""
    return list(HOOK_FIELD_TYPES)


def ensure_hook_field_type_schema(title: str) -> str:
    if not isinstance(title, str) or title not in HOOK_FIELD_TYPE_SCHEMA_NAMES:
        raise HookFieldTypeError(f"未登记类型契约 schema: {title!r}")
    return title


def is_hook_field_type_schema(title: str) -> bool:
    return isinstance(title, str) and title in HOOK_FIELD_TYPE_SCHEMA_NAMES


def field_type_signature(title: str, field: str) -> str:
    """返回 (schema, 字段) 的规范化类型签名。"""
    ensure_hook_field_type_schema(title)
    fields = HOOK_FIELD_TYPES[title]
    if field not in fields:
        raise HookFieldTypeError(f"{title!r} 未登记字段: {field!r}")
    return fields[field]


def fields_with_signature_kind(title: str, kind: str) -> tuple[str, ...]:
    """反查：返回签名含 ``kind`` 子串的字段名元组（如 'const='/'enum='/'default='）。"""
    ensure_hook_field_type_schema(title)
    return tuple(f for f, sig in HOOK_FIELD_TYPES[title].items() if kind in sig)


def validate_hook_field_types(title: str, mapping: dict[str, str]) -> str:
    """守门：title 已登记、字段集合一致、逐字段签名逐字匹配。"""
    ensure_hook_field_type_schema(title)
    exp = HOOK_FIELD_TYPES[title]
    got = dict(mapping)
    if set(got) != set(exp):
        raise HookFieldTypeError(
            f"{title!r} 字段集合不符：缺 {sorted(set(exp)-set(got))!r} 多 {sorted(set(got)-set(exp))!r}"
        )
    for f in exp:
        if got[f] != exp[f]:
            raise HookFieldTypeError(f"{title!r}.{f} 签名应为 {exp[f]!r}，实得 {got[f]!r}")
    return title
