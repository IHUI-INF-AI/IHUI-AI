# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""2-6 成本真实计价(Decimal 微元整数)与预算看板测试。

覆盖:
- cost_micro_usd / cost_micro_usd_from_per_1m / cost_micro_usd_from_per_1k:
  精度(ROUND_HALF_UP 单次舍入、float 漂移反例)、多模型、0 token 边界
- estimate_cost_usd 对外契约不变(cost_usd + estimated)
- llm_budget_governor._calc_cost Decimal 改造等价性(per-1K 表语义)
- 预算金额模式:check_budget 在 cost_pct 主导时取 max 作为 usage_percent
- 预算事件环形缓冲:写入/去重/回落新周期/limit/event_type 过滤/最新在前
- llm_usage_service._estimate_cost 微元引擎挂接(round 4 位口径)
"""

from __future__ import annotations

import pytest

from app.core import model_pricing
from app.core.model_pricing import (
    cost_micro_usd,
    cost_micro_usd_from_per_1k,
    cost_micro_usd_from_per_1m,
    estimate_cost_usd,
    micro_usd_to_usd,
)
from app.services.llm_budget_governor import (
    _REDIS_KEY_DAILY,
    BudgetConfig,
    LLMBudgetGovernor,
    _today_key,
)
from app.services.llm_usage_service import _estimate_cost


@pytest.fixture(autouse=True)
def _clean_overrides():
    """每用例前后清空运行时价目覆盖,防用例间污染。"""
    model_pricing._OVERRIDES.clear()
    yield
    model_pricing._OVERRIDES.clear()


@pytest.fixture
def memory_governor() -> LLMBudgetGovernor:
    """强制内存模式的 governor(不发 Redis,不连外部状态)。"""
    gov = LLMBudgetGovernor()
    gov._redis = None
    gov._redis_inited = True
    return gov


# =============================================================================
# 微元计价纯函数(Decimal 精度)
# =============================================================================


def test_micro_from_per_1m_exact():
    # per-1M 单价 × token 数恰以微元为量纲,全程无除法
    assert cost_micro_usd_from_per_1m(2.50, 10.00, 1_000_000, 1_000_000) == 12_500_000
    assert cost_micro_usd_from_per_1m(2.50, 10.00, 0, 0) == 0
    assert cost_micro_usd_from_per_1m(0.0, 0.0, 1_000_000, 1_000_000) == 0


def test_micro_from_per_1k_exact():
    # tokens × USD/1K × 1000 = 微美元
    assert cost_micro_usd_from_per_1k(0.0025, 0.01, 1000, 500) == 7500
    assert cost_micro_usd_from_per_1k(0.002, 0.008, 0, 0) == 0


def test_micro_round_half_up_boundaries():
    # 0.75 micro → 进位到 1
    assert cost_micro_usd_from_per_1k(0.00015, 0.0006, 1, 1) == 1
    # 0.3 micro → 舍去到 0
    assert cost_micro_usd_from_per_1m(0.10, 0.20, 1, 1) == 0
    # 2.5 micro → HALF_UP 进位到 3(而非银行家舍入的 2)
    assert cost_micro_usd_from_per_1m(2.50, 0.0, 1, 0) == 3


def test_micro_beats_float_drift():
    """float 链路反例:0.07 的二进制近似 × 50 = 3.4999…会被舍到 3;
    Decimal(str) 精确 3.5 → HALF_UP 进位到 4。"""
    assert cost_micro_usd_from_per_1m(0.07, 0.0, 50, 0) == 4


def test_micro_usd_to_usd():
    assert micro_usd_to_usd(7500) == 0.0075
    assert micro_usd_to_usd(12_500_000) == 12.5
    assert micro_usd_to_usd(0) == 0.0
    assert micro_usd_to_usd(1) == 0.000001


# =============================================================================
# cost_micro_usd 多模型价目解析
# =============================================================================


@pytest.mark.parametrize(
    ("model", "tokens_in", "tokens_out", "expected_micro"),
    [
        ("gpt-4o", 1_000_000, 0, 2_500_000),          # 2.50 / 1M in
        ("gpt-4o", 1_000_000, 1_000_000, 12_500_000),  # + 10.00 / 1M out
        ("gpt-4o-mini", 1000, 1000, 750),               # 0.15/0.60 per 1M
        ("claude-sonnet-4", 1_000_000, 1_000_000, 18_000_000),  # 3.00/15.00
        ("gemini-2.5-flash", 1_000_000, 1_000_000, 2_800_000),  # 0.30/2.50
        ("deepseek-chat", 1_000_000, 1_000_000, 700_000),  # 0.28/0.42
        ("no-such-model", 1_000_000, 1_000_000, 4_000_000),  # 全局默认 1.00/3.00
    ],
)
def test_cost_micro_usd_multi_model(model, tokens_in, tokens_out, expected_micro):
    assert cost_micro_usd(model, tokens_in, tokens_out) == expected_micro


def test_cost_micro_usd_provider_fallback():
    # 模型未命中 → 厂商级兜底(anthropic 3.00/15.00)
    assert cost_micro_usd("totally-unknown", 1_000_000, 0, provider="anthropic") == 3_000_000


def test_cost_micro_usd_zero_tokens():
    assert cost_micro_usd("gpt-4o", 0, 0) == 0


# =============================================================================
# estimate_cost_usd 对外契约(回归)
# =============================================================================


def test_estimate_cost_usd_contract_unchanged():
    r = estimate_cost_usd("gpt-4o", 1_000_000, 1_000_000)
    assert r["cost_usd"] == 12.5
    assert r["estimated"] is False


def test_estimate_cost_usd_estimated_flag():
    r = estimate_cost_usd("no-such-model", 1_000_000, 1_000_000)
    assert r["cost_usd"] == 4.0  # 全局默认 1.00/3.00
    assert r["estimated"] is True


def test_estimate_cost_usd_zero_tokens():
    assert estimate_cost_usd("gpt-4o", 0, 0)["cost_usd"] == 0.0


# =============================================================================
# llm_budget_governor._calc_cost(Decimal 改造等价性,per-1K 表语义)
# =============================================================================


def test_calc_cost_gpt4o(memory_governor):
    # 表内 per-1K:0.0025/0.01 → (1000×0.0025 + 500×0.01)×1000 = 7500 micro
    assert memory_governor._calc_cost("gpt-4o", 1000, 500) == 0.0075


def test_calc_cost_gpt4o_mini(memory_governor):
    # 0.00015/0.0006 per-1K → (0.15 + 0.6)×1000 = 750 micro
    assert memory_governor._calc_cost("gpt-4o-mini", 1000, 1000) == 0.00075


def test_calc_cost_unknown_model_uses_default(memory_governor):
    # default per-1K:0.001/0.003 → (1 + 3)×1000 = 4000 micro
    assert memory_governor._calc_cost("no-such-model", 1000, 1000) == 0.004


def test_calc_cost_zero_tokens(memory_governor):
    assert memory_governor._calc_cost("gpt-4o", 0, 0) == 0.0


def test_calc_cost_sub_micro_rounding(memory_governor):
    # gpt-4o-mini 1+1 token → 0.75 micro → HALF_UP → 1 micro
    assert memory_governor._calc_cost("gpt-4o-mini", 1, 1) == 0.000001


# =============================================================================
# 预算金额模式(check_budget 取 token/cost/hourly 三维 max)
# =============================================================================


def _inject_daily(gov: LLMBudgetGovernor, tokens: int, cost: float) -> None:
    """往内存降级存储注入当日累计用量(与 _get_period_usage 读取 key 一致)。"""
    key = _REDIS_KEY_DAILY.format(date=_today_key())
    gov._memory_daily[key] = {"tokens": float(tokens), "cost": cost}


@pytest.mark.asyncio
async def test_check_budget_cost_mode_dominates():
    """token 用量低但成本占比高 → usage_percent 取 cost_pct(金额模式判定)。"""
    gov = LLMBudgetGovernor(
        BudgetConfig(daily_token_limit=1_000_000, daily_cost_limit_usd=1.0)
    )
    gov._redis = None
    gov._redis_inited = True
    _inject_daily(gov, tokens=100_000, cost=0.85)  # token 10%,cost 85%
    result = await gov.check_budget("rules")
    assert result.allowed is True
    assert result.usage_percent == pytest.approx(0.85)
    # 85% > warning(80%) 但 < degrade(90%) → 仅预警,不降级
    assert result.degrade_to_model is None
    events = gov.get_budget_events(event_type="budget.warning")
    assert len(events) == 1
    assert events[0]["pillar"] == "rules"
    assert events[0]["usage_percent"] == pytest.approx(0.85)


@pytest.mark.asyncio
async def test_check_budget_cost_mode_degrades():
    """成本占比 95% → 自动降级 + critical 事件。"""
    gov = LLMBudgetGovernor(
        BudgetConfig(daily_token_limit=1_000_000, daily_cost_limit_usd=1.0)
    )
    gov._redis = None
    gov._redis_inited = True
    _inject_daily(gov, tokens=1, cost=0.95)
    result = await gov.check_budget("spec")
    assert result.allowed is True
    assert result.usage_percent == pytest.approx(0.95)
    assert result.degrade_to_model == "gpt-4o-mini"  # 降级链第二档
    assert gov.get_budget_events(event_type="budget.degrade")


@pytest.mark.asyncio
async def test_check_budget_cost_mode_hard_stop():
    """成本打满预算 → 硬停止(allowed=False),即使 token 维度还很富余。"""
    gov = LLMBudgetGovernor(
        BudgetConfig(daily_token_limit=1_000_000, daily_cost_limit_usd=1.0)
    )
    gov._redis = None
    gov._redis_inited = True
    _inject_daily(gov, tokens=1, cost=1.0)
    result = await gov.check_budget("hook")
    assert result.allowed is False
    assert result.usage_percent == pytest.approx(1.0)
    assert result.remaining_cost_usd == 0.0
    events = gov.get_budget_events(event_type="budget.critical")
    assert events and events[0].get("hard_stop") is True


@pytest.mark.asyncio
async def test_check_budget_token_mode_still_works():
    """token 维度主导时(成本占比低),行为不变(默认 token 模式回归)。"""
    gov = LLMBudgetGovernor(
        BudgetConfig(daily_token_limit=100_000, daily_cost_limit_usd=100.0)
    )
    gov._redis = None
    gov._redis_inited = True
    _inject_daily(gov, tokens=90_000, cost=0.01)  # token 90%,cost 0.01%
    result = await gov.check_budget("context")
    assert result.usage_percent == pytest.approx(0.9)
    assert result.degrade_to_model == "gpt-4o-mini"


# =============================================================================
# 预算事件环形缓冲(写入/去重/过滤)
# =============================================================================


def test_budget_event_record_and_query_order():
    gov = LLMBudgetGovernor()
    gov._record_budget_event("budget.warning", {"pillar": "rules", "usage_percent": 0.81})
    gov._record_budget_event("budget.warning", {"pillar": "hook", "usage_percent": 0.82})
    gov._record_budget_event("budget.critical", {"pillar": "spec", "usage_percent": 0.96})
    events = gov.get_budget_events()
    # 最新在前
    assert [e["event_type"] for e in events] == [
        "budget.critical", "budget.warning", "budget.warning",
    ]
    assert all("timestamp" in e for e in events)


def test_budget_event_dedup_same_pillar_small_growth():
    gov = LLMBudgetGovernor()
    gov._record_budget_event("budget.warning", {"pillar": "rules", "usage_percent": 0.85})
    # 同支柱同类型,增长 0.002(<1 个百分点)→ 去重
    gov._record_budget_event("budget.warning", {"pillar": "rules", "usage_percent": 0.852})
    assert len(gov._budget_events) == 1
    # 增长 ≥1 个百分点 → 记录
    gov._record_budget_event("budget.warning", {"pillar": "rules", "usage_percent": 0.87})
    assert len(gov._budget_events) == 2


def test_budget_event_dedup_scoped_to_pillar_and_type():
    gov = LLMBudgetGovernor()
    gov._record_budget_event("budget.warning", {"pillar": "rules", "usage_percent": 0.85})
    # 不同支柱 → 不去重
    gov._record_budget_event("budget.warning", {"pillar": "hook", "usage_percent": 0.85})
    # 不同事件类型 → 不去重
    gov._record_budget_event("budget.critical", {"pillar": "rules", "usage_percent": 0.85})
    assert len(gov._budget_events) == 3


def test_budget_event_usage_drop_starts_new_cycle():
    """用量回落(< 最近一条)视为新预算周期,应记录而非误去重。"""
    gov = LLMBudgetGovernor()
    gov._record_budget_event("budget.warning", {"pillar": "rules", "usage_percent": 0.90})
    gov._record_budget_event("budget.warning", {"pillar": "rules", "usage_percent": 0.05})
    assert len(gov._budget_events) == 2


def test_budget_event_no_usage_percent_always_records():
    """degrade_reset 等无 usage_percent 的事件不去重。"""
    gov = LLMBudgetGovernor()
    gov._record_budget_event("budget.degrade_reset", {"pillar": "rules"})
    gov._record_budget_event("budget.degrade_reset", {"pillar": "rules"})
    assert len(gov._budget_events) == 2


def test_budget_event_query_limit_and_filter():
    gov = LLMBudgetGovernor()
    for i in range(5):
        gov._record_budget_event("budget.warning", {"pillar": "rules", "usage_percent": 0.8 + i * 0.01})
    gov._record_budget_event("budget.critical", {"pillar": "spec", "usage_percent": 0.96})
    assert len(gov.get_budget_events(limit=2)) == 2
    # 最新在前的 limit=2 应取末尾两条
    assert gov.get_budget_events(limit=2)[0]["event_type"] == "budget.critical"
    only_critical = gov.get_budget_events(event_type="budget.critical")
    assert len(only_critical) == 1
    assert only_critical[0]["pillar"] == "spec"
    # limit<=0 → 空
    assert gov.get_budget_events(limit=0) == []


def test_budget_event_ring_buffer_cap():
    """环形缓冲上限 200,超限自动淘汰最旧。

    usage_percent 用整数步长(相邻差恒为 1.0),避免 float 差值抖动干扰去重判定。
    """
    gov = LLMBudgetGovernor()
    for i in range(250):
        gov._record_budget_event("budget.warning", {"pillar": "rules", "usage_percent": float(i)})
    assert len(gov._budget_events) == 200
    # 最旧一条应为 i=50(前 50 条被淘汰),最新一条 i=249(需显式 limit 才能取全量)
    assert gov.get_budget_events(limit=200)[-1]["usage_percent"] == 50.0
    assert gov.get_budget_events(limit=200)[0]["usage_percent"] == 249.0


@pytest.mark.asyncio
async def test_reset_degradation_records_event():
    gov = LLMBudgetGovernor()
    gov._redis = None
    gov._redis_inited = True
    gov._degraded_models["rules"] = "gpt-4o-mini"
    assert await gov.reset_degradation("rules") is True
    events = gov.get_budget_events(event_type="budget.degrade_reset")
    assert len(events) == 1 and events[0]["pillar"] == "rules"
    # 未降级的支柱重置 → False 且不发事件
    assert await gov.reset_degradation("hook") is False
    assert len(gov.get_budget_events(event_type="budget.degrade_reset")) == 1


# =============================================================================
# llm_usage_service._estimate_cost(微元引擎挂接,round 4 位口径)
# =============================================================================


def test_usage_service_estimate_provider_table():
    # 无 model → 厂商级查表:openai 2.50/10.00 → 7500 micro
    assert _estimate_cost("openai", 1000, 500) == 0.0075


def test_usage_service_estimate_free_provider():
    assert _estimate_cost("ollama", 1000, 1000) == 0.0


def test_usage_service_estimate_unknown_provider_default():
    # 未知厂商 → 全局默认 1.00/3.00 → 4000 micro
    assert _estimate_cost("unknown_provider", 1000, 1000) == 0.004


def test_usage_service_estimate_with_model_beats_provider():
    # 有 model → 模型级价目优先(即使 provider 不匹配)
    assert _estimate_cost("anthropic", 1000, 500, model="gpt-4o") == 0.0075
    # gemini-2.0-flash 0.10/1M → 1000 token = 100 micro = 0.0001 USD
    assert _estimate_cost("anthropic", 1000, 0, model="gemini-2.0-flash") == 0.0001
    # claude-3-haiku 0.25/1.25 per 1M → 2000+2000 = 3000 micro = 0.003 USD
    assert _estimate_cost("anthropic", 2000, 2000, model="claude-3-haiku") == 0.003


def test_usage_service_estimate_zero_tokens():
    assert _estimate_cost("openai", 0, 0) == 0.0
    assert _estimate_cost("openai", 0, 0, model="gpt-4o") == 0.0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
