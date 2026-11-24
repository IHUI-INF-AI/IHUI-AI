# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Patch 变更种类封闭集（PatchChangeKind，三档）—— 统一工程规范 R56。

取证（codex.exe 26.1111.2228.0，strings 逐字）：
::

    internally tagged enum PatchChangeKindAddDeleteFileUpdateChangekinddiff
    struct variant PatchChangeKind::Update with 1 element
    move_pathstruct variant PatchChangeKind::Update with 1 element

三档逐字确证（internally tagged enum）：``Add`` / ``Delete`` / ``Update``。
``Update`` 变体带 1 元素（``FileUpdateChange``），其载荷锚 ``kind`` / ``diff`` /
``move_path`` 逐字命中。

配套（同取证块）：``ThreadItemPayload`` / ``WebSearchItem`` /
``CommandAction`` / ``DynamicToolCallOutputContentItem``（并列 wire 枚举，另一轴）。

本仓边界：``apply_patch.py`` / ``turn_diff_tracker.py`` 有 ``move_path`` 解析与改名
成对映射（**补丁解析/路径追踪轴**），但全仓无 ``PatchChangeKind`` 三档封闭集，也无
「按变更种类分派处理」的判据。本模块补齐 wire 变更种类轴，不替换补丁解析模块。

一轴超越：对照靠 internally tagged enum 反序列化区分，Update 的 ``move_path``
存在与否散在补丁应用分支，无「是否改名 / 是否删除 / 是否内容修改」的显式谓词。
本模块提供 ``is_add/is_delete/is_update/is_rename`` 四纯函数（is_rename 接受
``has_move_path`` 显式入参，不臆造）+ ``classify_patch_change`` 校验载荷一致性 +
``ensure_patch_change_kind`` 守门。

诚实边界：三档 tagged 值 + Update 1 元素逐字确证；``Add``/``Delete`` 是否也带载荷
（struct variant）未从二进制确证；is_rename 依赖调用方传 ``has_move_path``，本模块
不解析补丁文本；变更种类在 wire item 上的确切字段名未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "PatchChangeKind",
    "PatchChangeKindError",
    "PATCH_CHANGE_KIND_VALUES",
    "ensure_patch_change_kind",
    "is_add",
    "is_delete",
    "is_update",
    "is_rename",
    "classify_patch_change",
]

#: 逐字 tagged 值表（对照 internally tagged enum，漂移由 pytest 钉死）。
PATCH_CHANGE_KIND_VALUES: Final[tuple[str, ...]] = ("Add", "Delete", "Update")

_CLOSED_SET: Final[frozenset[str]] = frozenset(PATCH_CHANGE_KIND_VALUES)


class PatchChangeKind(StrEnum):
    """对照 PatchChangeKind 三档（逐字确证），真相源登记。"""

    ADD = "Add"
    DELETE = "Delete"
    UPDATE = "Update"


class PatchChangeKindError(ValueError):
    """未登记的 Patch 变更种类（封闭集判据点名）。"""


def ensure_patch_change_kind(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`PatchChangeKindError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise PatchChangeKindError(
            f"未登记的 Patch 变更种类: {value!r} —— "
            "先在 app/core/patch_change_kind.py 的 PatchChangeKind 登记后再产出"
        )
    return value


def is_add(value: str) -> bool:
    """是否新增文件。"""
    return ensure_patch_change_kind(value) == PatchChangeKind.ADD.value


def is_delete(value: str) -> bool:
    """是否删除文件。"""
    return ensure_patch_change_kind(value) == PatchChangeKind.DELETE.value


def is_update(value: str) -> bool:
    """是否修改文件（唯一可能带 move_path 的档位）。"""
    return ensure_patch_change_kind(value) == PatchChangeKind.UPDATE.value


def is_rename(value: str, has_move_path: bool) -> bool:
    """是否改名/移动：仅 Update 档且调用方显式给出 ``has_move_path=True``。

    不解析补丁文本、不臆造 move_path；非 Update 档即使传入 has_move_path 也返回 False。
    """
    kind = ensure_patch_change_kind(value)
    return kind == PatchChangeKind.UPDATE.value and bool(has_move_path)


def classify_patch_change(value: str, *, has_move_path: bool = False) -> str:
    """分类并自检载荷一致性：返回档位；非法组合（非 Update 带 move_path）抛错。

    对照只在运行时反序列化时隐式接受字段组合，本模块把"只有 Update 可带 move_path"
    显式化为判据，可 diff 可单测。
    """
    kind = ensure_patch_change_kind(value)
    if has_move_path and kind != PatchChangeKind.UPDATE.value:
        raise PatchChangeKindError(
            f"载荷不一致: move_path 只属于 Update 档，收到 {kind!r}"
        )
    return kind
