# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器三级交互 API 优先级仲裁 — 统一实现 26.1111 三级交互原语。

设计依据
--------
``内部规格`` §1/§3(明文 TS
按行为规格)。外部实现 浏览器交互有三个抽象层级可选::

    AXAPI        —— 无障碍树级(按可访问性语义点,最稳)
    DomCUAAPI    —— DOM 节点级(按 backend nodeId)
    PlaywrightAPI —— Playwright locator 级(按 selector)

    "Codex 显式把 AX 语义层做成一等 API" —— 同一个"点击"三层各有 API。

对照 IHUI 缺口
--------------
- ``element_locator_snapshot`` 只给了 selector 候选降级,无**跨抽象层级**的
  优先级仲裁:给定一个 ElementInfo(同时含 ariaName/role / nodeId / selector),
  该先用哪层?失败后按什么序降级?IHUI 无此判据。

设计要点(纯函数,零 IO)
------------------------
1. **三层稳定度序**(Codex:AX 最稳 → DOM 次之 → locator 依赖选择器稳定性):
   tier 序 = ax > dom > playwright;每层有自己的降级内序(候选/锚/选择器序);
2. **仲裁** ``arbitrate_tier``:按元素可用线索(有 ariaName/role → AX 可用;
   有 nodeId → DOM 可用;有 selector → locator 可用)产出**有序尝试计划**,
   AX 优先,失败逐层降级;
3. **降级内序**:每层内部再按稳定性排(AX:role+ariaName > role;DOM:nodeId;
   locator:primary > candidates);
4. **跳过不可用层**:缺线索的层不进计划(不猜),全缺 → 拒。

与既有层的关系
--------------
- 只产出"该按什么序试哪层"的计划,不真点击(那是执行器);消费
  ``element_locator_snapshot.ElementTargetSnapshot`` 的线索;
- 与 ``element_locator_snapshot``(候选降级)、``browser_interaction_params``
  (参数边界)互补:本模块补"跨抽象层级的优先级仲裁"这一维。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class InteractionTier(StrEnum):
    """三级交互抽象层级(Codex AXAPI / DomCUAAPI / PlaywrightAPI)。"""

    AX = "ax"  # 无障碍树级,语义点,最稳
    DOM = "dom"  # DOM 节点级,backend nodeId
    PLAYWRIGHT = "playwright"  # Playwright locator 级,selector


# 层稳定度序(越靠前越优先;Codex:AX 最稳)
TIER_STABILITY_ORDER: tuple[str, ...] = (
    InteractionTier.AX.value,
    InteractionTier.DOM.value,
    InteractionTier.PLAYWRIGHT.value,
)

TIERS: tuple[str, ...] = TIER_STABILITY_ORDER


@dataclass(frozen=True)
class TierAttempt:
    """计划里的一次尝试(某抽象层 + 该层的定位线索)。"""

    tier: str  # ``InteractionTier`` 之一
    anchor: str  # 该层的定位线索(AX:role+name / DOM:nodeId / locator:selector)
    reason: str  # 为何排在此位


@dataclass(frozen=True)
class ArbitrationPlan:
    """跨层级尝试计划(AX 优先,逐层降级)。"""

    attempts: tuple[TierAttempt, ...]
    primary_tier: str | None  # 首选层(最稳的可用层)
    detail: str

    @property
    def tiers(self) -> tuple[str, ...]:
        return tuple(a.tier for a in self.attempts)


def _ax_anchor(info: dict[str, Any]) -> str | None:
    """AX 层锚:role + ariaName(语义点,最稳);仅有 role 也算可用。"""
    role = info.get("role")
    aria = info.get("aria_name") or info.get("ariaName")
    if role and aria:
        return f"role={role},name={aria}"
    if role:
        return f"role={role}"
    return None


def _dom_anchor(info: dict[str, Any]) -> str | None:
    """DOM 层锚:backend nodeId。"""
    node_id = info.get("node_id", info.get("nodeId"))
    if node_id is not None:
        return f"nodeId={node_id}"
    return None


def _playwright_anchor(info: dict[str, Any]) -> str | None:
    """locator 层锚:primary 优先,否则首个 candidate。"""
    selector = info.get("selector")
    if isinstance(selector, dict):
        primary = selector.get("primary")
        if primary:
            return f"selector={primary}"
        candidates = selector.get("candidates")
        if isinstance(candidates, list) and candidates:
            return f"selector={candidates[0]}"
    elif isinstance(selector, str) and selector:
        return f"selector={selector}"
    return None


_ANCHORERS: dict[str, Any] = {
    InteractionTier.AX.value: _ax_anchor,
    InteractionTier.DOM.value: _dom_anchor,
    InteractionTier.PLAYWRIGHT.value: _playwright_anchor,
}


def arbitrate_tier(info: dict[str, Any]) -> ArbitrationPlan:
    """按元素可用线索仲裁三级交互的尝试顺序(AX 优先,逐层降级)。

    参数 ``info``:ElementInfo 形状的 dict(role/aria_name/node_id/selector)。
    只纳入有线索的层(不猜);全缺线索 → 空计划(调用方拒绝,不给坐标兜底)。
    """
    attempts: list[TierAttempt] = []
    for tier in TIER_STABILITY_ORDER:
        anchorer = _ANCHORERS[tier]
        anchor = anchorer(info)
        if anchor:
            attempts.append(TierAttempt(tier=tier, anchor=anchor, reason=_TIER_REASON[tier]))
    if not attempts:
        return ArbitrationPlan(
            attempts=(),
            primary_tier=None,
            detail="元素无任何层级线索(role/name/nodeId/selector 全缺),无安全定位入口,拒绝。",
        )
    return ArbitrationPlan(
        attempts=tuple(attempts),
        primary_tier=attempts[0].tier,
        detail=f"三级仲裁:优先 {attempts[0].tier}(最稳),失败逐层降级,共 {len(attempts)} 个可用层。",
    )


_TIER_REASON: dict[str, str] = {
    InteractionTier.AX.value: "AX 语义层最稳(可访问性语义点,不依赖选择器字符串)。",
    InteractionTier.DOM.value: "DOM 节点级次之(backend nodeId,受重排影响小于 selector)。",
    InteractionTier.PLAYWRIGHT.value: "Playwright locator 依赖选择器稳定性,作降级。",
}


def next_tier_on_failure(plan: ArbitrationPlan, failed_tier: str) -> TierAttempt | None:
    """某层失败后取下一个尝试(按计划序);无更多层返回 None。"""
    seen = False
    for attempt in plan.attempts:
        if seen:
            return attempt
        if attempt.tier == failed_tier:
            seen = True
    return None


__all__ = [
    "InteractionTier",
    "TIER_STABILITY_ORDER",
    "TIERS",
    "TierAttempt",
    "ArbitrationPlan",
    "arbitrate_tier",
    "next_tier_on_failure",
]
