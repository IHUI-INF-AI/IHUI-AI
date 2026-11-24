# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""命名权限预设:捆绑沙箱轴与审批轴,派生 ``custom``,切换只写变化轴。

对齐 DSH ``dsh-permission-presets`` 的可观察语义,但复用本仓既有
``core.permission_axis.APPROVAL_PRESETS`` 作为唯一轴值真源:

- 预设把 ``(sandbox_mode, approval_policy)`` 捆绑成一个可选项;
- ``custom`` 只能由当前轴组合**推导**,不能作为可选项被持久化;
- 当前值解析顺序:仍匹配的最近选择 > 目录里第一个匹配项 > ``custom``;
- 切换返回目标两轴与**实际变化轴**,两轴都没变时 ``changed_axes`` 为空,
  调用方不应追加无意义的选择事件。

本模块是纯函数层,不读写会话、不碰执行面。执行面仍只认两轴真值。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .permission_axis import (
    APPROVAL_PRESETS,
    normalize_approval_policy,
    normalize_sandbox_mode,
)

__all__ = [
    "CUSTOM_PRESET",
    "DEFAULT_CATALOG",
    "PresetCatalog",
    "PresetEntry",
    "PresetSelectionError",
    "PresetSwitch",
    "current_preset",
    "switch_preset",
]

CUSTOM_PRESET_NAME = "custom"


@dataclass(frozen=True)
class PresetEntry:
    """一个命名预设:名称 + 两轴 + 可选展示文案。"""

    name: str
    sandbox_mode: str
    approval_policy: str
    description: str = ""
    selectable: bool = True

    def matches(self, sandbox_mode: str | None, approval_policy: str | None) -> bool:
        return self.sandbox_mode == sandbox_mode and self.approval_policy == approval_policy

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "sandboxMode": self.sandbox_mode,
            "approvalPolicy": self.approval_policy,
            "description": self.description,
            "selectable": self.selectable,
        }


@dataclass(frozen=True)
class PresetCatalog:
    """进程级预设目录。``default_preset`` 只允许指向目录内的可选项。"""

    entries: tuple[PresetEntry, ...]
    default_preset: str

    def __post_init__(self) -> None:
        if not self.entries:
            raise PresetSelectionError("权限预设目录不可为空")
        names = [entry.name for entry in self.entries]
        if len(names) != len(set(names)):
            raise PresetSelectionError(f"权限预设目录存在重名: {names}")
        if CUSTOM_PRESET_NAME in names:
            raise PresetSelectionError("custom 是推导态,不得进入可选目录")
        if self.get(self.default_preset) is None:
            raise PresetSelectionError(f"默认预设不可选或不存在: {self.default_preset!r}")

    def get(self, name: str) -> PresetEntry | None:
        for entry in self.entries:
            if entry.name == name and entry.selectable:
                return entry
        return None

    def as_dict(self) -> dict[str, Any]:
        return {
            "presets": [entry.as_dict() for entry in self.entries],
            "defaultPreset": self.default_preset,
            "custom": CUSTOM_PRESET.as_dict(),
        }


class PresetSelectionError(ValueError):
    """预设不可选 / 未知 / 目录非法。"""


class PresetSwitch:
    """一次预设切换的计算结果(不可变)。"""

    __slots__ = ("preset", "sandbox_mode", "approval_policy", "changed_axes")

    def __init__(
        self,
        *,
        preset: str,
        sandbox_mode: str,
        approval_policy: str,
        changed_axes: tuple[str, ...],
    ) -> None:
        self.preset = preset
        self.sandbox_mode = sandbox_mode
        self.approval_policy = approval_policy
        self.changed_axes = changed_axes

    @property
    def no_op(self) -> bool:
        return not self.changed_axes

    def as_dict(self) -> dict[str, Any]:
        return {
            "preset": self.preset,
            "sandboxMode": self.sandbox_mode,
            "approvalPolicy": self.approval_policy,
            "changedAxes": list(self.changed_axes),
            "noOp": self.no_op,
        }


CUSTOM_PRESET = PresetEntry(
    name=CUSTOM_PRESET_NAME,
    sandbox_mode="",
    approval_policy="",
    description="当前两轴组合不匹配任何命名预设;可切换到任一可选预设,不可反向选中 custom。",
    selectable=False,
)


def _default_catalog() -> PresetCatalog:
    descriptions = {
        "readOnly": "只读:任何写操作都需要审批。",
        "auto": "工作区可写:按需审批,不自动放行危险操作。",
        "fullAccess": "完全访问:沙箱全开,审批策略 never。",
    }
    entries = tuple(
        PresetEntry(
            name=name,
            sandbox_mode=pair[0],
            approval_policy=pair[1],
            description=descriptions.get(name, ""),
        )
        for name, pair in APPROVAL_PRESETS.items()
    )
    return PresetCatalog(entries=entries, default_preset="auto")


DEFAULT_CATALOG = _default_catalog()


def current_preset(
    catalog: PresetCatalog,
    *,
    sandbox_mode: object,
    approval_policy: object,
    last_selected: str | None = None,
) -> str:
    """按 DSH 顺序推导当前预设名;认不出的轴或组合一律返回 ``custom``。"""
    sm = normalize_sandbox_mode(sandbox_mode)
    ap = normalize_approval_policy(approval_policy)
    if sm is None or ap is None:
        return CUSTOM_PRESET_NAME
    if last_selected is not None:
        selected = catalog.get(last_selected)
        if selected is not None and selected.matches(sm, ap):
            return selected.name
    for entry in catalog.entries:
        if entry.selectable and entry.matches(sm, ap):
            return entry.name
    return CUSTOM_PRESET_NAME


def switch_preset(
    catalog: PresetCatalog,
    name: str,
    *,
    current_sandbox_mode: object,
    current_approval_policy: object,
) -> PresetSwitch:
    """解析目标预设并算实际变化轴;``custom``/未知/不可选一律拒绝。"""
    target = catalog.get(name) if isinstance(name, str) else None
    if target is None:
        raise PresetSelectionError(
            f"不可选的权限预设: {name!r};可选值为 {[e.name for e in catalog.entries if e.selectable]}"
        )
    current_sm = normalize_sandbox_mode(current_sandbox_mode)
    current_ap = normalize_approval_policy(current_approval_policy)
    changed: list[str] = []
    if current_sm != target.sandbox_mode:
        changed.append("sandbox")
    if current_ap != target.approval_policy:
        changed.append("approval")
    return PresetSwitch(
        preset=target.name,
        sandbox_mode=target.sandbox_mode,
        approval_policy=target.approval_policy,
        changed_axes=tuple(changed),
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
