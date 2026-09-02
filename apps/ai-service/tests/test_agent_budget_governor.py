# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‌‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‌‍‌​‌‌‌​‌​‍‍​‌‌​‌‌‌‌‌‍‌‌‌​​​‍‍​‌​‌‌​‌‌‌‍‍​‌‌‌​​​‍‍​‌​‌​​​‌‍‍​‌​‌​​​‌‍‍‍​‌​​‌​​‌​‍‍​‌​​‌‌‌‌‌‍‌​‌​‌‌​‍‍​‌​​​‌​‍‌‍‌‌​​‌‌‌‌‍‌​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AgentLoopV2 × budget governor 集成测试(1-6 token 治理)。

验证主循环每轮接入 check_budget 硬约束 + record_usage 计量:
- budget off(默认)→ 行为与改动前完全一致(跑通 2 轮,record_usage 不被调用)
- budget on + 硬停止(check_budget 返回 allowed=False / raise BudgetExceededError)
  → 循环优雅停止,stop_reason="budget_exceeded",error 非空,iterations 保留
- budget on + 正常 → 每轮 LLM 返回后 record_usage 被调用
- budget on + 软降级(degrade_to_model)→ 仅提示,不中断,循环正常完成

mock 全局单例 llm_budget_governor 的方法,隔离真实预算状态;fixture 风格
照抄 test_agent_loop_v2.py(无外部依赖,可独立运行)。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition
from app.services.llm_budget_governor import (
    BudgetCheckResult,
    BudgetExceededError,
    llm_budget_governor,
)

# =============================================================================
# 辅助:工具定义与消息(照抄 test_agent_loop_v2.py)
# =============================================================================


async def _weather_executor(args):
    return {"city": args["city"], "weather": "晴", "temp": 25}


def _weather_tool(executor=None) -> ToolDefinition:
    return ToolDefinition(
        name="get_weather",
        description="查询城市天气",
        parameters={
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
        executor=executor or _weather_executor,
    )


def _default_messages() -> list[dict]:
    return [
        {"role": "system", "content": "你是助手"},
        {"role": "user", "content": "北京天气"},
    ]


def _allowed_check(usage_percent: float = 0.3) -> BudgetCheckResult:
    """构造 allowed=True 的预算检查结果。"""
    return BudgetCheckResult(
        allowed=True,
        degrade_to_model=None,
        reason="预算充足",
        usage_percent=usage_percent,
        pillar_usage_percent=usage_percent * 0.5,
        remaining_tokens=1_000_000,
        remaining_cost_usd=5.0,
    )


def _denied_check(reason: str = "已达硬停止阈值(100.0% ≥ 100%)") -> BudgetCheckResult:
    """构造 allowed=False 的预算检查结果(硬停止)。"""
    return BudgetCheckResult(
        allowed=False,
        degrade_to_model=None,
        reason=reason,
        usage_percent=1.0,
        pillar_usage_percent=1.0,
        remaining_tokens=0,
        remaining_cost_usd=0.0,
    )


# =============================================================================
# 1. budget off(默认)→ 行为与改动前完全一致
# =============================================================================


async def test_budget_off_runs_unchanged():
    """budget 默认 off:2 轮跑通,stop_reason=completed,record_usage 不被调用。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "我来查一下天气",
                "tool_calls": [{"id": "c1", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "北京今天晴,25度", "tool_calls": None}

    # 不传 budget_enabled → 默认 off(与改动前行为一致)
    with patch.object(llm_budget_governor, "record_usage", AsyncMock()) as rec:
        loop = AgentLoopV2(mock_llm, [_weather_tool()], max_iterations=5)
        result = await loop.run(_default_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    assert len(result.iterations) == 2
    assert call_count == 2
    # budget off → 不计量
    rec.assert_not_awaited()
    # 摘要字段为 None
    assert result.budget is None


# =============================================================================
# 2. budget on + 硬停止(allowed=False)→ 第 2 轮优雅停止,iterations 保留
# =============================================================================


async def test_budget_on_hard_stop_after_first_iteration():
    """check_budget 第 1 轮放行、第 2 轮拒绝 → 停止,stop_reason=budget_exceeded。

    第 1 轮成功完成(记录 1 个 iteration 且 record_usage 被调 1 次),
    第 2 轮预算检查在 LLM 调用前拒绝 → 优雅返回,已完成的 iteration 保留。
    """
    call_count = 0
    checks = [_allowed_check(), _denied_check()]

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        # 仅第 1 轮实际发起 LLM 调用(第 2 轮预算被拒,不会到这)
        return {
            "content": "我来查一下天气",
            "tool_calls": [{"id": "c1", "name": "get_weather", "args": {"city": "北京"}}],
        }

    with (
        patch.object(llm_budget_governor, "check_budget", side_effect=checks)
        as check_mock,
        patch.object(llm_budget_governor, "record_usage", AsyncMock()) as rec,
        patch.object(
            llm_budget_governor,
            "get_usage_summary",
            AsyncMock(return_value={"usage_percent": 1.0, "total_tokens": 1}),
        ),
        patch.object(
            llm_budget_governor,
            "get_pillar_budget",
            AsyncMock(
                return_value={
                    "usage_percent": 1.0,
                    "remaining": {"tokens": 0},
                    "degraded_model": None,
                }
            ),
        ),
    ):
        loop = AgentLoopV2(
            mock_llm, [_weather_tool()], max_iterations=5, budget_enabled=True
        )
        result = await loop.run(_default_messages())

    assert result.success is False
    assert result.stop_reason == "budget_exceeded"
    assert result.error  # error 非空
    assert "硬停止" in result.error
    # 第 1 轮已完成,迭代保留(1 条)
    assert len(result.iterations) == 1
    assert result.iterations[0].iteration == 1
    assert result.budget is not None
    assert result.budget["stopped_at_iteration"] == 2
    assert result.budget["usage_percent"] == 1.0
    # 只有第 1 轮真正调了 LLM → check 2 次、record 1 次
    assert check_mock.await_count == 2
    rec.assert_awaited_once()
    assert call_count == 1


# =============================================================================
# 3. budget on + 硬停止(raise BudgetExceededError)→ 第 1 轮即停止
# =============================================================================


async def test_budget_on_hard_stop_raises_budget_exceeded():
    """check_budget 抛 BudgetExceededError → 第 1 轮即优雅停止,iterations 为空。"""
    async def mock_llm(messages, tools):
        raise AssertionError("LLM 不应被调用(预算已拒)")

    with (
        patch.object(
            llm_budget_governor,
            "check_budget",
            AsyncMock(
                side_effect=BudgetExceededError(
                    "预算超限", usage_percent=1.2, remaining_tokens=0
                )
            ),
        ),
        patch.object(llm_budget_governor, "record_usage", AsyncMock()) as rec,
    ):
        loop = AgentLoopV2(
            mock_llm, [_weather_tool()], max_iterations=5, budget_enabled=True
        )
        result = await loop.run(_default_messages())

    assert result.success is False
    assert result.stop_reason == "budget_exceeded"
    assert result.error == "预算超限"
    assert len(result.iterations) == 0  # 第 1 轮前即停止,无已完成迭代
    assert result.budget is not None
    assert result.budget["usage_percent"] == 1.2
    # 预算被拒,LLM 从未调用,不计量
    rec.assert_not_awaited()


# =============================================================================
# 4. budget on + 正常 → 每轮 LLM 返回后 record_usage 被调用
# =============================================================================


async def test_budget_on_normal_records_usage():
    """budget on 且预算充足:2 轮跑通,record_usage 被调用 2 次。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "我来查一下天气",
                "tool_calls": [{"id": "c1", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "北京今天晴,25度", "tool_calls": None}

    with (
        patch.object(
            llm_budget_governor, "check_budget", AsyncMock(return_value=_allowed_check())
        )
        as check_mock,
        patch.object(llm_budget_governor, "record_usage", AsyncMock()) as rec,
        patch.object(
            llm_budget_governor,
            "get_usage_summary",
            AsyncMock(return_value={"usage_percent": 0.05, "total_tokens": 100}),
        ),
        patch.object(
            llm_budget_governor,
            "get_pillar_budget",
            AsyncMock(
                return_value={
                    "usage_percent": 0.05,
                    "remaining": {"tokens": 999000},
                    "degraded_model": None,
                }
            ),
        ),
    ):
        loop = AgentLoopV2(
            mock_llm, [_weather_tool()], max_iterations=5, budget_enabled=True
        )
        result = await loop.run(_default_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    assert len(result.iterations) == 2
    # 每轮 LLM 调用后各 record 一次
    assert check_mock.await_count == 2
    assert rec.await_count == 2
    # record_usage 用 budget_enabled 的 pillar(默认 terminal)与 action=agent_loop
    _, kw = rec.await_args_list[0]
    assert kw["pillar"] == "terminal"
    assert kw["action"] == "agent_loop"
    assert kw["input_tokens"] > 0  # 无 usage 时按内容粗估


# =============================================================================
# 5. budget on + 软降级(degrade_to_model)→ 仅提示,不中断
# =============================================================================


async def test_budget_on_degrade_continues():
    """check_budget 返回 allowed=True 但 degrade_to_model 非空 → 不中断,正常完成。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "我来查一下天气",
                "tool_calls": [{"id": "c1", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "北京今天晴,25度", "tool_calls": None}

    degrade_check = BudgetCheckResult(
        allowed=True,
        degrade_to_model="gpt-4o-mini",
        reason="已超降级阈值,建议切换到 gpt-4o-mini",
        usage_percent=0.92,
        pillar_usage_percent=0.5,
        remaining_tokens=160_000,
        remaining_cost_usd=0.8,
    )

    with (
        patch.object(
            llm_budget_governor, "check_budget", AsyncMock(return_value=degrade_check)
        ),
        patch.object(llm_budget_governor, "record_usage", AsyncMock()),
        patch.object(
            llm_budget_governor,
            "get_usage_summary",
            AsyncMock(return_value={"usage_percent": 0.92, "total_tokens": 1_840_000}),
        ),
        patch.object(
            llm_budget_governor,
            "get_pillar_budget",
            AsyncMock(
                return_value={
                    "usage_percent": 0.5,
                    "remaining": {"tokens": 160000},
                    "degraded_model": "gpt-4o-mini",
                }
            ),
        ),
    ):
        loop = AgentLoopV2(
            mock_llm, [_weather_tool()], max_iterations=5, budget_enabled=True
        )
        result = await loop.run(_default_messages())

    # 软降级不中断:正常完成
    assert result.success is True
    assert result.stop_reason == "completed"
    assert len(result.iterations) == 2


# =============================================================================
# 6. budget on + check_budget 异常 → 降级放行(不阻塞)
# =============================================================================


async def test_budget_on_check_error_falls_through():
    """check_budget 抛非 BudgetExceededError 异常 → 降级放行,循环正常完成。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "我来查一下天气",
                "tool_calls": [{"id": "c1", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "北京今天晴,25度", "tool_calls": None}

    with (
        patch.object(
            llm_budget_governor,
            "check_budget",
            AsyncMock(side_effect=RuntimeError("governor 挂了")),
        ),
        patch.object(llm_budget_governor, "record_usage", AsyncMock()),
        patch.object(
            llm_budget_governor,
            "get_usage_summary",
            AsyncMock(return_value={"usage_percent": 0.0, "total_tokens": 0}),
        ),
        patch.object(
            llm_budget_governor,
            "get_pillar_budget",
            AsyncMock(
                return_value={
                    "usage_percent": 0.0,
                    "remaining": {"tokens": 2_000_000},
                    "degraded_model": None,
                }
            ),
        ),
    ):
        loop = AgentLoopV2(
            mock_llm, [_weather_tool()], max_iterations=5, budget_enabled=True
        )
        result = await loop.run(_default_messages())

    # 异常降级放行:仍正常完成
    assert result.success is True
    assert result.stop_reason == "completed"
    assert len(result.iterations) == 2
