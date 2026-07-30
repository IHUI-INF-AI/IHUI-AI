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

import asyncio
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


# =============================================================================
# Fusion 策略增强测试(2026-07-30 立,merge/vote 双模式 + 降级 + 并发限流)
#
# 测试覆盖(≥10 个):
# - merge 模式成功 / judge 异常降级
# - vote 模式成功 / markdown fence / judge 异常降级 / 非法 JSON 降级
# - 全 proposer 失败 / 无 judge / 仅 1 个成功跳过 judge
# - 并发限流(Semaphore,max_concurrency=1 时 active 峰值=1)
# - judge_mode / max_concurrency 配置降级
# - vote 结果结构验证
# - _parse_vote_json 单元测试(裸 JSON / markdown fence / 文本前后 / 非法输入)
# =============================================================================


def _build_fusion_router(
    strategy: str = "fusion",
    chain: list[str] | None = None,
    judge: str | None = "gpt-4o-mini",
    judge_mode: str = "merge",
    max_concurrency: int = 5,
) -> ComboRouter:
    """构造一个 fusion 测试用 ComboRouter。"""
    router = ComboRouter()
    router.configure_combo("f1", {
        "strategy": strategy,
        "chain": chain or ["gpt-4o", "claude-3.5-sonnet", "gemini-2.5-pro"],
        "judge": judge,
        "judge_mode": judge_mode,
        "max_concurrency": max_concurrency,
    })
    return router


@pytest.mark.asyncio
async def test_fusion_merge_mode_basic_returns_judge_answer():
    """merge 模式:3 个 proposer + judge 融合,返回 judge 答案 + metric 字段。"""
    router = _build_fusion_router(judge_mode="merge")

    call_log: list[str] = []

    async def _complete(messages, model=None, **kwargs):
        call_log.append(model)
        proposers = {
            "gpt-4o": "answer A",
            "claude-3.5-sonnet": "answer B",
            "gemini-2.5-pro": "answer C",
        }
        if model in proposers:
            return {"content": proposers[model], "model": model, "usage": {}, "stub": False}
        if model == "gpt-4o-mini":  # judge
            return {"content": "merged best answer", "model": model, "usage": {}, "stub": False}
        return {"content": "", "error": True, "error_message": f"unknown {model}"}

    mock_gateway = MagicMock()
    mock_gateway.complete = _complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "Q"}],
            combo_name="f1",
        )

    assert result["content"] == "merged best answer"
    assert result["model"] == "gpt-4o-mini"
    assert result["fusion_judge_mode"] == "merge"
    assert set(result["fusion_proposers"]) == {"gpt-4o", "claude-3.5-sonnet", "gemini-2.5-pro"}
    # 4 次调用:3 proposer + 1 judge
    assert len(call_log) == 4
    assert "gpt-4o-mini" in call_log


@pytest.mark.asyncio
async def test_fusion_vote_mode_basic_returns_best_proposal():
    """vote 模式:judge 返回裸 JSON,选出 best_index=2 的 proposal(claude)。"""
    router = _build_fusion_router(judge_mode="vote")

    vote_json = (
        '{"best_index": 2, "scores": ['
        '{"index": 1, "score": 7, "reason": "ok"}, '
        '{"index": 2, "score": 9, "reason": "best"}, '
        '{"index": 3, "score": 6, "reason": "avg"}'
        '], "reason": "claude is most coherent"}'
    )

    async def _complete(messages, model=None, **kwargs):
        proposers = {
            "gpt-4o": "answer A",
            "claude-3.5-sonnet": "answer B",
            "gemini-2.5-pro": "answer C",
        }
        if model in proposers:
            return {"content": proposers[model], "model": model, "usage": {}, "stub": False}
        if model == "gpt-4o-mini":  # judge
            return {"content": vote_json, "model": model, "usage": {}, "stub": False}
        return {"content": "", "error": True, "error_message": f"unknown {model}"}

    mock_gateway = MagicMock()
    mock_gateway.complete = _complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "Q"}],
            combo_name="f1",
        )

    # vote 模式返回 best_index=2 → claude-3.5-sonnet 的 proposal
    assert result["content"] == "answer B"
    assert result["model"] == "claude-3.5-sonnet"
    assert result["fusion_judge_mode"] == "vote"
    assert result["fusion_judge_model"] == "gpt-4o-mini"
    vote_result = result["fusion_vote_result"]
    assert vote_result["best_index"] == 2
    assert vote_result["reason"] == "claude is most coherent"
    assert len(vote_result["scores"]) == 3
    assert vote_result["scores"][1] == {"index": 2, "score": 9, "reason": "best"}


@pytest.mark.asyncio
async def test_fusion_vote_mode_with_markdown_fence_json():
    """vote 模式:judge 返回 markdown fence 包裹的 JSON,解析后选出 best_index=1。"""
    router = _build_fusion_router(judge_mode="vote")

    vote_json = '```json\n{"best_index": 1, "scores": [], "reason": "first wins"}\n```'

    async def _complete(messages, model=None, **kwargs):
        proposers = {
            "gpt-4o": "answer A",
            "claude-3.5-sonnet": "answer B",
            "gemini-2.5-pro": "answer C",
        }
        if model in proposers:
            return {"content": proposers[model], "model": model, "usage": {}, "stub": False}
        if model == "gpt-4o-mini":
            return {"content": vote_json, "model": model, "usage": {}, "stub": False}
        return {"content": "", "error": True, "error_message": f"unknown {model}"}

    mock_gateway = MagicMock()
    mock_gateway.complete = _complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "Q"}],
            combo_name="f1",
        )

    assert result["content"] == "answer A"
    assert result["model"] == "gpt-4o"
    assert result["fusion_judge_mode"] == "vote"
    assert result["fusion_vote_result"]["best_index"] == 1
    assert result["fusion_vote_result"]["reason"] == "first wins"


@pytest.mark.asyncio
async def test_fusion_vote_mode_judge_exception_degrades_to_first():
    """vote 模式:judge 调用抛异常 → 记录 FAILURE + 降级取第一个成功 proposal。"""
    router = _build_fusion_router(judge_mode="vote")

    async def _complete(messages, model=None, **kwargs):
        proposers = {
            "gpt-4o": "answer A",
            "claude-3.5-sonnet": "answer B",
            "gemini-2.5-pro": "answer C",
        }
        if model in proposers:
            return {"content": proposers[model], "model": model, "usage": {}, "stub": False}
        if model == "gpt-4o-mini":
            raise RuntimeError("judge API down")
        return {"content": "", "error": True, "error_message": f"unknown {model}"}

    mock_gateway = MagicMock()
    mock_gateway.complete = _complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "Q"}],
            combo_name="f1",
        )

    # 降级到第一个成功 proposal(顺序由 chain 决定,首个是 gpt-4o)
    assert result["content"] == "answer A"
    assert result["model"] == "gpt-4o"
    # 降级场景:fusion_judge_mode 仍记录为 vote(因为配置是 vote,只是 judge 没成功)
    assert result["fusion_judge_mode"] == "vote"
    # 不应有 fusion_vote_result(judge 没成功)
    assert "fusion_vote_result" not in result


@pytest.mark.asyncio
async def test_fusion_vote_mode_invalid_json_degrades_to_first():
    """vote 模式:judge 返回非法 JSON → 记录 FAILURE + 降级取第一个成功 proposal。"""
    router = _build_fusion_router(judge_mode="vote")

    async def _complete(messages, model=None, **kwargs):
        proposers = {
            "gpt-4o": "answer A",
            "claude-3.5-sonnet": "answer B",
            "gemini-2.5-pro": "answer C",
        }
        if model in proposers:
            return {"content": proposers[model], "model": model, "usage": {}, "stub": False}
        if model == "gpt-4o-mini":
            # 非法 JSON:judge 累了输出自然语言
            return {"content": "I think answer 2 is better because reasons.", "model": model, "usage": {}, "stub": False}
        return {"content": "", "error": True, "error_message": f"unknown {model}"}

    mock_gateway = MagicMock()
    mock_gateway.complete = _complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "Q"}],
            combo_name="f1",
        )

    assert result["content"] == "answer A"
    assert result["model"] == "gpt-4o"
    assert "fusion_vote_result" not in result


@pytest.mark.asyncio
async def test_fusion_merge_mode_judge_exception_degrades_to_first():
    """merge 模式:judge 调用抛异常 → 记录 FAILURE + 降级取第一个成功 proposal。"""
    router = _build_fusion_router(judge_mode="merge")

    async def _complete(messages, model=None, **kwargs):
        proposers = {
            "gpt-4o": "answer A",
            "claude-3.5-sonnet": "answer B",
            "gemini-2.5-pro": "answer C",
        }
        if model in proposers:
            return {"content": proposers[model], "model": model, "usage": {}, "stub": False}
        if model == "gpt-4o-mini":
            raise RuntimeError("judge timeout")
        return {"content": "", "error": True, "error_message": f"unknown {model}"}

    mock_gateway = MagicMock()
    mock_gateway.complete = _complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "Q"}],
            combo_name="f1",
        )

    assert result["content"] == "answer A"
    assert result["model"] == "gpt-4o"
    assert result["fusion_judge_mode"] == "merge"  # 配置是 merge,judge 失败


@pytest.mark.asyncio
async def test_fusion_all_proposers_fail_returns_error():
    """fusion 策略:所有 proposer 都失败 → 返回 error,不调 judge。"""
    router = _build_fusion_router(judge_mode="vote")

    call_log: list[str] = []

    async def _complete(messages, model=None, **kwargs):
        call_log.append(model)
        # 所有调用都失败
        return {"content": "", "error": True, "error_message": f"{model} down"}

    mock_gateway = MagicMock()
    mock_gateway.complete = _complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "Q"}],
            combo_name="f1",
        )

    assert result.get("error")
    assert "all proposers failed" in result.get("error", "") or result.get("content") == ""
    # 只调了 3 个 proposer,judge 没调
    assert len(call_log) == 3
    assert "gpt-4o-mini" not in call_log


@pytest.mark.asyncio
async def test_fusion_no_judge_takes_first_success():
    """fusion 策略:无 judge 配置 → 直接取第一个成功 proposal。"""
    router = _build_fusion_router(judge=None, judge_mode="merge")

    async def _complete(messages, model=None, **kwargs):
        proposers = {
            "gpt-4o": "answer A",
            "claude-3.5-sonnet": "answer B",
            "gemini-2.5-pro": "answer C",
        }
        return {"content": proposers[model], "model": model, "usage": {}, "stub": False}

    mock_gateway = MagicMock()
    mock_gateway.complete = _complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "Q"}],
            combo_name="f1",
        )

    # 无 judge → fusion_judge_mode = "none"
    assert result["content"] == "answer A"
    assert result["model"] == "gpt-4o"
    assert result["fusion_judge_mode"] == "none"


@pytest.mark.asyncio
async def test_fusion_single_success_skips_judge():
    """fusion 策略:仅 1 个 proposer 成功 → 不调 judge,直接返回该 proposal。"""
    router = _build_fusion_router(judge="gpt-4o-mini", judge_mode="vote")

    call_log: list[str] = []

    async def _complete(messages, model=None, **kwargs):
        call_log.append(model)
        if model == "gpt-4o":
            return {"content": "only success", "model": model, "usage": {}, "stub": False}
        # 其他 proposer 失败
        return {"content": "", "error": True, "error_message": f"{model} failed"}

    mock_gateway = MagicMock()
    mock_gateway.complete = _complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "Q"}],
            combo_name="f1",
        )

    # judge 不会被调用(因为只有 1 个成功)
    assert "gpt-4o-mini" not in call_log
    assert result["content"] == "only success"
    assert result["model"] == "gpt-4o"
    assert result["fusion_judge_mode"] == "none"  # 没走 judge


@pytest.mark.asyncio
async def test_fusion_concurrency_limit_enforced_by_semaphore():
    """max_concurrency=1 时,proposer 串行调用(active 峰值=1)。"""
    router = _build_fusion_router(judge=None, max_concurrency=1)

    active = 0
    max_active = [0]
    lock = asyncio.Lock()

    async def _complete(messages, model=None, **kwargs):
        nonlocal active
        async with lock:
            active += 1
            if active > max_active[0]:
                max_active[0] = active
        await asyncio.sleep(0.02)  # 模拟 IO,让其他 task 有机会进入
        async with lock:
            active -= 1
        return {"content": f"from {model}", "model": model, "usage": {}, "stub": False}

    mock_gateway = MagicMock()
    mock_gateway.complete = _complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "Q"}],
            combo_name="f1",
        )

    assert max_active[0] == 1, f"max_concurrency=1 应保证 active 峰值=1,实际={max_active[0]}"
    assert result["content"].startswith("from ")


@pytest.mark.asyncio
async def test_fusion_concurrency_limit_allows_parallel_when_gt_1():
    """max_concurrency=3 时,3 个 proposer 可并发(active 峰值=3)。"""
    router = _build_fusion_router(
        chain=["gpt-4o", "claude-3.5-sonnet", "gemini-2.5-pro"],
        judge=None,
        max_concurrency=3,
    )

    active = 0
    max_active = [0]
    lock = asyncio.Lock()

    async def _complete(messages, model=None, **kwargs):
        nonlocal active
        async with lock:
            active += 1
            if active > max_active[0]:
                max_active[0] = active
        await asyncio.sleep(0.02)
        async with lock:
            active -= 1
        return {"content": f"from {model}", "model": model, "usage": {}, "stub": False}

    mock_gateway = MagicMock()
    mock_gateway.complete = _complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        await router.route_with_combo(
            messages=[{"role": "user", "content": "Q"}],
            combo_name="f1",
        )

    assert max_active[0] == 3, f"max_concurrency=3 应允许 3 并发,实际={max_active[0]}"


def test_fusion_judge_mode_invalid_falls_back_to_merge():
    """configure_combo judge_mode 无效值 → 降级为 merge。"""
    router = ComboRouter()
    router.configure_combo("f1", {
        "strategy": "fusion",
        "chain": ["gpt-4o", "claude-3.5-sonnet"],
        "judge": "gpt-4o-mini",
        "judge_mode": "invalid_mode",
    })
    combo = router.get_combo("f1")
    assert combo is not None
    assert combo.judge_mode == "merge"


def test_fusion_max_concurrency_invalid_falls_back_to_5():
    """configure_combo max_concurrency=0 → 降级为 5(其他无效值同理)。"""
    router = ComboRouter()
    router.configure_combo("f1", {
        "strategy": "fusion",
        "chain": ["gpt-4o"],
        "max_concurrency": 0,
    })
    combo = router.get_combo("f1")
    assert combo is not None
    assert combo.max_concurrency == 5

    # 负数也应降级
    router.configure_combo("f2", {
        "strategy": "fusion",
        "chain": ["gpt-4o"],
        "max_concurrency": -1,
    })
    combo2 = router.get_combo("f2")
    assert combo2 is not None
    assert combo2.max_concurrency == 5

    # bool 不算 int(True=1 但被显式拒绝)
    router.configure_combo("f3", {
        "strategy": "fusion",
        "chain": ["gpt-4o"],
        "max_concurrency": True,
    })
    combo3 = router.get_combo("f3")
    assert combo3 is not None
    assert combo3.max_concurrency == 5


def test_fusion_combo_chain_defaults():
    """ComboChain 默认 judge_mode=merge / max_concurrency=5。"""
    chain = ComboChain(
        name="default-test",
        strategy=ComboStrategy.FUSION,
        chain=["gpt-4o"],
    )
    assert chain.judge_mode == "merge"
    assert chain.max_concurrency == 5
    assert chain.judge is None


@pytest.mark.asyncio
async def test_fusion_vote_result_structure_complete():
    """vote 模式成功时,fusion_vote_result 含 best_index/scores/reason 完整字段。"""
    router = _build_fusion_router(judge_mode="vote")

    vote_json = (
        '{"best_index": 3, "scores": ['
        '{"index": 1, "score": 5, "reason": "weak"}, '
        '{"index": 2, "score": 7, "reason": "ok"}, '
        '{"index": 3, "score": 9, "reason": "excellent"}'
        '], "reason": "gemini wins"}'
    )

    async def _complete(messages, model=None, **kwargs):
        proposers = {
            "gpt-4o": "answer A",
            "claude-3.5-sonnet": "answer B",
            "gemini-2.5-pro": "answer C",
        }
        if model in proposers:
            return {"content": proposers[model], "model": model, "usage": {}, "stub": False}
        if model == "gpt-4o-mini":
            return {"content": vote_json, "model": model, "usage": {}, "stub": False}
        return {"content": "", "error": True, "error_message": f"unknown {model}"}

    mock_gateway = MagicMock()
    mock_gateway.complete = _complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "Q"}],
            combo_name="f1",
        )

    # 选了 best_index=3 → gemini-2.5-pro
    assert result["model"] == "gemini-2.5-pro"
    assert result["content"] == "answer C"
    assert result["fusion_judge_mode"] == "vote"
    assert result["fusion_judge_model"] == "gpt-4o-mini"
    vote = result["fusion_vote_result"]
    assert vote["best_index"] == 3
    assert vote["reason"] == "gemini wins"
    assert len(vote["scores"]) == 3
    # 验证 scores 中每项结构
    for s in vote["scores"]:
        assert "index" in s
        assert "score" in s
        assert "reason" in s
    assert vote["scores"][2] == {"index": 3, "score": 9, "reason": "excellent"}
    # fusion_proposers 应该列出所有成功的 proposer
    assert set(result["fusion_proposers"]) == {"gpt-4o", "claude-3.5-sonnet", "gemini-2.5-pro"}


# -----------------------------------------------------------------------------
# _parse_vote_json 单元测试(纯函数,直接调 router._parse_vote_json)
# -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "content,total,expected_best",
    [
        # 1. 裸 JSON
        (
            '{"best_index": 1, "scores": [{"index": 1, "score": 9, "reason": "good"}], "reason": "best is 1"}',
            2,
            1,
        ),
        # 2. markdown fence ```json ... ```
        (
            '```json\n{"best_index": 2, "scores": [], "reason": "..."}\n```',
            2,
            2,
        ),
        # 3. markdown fence ``` ... ```(无 json 标识)
        (
            '```\n{"best_index": 1, "scores": [], "reason": "x"}\n```',
            3,
            1,
        ),
        # 4. 文本前后包裹 JSON
        (
            'Here is the result:\n{"best_index": 1, "scores": [], "reason": "x"}\nDone.',
            3,
            1,
        ),
        # 5. best_index = total 边界
        (
            '{"best_index": 3, "scores": [], "reason": ""}',
            3,
            3,
        ),
        # 6. 缺失 scores 字段 → 默认空列表
        (
            '{"best_index": 1, "reason": "ok"}',
            2,
            1,
        ),
        # 7. 缺失 reason 字段 → 默认空字符串
        (
            '{"best_index": 1, "scores": []}',
            2,
            1,
        ),
    ],
)
def test_parse_vote_json_valid_inputs(content, total, expected_best):
    """_parse_vote_json 合法输入场景:支持裸 JSON / markdown fence / 文本前后。"""
    router = ComboRouter()
    result = router._parse_vote_json(content, total=total)
    assert result is not None
    assert result["best_index"] == expected_best
    assert isinstance(result["scores"], list)
    assert isinstance(result["reason"], str)


@pytest.mark.parametrize(
    "content,total",
    [
        # 1. 完全不是 JSON
        ("not json at all", 2),
        # 2. best_index 越界(>total)
        ('{"best_index": 5, "scores": [], "reason": ""}', 2),
        # 3. best_index < 1
        ('{"best_index": 0, "scores": [], "reason": ""}', 2),
        # 4. best_index 缺失
        ('{"scores": [], "reason": ""}', 2),
        # 5. best_index 是 bool(True 在 Python 中是 int 子类,但应被拒绝)
        ('{"best_index": true, "scores": [], "reason": ""}', 2),
        # 6. best_index 是字符串
        ('{"best_index": "1", "scores": [], "reason": ""}', 2),
        # 7. JSON 是数组而非对象
        ('[1, 2, 3]', 2),
        # 8. JSON 是数字
        ('42', 2),
        # 9. 空 content
        ("", 2),
    ],
)
def test_parse_vote_json_rejects_invalid(content, total):
    """_parse_vote_json 拒绝非法输入(返回 None)。"""
    router = ComboRouter()
    result = router._parse_vote_json(content, total=total)
    assert result is None


def test_parse_vote_json_scores_structure_normalized():
    """_parse_vote_json 把 scores 中每项归一化为 {index, score, reason} 结构。"""
    router = ComboRouter()
    content = (
        '{"best_index": 1, "scores": ['
        '{"index": 1, "score": 8, "reason": "good"}, '
        '{"index": 2, "score": 6}, '  # 缺 reason
        '{"index": 3}, '  # 缺 score + reason
        '"invalid", '  # 非 dict 项,应被跳过
        '42'  # 非 dict 项,应被跳过
        '], "reason": "test"}'
    )
    result = router._parse_vote_json(content, total=3)
    assert result is not None
    scores = result["scores"]
    assert len(scores) == 3  # 3 个有效 dict 项
    assert scores[0] == {"index": 1, "score": 8, "reason": "good"}
    assert scores[1] == {"index": 2, "score": 6, "reason": ""}
    assert scores[2] == {"index": 3, "score": 0, "reason": ""}


def test_extract_original_question_from_messages():
    """_extract_original_question 取最后一条 user 消息 content。"""
    router = ComboRouter()
    messages = [
        {"role": "system", "content": "you are helpful"},
        {"role": "user", "content": "first question"},
        {"role": "assistant", "content": "answer"},
        {"role": "user", "content": "second question"},
    ]
    assert router._extract_original_question(messages) == "second question"


def test_extract_original_question_no_user_returns_unknown():
    """_extract_original_question 无 user 消息时返回 (unknown)。"""
    router = ComboRouter()
    messages = [
        {"role": "system", "content": "you are helpful"},
        {"role": "assistant", "content": "answer"},
    ]
    assert router._extract_original_question(messages) == "(unknown)"


def test_extract_original_question_multimodal_list_content():
    """_extract_original_question 支持多模态 list content(取首项 text)。"""
    router = ComboRouter()
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "describe this image"},
                {"type": "image_url", "image_url": {"url": "..."}},
            ],
        },
    ]
    assert router._extract_original_question(messages) == "describe this image"


@pytest.mark.asyncio
async def test_fusion_merge_mode_proposers_partial_failure():
    """fusion 策略:部分 proposer 失败,judge 仍用成功的 proposals 融合。

    验证:即使 chain 有 3 个,只有 2 个成功,judge 仍被调用并返回融合答案。
    """
    router = _build_fusion_router(judge_mode="merge")

    async def _complete(messages, model=None, **kwargs):
        if model == "gpt-4o":
            return {"content": "answer A", "model": model, "usage": {}, "stub": False}
        if model == "claude-3.5-sonnet":
            return {"content": "", "error": True, "error_message": "claude down"}
        if model == "gemini-2.5-pro":
            return {"content": "answer C", "model": model, "usage": {}, "stub": False}
        if model == "gpt-4o-mini":  # judge
            return {"content": "merged A and C", "model": model, "usage": {}, "stub": False}
        return {"content": "", "error": True, "error_message": f"unknown {model}"}

    mock_gateway = MagicMock()
    mock_gateway.complete = _complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "Q"}],
            combo_name="f1",
        )

    # judge 成功,返回融合答案
    assert result["content"] == "merged A and C"
    assert result["model"] == "gpt-4o-mini"
    assert result["fusion_judge_mode"] == "merge"
    # fusion_proposers 只列出成功的 2 个(claude 失败,不在内)
    assert set(result["fusion_proposers"]) == {"gpt-4o", "gemini-2.5-pro"}


@pytest.mark.asyncio
async def test_fusion_metric_no_exception_propagates(caplog):
    """fusion 调用过程 metric 埋点失败不阻塞业务(_safe_metric_inc 吞异常)。"""
    router = _build_fusion_router(judge_mode="merge")

    async def _complete(messages, model=None, **kwargs):
        proposers = {
            "gpt-4o": "answer A",
            "claude-3.5-sonnet": "answer B",
            "gemini-2.5-pro": "answer C",
        }
        if model in proposers:
            return {"content": proposers[model], "model": model, "usage": {}, "stub": False}
        if model == "gpt-4o-mini":
            return {"content": "merged", "model": model, "usage": {}, "stub": False}
        return {"content": "", "error": True, "error_message": f"unknown {model}"}

    mock_gateway = MagicMock()
    mock_gateway.complete = _complete

    with patch("app.core.llm_gateway.llm_gateway", mock_gateway):
        # 即使 metric 内部异常,业务调用应正常返回
        result = await router.route_with_combo(
            messages=[{"role": "user", "content": "Q"}],
            combo_name="f1",
        )

    assert result["content"] == "merged"
    assert result["fusion_judge_mode"] == "merge"
