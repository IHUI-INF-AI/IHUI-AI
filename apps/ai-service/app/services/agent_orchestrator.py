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
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from ..core.llm_gateway import llm_gateway
from .agent_loop import agent_executor
from .memory import memory_store
from .mcp_server import mcp_server


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
        """注册 5 个默认 agent(对齐 persona_registry)。"""
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
            except Exception:
                pass

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
