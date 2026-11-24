# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B3-07 patches 增量编辑（消息 / 工具定义）。

对照 Qoder `chat.proto` 的 `patches: map<string, ChatPatchList>`：
`ChatPatch` 带 `cache_id / action / position / content / name / rename_to /
description / parameters`，按 `cache_id` 对既有条目做增量修改，而不是重发整份列表。

本仓取舍：
- `cache_id` 是稳定主键；缺它就无法定位，直接具名拒绝；
- 一次 patch list 原子应用：任一动作失败，整份状态不变（不留半改）；
- 冲突策略 fail-closed：add 撞已有 id、update/rename/delete 找不到目标、
  rename 撞新名字，都返回错误码，不做"猜一个最像的"。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PatchAction(StrEnum):
    ADD = "add"
    UPDATE = "update"
    DELETE = "delete"
    RENAME = "rename"


class ChatPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cache_id: str = Field(min_length=1)
    action: PatchAction
    position: int | None = Field(None, ge=0)
    content: Any | None = None
    name: str | None = None
    rename_to: str | None = None
    description: str | None = None
    parameters: Any | None = None


class ChatPatchList(BaseModel):
    model_config = ConfigDict(extra="forbid")

    patches: list[ChatPatch]


@dataclass
class PatchApplyResult:
    ok: bool
    items: list[dict[str, Any]]
    changed: list[str] = field(default_factory=list)
    error_code: str | None = None
    detail: str | None = None


def _find(items: list[dict[str, Any]], cache_id: str) -> int:
    for index, item in enumerate(items):
        if item.get("cache_id") == cache_id:
            return index
    return -1


def _with_cache_id(item: dict[str, Any], cache_id: str) -> dict[str, Any]:
    copy = dict(item)
    copy["cache_id"] = cache_id
    return copy


def apply_chat_patches(
    items: list[dict[str, Any]],
    patches: list[ChatPatch] | ChatPatchList,
) -> PatchApplyResult:
    """原子应用一组 patch；成功返回新列表，失败返回原列表副本 + 错误码。"""
    patch_list = patches.patches if isinstance(patches, ChatPatchList) else patches
    working = [dict(item) for item in items]
    changed: list[str] = []

    for patch in patch_list:
        index = _find(working, patch.cache_id)

        if patch.action is PatchAction.ADD:
            if index >= 0:
                return PatchApplyResult(
                    False, [dict(item) for item in items], changed,
                    "PATCH_CACHE_ID_DUPLICATE", f"cache_id 已存在: {patch.cache_id}",
                )
            item: dict[str, Any] = {"cache_id": patch.cache_id}
            if isinstance(patch.content, dict):
                item.update(patch.content)
            if patch.name is not None:
                item["name"] = patch.name
            if patch.description is not None:
                item["description"] = patch.description
            if patch.parameters is not None:
                item["parameters"] = patch.parameters
            position = patch.position if patch.position is not None else len(working)
            if position > len(working):
                return PatchApplyResult(
                    False, [dict(item) for item in items], changed,
                    "PATCH_POSITION_OUT_OF_RANGE", f"position {position} > {len(working)}",
                )
            working.insert(position, item)
            changed.append(patch.cache_id)
            continue

        if index < 0:
            return PatchApplyResult(
                False, [dict(item) for item in items], changed,
                "PATCH_TARGET_MISSING", f"找不到 cache_id: {patch.cache_id}",
            )

        if patch.action is PatchAction.DELETE:
            working.pop(index)
            changed.append(patch.cache_id)
            continue

        if patch.action is PatchAction.UPDATE:
            item = _with_cache_id(working[index], patch.cache_id)
            if isinstance(patch.content, dict):
                item.update(patch.content)
            if patch.name is not None:
                item["name"] = patch.name
            if patch.description is not None:
                item["description"] = patch.description
            if patch.parameters is not None:
                item["parameters"] = patch.parameters
            working[index] = item
            changed.append(patch.cache_id)
            continue

        if patch.action is PatchAction.RENAME:
            target = patch.rename_to or patch.name
            if not target:
                return PatchApplyResult(
                    False, [dict(item) for item in items], changed,
                    "PATCH_RENAME_TARGET_REQUIRED", f"cache_id {patch.cache_id} 缺 rename_to",
                )
            if any(i != index and item.get("name") == target for i, item in enumerate(working)):
                return PatchApplyResult(
                    False, [dict(item) for item in items], changed,
                    "PATCH_RENAME_CONFLICT", f"name 已被占用: {target}",
                )
            item = _with_cache_id(working[index], patch.cache_id)
            item["name"] = target
            working[index] = item
            changed.append(patch.cache_id)

    return PatchApplyResult(True, working, changed)


def apply_patch_map(
    state: dict[str, list[dict[str, Any]]],
    patch_map: dict[str, ChatPatchList],
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, PatchApplyResult]]:
    """按 channel（如 messages / tools）批量应用；任一通道失败整份状态不变。"""
    results: dict[str, PatchApplyResult] = {}
    next_state: dict[str, list[dict[str, Any]]] = {}
    failed = False
    for channel, items in state.items():
        patch_list = patch_map.get(channel)
        if patch_list is None:
            next_state[channel] = [dict(item) for item in items]
            continue
        result = apply_chat_patches(items, patch_list)
        results[channel] = result
        if not result.ok:
            failed = True
            break
        next_state[channel] = result.items
    if failed:
        return {k: [dict(item) for item in v] for k, v in state.items()}, results
    return next_state, results
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
