# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent preset 注册表:模型 / 工具子集 / 轮次上限 / 权限预设的单一组合。

对照 DSH `dsh-agent-preset` 的可观察语义:客户端只选一个 preset 名,不再分别拼
模型、工具白名单、轮次和权限档。权限部分继续复用 `permission_presets` 的
`readOnly / auto / fullAccess`(不造第二份轴值真源);工具子集复用
`persona_registry` 的 persona 契约(不造第二份 persona 定义)。

纯函数层;执行面仍只认展开后的实际字段。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services.persona_registry import get_persona_contract

from .permission_presets import DEFAULT_CATALOG as PERMISSION_CATALOG

__all__ = [
    "AgentPreset",
    "AgentPresetCatalog",
    "AgentPresetError",
    "DEFAULT_AGENT_PRESETS",
    "resolve_agent_preset",
    "expand_agent_preset",
]

DEFAULT_AGENT_PRESET = "general"


class AgentPresetError(ValueError):
    """未知 preset / 非法目录 / 与显式字段冲突。"""


@dataclass(frozen=True)
class AgentPreset:
    """一个命名 agent 组合。``tools=None`` 表示沿用运行时默认工具清单。"""

    name: str
    persona: str
    model: str | None
    tools: tuple[str, ...] | None
    max_iterations: int
    permission_preset: str
    description: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "persona": self.persona,
            "model": self.model,
            "tools": list(self.tools) if self.tools is not None else None,
            "maxIterations": self.max_iterations,
            "permissionPreset": self.permission_preset,
            "description": self.description,
        }


@dataclass(frozen=True)
class AgentPresetCatalog:
    entries: tuple[AgentPreset, ...]
    default_preset: str

    def __post_init__(self) -> None:
        if not self.entries:
            raise AgentPresetError("agent preset 目录不可为空")
        names = [entry.name for entry in self.entries]
        if len(names) != len(set(names)):
            raise AgentPresetError(f"agent preset 目录存在重名: {names}")
        if self.get(self.default_preset) is None:
            raise AgentPresetError(f"默认 agent preset 不存在: {self.default_preset!r}")
        for entry in self.entries:
            if entry.max_iterations <= 0:
                raise AgentPresetError(f"{entry.name}: maxIterations 必须为正整数")
            if PERMISSION_CATALOG.get(entry.permission_preset) is None:
                raise AgentPresetError(
                    f"{entry.name}: 权限预设不存在或不可选 {entry.permission_preset!r}"
                )

    def get(self, name: str) -> AgentPreset | None:
        for entry in self.entries:
            if entry.name == name:
                return entry
        return None

    def as_dict(self) -> dict[str, Any]:
        return {
            "presets": [entry.as_dict() for entry in self.entries],
            "defaultPreset": self.default_preset,
        }


def _persona_tools(persona: str) -> tuple[str, ...] | None:
    contract = get_persona_contract(persona) if persona else None
    return tuple(contract.tools) if contract is not None else None


def _preset(
    name: str,
    *,
    persona: str,
    model: str | None,
    max_iterations: int,
    permission_preset: str,
    description: str,
) -> AgentPreset:
    return AgentPreset(
        name=name,
        persona=persona,
        model=model,
        tools=_persona_tools(persona) if persona else None,
        max_iterations=max_iterations,
        permission_preset=permission_preset,
        description=description,
    )


#: 进程级默认目录。``general`` 是唯一允许“全默认”的 preset;其余都带 persona
#: 工具子集与权限档,避免出现“选了一个看起来更严的 preset 却仍全权限”。
DEFAULT_AGENT_PRESETS = AgentPresetCatalog(
    entries=(
        _preset(
            "general",
            persona="",
            model=None,
            max_iterations=8,
            permission_preset="auto",
            description="通用执行:默认模型 + 默认工具 + 工作区写 + 按需审批",
        ),
        _preset(
            "researcher",
            persona="researcher",
            model=None,
            max_iterations=12,
            permission_preset="readOnly",
            description="调研只读:persona 工具子集 + 沙箱只读 + 按需审批",
        ),
        _preset(
            "coder",
            persona="coder",
            model=None,
            max_iterations=16,
            permission_preset="auto",
            description="编码实现:persona 工具子集 + 工作区写 + 按需审批",
        ),
        _preset(
            "reviewer",
            persona="reviewer",
            model=None,
            max_iterations=8,
            permission_preset="readOnly",
            description="代码审查:persona 工具子集 + 沙箱只读 + 按需审批",
        ),
        _preset(
            "architect",
            persona="architect",
            model=None,
            max_iterations=12,
            permission_preset="auto",
            description="架构分析:persona 工具子集 + 工作区写 + 按需审批",
        ),
        _preset(
            "debugger",
            persona="debugger",
            model=None,
            max_iterations=12,
            permission_preset="auto",
            description="故障定位:persona 工具子集 + 工作区写 + 按需审批",
        ),
    ),
    default_preset=DEFAULT_AGENT_PRESET,
)


def resolve_agent_preset(
    name: str, catalog: AgentPresetCatalog = DEFAULT_AGENT_PRESETS
) -> AgentPreset:
    entry = catalog.get(name)
    if entry is None:
        raise AgentPresetError(f"未知 agent preset: {name!r}")
    return entry


def expand_agent_preset(
    name: str,
    *,
    model: str | None = None,
    tools: list[str] | None = None,
    max_iterations: int | None = None,
    permission_preset: str | None = None,
    sandbox_mode: str | None = None,
    approval_policy: str | None = None,
    catalog: AgentPresetCatalog = DEFAULT_AGENT_PRESETS,
) -> dict[str, Any]:
    """展开 preset;与任何显式字段同给都拒绝,避免静默覆盖。

    返回可直接并入请求模型的字段:``model`` / ``tools`` / ``max_iterations`` /
    ``permission_preset`` / ``persona``。
    """
    explicit = {
        "model": model,
        "tools": tools,
        "max_iterations": max_iterations,
        "permission_preset": permission_preset,
        "sandbox_mode": sandbox_mode,
        "approval_policy": approval_policy,
    }
    conflicted = [key for key, value in explicit.items() if value is not None]
    if conflicted:
        raise AgentPresetError(
            "agent preset 与显式字段互斥,不得同给: " + ", ".join(sorted(conflicted))
        )
    entry = resolve_agent_preset(name, catalog)
    return {
        "model": entry.model,
        "tools": list(entry.tools) if entry.tools is not None else None,
        "max_iterations": entry.max_iterations,
        "permission_preset": entry.permission_preset,
        "persona": entry.persona,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
