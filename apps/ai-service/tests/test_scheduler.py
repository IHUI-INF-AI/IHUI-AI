"""scheduler 综合测试(2026-07-23 立,补齐 P3-3 调度器零覆盖)。

覆盖维度(60+ cases):
1. dataclass 构造与默认值:ScheduleDecision / SchedulingResult / RetryPolicy / FailoverConfig(4 tests)
2. _utc_now_plus_seconds:时间偏移 + ISO 格式(3 tests)
3. _agent_capabilities:tools / metadata category / 组合(4 tests)
4. _jaccard_score:空集 / 全交集 / 无交集 / 部分交集 / 子集(6 tests)
5. _compute_backoff:fixed / linear / exponential / max_ms cap / 未知策略(6 tests)
6. _classify_error:5 种类型 + 大小写 + 空串(8 tests)
7. TaskScheduler 初始化:set_executor / 默认执行器(3 tests)
8. schedule 边界:空 sub_tasks / 空 agents / 双空 / 未知策略(4 tests)
9. capability_match 策略:最佳匹配 / 负载跟踪 / 累积时长 / 防御性 continue(5 tests)
10. load_balance 策略:均匀分配 / jaccard tie-breaker / matchScore 衰减(4 tests)
11. priority 策略:priority 降序 / 最佳 agent(3 tests)
12. round_robin 策略:循环分配 / 超 agent 数 / matchScore(3 tests)
13. execute_with_retry:首次成功 / 重试成功 / 全失败 / 不可重试 / maxRetries=0 / 3 种退避 / session_id(9 tests)
14. execute_with_failover:主成功 / 主失败备成功 / 全失败 / 超时 / 低质量转移 / 阈值 None / agent 缺失 / 全不可用(8 tests)
15. _evaluate_quality:空输出 / 有效分 / 垃圾 / 越界 clamp / 异常降级(7 tests)
16. _default_executor:成功 / 错误响应 / 异常 / model 传递(4 tests)
17. task_scheduler 单例:存在 / 类型 / 状态(3 tests)
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch

import pytest

from app.services.agent_orchestrator import AgentDefinition, AgentStepResult
from app.services.scheduler import (
    FailoverConfig,
    RetryPolicy,
    ScheduleDecision,
    SchedulingResult,
    TaskScheduler,
    _utc_now_plus_seconds,
    task_scheduler,
)
from app.services.task_decomposer import SubTask


# =============================================================================
# 工厂函数
# =============================================================================


def make_agent(
    name: str = "a1",
    tools: list[str] | None = None,
    category: str | None = None,
    model: str | None = "gpt-4",
) -> AgentDefinition:
    return AgentDefinition(
        name=name,
        description=f"agent {name}",
        system_prompt=f"prompt for {name}",
        tools=tools or [],
        model=model,
        metadata={"category": category} if category else {},
    )


def make_subtask(
    id: str = "st1",
    description: str = "do something",
    capabilities: list[str] | None = None,
    priority: int = 5,
    duration: int | None = 10,
) -> SubTask:
    return SubTask(
        id=id,
        description=description,
        recommendedAgentType="general",
        requiredCapabilities=capabilities or [],
        priority=priority,
        estimatedDurationSeconds=duration,
    )


def make_result(
    status: str = "completed",
    output: str = "ok",
    error: str | None = None,
    agent_name: str = "a1",
) -> AgentStepResult:
    return AgentStepResult(
        agent_name=agent_name,
        input="input",
        output=output,
        status=status,
        error=error,
    )


# =============================================================================
# 1. dataclass 构造与默认值(4 tests)
# =============================================================================


class TestDataclasses:
    """4 个 dataclass 的字段构造与默认值。"""

    def test_schedule_decision_fields(self):
        d = ScheduleDecision(
            subTaskId="st1",
            assignedAgent="a1",
            reason="r",
            matchScore=0.5,
            estimatedStartTime="2026-01-01T00:00:00+00:00",
            strategy="capability_match",
        )
        assert d.subTaskId == "st1"
        assert d.assignedAgent == "a1"
        assert d.reason == "r"
        assert d.matchScore == 0.5
        assert d.estimatedStartTime == "2026-01-01T00:00:00+00:00"
        assert d.strategy == "capability_match"

    def test_scheduling_result_fields(self):
        r = SchedulingResult(
            decisions=[], concurrency=0,
            estimatedTotalDurationSeconds=42, strategy="round_robin",
        )
        assert r.decisions == []
        assert r.concurrency == 0
        assert r.estimatedTotalDurationSeconds == 42
        assert r.strategy == "round_robin"

    def test_retry_policy_fields(self):
        p = RetryPolicy(
            maxRetries=3, backoff="exponential",
            initialDelayMs=100, maxDelayMs=5000,
            retryableErrors=["timeout", "network"],
        )
        assert p.maxRetries == 3
        assert p.backoff == "exponential"
        assert p.initialDelayMs == 100
        assert p.maxDelayMs == 5000
        assert p.retryableErrors == ["timeout", "network"]

    def test_failover_config_default_quality_threshold_none(self):
        c = FailoverConfig(
            primary="p1", fallbacks=["f1", "f2"],
            triggerOn=["failure"],
        )
        assert c.primary == "p1"
        assert c.fallbacks == ["f1", "f2"]
        assert c.triggerOn == ["failure"]
        assert c.qualityThreshold is None

    def test_failover_config_with_quality_threshold(self):
        c = FailoverConfig(
            primary="p1", fallbacks=["f1"],
            triggerOn=["low_quality"], qualityThreshold=0.8,
        )
        assert c.qualityThreshold == 0.8


# =============================================================================
# 2. _utc_now_plus_seconds(3 tests)
# =============================================================================


class TestUtcNowPlusSeconds:
    def test_zero_seconds_returns_current_time(self):
        before = datetime.now(timezone.utc)
        result = _utc_now_plus_seconds(0)
        after = datetime.now(timezone.utc)
        parsed = datetime.fromisoformat(result)
        assert before <= parsed <= after

    def test_positive_seconds_future_time(self):
        before = datetime.now(timezone.utc)
        result = _utc_now_plus_seconds(60)
        parsed = datetime.fromisoformat(result)
        assert parsed >= before + timedelta(seconds=59)

    def test_format_is_iso_with_timezone(self):
        result = _utc_now_plus_seconds(0)
        parsed = datetime.fromisoformat(result)
        assert parsed.tzinfo is not None


# =============================================================================
# 3. _agent_capabilities(4 tests)
# =============================================================================


class TestAgentCapabilities:
    def test_empty_tools_no_category(self):
        agent = make_agent(tools=[], category=None)
        caps = TaskScheduler._agent_capabilities(agent)
        assert caps == set()

    def test_with_tools_no_category(self):
        agent = make_agent(tools=["search", "read"], category=None)
        caps = TaskScheduler._agent_capabilities(agent)
        assert caps == {"search", "read"}

    def test_with_tools_and_category(self):
        agent = make_agent(tools=["search"], category="research")
        caps = TaskScheduler._agent_capabilities(agent)
        assert caps == {"search", "research"}

    def test_category_only_no_tools(self):
        agent = make_agent(tools=[], category="coding")
        caps = TaskScheduler._agent_capabilities(agent)
        assert caps == {"coding"}


# =============================================================================
# 4. _jaccard_score(6 tests)
# =============================================================================


class TestJaccardScore:
    def test_empty_required_returns_half(self):
        """无需求时中性分数 0.5。"""
        assert TaskScheduler._jaccard_score([], {"a", "b"}) == 0.5

    def test_non_empty_required_empty_available_returns_zero(self):
        assert TaskScheduler._jaccard_score(["a"], set()) == 0.0

    def test_identical_sets_returns_one(self):
        assert TaskScheduler._jaccard_score(["a", "b"], {"a", "b"}) == 1.0

    def test_no_overlap_returns_zero(self):
        assert TaskScheduler._jaccard_score(["a", "b"], {"c", "d"}) == 0.0

    def test_partial_overlap(self):
        # 交集 {a} / 并集 {a,b,c} = 1/3
        assert TaskScheduler._jaccard_score(["a", "b"], {"a", "c"}) == pytest.approx(1 / 3)

    def test_required_subset_of_available(self):
        # 交集 {a,b} / 并集 {a,b,c} = 2/3
        assert TaskScheduler._jaccard_score(["a", "b"], {"a", "b", "c"}) == pytest.approx(2 / 3)


# =============================================================================
# 5. _compute_backoff(6 tests)
# =============================================================================


class TestComputeBackoff:
    def test_fixed_strategy(self):
        assert TaskScheduler._compute_backoff("fixed", 1, 100, 5000) == 100
        assert TaskScheduler._compute_backoff("fixed", 5, 100, 5000) == 100

    def test_linear_attempt_1(self):
        assert TaskScheduler._compute_backoff("linear", 1, 100, 5000) == 100

    def test_linear_attempt_3(self):
        assert TaskScheduler._compute_backoff("linear", 3, 100, 5000) == 300

    def test_exponential_attempt_1(self):
        assert TaskScheduler._compute_backoff("exponential", 1, 100, 5000) == 100

    def test_exponential_attempt_3(self):
        # 100 * 2^(3-1) = 400
        assert TaskScheduler._compute_backoff("exponential", 3, 100, 5000) == 400

    def test_capped_at_max_ms(self):
        # linear: 100 * 100 = 10000 > 5000 → 5000
        assert TaskScheduler._compute_backoff("linear", 100, 100, 5000) == 5000
        # exponential: 100 * 2^10 = 102400 > 5000 → 5000
        assert TaskScheduler._compute_backoff("exponential", 11, 100, 5000) == 5000


# =============================================================================
# 6. _classify_error(8 tests)
# =============================================================================


class TestClassifyError:
    def test_timeout_keyword(self):
        assert TaskScheduler._classify_error("request timeout occurred") == "timeout"

    def test_timed_out_keyword(self):
        assert TaskScheduler._classify_error("operation timed out") == "timeout"

    def test_rate_limited(self):
        assert TaskScheduler._classify_error("rate limit exceeded") == "rate_limited"
        assert TaskScheduler._classify_error("API rate limit") == "rate_limited"

    def test_overloaded(self):
        assert TaskScheduler._classify_error("server overloaded") == "overloaded"

    def test_capacity(self):
        assert TaskScheduler._classify_error("no capacity") == "overloaded"

    def test_network(self):
        assert TaskScheduler._classify_error("network unreachable") == "network"
        assert TaskScheduler._classify_error("connection refused") == "network"

    def test_unknown_default(self):
        assert TaskScheduler._classify_error("some weird error") == "unknown"

    def test_empty_string(self):
        assert TaskScheduler._classify_error("") == "unknown"

    def test_case_insensitive(self):
        assert TaskScheduler._classify_error("TIMEOUT") == "timeout"
        assert TaskScheduler._classify_error("RATE LIMIT") == "rate_limited"
        assert TaskScheduler._classify_error("OVERLOADED") == "overloaded"


# =============================================================================
# 7. TaskScheduler 初始化(3 tests)
# =============================================================================


class TestSchedulerInit:
    def test_default_executor_is_default_method(self):
        s = TaskScheduler()
        assert s._executor == s._default_executor
        assert s._agent_load == {}

    def test_custom_executor_via_constructor(self):
        custom = AsyncMock()
        s = TaskScheduler(executor=custom)
        assert s._executor is custom

    def test_set_executor_replaces(self):
        s = TaskScheduler()
        new_exec = AsyncMock()
        s.set_executor(new_exec)
        assert s._executor is new_exec


# =============================================================================
# 8. schedule 边界(4 tests)
# =============================================================================


class TestScheduleEdgeCases:
    @pytest.mark.asyncio
    async def test_empty_sub_tasks(self):
        s = TaskScheduler()
        result = await s.schedule([], [make_agent()])
        assert result.decisions == []
        assert result.concurrency == 0
        assert result.estimatedTotalDurationSeconds == 0
        assert result.strategy == "capability_match"

    @pytest.mark.asyncio
    async def test_empty_agents(self):
        s = TaskScheduler()
        result = await s.schedule([make_subtask()], [])
        assert result.decisions == []
        assert result.concurrency == 0

    @pytest.mark.asyncio
    async def test_both_empty(self):
        s = TaskScheduler()
        result = await s.schedule([], [])
        assert result.decisions == []
        assert result.concurrency == 0

    @pytest.mark.asyncio
    async def test_unknown_strategy_falls_to_round_robin(self):
        """未知策略走 else 分支(round_robin),但 SchedulingResult.strategy 仍是传入值。"""
        s = TaskScheduler()
        result = await s.schedule(
            [make_subtask(id="st1")], [make_agent(name="a1")],
            strategy="unknown_strategy",  # type: ignore[arg-type]
        )
        assert len(result.decisions) == 1
        assert result.decisions[0].strategy == "round_robin"
        assert result.strategy == "unknown_strategy"


# =============================================================================
# 9. capability_match 策略(5 tests)
# =============================================================================


class TestScheduleCapabilityMatch:
    @pytest.mark.asyncio
    async def test_single_task_single_agent(self):
        s = TaskScheduler()
        result = await s.schedule(
            [make_subtask(id="st1", capabilities=["search"])],
            [make_agent(name="a1", tools=["search"])],
            strategy="capability_match",
        )
        assert len(result.decisions) == 1
        d = result.decisions[0]
        assert d.subTaskId == "st1"
        assert d.assignedAgent == "a1"
        assert d.matchScore == 1.0
        assert d.strategy == "capability_match"
        assert "能力匹配度" in d.reason

    @pytest.mark.asyncio
    async def test_picks_best_match(self):
        s = TaskScheduler()
        # a1 完全匹配, a2 无匹配
        result = await s.schedule(
            [make_subtask(id="st1", capabilities=["search", "read"])],
            [
                make_agent(name="a2", tools=["write"]),
                make_agent(name="a1", tools=["search", "read"]),
            ],
            strategy="capability_match",
        )
        assert result.decisions[0].assignedAgent == "a1"

    @pytest.mark.asyncio
    async def test_load_tracking(self):
        s = TaskScheduler()
        await s.schedule(
            [make_subtask(id="st1"), make_subtask(id="st2"), make_subtask(id="st3")],
            [make_agent(name="a1")],
            strategy="capability_match",
        )
        assert s._agent_load["a1"] == 3

    @pytest.mark.asyncio
    async def test_duration_accumulation(self):
        s = TaskScheduler()
        result = await s.schedule(
            [
                make_subtask(id="st1", duration=10),
                make_subtask(id="st2", duration=20),
            ],
            [make_agent(name="a1")],
            strategy="capability_match",
        )
        assert result.estimatedTotalDurationSeconds == 30

    @pytest.mark.asyncio
    async def test_empty_agents_defensive_continue(self):
        """直接调 _schedule_by_capability 传空 agents → best_agent is None → continue。"""
        s = TaskScheduler()
        decisions, cumulative = s._schedule_by_capability(
            [make_subtask(id="st1")], [],
        )
        assert decisions == []
        assert cumulative == 0


# =============================================================================
# 10. load_balance 策略(4 tests)
# =============================================================================


class TestScheduleLoadBalance:
    @pytest.mark.asyncio
    async def test_distributes_evenly(self):
        s = TaskScheduler()
        result = await s.schedule(
            [
                make_subtask(id="st1"),
                make_subtask(id="st2"),
            ],
            [make_agent(name="a1"), make_agent(name="a2")],
            strategy="load_balance",
        )
        assigned = {d.assignedAgent for d in result.decisions}
        assert assigned == {"a1", "a2"}
        assert s._agent_load["a1"] == 1
        assert s._agent_load["a2"] == 1

    @pytest.mark.asyncio
    async def test_tie_breaker_by_jaccard(self):
        """负载相同时,选 jaccard 匹配度高的 agent。"""
        s = TaskScheduler()
        result = await s.schedule(
            [make_subtask(id="st1", capabilities=["search"])],
            [
                make_agent(name="a1", tools=["write"]),
                make_agent(name="a2", tools=["search"]),
            ],
            strategy="load_balance",
        )
        assert result.decisions[0].assignedAgent == "a2"

    @pytest.mark.asyncio
    async def test_load_tracking(self):
        s = TaskScheduler()
        await s.schedule(
            [make_subtask(id="st1"), make_subtask(id="st2")],
            [make_agent(name="a1")],
            strategy="load_balance",
        )
        assert s._agent_load["a1"] == 2

    @pytest.mark.asyncio
    async def test_match_score_decreases_with_load(self):
        """matchScore = 1/(1+load),load 增大 score 减小。"""
        s = TaskScheduler()
        result = await s.schedule(
            [make_subtask(id="st1"), make_subtask(id="st2")],
            [make_agent(name="a1")],
            strategy="load_balance",
        )
        assert result.decisions[0].matchScore == 0.5  # 1/(1+1)
        assert result.decisions[1].matchScore == pytest.approx(1 / 3, abs=0.0001)


# =============================================================================
# 11. priority 策略(3 tests)
# =============================================================================


class TestSchedulePriority:
    @pytest.mark.asyncio
    async def test_sorts_by_priority_desc(self):
        """高优先级任务先分配。"""
        s = TaskScheduler()
        result = await s.schedule(
            [
                make_subtask(id="low", priority=1),
                make_subtask(id="high", priority=10),
                make_subtask(id="mid", priority=5),
            ],
            [make_agent(name="a1")],
            strategy="priority",
        )
        assert result.decisions[0].subTaskId == "high"
        assert result.decisions[1].subTaskId == "mid"
        assert result.decisions[2].subTaskId == "low"

    @pytest.mark.asyncio
    async def test_best_agent_per_task(self):
        s = TaskScheduler()
        result = await s.schedule(
            [make_subtask(id="st1", capabilities=["search"])],
            [
                make_agent(name="a1", tools=["write"]),
                make_agent(name="a2", tools=["search"]),
            ],
            strategy="priority",
        )
        assert result.decisions[0].assignedAgent == "a2"
        assert "优先级" in result.decisions[0].reason

    @pytest.mark.asyncio
    async def test_cumulative_duration(self):
        s = TaskScheduler()
        result = await s.schedule(
            [make_subtask(id="st1", duration=5), make_subtask(id="st2", duration=15)],
            [make_agent(name="a1")],
            strategy="priority",
        )
        assert result.estimatedTotalDurationSeconds == 20


# =============================================================================
# 12. round_robin 策略(3 tests)
# =============================================================================


class TestScheduleRoundRobin:
    @pytest.mark.asyncio
    async def test_cycles_through_agents(self):
        s = TaskScheduler()
        result = await s.schedule(
            [make_subtask(id="st1"), make_subtask(id="st2")],
            [make_agent(name="a1"), make_agent(name="a2")],
            strategy="round_robin",
        )
        assert result.decisions[0].assignedAgent == "a1"
        assert result.decisions[1].assignedAgent == "a2"

    @pytest.mark.asyncio
    async def test_more_tasks_than_agents(self):
        s = TaskScheduler()
        result = await s.schedule(
            [make_subtask(id=f"st{i}") for i in range(5)],
            [make_agent(name="a1"), make_agent(name="a2")],
            strategy="round_robin",
        )
        assert result.decisions[0].assignedAgent == "a1"
        assert result.decisions[1].assignedAgent == "a2"
        assert result.decisions[2].assignedAgent == "a1"
        assert result.decisions[3].assignedAgent == "a2"
        assert result.decisions[4].assignedAgent == "a1"

    @pytest.mark.asyncio
    async def test_match_score(self):
        """matchScore = 1/len(agents)。"""
        s = TaskScheduler()
        result = await s.schedule(
            [make_subtask(id="st1")],
            [make_agent(name="a1"), make_agent(name="a2"), make_agent(name="a3")],
            strategy="round_robin",
        )
        assert result.decisions[0].matchScore == pytest.approx(1 / 3, abs=0.0001)


# =============================================================================
# 13. execute_with_retry(9 tests)
# =============================================================================


class TestExecuteWithRetry:
    @pytest.mark.asyncio
    async def test_success_first_attempt(self):
        executor = AsyncMock(return_value=make_result(status="completed"))
        s = TaskScheduler(executor=executor)
        policy = RetryPolicy(
            maxRetries=3, backoff="fixed",
            initialDelayMs=10, maxDelayMs=100,
            retryableErrors=["timeout"],
        )
        result = await s.execute_with_retry(
            make_subtask(), make_agent(), policy,
        )
        assert result.status == "completed"
        assert executor.call_count == 1

    @pytest.mark.asyncio
    async def test_retry_then_success(self):
        executor = AsyncMock(side_effect=[
            make_result(status="failed", error="timeout"),
            make_result(status="completed"),
        ])
        s = TaskScheduler(executor=executor)
        policy = RetryPolicy(
            maxRetries=3, backoff="fixed",
            initialDelayMs=10, maxDelayMs=100,
            retryableErrors=["timeout"],
        )
        result = await s.execute_with_retry(
            make_subtask(), make_agent(), policy,
        )
        assert result.status == "completed"
        assert executor.call_count == 2

    @pytest.mark.asyncio
    @patch("app.services.scheduler.asyncio.sleep", new_callable=AsyncMock)
    async def test_all_retries_fail(self, mock_sleep):
        executor = AsyncMock(return_value=make_result(status="failed", error="timeout"))
        s = TaskScheduler(executor=executor)
        policy = RetryPolicy(
            maxRetries=2, backoff="fixed",
            initialDelayMs=10, maxDelayMs=100,
            retryableErrors=["timeout"],
        )
        result = await s.execute_with_retry(
            make_subtask(), make_agent(), policy,
        )
        assert result.status == "failed"
        # maxRetries=2 → max_attempts=3
        assert executor.call_count == 3
        # 重试 2 次,每次都 sleep
        assert mock_sleep.call_count == 2

    @pytest.mark.asyncio
    async def test_non_retryable_error_returns_immediately(self):
        executor = AsyncMock(return_value=make_result(status="failed", error="unknown error"))
        s = TaskScheduler(executor=executor)
        policy = RetryPolicy(
            maxRetries=3, backoff="fixed",
            initialDelayMs=10, maxDelayMs=100,
            retryableErrors=["timeout"],  # 不含 unknown
        )
        result = await s.execute_with_retry(
            make_subtask(), make_agent(), policy,
        )
        assert result.status == "failed"
        assert executor.call_count == 1

    @pytest.mark.asyncio
    async def test_max_retries_zero(self):
        """maxRetries=0 → max_attempts=1,只执行一次,不重试。"""
        executor = AsyncMock(return_value=make_result(status="failed", error="timeout"))
        s = TaskScheduler(executor=executor)
        policy = RetryPolicy(
            maxRetries=0, backoff="fixed",
            initialDelayMs=10, maxDelayMs=100,
            retryableErrors=["timeout"],
        )
        result = await s.execute_with_retry(
            make_subtask(), make_agent(), policy,
        )
        assert result.status == "failed"
        assert executor.call_count == 1

    @pytest.mark.asyncio
    @patch("app.services.scheduler.asyncio.sleep", new_callable=AsyncMock)
    async def test_fixed_backoff_sleep(self, mock_sleep):
        executor = AsyncMock(side_effect=[
            make_result(status="failed", error="timeout"),
            make_result(status="failed", error="timeout"),
            make_result(status="completed"),
        ])
        s = TaskScheduler(executor=executor)
        policy = RetryPolicy(
            maxRetries=3, backoff="fixed",
            initialDelayMs=100, maxDelayMs=5000,
            retryableErrors=["timeout"],
        )
        await s.execute_with_retry(make_subtask(), make_agent(), policy)
        # fixed:每次都 sleep 100ms → 0.1s
        mock_sleep.assert_any_call(0.1)
        for call in mock_sleep.call_args_list:
            assert call.args[0] == 0.1

    @pytest.mark.asyncio
    @patch("app.services.scheduler.asyncio.sleep", new_callable=AsyncMock)
    async def test_linear_backoff_sleep(self, mock_sleep):
        executor = AsyncMock(side_effect=[
            make_result(status="failed", error="timeout"),
            make_result(status="failed", error="timeout"),
            make_result(status="completed"),
        ])
        s = TaskScheduler(executor=executor)
        policy = RetryPolicy(
            maxRetries=3, backoff="linear",
            initialDelayMs=100, maxDelayMs=5000,
            retryableErrors=["timeout"],
        )
        await s.execute_with_retry(make_subtask(), make_agent(), policy)
        # linear:attempt 1 → 100*1=100ms=0.1s;attempt 2 → 100*2=200ms=0.2s
        assert mock_sleep.call_args_list[0].args[0] == 0.1
        assert mock_sleep.call_args_list[1].args[0] == 0.2

    @pytest.mark.asyncio
    @patch("app.services.scheduler.asyncio.sleep", new_callable=AsyncMock)
    async def test_exponential_backoff_sleep(self, mock_sleep):
        executor = AsyncMock(side_effect=[
            make_result(status="failed", error="timeout"),
            make_result(status="failed", error="timeout"),
            make_result(status="completed"),
        ])
        s = TaskScheduler(executor=executor)
        policy = RetryPolicy(
            maxRetries=3, backoff="exponential",
            initialDelayMs=100, maxDelayMs=5000,
            retryableErrors=["timeout"],
        )
        await s.execute_with_retry(make_subtask(), make_agent(), policy)
        # exponential:attempt 1 → 100*2^0=100ms=0.1s;attempt 2 → 100*2^1=200ms=0.2s
        assert mock_sleep.call_args_list[0].args[0] == 0.1
        assert mock_sleep.call_args_list[1].args[0] == 0.2

    @pytest.mark.asyncio
    async def test_session_id_passed_through(self):
        executor = AsyncMock(return_value=make_result(status="completed"))
        s = TaskScheduler(executor=executor)
        policy = RetryPolicy(
            maxRetries=1, backoff="fixed",
            initialDelayMs=10, maxDelayMs=100,
            retryableErrors=["timeout"],
        )
        await s.execute_with_retry(
            make_subtask(), make_agent(), policy, session_id="my-session",
        )
        assert executor.call_args.args[2] == "my-session"

    @pytest.mark.asyncio
    async def test_session_id_default_generated(self):
        executor = AsyncMock(return_value=make_result(status="completed"))
        s = TaskScheduler(executor=executor)
        policy = RetryPolicy(
            maxRetries=0, backoff="fixed",
            initialDelayMs=10, maxDelayMs=100,
            retryableErrors=["timeout"],
        )
        await s.execute_with_retry(make_subtask(), make_agent(), policy)
        sid = executor.call_args.args[2]
        assert sid is not None
        assert sid.startswith("retry-")


# =============================================================================
# 14. execute_with_failover(8 tests)
# =============================================================================


class TestExecuteWithFailover:
    @pytest.mark.asyncio
    async def test_primary_succeeds(self):
        executor = AsyncMock(return_value=make_result(status="completed", output="done"))
        s = TaskScheduler(executor=executor)
        config = FailoverConfig(primary="p1", fallbacks=["f1"], triggerOn=["failure"])
        result = await s.execute_with_failover(
            make_subtask(),
            [make_agent(name="p1"), make_agent(name="f1")],
            config,
        )
        assert result.status == "completed"
        assert executor.call_count == 1

    @pytest.mark.asyncio
    async def test_primary_fails_fallback_succeeds(self):
        executor = AsyncMock(side_effect=[
            make_result(status="failed", error="boom", agent_name="p1"),
            make_result(status="completed", output="ok", agent_name="f1"),
        ])
        s = TaskScheduler(executor=executor)
        config = FailoverConfig(primary="p1", fallbacks=["f1"], triggerOn=["failure"])
        result = await s.execute_with_failover(
            make_subtask(),
            [make_agent(name="p1"), make_agent(name="f1")],
            config,
        )
        assert result.status == "completed"
        assert result.agent_name == "f1"
        assert executor.call_count == 2

    @pytest.mark.asyncio
    async def test_all_fail_returns_last(self):
        executor = AsyncMock(return_value=make_result(status="failed", error="boom"))
        s = TaskScheduler(executor=executor)
        config = FailoverConfig(primary="p1", fallbacks=["f1"], triggerOn=["failure"])
        result = await s.execute_with_failover(
            make_subtask(),
            [make_agent(name="p1"), make_agent(name="f1")],
            config,
        )
        assert result.status == "failed"
        assert executor.call_count == 2

    @pytest.mark.asyncio
    async def test_timeout_trigger(self):
        """triggerOn 含 timeout 时,executor 抛 TimeoutError → 转移到下一个。"""
        executor = AsyncMock(side_effect=[
            asyncio.TimeoutError(),
            make_result(status="completed", agent_name="f1"),
        ])
        s = TaskScheduler(executor=executor)
        config = FailoverConfig(
            primary="p1", fallbacks=["f1"],
            triggerOn=["timeout"],
        )
        result = await s.execute_with_failover(
            make_subtask(),
            [make_agent(name="p1"), make_agent(name="f1")],
            config,
        )
        assert result.status == "completed"
        assert result.agent_name == "f1"

    @pytest.mark.asyncio
    async def test_timeout_no_fallback_returns_timeout_result(self):
        executor = AsyncMock(side_effect=asyncio.TimeoutError())
        s = TaskScheduler(executor=executor)
        config = FailoverConfig(
            primary="p1", fallbacks=["f1"],
            triggerOn=["timeout"],
        )
        result = await s.execute_with_failover(
            make_subtask(),
            [make_agent(name="p1"), make_agent(name="f1")],
            config,
        )
        assert result.status == "failed"
        assert result.error == "timeout"

    @pytest.mark.asyncio
    async def test_low_quality_trigger_failover(self):
        executor = AsyncMock(return_value=make_result(status="completed", output="bad"))
        s = TaskScheduler(executor=executor)
        # mock _evaluate_quality 返回低分
        s._evaluate_quality = AsyncMock(return_value=0.3)
        config = FailoverConfig(
            primary="p1", fallbacks=["f1"],
            triggerOn=["low_quality"], qualityThreshold=0.8,
        )
        result = await s.execute_with_failover(
            make_subtask(),
            [make_agent(name="p1"), make_agent(name="f1")],
            config,
        )
        # 两个 agent 都低质量 → 返回最后一个(last_result)
        assert result.status == "completed"
        assert "low_quality" in (result.error or "")
        assert executor.call_count == 2

    @pytest.mark.asyncio
    async def test_low_quality_high_score_no_failover(self):
        executor = AsyncMock(return_value=make_result(status="completed", output="good"))
        s = TaskScheduler(executor=executor)
        s._evaluate_quality = AsyncMock(return_value=0.95)
        config = FailoverConfig(
            primary="p1", fallbacks=["f1"],
            triggerOn=["low_quality"], qualityThreshold=0.8,
        )
        result = await s.execute_with_failover(
            make_subtask(),
            [make_agent(name="p1"), make_agent(name="f1")],
            config,
        )
        assert result.status == "completed"
        assert result.error is None
        assert executor.call_count == 1

    @pytest.mark.asyncio
    async def test_quality_threshold_none_skips_eval(self):
        """qualityThreshold=None 时,即使 triggerOn 含 low_quality 也不评估。"""
        executor = AsyncMock(return_value=make_result(status="completed", output="ok"))
        s = TaskScheduler(executor=executor)
        s._evaluate_quality = AsyncMock(return_value=0.0)
        config = FailoverConfig(
            primary="p1", fallbacks=["f1"],
            triggerOn=["low_quality"], qualityThreshold=None,
        )
        result = await s.execute_with_failover(
            make_subtask(),
            [make_agent(name="p1"), make_agent(name="f1")],
            config,
        )
        assert result.status == "completed"
        s._evaluate_quality.assert_not_called()
        assert executor.call_count == 1

    @pytest.mark.asyncio
    async def test_agent_not_in_list_skipped(self):
        """primary 不在 agents 列表 → 跳过,直接用 fallback。"""
        executor = AsyncMock(return_value=make_result(status="completed"))
        s = TaskScheduler(executor=executor)
        config = FailoverConfig(primary="missing", fallbacks=["f1"], triggerOn=["failure"])
        result = await s.execute_with_failover(
            make_subtask(),
            [make_agent(name="f1")],
            config,
        )
        assert result.status == "completed"
        assert executor.call_count == 1

    @pytest.mark.asyncio
    async def test_all_agents_unavailable(self):
        """primary + fallbacks 都不在 agents 列表 → 返回兜底错误。"""
        executor = AsyncMock(return_value=make_result(status="completed"))
        s = TaskScheduler(executor=executor)
        config = FailoverConfig(
            primary="missing1", fallbacks=["missing2"],
            triggerOn=["failure"],
        )
        result = await s.execute_with_failover(
            make_subtask(),
            [make_agent(name="other")],
            config,
        )
        assert result.status == "failed"
        assert "所有 agent 均不可用" in (result.error or "")
        assert executor.call_count == 0

    @pytest.mark.asyncio
    async def test_session_id_passed_through(self):
        executor = AsyncMock(return_value=make_result(status="completed"))
        s = TaskScheduler(executor=executor)
        config = FailoverConfig(primary="p1", fallbacks=[], triggerOn=["failure"])
        await s.execute_with_failover(
            make_subtask(),
            [make_agent(name="p1")],
            config,
            session_id="my-session",
        )
        assert executor.call_args.args[2] == "my-session"

    @pytest.mark.asyncio
    async def test_session_id_default_generated(self):
        executor = AsyncMock(return_value=make_result(status="completed"))
        s = TaskScheduler(executor=executor)
        config = FailoverConfig(primary="p1", fallbacks=[], triggerOn=["failure"])
        await s.execute_with_failover(
            make_subtask(),
            [make_agent(name="p1")],
            config,
        )
        sid = executor.call_args.args[2]
        assert sid is not None
        assert sid.startswith("failover-")


# =============================================================================
# 15. _evaluate_quality(7 tests)
# =============================================================================


class TestEvaluateQuality:
    @pytest.mark.asyncio
    async def test_empty_output_returns_zero(self):
        s = TaskScheduler()
        score = await s._evaluate_quality("", "task")
        assert score == 0.0

    @pytest.mark.asyncio
    async def test_whitespace_output_returns_zero(self):
        s = TaskScheduler()
        score = await s._evaluate_quality("   \n\t  ", "task")
        assert score == 0.0

    @pytest.mark.asyncio
    @patch("app.services.scheduler.llm_gateway")
    async def test_valid_score(self, mock_llm):
        mock_llm.complete = AsyncMock(return_value={"content": "0.85"})
        s = TaskScheduler()
        score = await s._evaluate_quality("some output", "some task")
        assert score == 0.85

    @pytest.mark.asyncio
    @patch("app.services.scheduler.llm_gateway")
    async def test_score_with_text(self, mock_llm):
        mock_llm.complete = AsyncMock(return_value={"content": "质量评分: 0.92"})
        s = TaskScheduler()
        score = await s._evaluate_quality("output", "task")
        assert score == 0.92

    @pytest.mark.asyncio
    @patch("app.services.scheduler.llm_gateway")
    async def test_garbage_returns_one(self, mock_llm):
        mock_llm.complete = AsyncMock(return_value={"content": "no number here"})
        s = TaskScheduler()
        score = await s._evaluate_quality("output", "task")
        assert score == 1.0

    @pytest.mark.asyncio
    @patch("app.services.scheduler.llm_gateway")
    async def test_score_above_one_clamped(self, mock_llm):
        mock_llm.complete = AsyncMock(return_value={"content": "1.5"})
        s = TaskScheduler()
        score = await s._evaluate_quality("output", "task")
        assert score == 1.0

    @pytest.mark.asyncio
    @patch("app.services.scheduler.llm_gateway")
    async def test_llm_exception_returns_one(self, mock_llm):
        mock_llm.complete = AsyncMock(side_effect=RuntimeError("LLM down"))
        s = TaskScheduler()
        score = await s._evaluate_quality("output", "task")
        assert score == 1.0

    @pytest.mark.asyncio
    @patch("app.services.scheduler.llm_gateway")
    async def test_empty_content_returns_one(self, mock_llm):
        mock_llm.complete = AsyncMock(return_value={"content": ""})
        s = TaskScheduler()
        score = await s._evaluate_quality("output", "task")
        assert score == 1.0


# =============================================================================
# 16. _default_executor(4 tests)
# =============================================================================


class TestDefaultExecutor:
    @pytest.mark.asyncio
    @patch("app.services.scheduler.llm_gateway")
    async def test_success(self, mock_llm):
        mock_llm.complete = AsyncMock(return_value={
            "content": "hello world", "error": False,
        })
        s = TaskScheduler()
        result = await s._default_executor(
            make_agent(name="a1", model="gpt-4"), "do task", "sid",
        )
        assert result.status == "completed"
        assert result.output == "hello world"
        assert result.error is None
        assert result.agent_name == "a1"

    @pytest.mark.asyncio
    @patch("app.services.scheduler.llm_gateway")
    async def test_error_response(self, mock_llm):
        mock_llm.complete = AsyncMock(return_value={
            "content": "", "error": True, "error_message": "API broke",
        })
        s = TaskScheduler()
        result = await s._default_executor(
            make_agent(name="a1"), "do task", "sid",
        )
        assert result.status == "failed"
        assert result.error == "API broke"

    @pytest.mark.asyncio
    @patch("app.services.scheduler.llm_gateway")
    async def test_exception(self, mock_llm):
        mock_llm.complete = AsyncMock(side_effect=RuntimeError("connection lost"))
        s = TaskScheduler()
        result = await s._default_executor(
            make_agent(name="a1"), "do task", "sid",
        )
        assert result.status == "failed"
        assert "connection lost" in (result.error or "")

    @pytest.mark.asyncio
    @patch("app.services.scheduler.llm_gateway")
    async def test_model_passed_through(self, mock_llm):
        mock_llm.complete = AsyncMock(return_value={"content": "ok"})
        s = TaskScheduler()
        await s._default_executor(
            make_agent(name="a1", model="claude-3"), "do task", "sid",
        )
        # complete 应该收到 model="claude-3"
        assert mock_llm.complete.call_args.kwargs.get("model") == "claude-3"


# =============================================================================
# 17. task_scheduler 单例(3 tests)
# =============================================================================


class TestTaskSchedulerSingleton:
    def test_singleton_exists(self):
        assert task_scheduler is not None

    def test_singleton_is_instance(self):
        assert isinstance(task_scheduler, TaskScheduler)

    def test_singleton_has_executor_and_load(self):
        assert hasattr(task_scheduler, "_executor")
        assert hasattr(task_scheduler, "_agent_load")
        assert isinstance(task_scheduler._agent_load, dict)


# =============================================================================
# 18. schedule 并发度与策略传递(2 tests)
# =============================================================================


class TestScheduleConcurrency:
    @pytest.mark.asyncio
    async def test_concurrency_is_min(self):
        """concurrency = min(len(sub_tasks), len(agents))。"""
        s = TaskScheduler()
        result = await s.schedule(
            [make_subtask(id=f"st{i}") for i in range(5)],
            [make_agent(name=f"a{i}") for i in range(3)],
            strategy="round_robin",
        )
        assert result.concurrency == 3

    @pytest.mark.asyncio
    async def test_strategy_propagated_to_result(self):
        s = TaskScheduler()
        for strat in ("capability_match", "load_balance", "priority", "round_robin"):
            result = await s.schedule(
                [make_subtask(id="st1")], [make_agent(name="a1")],
                strategy=strat,
            )
            assert result.strategy == strat
            assert result.decisions[0].strategy == strat
