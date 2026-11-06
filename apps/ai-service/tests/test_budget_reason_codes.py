# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批次 3:预算硬停原因码闭集 + 80/95/100% 行为(与 TS 契约逐字对齐)。

覆盖:
- BUDGET_STOP_REASON_CODES / scopes 与 packages/shared/src/sse/contract.ts 一致;
- normalize_budget_reason 把历史 free-text 映射到闭集,且不返回 None/空串;
- reason_code_for_usage 按实际判据(三维占比)定码,provider 优先;
- 真实 governor 内存模式 80%(warning)/95%(critical+degrade)/100%(hard stop)行为,
  硬停时 reason_code/scope 为机器字段,放行时为空串(不冒充"已停止")。
"""

from __future__ import annotations

import pytest

from app.core.budget_reason import (
    BUDGET_STOP_REASON_CODES,
    BUDGET_STOP_SCOPES,
    normalize_budget_reason,
    reason_code_for_usage,
    scope_for_budget_reason,
)
from app.services.llm_budget_governor import (
    _REDIS_KEY_DAILY,
    BudgetConfig,
    LLMBudgetGovernor,
    _today_key,
)


def _inject_daily(gov: LLMBudgetGovernor, tokens: float, cost: float) -> None:
    """往内存降级存储注入当日累计用量(与 _get_period_usage 读取 key 一致)。"""
    key = _REDIS_KEY_DAILY.format(date=_today_key())
    gov._memory_daily[key] = {"tokens": float(tokens), "cost": cost}


def _memory_gov(config: BudgetConfig) -> LLMBudgetGovernor:
    gov = LLMBudgetGovernor(config)
    gov._redis = None
    gov._redis_inited = True  # 跳过 Redis 连接,确保走内存口径
    return gov


# =============================================================================
# 1. 闭集常量 + 归一化
# =============================================================================


def test_reason_codes_match_contract_verbatim():
    """闭集与 contract.ts 逐字一致(顺序也一致,前端按序渲染)。"""
    assert BUDGET_STOP_REASON_CODES == (
        "daily_token_limit",
        "daily_cost_limit",
        "hourly_token_limit",
        "pillar_token_limit",
        "request_token_limit",
        "provider_budget_exhausted",
    )
    assert BUDGET_STOP_SCOPES == (
        "daily",
        "hourly",
        "pillar",
        "request",
        "provider",
    )


@pytest.mark.parametrize(
    ("reason", "expected"),
    [
        ("daily token limit exceeded", "daily_token_limit"),
        ("已达硬停止阈值(120.0% ≥ 100%)", "daily_token_limit"),
        ("daily cost limit exceeded: $1.2/$1", "daily_cost_limit"),
        ("成本超支 $1.2", "daily_cost_limit"),
        ("hourly token limit exceeded", "hourly_token_limit"),
        ("每小时 token 用量已达上限", "hourly_token_limit"),
        ("pillar rules budget exhausted", "pillar_token_limit"),
        ("支柱 rules 超预算", "pillar_token_limit"),
        ("request token limit exceeded", "request_token_limit"),
        ("单请求 token 超限", "request_token_limit"),
        ("provider quota exhausted", "provider_budget_exhausted"),
        ("上游供应商账户额度不足", "provider_budget_exhausted"),
        # 取不到判据且文案无维度关键词 ⇒ 唯一可达的默认硬停维度,不是 None
        ("预算已耗尽", "daily_token_limit"),
        ("", "daily_token_limit"),
        (None, "daily_token_limit"),
    ],
)
def test_normalize_budget_reason(reason: str | None, expected: str):
    code = normalize_budget_reason(reason)
    assert code == expected
    # 封闭集纪律:归一化永远落在闭集内,不允许 None/空串
    assert code in BUDGET_STOP_REASON_CODES


def test_scope_mapping_never_unknown():
    assert scope_for_budget_reason("hourly_token_limit") == "hourly"
    assert scope_for_budget_reason("daily_cost_limit") == "daily"
    assert scope_for_budget_reason("pillar_token_limit") == "pillar"
    assert scope_for_budget_reason("request_token_limit") == "request"
    assert scope_for_budget_reason("provider_budget_exhausted") == "provider"
    # 未知码不抛错:沿用日维(与归一化回落同口径)
    assert scope_for_budget_reason("no_such_code") == "daily"


def test_reason_code_for_usage_prefers_actual_dimension():
    # 成本占比最高 → 日成本
    assert reason_code_for_usage(
        daily_token_percent=0.9, daily_cost_percent=1.1, hourly_token_percent=0.2
    ) == ("daily_cost_limit", "daily")
    # 小时占比最高 → 小时
    assert reason_code_for_usage(
        daily_token_percent=0.9, daily_cost_percent=0.3, hourly_token_percent=1.2
    ) == ("hourly_token_limit", "hourly")
    # 日 token 占比最高 → 日 token
    assert reason_code_for_usage(
        daily_token_percent=1.3, daily_cost_percent=0.3, hourly_token_percent=0.2
    ) == ("daily_token_limit", "daily")
    # provider 优先(上游账户额度耗尽与用户日限额不是一回事)
    assert reason_code_for_usage(provider_exhausted=True) == (
        "provider_budget_exhausted",
        "provider",
    )
    # 都没过线 → 回落 free-text 归一(不返回空)
    assert reason_code_for_usage(
        reason="hourly token limit exceeded",
        daily_token_percent=0.5,
        daily_cost_percent=0.2,
        hourly_token_percent=0.3,
    ) == ("hourly_token_limit", "hourly")


# =============================================================================
# 2. governor 80/95/100% 行为(真实 check_budget,内存模式)
# =============================================================================


@pytest.mark.asyncio
async def test_budget_80_percent_only_warns():
    """80%:warning 事件,allowed=True,reason_code 留空(未停止)。"""
    gov = _memory_gov(
        BudgetConfig(daily_token_limit=1000, daily_cost_limit_usd=1000.0)
    )
    _inject_daily(gov, tokens=800, cost=0.0)
    result = await gov.check_budget("rules")
    assert result.allowed is True
    assert result.usage_percent == pytest.approx(0.8)
    assert result.reason_code == ""
    assert result.scope == ""
    events = gov.get_budget_events(event_type="budget.warning")
    assert len(events) == 1
    assert events[0]["usage_percent"] == pytest.approx(0.8)


@pytest.mark.asyncio
async def test_budget_95_percent_degrades_but_allows():
    """95%:critical 事件 + 自动降级,allowed=True,reason_code 留空。"""
    gov = _memory_gov(
        BudgetConfig(daily_token_limit=1000, daily_cost_limit_usd=1000.0)
    )
    _inject_daily(gov, tokens=950, cost=0.0)
    result = await gov.check_budget("rules")
    assert result.allowed is True
    assert result.usage_percent == pytest.approx(0.95)
    assert result.degrade_to_model == "gpt-4o-mini"
    assert result.reason_code == ""
    assert result.scope == ""
    assert gov.get_budget_events(event_type="budget.degrade")


@pytest.mark.asyncio
async def test_budget_100_percent_hard_stop_with_daily_code():
    """100%:硬停,reason_code=daily_token_limit,scope=daily。"""
    gov = _memory_gov(
        BudgetConfig(daily_token_limit=1000, daily_cost_limit_usd=1000.0)
    )
    _inject_daily(gov, tokens=1000, cost=0.0)
    result = await gov.check_budget("rules")
    assert result.allowed is False
    assert result.usage_percent == pytest.approx(1.0)
    assert result.reason_code == "daily_token_limit"
    assert result.scope == "daily"
    assert result.remaining_tokens == 0
    critical = gov.get_budget_events(event_type="budget.critical")
    assert critical
    assert critical[0]["hard_stop"] is True
    assert critical[0]["reason_code"] == "daily_token_limit"
    assert critical[0]["scope"] == "daily"


@pytest.mark.asyncio
async def test_budget_100_percent_cost_dominant_reports_cost_code():
    """日 token 充足但成本打满 → 硬停原因码必须是 daily_cost_limit(按实际判据)。"""
    gov = _memory_gov(
        BudgetConfig(daily_token_limit=1000, daily_cost_limit_usd=1.0)
    )
    _inject_daily(gov, tokens=1, cost=1.0)
    result = await gov.check_budget("hook")
    assert result.allowed is False
    assert result.reason_code == "daily_cost_limit"
    assert result.scope == "daily"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
