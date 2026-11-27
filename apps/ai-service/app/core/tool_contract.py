# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具契约的判定面(ITCP v0.1,Python 侧第一份,2026-11-27 立)。

**这是什么**:`packages/types/src/tool-contract.ts`(615 行)是契约的**类型与谓词**真相源,
`protocol/itcp-registry.json` 是它的**声明面导出物**(由 `scripts/itcp-export.mjs` 生成)。
本模块提供 Python 侧的第二份实现 —— 只实现**谓词**,不实现类型校验:
类型由导出器在 TS 侧校验过,Python 侧再抄一套 JSON Schema 等于制造第二个真相源。

**判序必须逐字对齐**(改 `packages/types/src/tool-contract.ts` 的谓词必须同步改本文件,
一致性由 `apps/ai-service/tests/test_tool_contract.py` 与 TS 侧 `itcp-export.test.mjs` 双向钉):

    humanApprovalMandated(carrier):
      1. 契约缺席(没有 permission) ⇒ **False,本判据完全不参与**
         —— 这是"不改缺省语义"的落点,不是 fail-open。第二阶段把"未声明即不可信"
         翻成运行时行为属另一票(前置 = 每个工具逐个补档),否则用户侧表现是
         "昨天能跑今天全要批准",那是制造事故不是收紧安全。
      2. 显式 `alwaysAsk is True` ⇒ True
      3. `requiresApproval is not True` ⇒ False
      4. 否则 ⇒ touchesExternalWorld(carrier)

    touchesExternalWorld: effectScope 认不出 ⇒ True(判碰);否则排除两档纯协议语义。
    mayWriteWorkspace:    effectScope 认不出 ⇒ True(判会);否则落在三档改写集合。

**它不做什么**(必须写在代码里,否则下一个人会拿它当万能门):

  - **不做危险门**。`run_command` / `write_file` 的契约是 `requiresApproval: false`
    (证据:protocol/itcp-registry.json 里这两枚的 permission),危险档拦截靠
    `dangerLevel: 'dangerous'` + 宿主的 danger-gate,不是这条谓词。
  - **不做放宽**。本谓词只能把 `allow` 升成 `ask`(单向棘轮),任何宿主不得用它
    把 `ask`/`deny` 降成 `allow`。
  - **不做工具可见性**。`shape.visibleToProvider` 是另一条轴,由导出物直接读字段。

**载体形态**(与 TS 的 `EffectScopeCarrier` 同构):

    {"contract": {"permission": {"effectScope": "workspace",
                                 "requiresApproval": True,
                                 "alwaysAsk": False}}}

`None` / 空 dict / 缺 `contract` / 缺 `permission` 一律按"契约缺席"处置(判序第 1 条)。
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Final

# --- 副作用档位(与 packages/types/src/tool-contract.ts 的 TOOL_EFFECT_SCOPES 逐字一致)---
TOOL_EFFECT_SCOPES: Final = (
    "none",
    "workspace",
    "repository",
    "network",
    "system",
    "delegate-to-caller",
    "ask-user",
)

# 纯协议语义两档:副作用不在本端发生(交回调用方 / 只问用户)。
TOOL_PROTOCOL_EFFECT_SCOPES: Final = ("delegate-to-caller", "ask-user")

# 会改写工作区/仓库/系统状态的档位(`mayWriteWorkspace` 的判据集合)。
TOOL_MUTATING_EFFECT_SCOPES: Final = ("workspace", "repository", "system")


def _permission_of(carrier: Any) -> Mapping[str, Any] | None:
    """从载体里取出 permission 子映射;取不到一律 None(按"契约缺席"处置)。"""
    if not isinstance(carrier, Mapping):
        return None
    contract = carrier.get("contract")
    if not isinstance(contract, Mapping):
        return None
    permission = contract.get("permission")
    if not isinstance(permission, Mapping):
        return None
    return permission


def declared_effect_scope(carrier: Any) -> str | None:
    """读 `contract.permission.effectScope` 并归一成规范档位。

    认不出(缺席 / 非字符串 / 拼错)返回 **None** —— 刻意不回落 `'none'`:
    静默降级成"无副作用"就是放行(TS 侧同一条判据,`tool-contract.ts:70` 注释)。
    """
    permission = _permission_of(carrier)
    if permission is None:
        return None
    scope = permission.get("effectScope")
    if not isinstance(scope, str):
        return None
    return scope if scope in TOOL_EFFECT_SCOPES else None


def touches_external_world(carrier: Any) -> bool:
    """这次调用碰没碰外部世界?缺省即不可信,且用**排除法**。

    只排除 `delegate-to-caller` / `ask-user` 两档纯协议语义;`none` 也算碰
    ("声明为无副作用的读"其结果仍取决于外部状态,策略侧要能看见它)。
    """
    scope = declared_effect_scope(carrier)
    if scope is None:
        return True
    return scope not in TOOL_PROTOCOL_EFFECT_SCOPES


def may_write_workspace(carrier: Any) -> bool:
    """这次调用会不会改写工作区?缺省即不可信。"""
    scope = declared_effect_scope(carrier)
    if scope is None:
        return True
    return scope in TOOL_MUTATING_EFFECT_SCOPES


def human_approval_mandated(carrier: Any) -> bool:
    """「这次调用必须由人来批准」的唯一投影出口(Python 侧)。

    判序与 TS `humanApprovalMandated` 逐字相同,见模块头注。返回值语义:
    `True` = 无论宿主策略怎么放行,都必须问人;`False` = 本判据不参与,
    **不代表**"不需要批准"(那由宿主的 dangerLevel / 权限模式判)。
    """
    permission = _permission_of(carrier)
    if permission is None:
        return False
    if permission.get("alwaysAsk") is True:
        return True
    if permission.get("requiresApproval") is not True:
        return False
    return touches_external_world(carrier)


def tightening_only(base_decision: str, carrier: Any, *, ask_decision: str = "ask") -> str:
    """把契约轴作用到宿主决策上:**只能收紧,不能放宽**。

    `base_decision` 是宿主按 dangerLevel / 权限模式算出的原始决策
    (`allow` / `ask` / `deny` 三值,大小写不敏感)。契约要求人批时,
    只有 `allow` 会被升成 `ask`;`ask` 与 `deny` 原样返回 —— 这是单向棘轮,
    防止"契约说不用批"被误读成"可以放宽危险门"。
    """
    normalized = str(base_decision or "").strip().lower()
    if normalized == "allow" and human_approval_mandated(carrier):
        return ask_decision
    return base_decision


__all__ = [
    "TOOL_EFFECT_SCOPES",
    "TOOL_PROTOCOL_EFFECT_SCOPES",
    "TOOL_MUTATING_EFFECT_SCOPES",
    "declared_effect_scope",
    "touches_external_world",
    "may_write_workspace",
    "human_approval_mandated",
    "tightening_only",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
