# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ITCP 契约注册表:Python 侧消费 `protocol/itcp-registry.json` 的**唯一入口**。

**为什么需要注册表而不是到处 import dict**:契约的声明面是导出物(JSON),
不是 Python 代码。任何模块想判"这枚工具的契约要求什么",只能经由本模块的
`lookup()`,拿到的三态必须被如实区分 —— 把"未判定"读成"没有契约"是本仓最高频失效型
(与 `telemetry.py` 的 `ChannelState.disabled` / `otel_log_channels.py` 同一条纪律)。

**三态**(`Lookup.state`):

    declared  —— 注册表可用,且这枚工具有条目
    absent    —— 注册表可用,但表里没有这枚工具(未声明)
    unjudged  —— 注册表本身不可用(文件缺失 / JSON 坏 / schema 不对 / 空表)

`absent` 与 `unjudged` 在契约轴上的后果**不同**:
  - `absent` 且宿主按 `tool_contract.human_approval_mandated` 判 ⇒ 契约缺席 ⇒ False(不参与):
    这是 TS 侧同一条判序,不是 fail-open;
  - `unjudged` ⇒ 调用方**不得**按"没契约"处置,应按自己的 fail-closed 方向拒绝或出声
    (因为这不是"没声明",是"我们看不见声明")。

**不猜**:JSON 里字段拼错、值为 null、注册表 schema 不认识 —— 一律降 `unjudged`,
不回落成 `absent`。`absent` 只用于"注册表健康且确实没有这条"。
"""

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Any, Final

from .tool_contract import human_approval_mandated, may_write_workspace, touches_external_world

REGISTRY_SCHEMA: Final = "itcp-registry/v0.1"
REGISTRY_ENV: Final = "IHUI_ITCP_REGISTRY"
DEFAULT_RELATIVE: Final = Path("protocol") / "itcp-registry.json"


class RegistryState(StrEnum):
    """注册表自身的健康状态(不是单条工具的状态)。"""

    LOADED = "loaded"
    MISSING = "missing"
    INVALID = "invalid"
    EMPTY = "empty"


class LookupState(StrEnum):
    """单条工具查询的三态。`absent` 与 `unjudged` 不得混读。"""

    DECLARED = "declared"
    ABSENT = "absent"
    UNJUDGED = "unjudged"


@dataclass(frozen=True)
class ToolContractEntry:
    """一枚工具的契约声明(原始字段,不做判定)。"""

    name: str
    file: str
    line: int
    declared: bool
    contract_form: str
    danger_level: str | None
    permission: Mapping[str, Any] | None
    shape: Mapping[str, Any] | None
    result_budget: Mapping[str, Any] | None

    def carrier(self) -> dict[str, Any]:
        """包成与 TS `EffectScopeCarrier` 同形的载体,交给 `tool_contract` 的谓词。"""
        if self.permission is None:
            return {}
        return {"contract": {"permission": dict(self.permission)}}

    # --- 三个谓词的便捷出口(禁止调用方自己 if 字段,否则判据会分叉)----------------
    def human_approval_mandated(self) -> bool:
        return human_approval_mandated(self.carrier())

    def touches_external_world(self) -> bool:
        return touches_external_world(self.carrier())

    def may_write_workspace(self) -> bool:
        return may_write_workspace(self.carrier())

    @property
    def visible_to_provider(self) -> bool | None:
        if isinstance(self.shape, Mapping):
            value = self.shape.get("visibleToProvider")
            return value if isinstance(value, bool) else None
        return None


@dataclass(frozen=True)
class Lookup:
    """一次查询的结果。`entry` 只在 `declared` 时非空。"""

    state: LookupState
    entry: ToolContractEntry | None = None
    reason: str | None = None


@dataclass(frozen=True)
class ContractRegistry:
    """加载完成的注册表(不可变)。"""

    state: RegistryState
    source: Mapping[str, Any]
    entries: Mapping[str, ToolContractEntry]
    reason: str | None = None
    path: str | None = None

    @property
    def usable(self) -> bool:
        return self.state is RegistryState.LOADED

    def lookup(self, tool_name: str) -> Lookup:
        """按工具名查契约。三态语义见模块头注。"""
        if not self.usable:
            return Lookup(state=LookupState.UNJUDGED, reason=self.reason or f"registry {self.state}")
        entry = self.entries.get(tool_name)
        if entry is None:
            return Lookup(state=LookupState.ABSENT)
        return Lookup(state=LookupState.DECLARED, entry=entry)

    def all_tools(self) -> Mapping[str, ToolContractEntry]:
        return self.entries


def default_registry_path() -> Path:
    """定位注册表:env 优先;否则从本文件向上找含 `protocol/itcp-registry.json` 的目录。"""
    override = os.environ.get(REGISTRY_ENV)
    if override and override.strip():
        return Path(override.strip())
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / DEFAULT_RELATIVE
        if candidate.is_file():
            return candidate
    # 找不到也要给出一个确定路径,让 state=missing 的 reason 能点名"该放哪"
    return here.parents[4] / DEFAULT_RELATIVE


def _entry_from_raw(raw: Any) -> ToolContractEntry | None:
    """把 JSON 里的一条工具记录转成 entry;字段类型不对返回 None(整体判 invalid)。"""
    if not isinstance(raw, Mapping):
        return None
    name = raw.get("name")
    file = raw.get("file")
    line = raw.get("line")
    if not isinstance(name, str) or not name:
        return None
    if not isinstance(file, str) or not isinstance(line, int):
        return None
    permission = raw.get("permission")
    if permission is not None and not isinstance(permission, Mapping):
        return None
    shape = raw.get("shape")
    if shape is not None and not isinstance(shape, Mapping):
        return None
    budget = raw.get("resultBudget")
    if budget is not None and not isinstance(budget, Mapping):
        return None
    return ToolContractEntry(
        name=name,
        file=file,
        line=line,
        declared=bool(raw.get("declared")),
        contract_form=str(raw.get("contractForm") or "unknown"),
        danger_level=raw.get("dangerLevel") if isinstance(raw.get("dangerLevel"), str) else None,
        permission=permission,
        shape=shape,
        result_budget=budget,
    )


def load_registry(path: str | Path | None = None) -> ContractRegistry:
    """加载注册表。**从不抛异常**:一切失败降成确定状态 + 人话 reason。"""
    target = Path(path) if path is not None else default_registry_path()
    if not target.is_file():
        return ContractRegistry(
            state=RegistryState.MISSING,
            source={},
            entries={},
            reason=f"注册表不存在: {target}",
            path=str(target),
        )
    try:
        text = target.read_text(encoding="utf-8")
        data = json.loads(text)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        return ContractRegistry(
            state=RegistryState.INVALID,
            source={},
            entries={},
            reason=f"注册表读取/解析失败({type(exc).__name__}): {exc}",
            path=str(target),
        )
    if not isinstance(data, Mapping):
        return ContractRegistry(
            state=RegistryState.INVALID,
            source={},
            entries={},
            reason="注册表顶层不是对象",
            path=str(target),
        )
    if data.get("schema") != REGISTRY_SCHEMA:
        return ContractRegistry(
            state=RegistryState.INVALID,
            source={},
            entries={},
            reason=f"schema 不匹配: {data.get('schema')!r} != {REGISTRY_SCHEMA!r}",
            path=str(target),
        )
    raw_tools = data.get("tools")
    if not isinstance(raw_tools, list):
        return ContractRegistry(
            state=RegistryState.INVALID,
            source={},
            entries={},
            reason="tools 不是数组",
            path=str(target),
        )
    entries: dict[str, ToolContractEntry] = {}
    for raw in raw_tools:
        entry = _entry_from_raw(raw)
        if entry is None:
            return ContractRegistry(
                state=RegistryState.INVALID,
                source={},
                entries={},
                reason="存在字段类型不合法的工具记录",
                path=str(target),
            )
        if entry.name in entries:
            return ContractRegistry(
                state=RegistryState.INVALID,
                source={},
                entries={},
                reason=f"工具名重复: {entry.name}",
                path=str(target),
            )
        entries[entry.name] = entry
    if not entries:
        return ContractRegistry(
            state=RegistryState.EMPTY,
            source=data.get("source") if isinstance(data.get("source"), Mapping) else {},
            entries={},
            reason="注册表里 0 枚工具(空表不得读成'全部无契约')",
            path=str(target),
        )
    source = data.get("source") if isinstance(data.get("source"), Mapping) else {}
    return ContractRegistry(
        state=RegistryState.LOADED,
        source=source,
        entries=entries,
        path=str(target),
    )


__all__ = [
    "REGISTRY_SCHEMA",
    "REGISTRY_ENV",
    "RegistryState",
    "LookupState",
    "ToolContractEntry",
    "Lookup",
    "ContractRegistry",
    "default_registry_path",
    "load_registry",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
