# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_interaction_tier 单测 — 钉住三级仲裁 AX 优先、逐层降级、无线索拒绝。"""

from __future__ import annotations

import pytest

from app.services.browser_interaction_tier import (
    TIER_STABILITY_ORDER,
    TIERS,
    arbitrate_tier,
    next_tier_on_failure,
)


def test_tier_order_ax_first() -> None:
    """AX 层最稳,排最前(Codex:AX 语义点最稳)。"""
    assert TIER_STABILITY_ORDER == ("ax", "dom", "playwright")
    assert TIERS == ("ax", "dom", "playwright")


def test_full_info_prefers_ax() -> None:
    """同时有 role/name/nodeId/selector → AX 优先。"""
    plan = arbitrate_tier({
        "role": "button",
        "aria_name": "Submit",
        "node_id": 42,
        "selector": {"primary": "#submit", "candidates": ["#submit", ".btn"]},
    })
    assert plan.primary_tier == "ax"
    assert plan.tiers == ("ax", "dom", "playwright")
    assert len(plan.attempts) == 3


def test_only_selector_uses_playwright() -> None:
    plan = arbitrate_tier({"selector": {"primary": "#submit"}})
    assert plan.primary_tier == "playwright"
    assert plan.tiers == ("playwright",)


def test_role_without_name_still_ax() -> None:
    plan = arbitrate_tier({"role": "button"})
    assert plan.primary_tier == "ax"
    assert "role=button" in plan.attempts[0].anchor


def test_no_clues_rejected() -> None:
    """全缺线索 → 空计划,不给坐标兜底。"""
    plan = arbitrate_tier({})
    assert plan.primary_tier is None
    assert plan.attempts == ()
    assert "拒绝" in plan.detail


def test_next_tier_on_failure_descends() -> None:
    plan = arbitrate_tier({"role": "button", "node_id": 7, "selector": "#s"})
    nxt = next_tier_on_failure(plan, "ax")
    assert nxt is not None
    assert nxt.tier == "dom"


def test_next_tier_on_last_returns_none() -> None:
    plan = arbitrate_tier({"selector": "#s"})
    assert next_tier_on_failure(plan, "playwright") is None


def test_next_tier_on_unknown_returns_none() -> None:
    plan = arbitrate_tier({"selector": "#s"})
    assert next_tier_on_failure(plan, "ax") is None  # ax 不在计划里


def test_dom_uses_node_id() -> None:
    plan = arbitrate_tier({"node_id": 99})
    assert plan.tiers == ("dom",)
    assert "nodeId=99" in plan.attempts[0].anchor


def test_selector_candidates_fallback() -> None:
    """无 primary 时用首个 candidate。"""
    plan = arbitrate_tier({"selector": {"candidates": [".a", ".b"]}})
    assert plan.tiers == ("playwright",)
    assert "selector=.a" in plan.attempts[0].anchor


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
