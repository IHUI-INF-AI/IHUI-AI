# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""hook 事件家族封闭集（12 家族 · input/output 形态） —— 统一工程规范 R63（字段级 wire 契约·hook command JSON Schema）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE）：允许多行的 mmap ASCII 抽取 → 花括号配对 →
``json.loads`` 成功且含 ``type``/``properties``/``title`` 的块，逐字提取 23 段内嵌 JSON Schema
（12 hook 家族 × input/output）。字段名是 schema ``properties`` 的逐字键（snake_case 与 camelCase
混合），``required`` 是经 ``required ⊆ properties`` 自证的必填子集。全部机器派生，零手敲字段名。

一轴超越：12 个 hook 家族逐字名 + 每族的 input/output schema 存在性；11 族双形态、``session-end`` 仅 input 的原生缺口逐字保留，``hook_events_with_output()`` 可执行反查。

诚实边界：家族名取 schema title 的 ``<family>.command.<shape>`` 前缀，存在性由是否提取到对应 schema 决定；本仓 hook_event_ordering/hook_exit_contract 管执行期排序与退出码，与本轴的命令 schema 形态正交。

源证据：``scripts/evidence`` 同型探针产物 ``R63/schemas.json``；报告 ``docs/engineering/round11-reverse/R63-*.md``。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "HookEventKind",
    "HookEventKindError",
    "HOOK_EVENT_SHAPES",
    "HOOK_EVENT_NAMES",
    "hook_event_names",
    "hook_event_shapes",
    "hook_events_with_output",
    "validate_hook_event",
    "is_hook_event",
    "ensure_hook_event",
]

# 逐字 hook 家族 → input/output 形态（schema title 前缀，逐字保留）。
HOOK_EVENT_SHAPES: Final[dict[str, dict[str, bool]]] = {
    "interrupt": {"input": True, "output": True},
    "permission-request": {"input": True, "output": True},
    "post-compact": {"input": True, "output": True},
    "post-tool-use": {"input": True, "output": True},
    "pre-compact": {"input": True, "output": True},
    "pre-tool-use": {"input": True, "output": True},
    "session-end": {"input": True, "output": False},
    "session-start": {"input": True, "output": True},
    "stop": {"input": True, "output": True},
    "subagent-start": {"input": True, "output": True},
    "subagent-stop": {"input": True, "output": True},
    "user-prompt-submit": {"input": True, "output": True},
}

HOOK_EVENT_NAMES: Final[frozenset[str]] = frozenset(HOOK_EVENT_SHAPES)


class HookEventKind(StrEnum):
    """12 个 hook 命令家族（input/output 形态真相源）。"""

    INTERRUPT = "interrupt"
    PERMISSION_REQUEST = "permission-request"
    POST_COMPACT = "post-compact"
    POST_TOOL_USE = "post-tool-use"
    PRE_COMPACT = "pre-compact"
    PRE_TOOL_USE = "pre-tool-use"
    SESSION_END = "session-end"
    SESSION_START = "session-start"
    STOP = "stop"
    SUBAGENT_START = "subagent-start"
    SUBAGENT_STOP = "subagent-stop"
    USER_PROMPT_SUBMIT = "user-prompt-submit"


class HookEventKindError(ValueError):
    """未登记 hook 家族 / 形态不一致抛错。"""


def hook_event_names() -> list[str]:
    return list(HOOK_EVENT_SHAPES)


def hook_event_shapes(name: str) -> tuple[bool, bool]:
    """返回 (has_input, has_output)。"""
    if name not in HOOK_EVENT_NAMES:
        raise HookEventKindError(f"未登记 hook 家族: {name!r}")
    d = HOOK_EVENT_SHAPES[name]
    return d["input"], d["output"]


def hook_events_with_output() -> tuple[str, ...]:
    """返回所有带 output schema 的 hook 家族（元组副本）。"""
    return tuple(n for n, d in HOOK_EVENT_SHAPES.items() if d["output"])


def is_hook_event(value: str) -> bool:
    return isinstance(value, str) and value in HOOK_EVENT_NAMES


def ensure_hook_event(value: str) -> str:
    if not is_hook_event(value):
        raise HookEventKindError(f"未登记 hook 家族: {value!r}")
    return value


def validate_hook_event(name: str, has_input: bool, has_output: bool) -> str:
    ensure_hook_event(name)
    exp = HOOK_EVENT_SHAPES[name]
    if (bool(has_input), bool(has_output)) != (exp["input"], exp["output"]):
        raise HookEventKindError(
            f"{name!r} 形态应为 ({exp['input']}, {exp['output']})，实得 ({has_input}, {has_output})"
        )
    return name

