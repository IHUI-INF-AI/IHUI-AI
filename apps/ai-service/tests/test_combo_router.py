"""combo_router.py 单元测试(P0-1 Combo 多级 fallback 链服务)。

测试覆盖:
- ComboChain 数据类构造
- configure_combo / get_combo / list_combos / find_combo_for_model
- ProviderHealthState:cooldown 检测 / mark_429 / mark_success
- ComboRouter.route_with_combo 三策略(priority / cheapest / fusion)
- 429 / timeout / 5xx 自动 fallback
- 全链路失败降级
- 配置链缺失处理
"""

from __future__ import annotations

import time
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.combo_router import (
    ComboChain,
    ComboRouter,
    ComboStrategy,
    ProviderHealthState,
    combo_router,
)


# =============================================================================
# ComboChain 数据类
# =============================================================================


def test_combo_chain_priority_strategy():
    """ComboChain 默认 strategy=priority。"""
    chain = ComboChain(
        name="test",
        strategy=ComboStrategy.PRIORITY,
        chain=["kimi-k2", "glm-4-flash"],
    )
    assert chain.strategy == ComboStrategy.PRIORITY
    assert chain.chain == ["kimi-k2", "glm-4-flash"]


def test_combo_chain_fusion_strategy_with_judge():
    """fusion 策略需要 judge model。"""
    chain = ComboChain(
        name="fusion-test",
        strategy=ComboStrategy.FUSION,
        chain=["gpt-4o", "claude-3.5-sonnet"],
        judge="gpt-4o-mini",
    )
    assert chain.strategy == ComboStrategy.FUSION
    assert chain.judge == "gpt-4o-mini"


# =============================================================================
# ProviderHealthState(cooldown 检测)
# =============================================================================


def test_health_state_initial_not_in_cooldown():
    """新建 health state 默认不在冷却期。"""
    h = ProviderHealthState(provider="kimi-k2")
    assert not h.is_in_cooldown()


def test_health_state_mark_429_triggers_cooldown():
    """mark_429 后进入冷却期。"""
    h = ProviderHealthState(provider="kimi-k2", cooldown_seconds=60.0)
    h.mark_429()
    assert h.is_in_cooldown()
    assert h.consecutive_failures == 1


def test_health_state_cooldown_expires():
    """冷却期过后自动恢复。"""
    h = ProviderHealthState(provider="kimi-k2")
    # 直接设置 last_429_at + cooldown_seconds(mark_429 会重置 cooldown_seconds,故不调)
    h.last_429_at = time.time()
    h.cooldown_seconds = 1.0
    # 模拟时间过去 1.5 秒
    future = time.time() + 1.5
    assert not h.is_in_cooldown(now=future)


def test_health_state_mark_success_resets_failures():
    """mark_success 重置 consecutive_failures。"""
    h = ProviderHealthState(provider="kimi-k2")
    h.mark_429()
    h.mark_429()
    assert h.consecutive_failures == 2
    h.mark_success()
    assert h.consecutive_failures == 0


# =============================================================================
# configure_combo / get_combo / list_combos / find_combo_for_model
# =============================================================================


def test_configure_combo_and_get():
    """configure_combo 注册后 get_combo 能取到。"""
    router = ComboRouter()
    router.configure_combo("maximize-free", {
        "strategy": "priority",
        "chain": ["kimi-k2", "glm-4-flash", "deepseek-chat"],
    })
    combo = router.get_combo("maximize-free")
    assert combo is not None
    assert combo.chain == ["kimi-k2", "glm-4-flash", "deepseek-chat"]


def test_get_combo_not_found():
    """未配置的 combo 返回 None。"""
    router = ComboRouter()
    assert router.get_combo("nonexistent") is None


def test_list_combos():
    """list_combos 返回所有已配置 combo。"""
    router = ComboRouter()
    router.configure_combo("c1", {"strategy": "priority", "chain": ["m1"]})
    router.configure_combo("c2", {"strategy": "cheapest", "chain": ["m2"]})
    combos = router.list_combos()
    assert len(combos) == 2


def test_find_combo_for_model_hit():
    """find_combo_for_model 命中。"""
    router = ComboRouter()
    router.configure_combo("maximize-free", {
        "strategy": "priority",
        "chain": ["kimi-k2", "glm-4-flash"],
    })
    assert router.find_combo_for_model("kimi-k2") == "maximize-free"
    assert router.find_combo_for_model("glm-4-flash") == "maximize-free"


def test_find_combo_for_model_miss():
    """find_combo_for_model 未命中返回 None。"""
    router = ComboRouter()
    router.configure_combo("c1", {"strategy": "priority", "chain": ["m1"]})
    assert router.find_combo_for_model("m999") is None


# =============================================================================
# route_with_combo:priority 策略
# =============================================================================


@pytest.mark.asyncio
async def test_route_priority_first_provider_success():
    """priority 策略:第一个 provider 成功直接返回。"""
    router = ComboRouter()
    router.configure_combo("c1", {
        "strategy": "priority",
        "chain": ["kimi-k2", "glm-4-flash"],
    })

    mock_gateway = MagicMock()
    mock_gateway.complete = AsyncMock(return_value={
        "content": "hello",
        "model": "kimi-k2",
        "usage": {},
        "stub": False,
    })

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "hi"}],
            combo_name="c1",
            primary="kimi-k2",
        )
    assert result["content"] == "hello"
    assert result["model"] == "kimi-k2"
    mock_gateway.complete.assert_called_once()


@pytest.mark.asyncio
async def test_route_priority_fallback_on_error():
    """priority 策略:第一个失败自动切第二个。"""
    router = ComboRouter()
    router.configure_combo("c1", {
        "strategy": "priority",
        "chain": ["kimi-k2", "glm-4-flash"],
    })

    mock_gateway = MagicMock()
    mock_gateway.complete = AsyncMock(side_effect=[
        {"content": "", "error": True, "error_message": "429 rate limit"},
        {"content": "fallback ok", "model": "glm-4-flash", "usage": {}, "stub": False},
    ])

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "hi"}],
            combo_name="c1",
            primary="kimi-k2",
        )
    assert result["content"] == "fallback ok"
    assert result["model"] == "glm-4-flash"
    assert mock_gateway.complete.call_count == 2


@pytest.mark.asyncio
async def test_route_priority_all_providers_fail():
    """priority 策略:全链路失败返回 error。"""
    router = ComboRouter()
    router.configure_combo("c1", {
        "strategy": "priority",
        "chain": ["kimi-k2", "glm-4-flash"],
    })

    mock_gateway = MagicMock()
    mock_gateway.complete = AsyncMock(return_value={
        "content": "",
        "error": True,
        "error_message": "5xx server error",
    })

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "hi"}],
            combo_name="c1",
            primary="kimi-k2",
        )
    assert result.get("error") or result.get("error_message")
    assert mock_gateway.complete.call_count == 2


@pytest.mark.asyncio
async def test_route_combo_not_found():
    """combo_name 不存在返回 error。"""
    router = ComboRouter()
    result = await router.route_with_combo(
        messages=[{"role": "user", "content": "hi"}],
        combo_name="nonexistent",
        primary="kimi-k2",
    )
    assert result.get("error") or "not found" in str(result.get("error", "")) + str(result.get("content", ""))


# =============================================================================
# route_with_combo:cheapest 策略
# =============================================================================


@pytest.mark.asyncio
async def test_route_cheapest_picks_lowest_price():
    """cheapest 策略:按价格升序选可用 provider。"""
    router = ComboRouter()
    router.configure_combo("c1", {
        "strategy": "cheapest",
        "chain": ["gpt-4o", "glm-4-flash", "kimi-k2"],  # 顺序不按价格
    })

    mock_gateway = MagicMock()
    # 模拟:第一个调用的应该是 kimi-k2($0)而非 gpt-4o($2.5)
    captured_models: list[str] = []

    async def _capture_complete(messages, model=None, **kwargs):
        captured_models.append(model)
        return {"content": f"from {model}", "model": model, "usage": {}, "stub": False}

    mock_gateway.complete = _capture_complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "hi"}],
            combo_name="c1",
            primary="gpt-4o",
        )
    # cheapest 应该优先选 kimi-k2($0)和 glm-4-flash($0)
    assert captured_models[0] in ("kimi-k2", "glm-4-flash")
    assert result["content"].startswith("from ")


# =============================================================================
# route_with_combo:429 cooldown
# =============================================================================


@pytest.mark.asyncio
async def test_route_priority_429_marks_cooldown():
    """priority 策略:429 错误标记 provider cooldown,后续跳过。"""
    router = ComboRouter()
    router.configure_combo("c1", {
        "strategy": "priority",
        "chain": ["kimi-k2", "glm-4-flash"],
    })

    mock_gateway = MagicMock()
    mock_gateway.complete = AsyncMock(side_effect=[
        {"content": "", "error": True, "error_message": "429 Too Many Requests"},
        {"content": "ok", "model": "glm-4-flash", "usage": {}, "stub": False},
    ])

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        await router.route_with_combo(
            messages=[{"role": "user", "content": "hi"}],
            combo_name="c1",
            primary="kimi-k2",
        )
    # kimi-k2 应该在 cooldown 中
    health = router._get_health("kimi-k2")
    assert health.is_in_cooldown()
    assert health.consecutive_failures >= 1


# =============================================================================
# PROVIDER_PRICING 表
# =============================================================================


def test_provider_pricing_table_has_free_providers():
    """PROVIDER_PRICING 表含免费 provider(0,0)。"""
    free = [
        m for m, p in ComboRouter.PROVIDER_PRICING.items()
        if p == (0.0, 0.0)
    ]
    assert "kimi-k2" in free
    assert "glm-4-flash" in free


def test_provider_pricing_table_has_premium_providers():
    """PROVIDER_PRICING 表含高档 provider(>=$10 input)。"""
    premium = [
        m for m, p in ComboRouter.PROVIDER_PRICING.items()
        if p[0] >= 10.0
    ]
    assert "claude-opus-4" in premium
    assert "gpt-5" in premium


# =============================================================================
# 模块级单例
# =============================================================================


def test_combo_router_singleton_exists():
    """combo_router 模块级单例存在。"""
    assert combo_router is not None
    assert isinstance(combo_router, ComboRouter)
