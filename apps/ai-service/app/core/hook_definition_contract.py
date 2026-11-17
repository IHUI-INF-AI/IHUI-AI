# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""hook 命令 schema 的 definitions 值域/结构契约（enum wire 类型 + 嵌套对象） —— 统一工程规范 R64（类型定义层 wire 契约）。

取证（codex.exe 26.1111.2228.0）：复用 R63 ``schemas.json`` 的 23 段内嵌 JSON Schema，聚合其
``definitions`` 段（跨 schema 同名字段零变体冲突，已机械自证）。分三类：

- **enum wire 类型**（4）：``BlockDecisionWire``=``["block"]``、``PreToolUseDecisionWire``=
  ``["approve","block"]``、``PreToolUsePermissionDecisionWire``=``["allow","deny","ask"]``、
  ``PermissionRequestBehaviorWire``=``["allow","deny"]``。
- **NullableString**：``type=["string","null"]``（15 处 ``$ref`` 指向它）。
- **对象结构**（7）：``*HookSpecificOutputWire`` 与 ``PermissionRequestDecisionWire``，逐字
  properties 与 required 子集。

一轴超越：R63 与字段类型层（模块 1）都未触达 definitions——这是 hook 决策语义（approve/block、
allow/deny/ask）的真相源，比字段名更深一层。``validate_definition_enum`` / ``validate_definition_object``
双向守门值域与结构。全部机器派生，零手敲枚举值/字段名。

诚实边界：description 自由文本不纳入；``additionalProperties:false`` 是各对象共有事实，在文档中
记录而不重复登记为表。

源证据：``R63/schemas.json``；报告 ``docs/engineering/round11-reverse/R64-*.md``。
"""

from __future__ import annotations

from typing import Final

__all__ = [
    "HOOK_DEFINITION_ENUMS",
    "HOOK_DEFINITION_OBJECTS",
    "HOOK_DEFINITION_NULLABLE",
    "HOOK_DEFINITION_NAMES",
    "HookDefinitionError",
    "definition_enum_names",
    "definition_object_names",
    "expected_definition_enum",
    "expected_definition_object",
    "validate_definition_enum",
    "validate_definition_object",
    "is_hook_definition",
    "ensure_hook_definition",
]

# enum wire 类型名 → 逐字值域元组。
HOOK_DEFINITION_ENUMS: Final[dict[str, tuple[str, ...]]] = {
    'BlockDecisionWire': ('block',),
    'PermissionRequestBehaviorWire': ('allow', 'deny'),
    'PreToolUseDecisionWire': ('approve', 'block'),
    'PreToolUsePermissionDecisionWire': ('allow', 'deny', 'ask'),
}

# 对象定义名 → (逐字 properties 字段名元组, required 元组)。
HOOK_DEFINITION_OBJECTS: Final[dict[str, tuple[tuple[str, ...], tuple[str, ...]]]] = {
    'PostToolUseHookSpecificOutputWire': (('additionalContext', 'hookEventName', 'updatedMCPToolOutput'), ('hookEventName',)),
    'PermissionRequestDecisionWire': (('behavior', 'interrupt', 'message', 'updatedInput', 'updatedPermissions'), ('behavior',)),
    'PermissionRequestHookSpecificOutputWire': (('decision', 'hookEventName'), ('hookEventName',)),
    'PreToolUseHookSpecificOutputWire': (('additionalContext', 'hookEventName', 'permissionDecision', 'permissionDecisionReason', 'updatedInput'), ('hookEventName',)),
    'SessionStartHookSpecificOutputWire': (('additionalContext', 'hookEventName'), ('hookEventName',)),
    'SubagentStartHookSpecificOutputWire': (('additionalContext', 'hookEventName'), ('hookEventName',)),
    'UserPromptSubmitHookSpecificOutputWire': (('additionalContext', 'hookEventName'), ('hookEventName',)),
}

# type=["string","null"] 的 nullable 定义名。
HOOK_DEFINITION_NULLABLE: Final[frozenset[str]] = frozenset({'NullableString'})

HOOK_DEFINITION_NAMES: Final[frozenset[str]] = (
    frozenset(HOOK_DEFINITION_ENUMS) | frozenset(HOOK_DEFINITION_OBJECTS) | HOOK_DEFINITION_NULLABLE
)


class HookDefinitionError(ValueError):
    """未登记 definition 或值域/结构不一致时抛错。"""


def definition_enum_names() -> tuple[str, ...]:
    return tuple(HOOK_DEFINITION_ENUMS)


def definition_object_names() -> tuple[str, ...]:
    return tuple(HOOK_DEFINITION_OBJECTS)


def ensure_hook_definition(name: str) -> str:
    if not isinstance(name, str) or name not in HOOK_DEFINITION_NAMES:
        raise HookDefinitionError(f"未登记 definition: {name!r}")
    return name


def is_hook_definition(name: str) -> bool:
    return isinstance(name, str) and name in HOOK_DEFINITION_NAMES


def expected_definition_enum(name: str) -> tuple[str, ...]:
    ensure_hook_definition(name)
    if name not in HOOK_DEFINITION_ENUMS:
        raise HookDefinitionError(f"{name!r} 不是 enum 定义")
    return HOOK_DEFINITION_ENUMS[name]


def expected_definition_object(name: str) -> tuple[tuple[str, ...], tuple[str, ...]]:
    ensure_hook_definition(name)
    if name not in HOOK_DEFINITION_OBJECTS:
        raise HookDefinitionError(f"{name!r} 不是 object 定义")
    return HOOK_DEFINITION_OBJECTS[name]


def validate_definition_enum(name: str, values: tuple[str, ...]) -> str:
    """守门：enum 名已登记且值域逐字匹配（含顺序）。"""
    ensure_hook_definition(name)
    exp = expected_definition_enum(name)
    if tuple(values) != exp:
        raise HookDefinitionError(f"{name!r} 值域应为 {exp!r}，实得 {tuple(values)!r}")
    return name


def validate_definition_object(
    name: str, fields: tuple[str, ...], required: tuple[str, ...]
) -> str:
    """守门：对象名已登记、字段名与 required 逐字匹配、required ⊆ fields。"""
    ensure_hook_definition(name)
    exp_f, exp_r = expected_definition_object(name)
    if tuple(fields) != exp_f:
        raise HookDefinitionError(f"{name!r} 字段应为 {exp_f!r}，实得 {tuple(fields)!r}")
    if tuple(required) != exp_r:
        raise HookDefinitionError(f"{name!r} required 应为 {exp_r!r}，实得 {tuple(required)!r}")
    if not set(required) <= set(fields):
        raise HookDefinitionError(f"{name!r} required 非 fields 子集")
    return name
