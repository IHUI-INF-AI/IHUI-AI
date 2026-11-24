# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具执行预算门控(tool_budget_governor.py)单元测试(2026-09-03 立)。

覆盖:
- 默认关闭 → 恒放行,零副作用(零回归)
- 次数上限触发 → 确定性 budget_exceeded + used/limits
- 成本上限触发(含前置 cost_estimate 预扣、被拒不计入)
- 并发上限触发(acquire 未 release 堆积)与 release 后恢复
- record_usage 成本校准 / get_state 已用与剩余 / reset
- guard 异步上下文:超额抛 ToolBudgetExceededError,正常退出自动 release
- 空 run_id 校验
"""

from __future__ import annotations

import pytest

from app.services.tool_budget_governor import (
    BUDGET_EXCEEDED,
    ToolBudgetConfig,
    ToolBudgetExceededError,
    ToolBudgetGovernor,
)


def _gov(**kw) -> ToolBudgetGovernor:
    """构造启用预算的 governor(默认放开次数/并发放大值,便于单维度测试)。"""
    defaults = {
        "enabled": True,
        "max_tools_per_run": 1000,
        "max_cost_per_run_usd": 100.0,
        "max_concurrency": 1000,
    }
    defaults.update(kw)
    return ToolBudgetGovernor(ToolBudgetConfig(**defaults))


# =============================================================================
# 1. 默认关闭 → 恒放行,零副作用
# =============================================================================


def test_disabled_always_allows():
    """enabled 默认 False:acquire 恒放行,reason=budget_disabled,不提额、不计数。"""
    gov = ToolBudgetGovernor()  # 默认关闭
    res = gov.acquire("run-1", cost_estimate=10.0)
    assert res.allowed is True
    assert res.error_type is None
    assert res.reason == "budget_disabled"
    st = gov.get_state("run-1")
    assert st["used"] == {"tool_count": 0, "cost": 0.0, "active": 0}
    assert st["remaining"]["tools"] == 0  # 未设上限


def test_disabled_no_side_effect_on_count():
    """关闭时多次 acquire 不产生任何计数副作用。"""
    gov = ToolBudgetGovernor()
    for _ in range(5):
        assert gov.acquire("r").allowed is True
    assert gov.get_state("r")["used"]["tool_count"] == 0


# =============================================================================
# 2. 次数上限触发
# =============================================================================


def test_tool_count_limit_exceeded():
    """达到 max_tools_per_run 后再 acquire → 确定性 budget_exceeded。"""
    gov = _gov(max_tools_per_run=3)
    for i in range(3):
        res = gov.acquire("r", tool_name=f"t{i}")
        assert res.allowed is True
        gov.release("r")
    res = gov.acquire("r", tool_name="t3")
    assert res.allowed is False
    assert res.error_type == BUDGET_EXCEEDED
    assert "次数超限" in res.reason
    assert res.used["tool_count"] == 3
    assert res.limits["max_tools"] == 3
    # 被拒的本次不计入 → 仍为 3
    assert gov.get_state("r")["used"]["tool_count"] == 3


# =============================================================================
# 3. 成本上限触发
# =============================================================================


def test_cost_limit_exceeded_with_estimate():
    """cost_estimate 前置预扣:累计超过 max_cost 即拒,被拒不计入成本。"""
    gov = _gov(max_cost_per_run_usd=0.5)
    res1 = gov.acquire("r", tool_name="a", cost_estimate=0.3)
    assert res1.allowed is True
    assert res1.used["cost"] == 0.3
    gov.release("r")
    res2 = gov.acquire("r", tool_name="b", cost_estimate=0.3)  # 0.3+0.3 > 0.5
    assert res2.allowed is False
    assert res2.error_type == BUDGET_EXCEEDED
    assert "成本超限" in res2.reason
    # 被拒未计入 → cost 仍 0.3,次数仍 1
    st = gov.get_state("r")
    assert st["used"]["cost"] == 0.3
    assert st["used"]["tool_count"] == 1
    assert st["remaining"]["cost"] == pytest.approx(0.2)


# =============================================================================
# 4. 并发上限触发
# =============================================================================


def test_concurrency_limit_and_release():
    """并发占满后再 acquire → 拒;release 后恢复可再获取。"""
    gov = _gov(max_concurrency=2)
    assert gov.acquire("r", tool_name="t1").allowed is True
    assert gov.acquire("r", tool_name="t2").allowed is True
    res = gov.acquire("r", tool_name="t3")  # 未 release,占满
    assert res.allowed is False
    assert res.error_type == BUDGET_EXCEEDED
    assert "并发超限" in res.reason
    assert res.used["active"] == 2
    # release 一个 → 恢复
    gov.release("r")
    assert gov.acquire("r", tool_name="t3").allowed is True


# =============================================================================
# 5. record_usage 校准 / get_state / reset
# =============================================================================


def test_record_usage_calibrates_cost():
    """acquire 预扣后可用 record_usage 按实际成本修正(含回退为负增量)。"""
    gov = _gov()
    gov.acquire("r", tool_name="a", cost_estimate=0.2)
    gov.release("r")
    gov.record_usage("r", cost=-0.05)  # 实花 0.15
    assert gov.get_state("r")["used"]["cost"] == 0.15


def test_get_state_reports_used_and_remaining():
    """未触碰的 run get_state 全 0;已用后 remaining 正确。"""
    gov = _gov(max_tools_per_run=10, max_cost_per_run_usd=1.0, max_concurrency=2)
    fresh = gov.get_state("nope")
    assert fresh["used"] == {"tool_count": 0, "cost": 0.0, "active": 0}
    assert fresh["remaining"] == {"tools": 10, "cost": 1.0}

    gov.acquire("r", cost_estimate=0.25)
    gov.release("r")
    st = gov.get_state("r")
    assert st["used"]["tool_count"] == 1
    assert st["remaining"]["tools"] == 9
    assert st["remaining"]["cost"] == pytest.approx(0.75)


def test_reset_removes_state():
    """reset 幂等:存在则删返回 True,不存在返回 False。"""
    gov = _gov()
    gov.acquire("r")
    assert gov.reset("r") is True
    assert gov.get_state("r")["used"]["tool_count"] == 0
    assert gov.reset("r") is False


def test_empty_run_id_raises():
    """run_id 为空 → ValueError(仅启用场景校验)。"""
    gov = _gov()
    with pytest.raises(ValueError):
        gov.acquire("")
    # 关闭时不校验(零回归)
    assert ToolBudgetGovernor().acquire("").allowed is True


# =============================================================================
# 6. guard 异步上下文管理器
# =============================================================================


async def test_guard_allowed_and_releases():
    """guard 正常进入/退出:退出后并发占位已释放。"""
    gov = _gov(max_tools_per_run=1)
    async with gov.guard("r", tool_name="t", cost_estimate=0.01) as g:
        assert g.result.allowed is True
        assert gov.get_state("r")["used"]["active"] == 1
    # 退出后 active 归零
    assert gov.get_state("r")["used"]["active"] == 0
    assert gov.get_state("r")["used"]["tool_count"] == 1


async def test_guard_raises_when_exceeded():
    """guard 在超额时抛 ToolBudgetExceededError,error_type=budget_exceeded。"""
    gov = _gov(max_tools_per_run=1)
    async with gov.guard("r", tool_name="t"):
        pass
    with pytest.raises(ToolBudgetExceededError) as exc:
        async with gov.guard("r", tool_name="t2"):
            pass
    assert exc.value.error_type == BUDGET_EXCEEDED
    assert "次数超限" in exc.value.reason
    assert exc.value.result.allowed is False


async def test_guard_disabled_never_raises():
    """预算关闭时 guard 恒放行,不抛异常。"""
    gov = ToolBudgetGovernor()  # 默认关闭
    async with gov.guard("r", tool_name="t", cost_estimate=99.0) as g:
        assert g.result.allowed is True


# =============================================================================
# 7. 确定性错误码常量
# =============================================================================


def test_error_code_constant():
    """稳定错误码契约:BUDGET_EXCEEDED 字符串固定为 budget_exceeded。"""
    assert BUDGET_EXCEEDED == "budget_exceeded"
