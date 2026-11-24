# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""hook 字段名封闭集（26 字段 · camel/snake 原生形态） —— 统一工程规范 R63（字段级 wire 契约·hook command JSON Schema）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE）：允许多行的 mmap ASCII 抽取 → 花括号配对 →
``json.loads`` 成功且含 ``type``/``properties``/``title`` 的块，逐字提取 23 段内嵌 JSON Schema
（12 hook 家族 × input/output）。字段名是 schema ``properties`` 的逐字键（snake_case 与 camelCase
混合），``required`` 是经 ``required ⊆ properties`` 自证的必填子集。全部机器派生，零手敲字段名。

一轴超越：26 个逐字字段名 + 原生命名风格（camel 4 / snake 22）+ 跨 schema 出现计数；``hook_fields_by_style()`` 反查，风格由字段本身大小写确定性归类。

诚实边界：字段名来自 schema ``properties`` 逐字键；``camel`` 判据是含大写字母（``hookSpecificOutput``/``stopReason``/``suppressOutput``/``systemMessage``），是本仓归类非对照原生 type 元数据；出现数是 23 段 schema 内的计数，非运行时频次。

源证据：``scripts/evidence`` 同型探针产物 ``R63/schemas.json``；报告 ``docs/engineering/round11-reverse/R63-*.md``。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "HookFieldName",
    "HookFieldNameError",
    "HOOK_FIELD_STYLES",
    "HOOK_FIELD_USAGE",
    "HOOK_FIELD_NAMES",
    "hook_field_names",
    "hook_fields_by_style",
    "validate_hook_field",
    "is_hook_field",
    "ensure_hook_field",
]

# 逐字字段名 → 命名风格（camel 含大写 / snake 全小写下划线）。
HOOK_FIELD_STYLES: Final[dict[str, str]] = {
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

# 逐字字段名 → 出现的 schema 段数（26 字段跨 23 段出现计数）。
HOOK_FIELD_USAGE: Final[dict[str, int]] = {
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

HOOK_FIELD_NAMES: Final[frozenset[str]] = frozenset(HOOK_FIELD_STYLES)


class HookFieldName(StrEnum):
    """26 个 hook schema 逐字字段名（真相源）。"""

    AGENT_ID = "agent_id"
    AGENT_TRANSCRIPT_PATH = "agent_transcript_path"
    AGENT_TYPE = "agent_type"
    CONTINUE = "continue"
    CWD = "cwd"
    DECISION = "decision"
    HOOKSPECIFICOUTPUT = "hookSpecificOutput"
    HOOK_EVENT_NAME = "hook_event_name"
    LAST_ASSISTANT_MESSAGE = "last_assistant_message"
    MODEL = "model"
    PERMISSION_MODE = "permission_mode"
    PROMPT = "prompt"
    REASON = "reason"
    SESSION_ID = "session_id"
    SOURCE = "source"
    STOPREASON = "stopReason"
    STOP_HOOK_ACTIVE = "stop_hook_active"
    SUPPRESSOUTPUT = "suppressOutput"
    SYSTEMMESSAGE = "systemMessage"
    TOOL_INPUT = "tool_input"
    TOOL_NAME = "tool_name"
    TOOL_RESPONSE = "tool_response"
    TOOL_USE_ID = "tool_use_id"
    TRANSCRIPT_PATH = "transcript_path"
    TRIGGER = "trigger"
    TURN_ID = "turn_id"


class HookFieldNameError(ValueError):
    """未登记字段名 / 风格或出现数不一致抛错。"""


def hook_field_names() -> list[str]:
    return list(HOOK_FIELD_STYLES)


def hook_fields_by_style(style: str) -> tuple[str, ...]:
    if style not in {"camel", "snake"}:
        raise HookFieldNameError(f"未登记风格: {style!r}")
    return tuple(f for f, s in HOOK_FIELD_STYLES.items() if s == style)


def is_hook_field(value: str) -> bool:
    return isinstance(value, str) and value in HOOK_FIELD_NAMES


def ensure_hook_field(value: str) -> str:
    if not is_hook_field(value):
        raise HookFieldNameError(f"未登记字段名: {value!r}")
    return value


def expected_hook_field_style(field: str) -> str:
    ensure_hook_field(field)
    return HOOK_FIELD_STYLES[field]


def validate_hook_field(field: str, style: str, usage_count: int) -> str:
    ensure_hook_field(field)
    if style != HOOK_FIELD_STYLES[field]:
        raise HookFieldNameError(f"{field!r} 风格应为 {HOOK_FIELD_STYLES[field]!r}，实得 {style!r}")
    if usage_count != HOOK_FIELD_USAGE[field]:
        raise HookFieldNameError(f"{field!r} 出现数应为 {HOOK_FIELD_USAGE[field]}，实得 {usage_count}")
    return field

