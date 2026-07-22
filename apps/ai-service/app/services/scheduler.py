"""调度算法 + 失败重试 + 故障转移(P3-3)。

对标 Hermes Agent 的调度系统:
1. TaskScheduler:基于能力匹配 / 负载均衡 / 优先级 / 轮询的 4 种调度策略
2. execute_with_retry:失败重试(fixed / linear / exponential 退避)
3. execute_with_failover:故障转移(主 agent 失败 → 备用 agent,含质量评估)

设计原则:
- 通过 executor 依赖注入避免与 agent_orchestrator 循环导入
- 质量评估用 LLM 评分(0-1),低于阈值触发转移
- 退避策略尊重 retryableErrors,不可重试的错误立即返回
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Awaitable, Callable, Literal

from ..core.llm_gateway import llm_gateway
from .agent_orchestrator import AgentDefinition, AgentStepResult
from .task_decomposer import SubTask

logger = logging.getLogger(__name__)

# 类型别名(对齐 packages/types/src/agent-runtime.ts P3-3 契约)
ScheduleStrategy = Literal["capability_match", "load_balance", "priority", "round_robin"]
BackoffStrategy = Literal["fixed", "linear", "exponential"]
FailoverTrigger = Literal["failure", "timeout", "low_quality"]
RetryableErrorType = Literal["timeout", "rate_limited", "overloaded", "network", "unknown"]

# 执行器签名:(agent, input, session_id) -> AgentStepResult
ExecutorFn = Callable[[AgentDefinition, str, str | None], Awaitable[AgentStepResult]]


@dataclass
class ScheduleDecision:
    """调度决策。"""

    subTaskId: str
    assignedAgent: str
    reason: str
    matchScore: float
    estimatedStartTime: str
    strategy: ScheduleStrategy


@dataclass
class SchedulingResult:
    """调度结果。"""

    decisions: list[ScheduleDecision]
    concurrency: int
    estimatedTotalDurationSeconds: int
    strategy: ScheduleStrategy


@dataclass
class RetryPolicy:
    """失败重试策略。"""

    maxRetries: int
    backoff: BackoffStrategy
    initialDelayMs: int
    maxDelayMs: int
    retryableErrors: list[RetryableErrorType]


@dataclass
class FailoverConfig:
    """故障转移配置。"""

    primary: str
    fallbacks: list[str]
    triggerOn: list[FailoverTrigger]
    qualityThreshold: float | None = None


def _utc_now_plus_seconds(seconds: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()


class TaskScheduler:
    """任务调度器:能力匹配 + 负载均衡 + 重试 + 故障转移。"""

    def __init__(self, executor: ExecutorFn | None = None) -> None:
        # 执行器(默认用 LLM 直连,orchestrator 传入自己的 _run_agent)
        self._executor: ExecutorFn = executor or self._default_executor
        # agent 负载跟踪(load_balance 策略用)
        self._agent_load: dict[str, int] = {}

    def set_executor(self, executor: ExecutorFn) -> None:
        """设置执行器(供 orchestrator 注入)。"""
        self._executor = executor

    # =========================================================================
    # 调度
    # =========================================================================

    async def schedule(
        self,
        sub_tasks: list[SubTask],
        available_agents: list[AgentDefinition],
        strategy: ScheduleStrategy = "capability_match",
    ) -> SchedulingResult:
        """调度子任务到 agent。

        4 种策略:
        - capability_match:Jaccard 相似度匹配 agent 能力与子任务需求
        - load_balance:选择当前负载最低的 agent
        - priority:按子任务 priority 降序分配(高优先级优先选最佳 agent)
        - round_robin:轮询分配
        """
        if not sub_tasks or not available_agents:
            return SchedulingResult(
                decisions=[], concurrency=0,
                estimatedTotalDurationSeconds=0, strategy=strategy,
            )

        decisions: list[ScheduleDecision] = []
        cumulative_seconds = 0

        if strategy == "capability_match":
            decisions, cumulative_seconds = self._schedule_by_capability(
                sub_tasks, available_agents
            )
        elif strategy == "load_balance":
            decisions, cumulative_seconds = await self._schedule_by_load(
                sub_tasks, available_agents
            )
        elif strategy == "priority":
            decisions, cumulative_seconds = self._schedule_by_priority(
                sub_tasks, available_agents
            )
        else:  # round_robin
            decisions, cumulative_seconds = self._schedule_round_robin(
                sub_tasks, available_agents
            )

        # 并发度 = min(子任务数, agent 数)
        concurrency = min(len(sub_tasks), len(available_agents))

        return SchedulingResult(
            decisions=decisions,
            concurrency=concurrency,
            estimatedTotalDurationSeconds=cumulative_seconds,
            strategy=strategy,
        )

    # -------------------------------------------------------------------------
    # 策略实现
    # -------------------------------------------------------------------------

    def _schedule_by_capability(
        self, sub_tasks: list[SubTask], agents: list[AgentDefinition]
    ) -> tuple[list[ScheduleDecision], int]:
        """能力匹配:Jaccard 相似度。"""
        decisions: list[ScheduleDecision] = []
        cumulative = 0
        for st in sub_tasks:
            best_agent: AgentDefinition | None = None
            best_score = -1.0
            for agent in agents:
                score = self._jaccard_score(
                    st.requiredCapabilities, self._agent_capabilities(agent)
                )
                if score > best_score:
                    best_score = score
                    best_agent = agent
            if best_agent is None:
                continue
            self._agent_load[best_agent.name] = self._agent_load.get(best_agent.name, 0) + 1
            dur = st.estimatedDurationSeconds or 0
            decisions.append(ScheduleDecision(
                subTaskId=st.id,
                assignedAgent=best_agent.name,
                reason=f"能力匹配度 {best_score:.2f}(Jaccard)",
                matchScore=round(best_score, 4),
                estimatedStartTime=_utc_now_plus_seconds(cumulative),
                strategy="capability_match",
            ))
            cumulative += dur
        return decisions, cumulative

    async def _schedule_by_load(
        self, sub_tasks: list[SubTask], agents: list[AgentDefinition]
    ) -> tuple[list[ScheduleDecision], int]:
        """负载均衡:选当前负载最低的 agent。"""
        decisions: list[ScheduleDecision] = []
        cumulative = 0
        for st in sub_tasks:
            # 选负载最低的 agent(负载相同取能力匹配最高的)
            candidates = sorted(
                agents,
                key=lambda a: (self._agent_load.get(a.name, 0), -self._jaccard_score(
                    st.requiredCapabilities, self._agent_capabilities(a)
                )),
            )
            chosen = candidates[0]
            self._agent_load[chosen.name] = self._agent_load.get(chosen.name, 0) + 1
            load = self._agent_load[chosen.name]
            dur = st.estimatedDurationSeconds or 0
            decisions.append(ScheduleDecision(
                subTaskId=st.id,
                assignedAgent=chosen.name,
                reason=f"负载最低(当前 {load} 个任务)",
                matchScore=round(1.0 / (1 + load), 4),
                estimatedStartTime=_utc_now_plus_seconds(cumulative),
                strategy="load_balance",
            ))
            cumulative += dur
        return decisions, cumulative

    def _schedule_by_priority(
        self, sub_tasks: list[SubTask], agents: list[AgentDefinition]
    ) -> tuple[list[ScheduleDecision], int]:
        """优先级:按 priority 降序,高优先级选能力匹配最高的 agent。"""
        sorted_tasks = sorted(sub_tasks, key=lambda s: -s.priority)
        decisions: list[ScheduleDecision] = []
        cumulative = 0
        for st in sorted_tasks:
            best_agent = max(
                agents,
                key=lambda a: self._jaccard_score(
                    st.requiredCapabilities, self._agent_capabilities(a)
                ),
            )
            self._agent_load[best_agent.name] = self._agent_load.get(best_agent.name, 0) + 1
            dur = st.estimatedDurationSeconds or 0
            decisions.append(ScheduleDecision(
                subTaskId=st.id,
                assignedAgent=best_agent.name,
                reason=f"优先级 {st.priority}(高优先级选最佳匹配)",
                matchScore=round(self._jaccard_score(
                    st.requiredCapabilities, self._agent_capabilities(best_agent)
                ), 4),
                estimatedStartTime=_utc_now_plus_seconds(cumulative),
                strategy="priority",
            ))
            cumulative += dur
        return decisions, cumulative

    def _schedule_round_robin(
        self, sub_tasks: list[SubTask], agents: list[AgentDefinition]
    ) -> tuple[list[ScheduleDecision], int]:
        """轮询:按顺序循环分配。"""
        decisions: list[ScheduleDecision] = []
        cumulative = 0
        for i, st in enumerate(sub_tasks):
            agent = agents[i % len(agents)]
            self._agent_load[agent.name] = self._agent_load.get(agent.name, 0) + 1
            dur = st.estimatedDurationSeconds or 0
            decisions.append(ScheduleDecision(
                subTaskId=st.id,
                assignedAgent=agent.name,
                reason=f"轮询第 {i + 1} 个,分配给 {agent.name}",
                matchScore=round(1.0 / len(agents), 4),
                estimatedStartTime=_utc_now_plus_seconds(cumulative),
                strategy="round_robin",
            ))
            cumulative += dur
        return decisions, cumulative

    # =========================================================================
    # 重试执行
    # =========================================================================

    async def execute_with_retry(
        self,
        sub_task: SubTask,
        agent: AgentDefinition,
        retry_policy: RetryPolicy,
        session_id: str | None = None,
    ) -> AgentStepResult:
        """执行子任务,失败时按 retry_policy 重试。

        退避策略:
        - fixed:固定延迟 initialDelayMs
        - linear:第 n 次重试延迟 initialDelayMs * n
        - exponential:第 n 次重试延迟 initialDelayMs * 2^(n-1),上限 maxDelayMs
        重试次数耗尽返回最后一个错误。
        """
        sid = session_id or f"retry-{uuid.uuid4().hex[:8]}"
        last_result: AgentStepResult | None = None
        max_attempts = retry_policy.maxRetries + 1  # 初次 + 重试次数

        for attempt in range(max_attempts):
            result = await self._executor(agent, sub_task.description, sid)
            last_result = result
            if result.status == "completed":
                return result

            # 判断错误是否可重试
            error_type = self._classify_error(result.error or "")
            if error_type not in retry_policy.retryableErrors:
                # 不可重试的错误,直接返回
                logger.info(
                    "子任务 %s 失败(不可重试错误 %s): %s",
                    sub_task.id, error_type, result.error,
                )
                return result

            # 是否还有重试机会
            if attempt < max_attempts - 1:
                delay_ms = self._compute_backoff(
                    retry_policy.backoff,
                    attempt + 1,
                    retry_policy.initialDelayMs,
                    retry_policy.maxDelayMs,
                )
                logger.info(
                    "子任务 %s 第 %d 次失败,%.0fms 后重试: %s",
                    sub_task.id, attempt + 1, delay_ms, result.error,
                )
                await asyncio.sleep(delay_ms / 1000.0)

        # 重试耗尽
        return last_result  # type: ignore[return-value]

    # =========================================================================
    # 故障转移
    # =========================================================================

    async def execute_with_failover(
        self,
        sub_task: SubTask,
        agents: list[AgentDefinition],
        config: FailoverConfig,
        session_id: str | None = None,
    ) -> AgentStepResult:
        """故障转移:主 agent 失败 → 备用 agent。

        触发条件:
        - failure:agent 执行失败(status=failed)
        - timeout:执行超时(用 asyncio.wait_for 包装)
        - low_quality:LLM 质量评分 < qualityThreshold
        """
        sid = session_id or f"failover-{uuid.uuid4().hex[:8]}"
        # 按优先级排序:primary 在前,fallbacks 在后
        agent_order = [config.primary] + config.fallbacks
        agents_by_name = {a.name: a for a in agents}

        last_result: AgentStepResult | None = None
        for i, agent_name in enumerate(agent_order):
            agent = agents_by_name.get(agent_name)
            if agent is None:
                logger.warning("故障转移:agent %s 不存在,跳过", agent_name)
                continue

            # 执行(带超时控制)
            try:
                if "timeout" in config.triggerOn:
                    result = await asyncio.wait_for(
                        self._executor(agent, sub_task.description, sid),
                        timeout=60.0,
                    )
                else:
                    result = await self._executor(agent, sub_task.description, sid)
            except asyncio.TimeoutError:
                last_result = AgentStepResult(
                    agent_name=agent_name,
                    input=sub_task.description,
                    output="",
                    status="failed",
                    error="timeout",
                )
                logger.warning("故障转移:agent %s 超时", agent_name)
                continue

            last_result = result

            # 检查是否需要转移
            should_failover = False
            if result.status == "failed" and "failure" in config.triggerOn:
                should_failover = True
                logger.info("故障转移:agent %s 失败,尝试下一个", agent_name)

            if (
                "low_quality" in config.triggerOn
                and config.qualityThreshold is not None
                and result.status == "completed"
            ):
                quality = await self._evaluate_quality(result.output, sub_task.description)
                if quality < config.qualityThreshold:
                    should_failover = True
                    logger.info(
                        "故障转移:agent %s 质量分 %.2f < 阈值 %.2f",
                        agent_name, quality, config.qualityThreshold,
                    )
                    # 把质量分附加到 error 字段供后续参考
                    result.error = f"low_quality: score={quality:.2f}"

            if not should_failover:
                return result

        # 全部 agent 都失败/低质量
        if last_result is not None:
            return last_result
        return AgentStepResult(
            agent_name=config.primary,
            input=sub_task.description,
            output="",
            status="failed",
            error="所有 agent 均不可用(主 + 备用)",
        )

    # =========================================================================
    # 工具方法
    # =========================================================================

    @staticmethod
    def _agent_capabilities(agent: AgentDefinition) -> set[str]:
        """提取 agent 的能力集合(tools + metadata category)。"""
        caps = set(agent.tools)
        cat = agent.metadata.get("category")
        if cat:
            caps.add(str(cat))
        return caps

    @staticmethod
    def _jaccard_score(required: list[str], available: set[str]) -> float:
        """Jaccard 相似度:|交集| / |并集|。"""
        if not required:
            return 0.5  # 无需求时中性分数
        req_set = set(required)
        if not available:
            return 0.0
        intersection = req_set & available
        union = req_set | available
        if not union:
            return 0.0
        return len(intersection) / len(union)

    @staticmethod
    def _compute_backoff(
        strategy: BackoffStrategy,
        attempt: int,
        initial_ms: int,
        max_ms: int,
    ) -> int:
        """计算退避延迟(ms)。"""
        if strategy == "fixed":
            delay = initial_ms
        elif strategy == "linear":
            delay = initial_ms * attempt
        else:  # exponential
            delay = initial_ms * (2 ** (attempt - 1))
        return min(delay, max_ms)

    @staticmethod
    def _classify_error(error_msg: str) -> RetryableErrorType:
        """根据错误信息分类错误类型。"""
        msg = error_msg.lower()
        if "timeout" in msg or "timed out" in msg:
            return "timeout"
        if "rate" in msg and "limit" in msg:
            return "rate_limited"
        if "overload" in msg or "capacity" in msg or "busy" in msg:
            return "overloaded"
        if "network" in msg or "connection" in msg or "unreachable" in msg:
            return "network"
        return "unknown"

    async def _evaluate_quality(self, output: str, task_description: str) -> float:
        """LLM 质量评估:对 output 针对 task 评分(0-1)。

        LLM 不可用时返回 1.0(不触发转移,容错降级)。
        """
        if not output.strip():
            return 0.0
        try:
            prompt = (
                f"请对以下 AI 输出针对任务的质量评分(0 到 1 的浮点数,1 为完美):\n\n"
                f"任务:{task_description[:500]}\n\n"
                f"输出:{output[:1000]}\n\n"
                "只回复一个 0 到 1 之间的数字(如 0.85),不要其他内容。"
            )
            result = await llm_gateway.complete(
                [{"role": "user", "content": prompt}],
            )
            content = str(result.get("content", "") or "").strip()
            # 提取数字
            nums = re.findall(r"(\d+\.?\d*)", content)
            if nums:
                score = float(nums[0])
                return max(0.0, min(1.0, score))
            return 1.0  # 解析失败,不触发转移
        except Exception as e:
            logger.warning("质量评估失败,降级为 1.0: %s", e)
            return 1.0

    async def _default_executor(
        self, agent: AgentDefinition, user_input: str, session_id: str | None
    ) -> AgentStepResult:
        """默认执行器:直接调 LLM(不走 agent_loop,无工具调用)。"""
        start = time.monotonic()
        try:
            result = await llm_gateway.complete(
                [
                    {"role": "system", "content": agent.system_prompt},
                    {"role": "user", "content": user_input},
                ],
                model=agent.model,
            )
            content = str(result.get("content", "") or "")
            error = result.get("error_message") if result.get("error") else None
            status = "failed" if result.get("error") else "completed"
            return AgentStepResult(
                agent_name=agent.name,
                input=user_input,
                output=content,
                status=status,
                duration_ms=round((time.monotonic() - start) * 1000, 2),
                error=error,
            )
        except Exception as e:
            return AgentStepResult(
                agent_name=agent.name,
                input=user_input,
                output="",
                status="failed",
                duration_ms=round((time.monotonic() - start) * 1000, 2),
                error=str(e),
            )


# 模块级单例(默认执行器,orchestrator 会注入自己的)
task_scheduler = TaskScheduler()
