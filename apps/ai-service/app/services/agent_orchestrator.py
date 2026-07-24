"""Multi-agent orchestrator — 多智能体编排服务。

提供:
1. Agent registry: 注册 / 查找 / 列出智能体
2. Single agent invoke: 调用单个智能体执行任务
3. Multi-agent orchestration: 串行 / 并行编排多个智能体,合并结果
4. Pipeline: 自定义 step 序列,每个 step 可调用不同 agent

设计原则(2026-07-20 立):
- 与现有 agent_loop / langgraph_service 互补(不重复实现)
- Agent 定义 = name + system_prompt + tools + model
- Pipeline 步骤 = (agent_name, user_input_template)
- 执行 trace 完整(每个 step 的耗时 / 状态 / 结果)
- stub 模式:无 API key 时返回固定响应
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from ..core.llm_gateway import llm_gateway
from .agent_loop import agent_executor
from .memory import memory_store
from .mcp_server import mcp_server

logger = logging.getLogger(__name__)


@dataclass
class AgentDefinition:
    """智能体定义。"""

    name: str
    description: str
    system_prompt: str
    tools: list[str] = field(default_factory=list)
    model: str | None = None
    max_iterations: int = 5
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "system_prompt": self.system_prompt[:200],
            "tools": self.tools,
            "model": self.model,
            "max_iterations": self.max_iterations,
            "metadata": self.metadata,
        }


@dataclass
class AgentStepResult:
    """单步执行结果。"""

    agent_name: str
    input: str
    output: str
    status: str  # completed / failed / skipped
    duration_ms: float = 0.0
    iterations: int = 0
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None


@dataclass
class OrchestrationResult:
    """完整编排结果。"""

    orchestration_id: str
    steps: list[AgentStepResult]
    final_output: str
    status: str
    total_duration_ms: float
    trace: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Agent Registry
# ---------------------------------------------------------------------------


class AgentRegistry:
    """智能体注册表(进程内单例)。"""

    def __init__(self) -> None:
        self._agents: dict[str, AgentDefinition] = {}
        self._register_defaults()

    def _register_defaults(self) -> None:
        """注册 10 个默认 agent(5 通用 + 5 专业 subagent,对齐 Trae 自定义智能体)。"""
        defaults = [
            AgentDefinition(
                name="researcher",
                description="研究助手:调研任务、收集信息、生成摘要",
                system_prompt=(
                    "你是研究助手。负责收集信息、调研问题并给出事实性回答。"
                    "回答时引用具体来源,不要猜测。"
                ),
                tools=["search_web", "web_search", "file_search", "read_file"],
                metadata={"category": "research"},
            ),
            AgentDefinition(
                name="coder",
                description="代码助手:实现功能、修复 bug、写代码",
                system_prompt=(
                    "你是代码助手。负责实现功能、修复 bug、编写测试。"
                    "优先使用 read_file / search_codebase / run_command 等工具探索代码库。"
                ),
                tools=[
                    "read_file", "write_file", "search_codebase", "file_search",
                    "analyze_code", "generate_test", "run_command",
                ],
                metadata={"category": "code"},
            ),
            AgentDefinition(
                name="reviewer",
                description="代码审查助手:审查 diff、给出修改建议",
                system_prompt=(
                    "你是代码审查助手。审查代码 diff 并给出具体修改建议。"
                    "重点关注正确性、安全性、性能、可读性。"
                ),
                tools=["read_file", "search_codebase", "analyze_code", "git_operations"],
                metadata={"category": "code"},
            ),
            AgentDefinition(
                name="architect",
                description="架构师:设计方案、规划模块、API 契约",
                system_prompt=(
                    "你是架构师。负责设计系统方案、规划模块结构、定义 API 契约。"
                    "输出需包含模块划分、数据流、关键技术决策。"
                ),
                tools=["search_codebase", "file_search", "read_file"],
                metadata={"category": "design"},
            ),
            AgentDefinition(
                name="debugger",
                description="调试助手:定位 bug、给出修复方案",
                system_prompt=(
                    "你是调试助手。负责定位 bug 的根因并给出修复方案。"
                    "通过 run_command / read_file / search_codebase 收集证据。"
                ),
                tools=[
                    "run_command", "read_file", "search_codebase",
                    "file_search", "git_operations",
                ],
                metadata={"category": "code"},
            ),
            # ---- 5 个专业 subagent(对齐 Trae 自定义智能体)----
            AgentDefinition(
                name="frontend-dev",
                description="前端开发专家:React/Next.js/Tailwind/shadcn 组件开发,熟悉 SSR/SSG/ISR",
                system_prompt=(
                    "你是前端开发专家。精通 React 19 / Next.js 15 / Tailwind 4 / shadcn/ui。"
                    "遵循项目 AGENTS.md 的 UI 约束:compact/elegant、禁止蓝色发光边框、"
                    "禁止 rounded-full 容器、禁止分割线。"
                    "用 packages/ui 的 Card/Button/Input/Dialog,每个页面 < 250 行。"
                    "时间用 Intl.DateTimeFormat,头像用 initials。"
                ),
                tools=[
                    "read_file", "write_file", "search_codebase", "file_search",
                    "analyze_code", "run_command",
                ],
                metadata={"category": "frontend"},
            ),
            AgentDefinition(
                name="backend-dev",
                description="后端开发专家:Fastify/Drizzle ORM/PostgreSQL/Redis,熟悉 REST API 设计",
                system_prompt=(
                    "你是后端开发专家。精通 Fastify 5 + Drizzle ORM 0.38 + PostgreSQL + Redis。"
                    "遵循项目 AGENTS.md 的后端约束:Zod 校验、复用 packages/auth、"
                    "admin 路由用 preHandler、onConflictDoNothing 幂等、"
                    "API 响应统一 {code, message, data} 格式。"
                ),
                tools=[
                    "read_file", "write_file", "search_codebase", "file_search",
                    "analyze_code", "run_command", "db_query",
                ],
                metadata={"category": "backend"},
            ),
            AgentDefinition(
                name="devops",
                description="DevOps 工程师:Docker/Turborepo/pnpm workspace/CI/CD,熟悉 monorepo 构建",
                system_prompt=(
                    "你是 DevOps 工程师。精通 Docker / Turborepo / pnpm workspace / GitHub Actions。"
                    "能优化构建速度、设计 CI/CD 流水线、排查部署问题。"
                    "遵循项目 AGENTS.md 的验证命令规范:pnpm turbo build typecheck lint test。"
                ),
                tools=[
                    "read_file", "search_codebase", "file_search",
                    "run_command", "git_operations",
                ],
                metadata={"category": "devops"},
            ),
            AgentDefinition(
                name="security-auditor",
                description="安全审计专家:OWASP Top 10/CWE 检测,熟悉 RCE/SSRF/SQL注入/XSS 等漏洞模式",
                system_prompt=(
                    "你是安全审计专家。精通 OWASP Top 10 / CWE 检测。"
                    "重点检查:RCE(new Function/eval)、SSRF(localhost/内网 IP)、"
                    "SQL 注入、XSS、硬编码密钥、路径穿越、不安全的反序列化。"
                    "输出按严重程度分级(critical/high/medium/low)+ 具体修复建议。"
                ),
                tools=[
                    "read_file", "search_codebase", "file_search",
                    "analyze_code", "git_operations",
                ],
                metadata={"category": "security"},
            ),
            AgentDefinition(
                name="test-engineer",
                description="测试工程师:Vitest/pytest/Playwright,熟悉单元/集成/E2E 测试设计",
                system_prompt=(
                    "你是测试工程师。精通 Vitest / pytest / Playwright。"
                    "遵循项目 AGENTS.md 的测试规范:覆盖默认态/hover 态/active 态/dark mode 态 4 状态。"
                    "优先 TDD,测试名用中文描述清晰场景。"
                ),
                tools=[
                    "read_file", "write_file", "search_codebase", "file_search",
                    "analyze_code", "run_command", "generate_test",
                ],
                metadata={"category": "test"},
            ),
        ]
        for a in defaults:
            self._agents[a.name] = a

    def register(self, agent: AgentDefinition) -> bool:
        """注册或覆盖 agent。返回是否成功。"""
        if not agent.name or not isinstance(agent.name, str):
            return False
        self._agents[agent.name] = agent
        return True

    def get(self, name: str) -> AgentDefinition | None:
        return self._agents.get(name)

    def list_agents(self) -> list[AgentDefinition]:
        return list(self._agents.values())

    def names(self) -> list[str]:
        return list(self._agents.keys())

    def remove(self, name: str) -> bool:
        return self._agents.pop(name, None) is not None


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


class AgentOrchestrator:
    """多智能体编排器。"""

    def __init__(self, registry: AgentRegistry | None = None) -> None:
        self._registry = registry or AgentRegistry()

    @property
    def registry(self) -> AgentRegistry:
        return self._registry

    # =========================================================================
    # Single agent invoke
    # =========================================================================

    async def invoke(
        self,
        agent_name: str,
        user_input: str,
        session_id: str | None = None,
        model_override: str | None = None,
    ) -> AgentStepResult:
        """调用单个 agent 执行任务。"""
        start = time.monotonic()
        agent = self._registry.get(agent_name)
        if not agent:
            return AgentStepResult(
                agent_name=agent_name,
                input=user_input,
                output="",
                status="failed",
                duration_ms=round((time.monotonic() - start) * 1000, 2),
                error=f"Agent 不存在: {agent_name}",
            )
        return await self._run_agent(agent, user_input, session_id, model_override)

    # =========================================================================
    # Pipeline(串行)
    # =========================================================================

    async def run_pipeline(
        self,
        steps: list[dict[str, Any]],
        initial_input: str,
        session_id: str | None = None,
    ) -> OrchestrationResult:
        """执行串行 pipeline。

        Args:
            steps: 每步 {agent, input_template},input_template 含 {input} / {prev_output} 占位符。
            initial_input: 初始输入。
            session_id: 共享 session id。

        Returns:
            OrchestrationResult 含每步结果 + final_output。
        """
        start = time.monotonic()
        orchestration_id = f"orch-{uuid.uuid4().hex[:8]}"
        trace: list[dict[str, Any]] = []
        step_results: list[AgentStepResult] = []
        current_input = initial_input
        sid = session_id or f"{orchestration_id}-session"
        final_output = ""
        status = "completed"

        for i, step in enumerate(steps):
            if not isinstance(step, dict):
                continue
            agent_name = str(step.get("agent", ""))
            template = str(step.get("input_template", "{input}"))
            try:
                step_input = template.format(
                    input=current_input,
                    prev_output=final_output,
                    step=i + 1,
                )
            except (KeyError, IndexError):
                step_input = current_input
            t0 = time.monotonic()
            try:
                result = await self.invoke(agent_name, step_input, session_id=sid)
            except Exception as e:
                result = AgentStepResult(
                    agent_name=agent_name,
                    input=step_input,
                    output="",
                    status="failed",
                    duration_ms=round((time.monotonic() - t0) * 1000, 2),
                    error=str(e),
                )
            step_results.append(result)
            trace.append({
                "step": i + 1,
                "agent": agent_name,
                "duration_ms": result.duration_ms,
                "status": result.status,
            })
            if result.status == "failed":
                status = "failed"
                break
            final_output = result.output
            current_input = final_output

        return OrchestrationResult(
            orchestration_id=orchestration_id,
            steps=step_results,
            final_output=final_output,
            status=status,
            total_duration_ms=round((time.monotonic() - start) * 1000, 2),
            trace=trace,
        )

    # =========================================================================
    # Parallel(并行)
    # =========================================================================

    async def run_parallel(
        self,
        agent_inputs: list[dict[str, Any]],
        session_id: str | None = None,
    ) -> OrchestrationResult:
        """并行调用多个 agent。

        Args:
            agent_inputs: 每项 {agent, input}。
            session_id: 共享 session id。

        Returns:
            OrchestrationResult 含每步结果,final_output = 所有 output 拼接。
        """
        start = time.monotonic()
        orchestration_id = f"orch-{uuid.uuid4().hex[:8]}"
        sid = session_id or f"{orchestration_id}-session"

        async def _one(idx: int, item: dict[str, Any]) -> AgentStepResult:
            agent_name = str(item.get("agent", ""))
            user_input = str(item.get("input", ""))
            t0 = time.monotonic()
            try:
                r = await self.invoke(agent_name, user_input, session_id=sid)
                if r.duration_ms == 0.0:
                    r.duration_ms = round((time.monotonic() - t0) * 1000, 2)
                return r
            except Exception as e:
                return AgentStepResult(
                    agent_name=agent_name,
                    input=user_input,
                    output="",
                    status="failed",
                    duration_ms=round((time.monotonic() - t0) * 1000, 2),
                    error=str(e),
                )

        results = await asyncio.gather(
            *[_one(i, item) for i, item in enumerate(agent_inputs)]
        )
        # 拼接 output
        joined = "\n\n---\n\n".join(
            f"[{r.agent_name}]: {r.output}" for r in results if r.status == "completed"
        )
        any_failed = any(r.status == "failed" for r in results)
        return OrchestrationResult(
            orchestration_id=orchestration_id,
            steps=list(results),
            final_output=joined,
            status="failed" if any_failed else "completed",
            total_duration_ms=round((time.monotonic() - start) * 1000, 2),
            trace=[
                {
                    "step": i + 1,
                    "agent": r.agent_name,
                    "duration_ms": r.duration_ms,
                    "status": r.status,
                }
                for i, r in enumerate(results)
            ],
        )

    # =========================================================================
    # Debate(辩论:多 Agent 多轮交替发言,P1-2)
    # =========================================================================

    async def run_debate(
        self,
        agents: list[str],
        topic: str,
        max_rounds: int = 3,
        session_id: str | None = None,
        model_override: str | None = None,
    ) -> OrchestrationResult:
        """辩论模式:多 Agent 多轮交替发言,每轮给出立场(agree/disagree/neutral)。

        流程:
        1. 第 1 轮:每个 Agent 基于主题给出初始观点 + 立场
        2. 第 2+ 轮:每个 Agent 看到其他 Agent 上一轮发言后,给出回应 + 可能更新立场
        3. 最后一轮后,LLM 综合所有发言生成最终结论
        """
        import re as _re

        start = time.monotonic()
        orchestration_id = f"orch-{uuid.uuid4().hex[:8]}"
        sid = session_id or f"{orchestration_id}-session"
        trace: list[dict[str, Any]] = []
        step_results: list[AgentStepResult] = []
        status = "completed"

        if len(agents) < 2:
            return OrchestrationResult(
                orchestration_id=orchestration_id,
                steps=[],
                final_output="",
                status="failed",
                total_duration_ms=round((time.monotonic() - start) * 1000, 2),
                trace=[{"error": "至少需要 2 个 Agent"}],
            )

        # 每轮每个 Agent 的发言记录:[{agent, output, stance, status}]
        rounds_history: list[list[dict[str, Any]]] = []

        for round_idx in range(max_rounds):
            round_records: list[dict[str, Any]] = []
            prev_round = rounds_history[-1] if rounds_history else []
            prev_text = ""
            if prev_round:
                prev_text = "前序发言:\n" + "\n".join(
                    f"[{r['agent']}](立场:{r.get('stance', 'unknown')}): "
                    f"{r.get('output', '')[:500]}"
                    for r in prev_round
                ) + "\n\n"

            for agent_name in agents:
                agent = self._registry.get(agent_name)
                if not agent:
                    step_results.append(AgentStepResult(
                        agent_name=agent_name, input="", output="",
                        status="failed", error=f"Agent 不存在: {agent_name}",
                    ))
                    trace.append({
                        "round": round_idx + 1, "agent": agent_name,
                        "status": "failed", "error": "agent_not_found",
                    })
                    round_records.append({
                        "agent": agent_name, "output": "",
                        "stance": "unknown", "status": "failed",
                    })
                    continue

                if round_idx == 0:
                    user_input = (
                        f"辩论主题:{topic}\n\n"
                        "请给出你的初始观点,并在末尾用一行声明立场(agree/disagree/neutral)。"
                    )
                else:
                    user_input = (
                        f"{prev_text}辩论主题:{topic}\n\n"
                        f"这是第 {round_idx + 1} 轮,请基于以上发言回应,"
                        "可在末尾更新立场(agree/disagree/neutral)。"
                    )

                t0 = time.monotonic()
                try:
                    result = await self._run_agent(agent, user_input, sid, model_override)
                except Exception as e:
                    result = AgentStepResult(
                        agent_name=agent_name, input=user_input, output="",
                        status="failed",
                        duration_ms=round((time.monotonic() - t0) * 1000, 2),
                        error=str(e),
                    )

                # 解析立场(取 output 中首个 agree/disagree/neutral 词)
                stance = "neutral"
                m = _re.search(r"\b(agree|disagree|neutral)\b", (result.output or "").lower())
                if m:
                    stance = m.group(1)

                step_results.append(result)
                trace.append({
                    "round": round_idx + 1, "agent": agent_name,
                    "duration_ms": result.duration_ms, "status": result.status,
                    "stance": stance,
                })
                round_records.append({
                    "agent": agent_name, "output": result.output,
                    "stance": stance, "status": result.status,
                })
                if result.status == "failed":
                    status = "failed"

            rounds_history.append(round_records)

        # 最终综合:LLM 汇总所有发言
        all_speeches = "\n\n".join(
            f"=== 第 {i + 1} 轮 ===\n" + "\n".join(
                f"[{r['agent']}](立场:{r.get('stance', 'unknown')}): "
                f"{r.get('output', '')[:800]}"
                for r in round_recs
            )
            for i, round_recs in enumerate(rounds_history)
        )
        summary_input = (
            f"以下是关于主题「{topic}」的多轮辩论记录:\n\n{all_speeches}\n\n"
            "请综合各方观点,生成最终结论(含主流立场 + 关键分歧 + 综合判断)。"
        )
        try:
            summary_result = await llm_gateway.complete(
                [{"role": "user", "content": summary_input}],
                model=model_override,
            )
            final_output = str(summary_result.get("content", "") or "")
        except Exception as e:
            final_output = f"[综合结论生成失败: {e}]\n\n" + all_speeches[:2000]

        return OrchestrationResult(
            orchestration_id=orchestration_id,
            steps=step_results,
            final_output=final_output,
            status=status,
            total_duration_ms=round((time.monotonic() - start) * 1000, 2),
            trace=trace,
        )

    # =========================================================================
    # Vote(投票:每个 Agent 出方案,然后投票,P1-2)
    # =========================================================================

    async def run_vote(
        self,
        agents: list[str],
        topic: str,
        session_id: str | None = None,
        model_override: str | None = None,
    ) -> OrchestrationResult:
        """投票模式:每个 Agent 独立出方案,然后所有 Agent 对每个方案投票。

        流程:
        1. 第 1 阶段:每个 Agent 独立生成方案(parallel)
        2. 第 2 阶段:每个 Agent 对所有方案(含自己)投票(每个 Agent 1 票,可投自己)
        3. 统计票数,票数最高的方案为最终结论
        4. OrchestrationResult.final_output 含获胜方案 + 票数
        5. trace 最后一项加 votes 字段(OrchestrationResult 无 votes 字段)
        """
        import re as _re

        start = time.monotonic()
        orchestration_id = f"orch-{uuid.uuid4().hex[:8]}"
        sid = session_id or f"{orchestration_id}-session"
        trace: list[dict[str, Any]] = []
        step_results: list[AgentStepResult] = []
        status = "completed"

        if len(agents) < 2:
            return OrchestrationResult(
                orchestration_id=orchestration_id,
                steps=[],
                final_output="",
                status="failed",
                total_duration_ms=round((time.monotonic() - start) * 1000, 2),
                trace=[{"error": "至少需要 2 个 Agent"}],
            )

        # 第 1 阶段:并行生成方案
        async def _gen(idx: int, agent_name: str) -> tuple[int, str, AgentStepResult]:
            agent = self._registry.get(agent_name)
            if not agent:
                r = AgentStepResult(
                    agent_name=agent_name, input="", output="",
                    status="failed", error=f"Agent 不存在: {agent_name}",
                )
                return idx, agent_name, r
            user_input = f"主题:{topic}\n\n请提出你的方案(含核心思路 + 关键步骤)。"
            t0 = time.monotonic()
            try:
                r = await self._run_agent(agent, user_input, sid, model_override)
            except Exception as e:
                r = AgentStepResult(
                    agent_name=agent_name, input=user_input, output="",
                    status="failed",
                    duration_ms=round((time.monotonic() - t0) * 1000, 2),
                    error=str(e),
                )
            return idx, agent_name, r

        gen_results = await asyncio.gather(
            *[_gen(i, n) for i, n in enumerate(agents)]
        )
        proposals: list[dict[str, Any]] = []
        for idx, agent_name, r in gen_results:
            step_results.append(r)
            trace.append({
                "phase": "propose", "agent": agent_name,
                "duration_ms": r.duration_ms, "status": r.status,
            })
            if r.status == "completed":
                proposals.append({"idx": idx, "agent": agent_name, "output": r.output})
            else:
                status = "failed"

        if not proposals:
            return OrchestrationResult(
                orchestration_id=orchestration_id,
                steps=step_results,
                final_output="[所有 Agent 方案生成失败]",
                status="failed",
                total_duration_ms=round((time.monotonic() - start) * 1000, 2),
                trace=trace,
            )

        # 第 2 阶段:每个 Agent 投票
        proposals_text = "\n".join(
            f"[方案{i + 1} - {p['agent']}]: {p['output'][:600]}"
            for i, p in enumerate(proposals)
        )
        n_proposals = len(proposals)

        async def _vote(voter_name: str) -> tuple[str, int]:
            agent = self._registry.get(voter_name)
            if not agent:
                return voter_name, -1
            user_input = (
                f"主题:{topic}\n\n以下是 {n_proposals} 个方案:\n{proposals_text}\n\n"
                f"请投票选出最佳方案,只回复方案编号(1-{n_proposals})。"
            )
            try:
                r = await self._run_agent(agent, user_input, sid, model_override)
            except Exception:
                return voter_name, -1
            nums = _re.findall(r"\d+", r.output or "")
            if not nums:
                return voter_name, 1  # 解析失败默认投 1
            vote = int(nums[0])
            if vote < 1 or vote > n_proposals:
                vote = 1  # 越界默认投 1
            return voter_name, vote

        vote_results = await asyncio.gather(*[_vote(n) for n in agents])
        votes_count: dict[int, int] = {i + 1: 0 for i in range(n_proposals)}
        votes_detail: list[dict[str, Any]] = []
        for voter, vote in vote_results:
            if vote >= 1:
                votes_count[vote] += 1
            votes_detail.append({"voter": voter, "vote": vote})
            trace.append({
                "phase": "vote", "agent": voter, "vote": vote,
                "status": "completed" if vote >= 1 else "failed",
            })

        # 获胜方案(票数最高,平票取编号最小)
        winner_idx = min(
            range(1, n_proposals + 1),
            key=lambda i: (-votes_count[i], i),
        )
        winner = proposals[winner_idx - 1]

        trace.append({
            "phase": "tally",
            "votes": votes_count,
            "votes_detail": votes_detail,
            "winner_idx": winner_idx,
            "winner_agent": winner["agent"],
        })

        final_output = (
            f"获胜方案(方案{winner_idx} - {winner['agent']},"
            f"得票 {votes_count[winner_idx]}/{len(agents)}):\n\n"
            f"{winner['output']}\n\n投票明细:{votes_count}"
        )

        return OrchestrationResult(
            orchestration_id=orchestration_id,
            steps=step_results,
            final_output=final_output,
            status=status,
            total_duration_ms=round((time.monotonic() - start) * 1000, 2),
            trace=trace,
        )

    # =========================================================================
    # Critique(批判:出方案 + 挑刺 + 改进,P1-2)
    # =========================================================================

    async def run_critique(
        self,
        agents: list[str],
        topic: str,
        max_rounds: int = 2,
        session_id: str | None = None,
        model_override: str | None = None,
    ) -> OrchestrationResult:
        """批判模式:第一个 Agent 出方案,其余 Agent 挑刺,出方案者迭代改进。

        流程:
        1. agents[0] 出初始方案
        2. agents[1:] 每个 Agent 提出批判意见(并行)
        3. agents[0] 基于批判意见改进方案(迭代 max_rounds 轮)
        4. 最终输出改进后的方案
        """
        start = time.monotonic()
        orchestration_id = f"orch-{uuid.uuid4().hex[:8]}"
        sid = session_id or f"{orchestration_id}-session"
        trace: list[dict[str, Any]] = []
        step_results: list[AgentStepResult] = []
        status = "completed"

        if len(agents) < 2:
            return OrchestrationResult(
                orchestration_id=orchestration_id,
                steps=[],
                final_output="",
                status="failed",
                total_duration_ms=round((time.monotonic() - start) * 1000, 2),
                trace=[{"error": "至少需要 2 个 Agent"}],
            )

        proposer_name = agents[0]
        critic_names = agents[1:]
        proposer = self._registry.get(proposer_name)

        if not proposer:
            return OrchestrationResult(
                orchestration_id=orchestration_id,
                steps=[],
                final_output=f"出方案 Agent 不存在: {proposer_name}",
                status="failed",
                total_duration_ms=round((time.monotonic() - start) * 1000, 2),
                trace=[{"error": f"proposer_not_found: {proposer_name}"}],
            )

        # 第 1 轮:出方案者给初始方案
        t0 = time.monotonic()
        try:
            r0 = await self._run_agent(
                proposer,
                f"主题:{topic}\n\n请提出你的方案(含核心思路 + 关键步骤 + 预期效果)。",
                sid, model_override,
            )
        except Exception as e:
            r0 = AgentStepResult(
                agent_name=proposer_name, input="", output="",
                status="failed",
                duration_ms=round((time.monotonic() - t0) * 1000, 2),
                error=str(e),
            )
        step_results.append(r0)
        trace.append({
            "round": 1, "phase": "propose", "agent": proposer_name,
            "duration_ms": r0.duration_ms, "status": r0.status,
        })
        current_proposal = r0.output if r0.status == "completed" else ""
        if r0.status == "failed":
            status = "failed"

        # 迭代 max_rounds 轮:批判 + 改进
        for round_idx in range(max_rounds):
            # 批判阶段(并行)
            async def _critique(critic_name: str) -> AgentStepResult:
                agent = self._registry.get(critic_name)
                if not agent:
                    return AgentStepResult(
                        agent_name=critic_name, input="", output="",
                        status="failed", error=f"Agent 不存在: {critic_name}",
                    )
                user_input = (
                    f"主题:{topic}\n\n以下是当前方案:\n{current_proposal}\n\n"
                    "请挑出该方案的问题/风险/可改进点(列出 3-5 条具体批判)。"
                )
                t0c = time.monotonic()
                try:
                    return await self._run_agent(agent, user_input, sid, model_override)
                except Exception as e:
                    return AgentStepResult(
                        agent_name=critic_name, input=user_input, output="",
                        status="failed",
                        duration_ms=round((time.monotonic() - t0c) * 1000, 2),
                        error=str(e),
                    )

            crit_results = await asyncio.gather(
                *[_critique(n) for n in critic_names]
            )
            critiques_text = ""
            for cr in crit_results:
                step_results.append(cr)
                trace.append({
                    "round": round_idx + 1, "phase": "critique",
                    "agent": cr.agent_name,
                    "duration_ms": cr.duration_ms, "status": cr.status,
                })
                if cr.status == "completed":
                    critiques_text += f"[{cr.agent_name}]: {cr.output[:600]}\n\n"
                else:
                    status = "failed"

            if not critiques_text.strip():
                break  # 无批判意见,提前结束

            # 改进阶段
            t0p = time.monotonic()
            try:
                rp = await self._run_agent(
                    proposer,
                    f"主题:{topic}\n\n当前方案:\n{current_proposal}\n\n"
                    f"批判意见:\n{critiques_text}\n\n"
                    "请基于以上批判改进方案,输出改进后的完整方案。",
                    sid, model_override,
                )
            except Exception as e:
                rp = AgentStepResult(
                    agent_name=proposer_name, input="", output="",
                    status="failed",
                    duration_ms=round((time.monotonic() - t0p) * 1000, 2),
                    error=str(e),
                )
            step_results.append(rp)
            trace.append({
                "round": round_idx + 1, "phase": "revise",
                "agent": proposer_name,
                "duration_ms": rp.duration_ms, "status": rp.status,
            })
            if rp.status == "completed" and rp.output:
                current_proposal = rp.output
            else:
                status = "failed"

        return OrchestrationResult(
            orchestration_id=orchestration_id,
            steps=step_results,
            final_output=current_proposal,
            status=status,
            total_duration_ms=round((time.monotonic() - start) * 1000, 2),
            trace=trace,
        )

    # =========================================================================
    # Decomposed(任务自动分解 + 调度 + 重试/故障转移,P3-3)
    # =========================================================================

    async def run_decomposed(
        self,
        task: str,
        strategy: str = "dag",
        session_id: str | None = None,
    ) -> OrchestrationResult:
        """分解式执行:任务分解 → 调度 → 按并行批次执行 → 重试/故障转移 → 汇总。

        流程:
        1. TaskDecomposer.decompose 分解任务为子任务(含拓扑排序 + 并行批次)
        2. TaskScheduler.schedule 按能力匹配分配 agent
        3. 按并行批次执行(同批 asyncio.gather,批次间串行)
        4. 每个子任务调 execute_with_retry,失败时调 execute_with_failover
        5. 通过 AgentMessageBus + AgentBlackboard 共享中间结果
        6. 汇总所有子任务结果
        """
        # 懒导入避免循环依赖(scheduler 导入本模块的 AgentDefinition/AgentStepResult)
        from .task_decomposer import task_decomposer, TaskDecompositionRequest
        from .scheduler import TaskScheduler, RetryPolicy, FailoverConfig
        from .agent_comm import agent_message_bus, agent_blackboard, BlackboardEntry

        start = time.monotonic()
        orchestration_id = f"orch-{uuid.uuid4().hex[:8]}"
        sid = session_id or f"{orchestration_id}-session"
        trace: list[dict[str, Any]] = []
        step_results: list[AgentStepResult] = []
        status = "completed"

        # 1. 构建可用 agent 列表(注册表转 decomposer 格式)
        all_agents = self._registry.list_agents()
        available_agents_info = [
            {
                "name": a.name,
                "capabilities": a.tools + (
                    [str(a.metadata.get("category"))]
                    if a.metadata.get("category") else []
                ),
            }
            for a in all_agents
        ]

        # 注册所有 agent 到消息总线
        for a in all_agents:
            agent_message_bus.register(a.name)

        # 2. 分解任务
        decomp_request = TaskDecompositionRequest(
            task=task,
            availableAgents=available_agents_info,
            strategy=strategy,  # type: ignore[arg-type]
            maxSubTasks=10,
        )
        try:
            decomp_result = await task_decomposer.decompose(decomp_request)
        except Exception as e:
            return OrchestrationResult(
                orchestration_id=orchestration_id,
                steps=[],
                final_output=f"任务分解失败: {e}",
                status="failed",
                total_duration_ms=round((time.monotonic() - start) * 1000, 2),
                trace=[{"error": str(e)}],
            )

        trace.append({
            "phase": "decompose",
            "strategy": strategy,
            "sub_task_count": len(decomp_result.subTasks),
            "execution_order": decomp_result.executionOrder,
            "parallel_batches": decomp_result.parallelBatches,
        })

        if not decomp_result.subTasks:
            return OrchestrationResult(
                orchestration_id=orchestration_id,
                steps=[],
                final_output="任务分解未产生子任务",
                status="failed",
                total_duration_ms=round((time.monotonic() - start) * 1000, 2),
                trace=trace,
            )

        # 3. 调度(能力匹配)
        local_scheduler = TaskScheduler(
            executor=self._make_executor(sid)
        )
        sched_result = await local_scheduler.schedule(
            decomp_result.subTasks, all_agents, strategy="capability_match"
        )
        trace.append({
            "phase": "schedule",
            "decisions": [
                {
                    "subTaskId": d.subTaskId,
                    "agent": d.assignedAgent,
                    "score": d.matchScore,
                    "reason": d.reason,
                }
                for d in sched_result.decisions
            ],
            "concurrency": sched_result.concurrency,
            "estimated_duration_s": sched_result.estimatedTotalDurationSeconds,
        })

        # 构建 subTaskId → assignedAgent 映射
        subtask_map = {st.id: st for st in decomp_result.subTasks}
        decision_map = {d.subTaskId: d for d in sched_result.decisions}

        # 4. 按并行批次执行
        for batch_idx, batch in enumerate(decomp_result.parallelBatches):
            trace.append({
                "phase": "execute_batch",
                "batch": batch_idx + 1,
                "sub_tasks": batch,
            })

            async def _exec_one(sub_task_id: str) -> AgentStepResult:
                st = subtask_map[sub_task_id]
                decision = decision_map.get(sub_task_id)
                agent_name = decision.assignedAgent if decision else st.recommendedAgentType
                agent = self._registry.get(agent_name)
                if agent is None:
                    return AgentStepResult(
                        agent_name=agent_name,
                        input=st.description,
                        output="",
                        status="failed",
                        error=f"agent 不存在: {agent_name}",
                    )

                # 重试策略
                retry_policy = RetryPolicy(
                    maxRetries=st.maxRetries if st.retryable else 0,
                    backoff="exponential",
                    initialDelayMs=1000,
                    maxDelayMs=10000,
                    retryableErrors=["timeout", "rate_limited", "overloaded", "network", "unknown"],
                )

                result = await local_scheduler.execute_with_retry(
                    st, agent, retry_policy, session_id=sid
                )

                # 失败且有其他可用 agent → 故障转移
                if result.status == "failed" and len(all_agents) > 1:
                    fallback_agents = [a for a in all_agents if a.name != agent_name]
                    failover_config = FailoverConfig(
                        primary=agent_name,
                        fallbacks=[a.name for a in fallback_agents],
                        triggerOn=["failure"],
                    )
                    result = await local_scheduler.execute_with_failover(
                        st, all_agents, failover_config, session_id=sid
                    )

                # 写入黑板(共享中间结果)
                if result.status == "completed" and result.output:
                    await agent_blackboard.write(BlackboardEntry(
                        id=f"bb-{uuid.uuid4().hex[:8]}",
                        key=f"result:{sub_task_id}",
                        value=result.output[:4000],
                        writtenBy=agent.name,
                        subTaskId=sub_task_id,
                    ))

                # 广播完成通知
                await agent_message_bus.broadcast(
                    from_agent=agent.name,
                    content=f"子任务 {sub_task_id} 完成(状态:{result.status})",
                    sub_task_id=sub_task_id,
                )
                return result

            batch_results = await asyncio.gather(
                *[_exec_one(sid_) for sid_ in batch]
            )
            step_results.extend(batch_results)
            if any(r.status == "failed" for r in batch_results):
                status = "failed"

        # 5. 汇总
        final_output = "\n\n---\n\n".join(
            f"[{r.agent_name}]: {r.output}"
            for r in step_results if r.status == "completed" and r.output
        ) or "[所有子任务执行失败]"

        return OrchestrationResult(
            orchestration_id=orchestration_id,
            steps=step_results,
            final_output=final_output,
            status=status,
            total_duration_ms=round((time.monotonic() - start) * 1000, 2),
            trace=trace,
        )

    # =========================================================================
    # With Communication(多 agent 协作 + 消息总线 + 共享黑板,P3-3)
    # =========================================================================

    async def run_with_communication(
        self,
        agents: list[str],
        task: str,
        session_id: str | None = None,
        model_override: str | None = None,
    ) -> OrchestrationResult:
        """多 agent 协作模式:通过消息总线通信 + 共享黑板记录中间结果。

        流程:
        1. 注册所有 agent 到消息总线
        2. 第一个 agent 处理任务主体,结果写入黑板
        3. 后续 agent 读取黑板 + 请求其他 agent 协助(通过 message bus)
        4. 每个 agent 可广播进度 / 请求-回复
        5. 汇总所有 agent 输出
        """
        from .agent_comm import (
            agent_message_bus, agent_blackboard, BlackboardEntry, AgentMessage,
        )

        start = time.monotonic()
        orchestration_id = f"orch-{uuid.uuid4().hex[:8]}"
        sid = session_id or f"{orchestration_id}-session"
        trace: list[dict[str, Any]] = []
        step_results: list[AgentStepResult] = []
        status = "completed"

        if not agents:
            return OrchestrationResult(
                orchestration_id=orchestration_id,
                steps=[],
                final_output="",
                status="failed",
                total_duration_ms=round((time.monotonic() - start) * 1000, 2),
                trace=[{"error": "agents 列表为空"}],
            )

        # 1. 注册 agent 到消息总线
        for name in agents:
            agent_message_bus.register(name)

        # 2. 写入初始任务到黑板
        await agent_blackboard.write(BlackboardEntry(
            id=f"bb-{uuid.uuid4().hex[:8]}",
            key="task",
            value=task,
            writtenBy="orchestrator",
        ))

        # 3. 每个 agent 依次处理(可读黑板 + 请求协助)
        for idx, agent_name in enumerate(agents):
            agent = self._registry.get(agent_name)
            if not agent:
                step_results.append(AgentStepResult(
                    agent_name=agent_name, input="", output="",
                    status="failed", error=f"Agent 不存在: {agent_name}",
                ))
                trace.append({
                    "agent": agent_name, "status": "failed",
                    "error": "agent_not_found",
                })
                status = "failed"
                continue

            # 读取黑板上的前序结果
            prev_entry = await agent_blackboard.read("task", agent_name)
            prev_results: list[BlackboardEntry] = await agent_blackboard.list_entries()
            context_text = ""
            for entry in prev_results:
                if entry.key == "task":
                    continue
                context_text += f"[{entry.writtenBy} 的 {entry.key}]: {entry.value[:500]}\n\n"

            # 构建 agent 输入:任务 + 前序 agent 的黑板结果
            if context_text:
                user_input = (
                    f"任务:{task}\n\n"
                    f"前序 agent 的产出:\n{context_text}\n"
                    f"请基于以上上下文继续推进任务。如需其他 agent 协助,可声明请求。"
                )
            else:
                user_input = f"任务:{task}\n\n请处理并给出你的产出。"

            t0 = time.monotonic()
            try:
                result = await self._run_agent(agent, user_input, sid, model_override)
            except Exception as e:
                result = AgentStepResult(
                    agent_name=agent_name, input=user_input, output="",
                    status="failed",
                    duration_ms=round((time.monotonic() - t0) * 1000, 2),
                    error=str(e),
                )

            step_results.append(result)
            trace.append({
                "agent": agent_name,
                "duration_ms": result.duration_ms,
                "status": result.status,
            })
            if result.status == "failed":
                status = "failed"

            # 4. 结果写入黑板
            if result.status == "completed" and result.output:
                await agent_blackboard.write(BlackboardEntry(
                    id=f"bb-{uuid.uuid4().hex[:8]}",
                    key=f"output:{agent_name}",
                    value=result.output[:4000],
                    writtenBy=agent_name,
                ))

            # 5. 广播进度
            await agent_message_bus.broadcast(
                from_agent=agent_name,
                content=f"agent {agent_name} 完成处理(状态:{result.status})",
            )

            # 检查是否有待处理请求(非阻塞,5s 超时)
            pending = await agent_message_bus.receive(agent_name, timeout=0.1)
            if pending is not None and pending.requireReply:
                # 回复请求方
                await agent_message_bus.send(AgentMessage(
                    id=f"resp-{uuid.uuid4().hex[:8]}",
                    fromAgent=agent_name,
                    toAgent=pending.fromAgent,
                    type="response",
                    content=f"已收到请求:{pending.content[:200]}. 当前进度已完成。",
                    subTaskId=pending.id,
                ))

        # 汇总
        final_output = "\n\n---\n\n".join(
            f"[{r.agent_name}]: {r.output}"
            for r in step_results if r.status == "completed" and r.output
        ) or "[所有 agent 执行失败]"

        return OrchestrationResult(
            orchestration_id=orchestration_id,
            steps=step_results,
            final_output=final_output,
            status=status,
            total_duration_ms=round((time.monotonic() - start) * 1000, 2),
            trace=trace,
        )

    # =========================================================================
    # Parallel dispatch(并行派发多个 subagent,带并发限制)
    # =========================================================================

    async def invoke_parallel(
        self,
        tasks: list[dict[str, Any]],
        max_concurrency: int = 5,
    ) -> dict[str, Any]:
        """并行派发多个 subagent,每个 task 独立执行,互不污染上下文。

        Args:
            tasks: [{"name": "agent-name", "task": "任务描述", "context": {...可选}}, ...]
            max_concurrency: 最大并发数(默认 5,防止资源耗尽)。

        Returns:
            成功时:
                {
                    "ok": True, "total": 3, "succeeded": 2, "failed": 1,
                    "results": [{"name","task","status","output","error","duration_ms"}, ...],
                    "message": "并行派发完成:2/3 成功",
                }
            tasks 为空时:
                {"ok": False, "errorCode": "EMPTY_TASKS", "message": "tasks 列表为空"}
        """
        if not tasks:
            return {
                "ok": False,
                "errorCode": "EMPTY_TASKS",
                "message": "tasks 列表为空",
            }

        semaphore = asyncio.Semaphore(max(1, max_concurrency))

        async def _run_one(task_spec: dict[str, Any]) -> dict[str, Any]:
            name = str(task_spec.get("name", ""))
            task_desc = str(task_spec.get("task", ""))
            context = task_spec.get("context") or {}
            t0 = time.monotonic()

            # 先检查 agent 是否存在(不占用 semaphore,失败不影响其他 task)
            if not self._registry.get(name):
                return {
                    "name": name,
                    "task": task_desc,
                    "status": "failed",
                    "output": "",
                    "error": f"Agent 不存在: {name}",
                    "duration_ms": round((time.monotonic() - t0) * 1000, 2),
                }

            async with semaphore:
                try:
                    session_id: str | None = None
                    if isinstance(context, dict):
                        sid = context.get("session_id")
                        if isinstance(sid, str):
                            session_id = sid
                    result = await self.invoke(name, task_desc, session_id=session_id)
                    return {
                        "name": name,
                        "task": task_desc,
                        "status": result.status,
                        "output": result.output,
                        "error": result.error,
                        "duration_ms": round((time.monotonic() - t0) * 1000, 2),
                    }
                except Exception as e:
                    return {
                        "name": name,
                        "task": task_desc,
                        "status": "failed",
                        "output": "",
                        "error": str(e),
                        "duration_ms": round((time.monotonic() - t0) * 1000, 2),
                    }

        results = await asyncio.gather(*[_run_one(t) for t in tasks])
        succeeded = sum(1 for r in results if r["status"] == "completed")
        failed = len(results) - succeeded
        return {
            "ok": True,
            "total": len(results),
            "succeeded": succeeded,
            "failed": failed,
            "results": list(results),
            "message": f"并行派发完成:{succeeded}/{len(results)} 成功",
        }

    def _make_executor(self, session_id: str) -> Any:
        """创建执行器闭包(注入 _run_agent 到 TaskScheduler)。"""
        async def _executor(agent: AgentDefinition, user_input: str, sid: str | None) -> AgentStepResult:
            return await self._run_agent(agent, user_input, sid or session_id, None)
        return _executor

    # =========================================================================
    # 私有:执行单个 agent
    # =========================================================================

    async def _run_agent(
        self,
        agent: AgentDefinition,
        user_input: str,
        session_id: str | None,
        model_override: str | None,
    ) -> AgentStepResult:
        """执行单个 agent(直接调 LLM + tools,不走 agent_loop 任务管理)。"""
        start = time.monotonic()
        sid = session_id or f"agent-{agent.name}-{int(datetime.utcnow().timestamp())}"
        used_model = model_override or agent.model
        stub = False
        tool_calls: list[dict[str, Any]] = []
        iterations = 0
        error: str | None = None

        try:
            await memory_store.add(sid, "user", user_input)
            history = await memory_store.get(sid, limit=20)
            messages: list[dict[str, Any]] = [
                {"role": "system", "content": agent.system_prompt},
            ]
            for m in history[:-1]:
                role = m.get("role")
                content = m.get("content", "")
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": content})
            messages.append({"role": "user", "content": user_input})

            # 准备 tools(只暴露 agent.tools 内的)
            tool_defs = self._filter_tools(agent.tools)

            output = ""
            for it in range(agent.max_iterations):
                iterations = it + 1
                kwargs: dict[str, Any] = {}
                if tool_defs:
                    kwargs["tools"] = tool_defs
                    kwargs["tool_choice"] = "auto"
                result = await llm_gateway.complete(
                    messages, model=used_model, **kwargs
                )
                used_model = str(result.get("model", used_model) or used_model)
                stub = stub or bool(result.get("stub", False))
                content = str(result.get("content", "") or "")
                tc_raw = result.get("tool_calls") or []
                if not tc_raw:
                    output = content
                    break
                messages.append({
                    "role": "assistant",
                    "content": content,
                    "tool_calls": tc_raw,
                })
                for tc in tc_raw:
                    if not isinstance(tc, dict):
                        continue
                    fn = tc.get("function") or {}
                    tool_name = fn.get("name", "")
                    raw_args = fn.get("arguments", "")
                    import json
                    if isinstance(raw_args, str):
                        try:
                            args = json.loads(raw_args) if raw_args.strip() else {}
                        except (json.JSONDecodeError, ValueError):
                            args = {"_raw": raw_args}
                    else:
                        args = raw_args or {}
                    exec_result = await mcp_server.call_tool(tool_name, args)
                    tool_calls.append({
                        "tool": tool_name,
                        "arguments": args,
                        "ok": bool(exec_result.get("ok")),
                    })
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id", ""),
                        "name": tool_name,
                        "content": str(exec_result)[:4000],
                    })
                if it == agent.max_iterations - 1:
                    # 最后一轮:让 LLM 总结
                    summary = await llm_gateway.complete(messages, model=used_model)
                    output = str(summary.get("content", "") or "")
                    stub = stub or bool(summary.get("stub", False))
                    break
            else:
                output = content

            try:
                await memory_store.add(sid, "assistant", output)
            except Exception as e:
                logger.warning("memory_store.add assistant 输出失败: %s", e)

            return AgentStepResult(
                agent_name=agent.name,
                input=user_input,
                output=output,
                status="completed",
                duration_ms=round((time.monotonic() - start) * 1000, 2),
                iterations=iterations,
                tool_calls=tool_calls,
                error=None,
            )
        except Exception as e:
            return AgentStepResult(
                agent_name=agent.name,
                input=user_input,
                output="",
                status="failed",
                duration_ms=round((time.monotonic() - start) * 1000, 2),
                iterations=iterations,
                tool_calls=tool_calls,
                error=str(e),
            )

    @staticmethod
    def _filter_tools(names: list[str]) -> list[dict[str, Any]]:
        """根据 name 列表返回 OpenAI tools 格式。"""
        if not names:
            return []
        available = {t.name: t for t in mcp_server.list_tools()}
        out: list[dict[str, Any]] = []
        for n in names:
            if n in available:
                t = available[n]
                out.append({
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.input_schema,
                    },
                })
        return out

    # =========================================================================
    # 序列化
    # =========================================================================

    @staticmethod
    def step_result_to_dict(r: AgentStepResult) -> dict[str, Any]:
        return {
            "agent_name": r.agent_name,
            "input": r.input,
            "output": r.output,
            "status": r.status,
            "duration_ms": r.duration_ms,
            "iterations": r.iterations,
            "tool_calls": r.tool_calls,
            "error": r.error,
        }

    @staticmethod
    def orchestration_to_dict(r: OrchestrationResult) -> dict[str, Any]:
        return {
            "orchestration_id": r.orchestration_id,
            "steps": [AgentOrchestrator.step_result_to_dict(s) for s in r.steps],
            "final_output": r.final_output,
            "status": r.status,
            "total_duration_ms": r.total_duration_ms,
            "trace": r.trace,
        }


agent_orchestrator = AgentOrchestrator()
