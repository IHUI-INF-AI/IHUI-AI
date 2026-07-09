"""LangGraph 工作流服务。

完整实现:plan(规划) → execute(执行) → summarize(总结)
- 真正使用 langgraph.graph.StateGraph 构建图调度
- 条件边:plan 后判断是否需要执行,execute 后判断是否完成
- 错误处理:任何节点失败转到 error 节点
- LangGraph 不可用时降级为手动状态机
- 节点可观测性:trace 收集器记录每个节点的执行时间/状态/错误
"""

import asyncio
import json
import time
from datetime import datetime
from typing import Any, TypedDict

from ..core.config import settings
from ..core.llm_gateway import llm_gateway
from .memory import memory_store


class GraphState(TypedDict, total=False):
    """LangGraph 图状态(TypedDict)。"""

    goal: str
    session_id: str
    model: str | None
    plan: list[str]
    results: list[dict[str, Any]]
    summary: str
    error: str | None
    step_index: int
    iterations: int
    status: str
    trace: list[dict[str, Any]]


class WorkflowState:
    """工作流状态(手动降级模式用)。"""

    def __init__(self, goal: str, session_id: str, model: str | None = None):
        self.goal = goal
        self.session_id = session_id
        self.model = model
        self.plan: list[str] = []
        self.results: list[dict[str, Any]] = []
        self.summary: str = ""
        self.error: str | None = None
        self.step_index: int = 0
        self.iterations: int = 0
        self.max_iterations: int = settings.max_agent_iterations
        self.status: str = "planning"
        self.trace: list[dict[str, Any]] = []


def _trace_entry(
    node: str,
    start: float,
    end: float,
    status: str = "ok",
    error: str | None = None,
    **metadata: Any,
) -> dict[str, Any]:
    """构造单条 trace 记录。

    字段:
    - node: 节点名(plan/execute/summarize/error)
    - start: ISO8601 开始时间
    - end: ISO8601 结束时间
    - duration_ms: 耗时(毫秒)
    - status: ok / error
    - error: 错误信息(可选)
    - 其他元数据(如 step/plan_length/iterations)
    """
    entry: dict[str, Any] = {
        "node": node,
        "start": datetime.utcfromtimestamp(start).isoformat() + "Z",
        "end": datetime.utcfromtimestamp(end).isoformat() + "Z",
        "duration_ms": round((end - start) * 1000, 2),
        "status": status,
    }
    if error:
        entry["error"] = error
    for k, v in metadata.items():
        entry[k] = v
    return entry


class LangGraphService:
    """LangGraph 工作流服务。"""

    def __init__(self):
        self._graph = None
        self._available = False
        self._init_graph()

    def _init_graph(self):
        """尝试初始化 LangGraph 图,失败则降级。"""
        try:
            from langgraph.graph import StateGraph, END

            # 真正构建 StateGraph
            workflow = StateGraph(GraphState)

            # 添加节点
            workflow.add_node("plan", self._plan_node)
            workflow.add_node("execute", self._execute_node)
            workflow.add_node("summarize", self._summarize_node)
            workflow.add_node("error", self._error_node)

            # 设置入口
            workflow.set_entry_point("plan")

            # 条件边:plan 后判断是否需要执行
            workflow.add_conditional_edges(
                "plan",
                self._should_execute,
                {
                    "execute": "execute",
                    "summarize": "summarize",
                    "error": "error",
                },
            )

            # 条件边:execute 后判断是否完成
            workflow.add_conditional_edges(
                "execute",
                self._should_continue,
                {
                    "execute": "execute",
                    "summarize": "summarize",
                    "error": "error",
                },
            )

            # summarize 和 error 后结束
            workflow.add_edge("summarize", END)
            workflow.add_edge("error", END)

            # 编译图
            self._graph = workflow.compile()
            self._available = True
        except ImportError:
            self._available = False
        except Exception:
            # 图构建失败也降级
            self._available = False

    @property
    def available(self) -> bool:
        """LangGraph 是否可用。"""
        return self._available

    # =========================================================================
    # 图节点函数(接收并返回 GraphState,带 trace 计时)
    # =========================================================================

    async def _plan_node(self, state: GraphState) -> GraphState:
        """规划节点:LLM 分析任务,生成执行计划。"""
        start = time.monotonic()
        goal = state.get("goal", "")
        model = state.get("model")
        session_id = state.get("session_id", "")
        trace = list(state.get("trace", []))

        try:
            try:
                await memory_store.add(session_id, "user", goal)
            except Exception:
                pass

            messages = [
                {
                    "role": "system",
                    "content": "你是一个任务规划助手。分析用户的目标,分解为 1-5 个可执行步骤。用 JSON 数组返回,每个元素是一个步骤描述字符串。",
                },
                {
                    "role": "user",
                    "content": f"目标: {goal}\n\n请返回执行步骤(JSON 数组):",
                },
            ]

            result = await llm_gateway.complete(messages, model=model)
            content = result.get("content", "[]")

            try:
                import re

                json_match = re.search(r"\[.*\]", content, re.DOTALL)
                if json_match:
                    plan = json.loads(json_match.group())
                else:
                    plan = [f"执行: {goal}"]
            except (json.JSONDecodeError, AttributeError):
                plan = [f"执行: {goal}"]

            plan = plan[:5] if len(plan) > 5 else plan
            end = time.monotonic()
            trace.append(_trace_entry(
                "plan", start, end,
                plan_length=len(plan),
                stub=result.get("stub", False),
            ))
            return {
                **state,
                "plan": plan,
                "status": "executing",
                "step_index": 0,
                "iterations": 0,
                "trace": trace,
            }
        except Exception as e:
            end = time.monotonic()
            trace.append(_trace_entry(
                "plan", start, end, status="error", error=str(e),
            ))
            return {**state, "error": str(e), "trace": trace}

    async def _execute_node(self, state: GraphState) -> GraphState:
        """执行节点:执行当前步骤。"""
        start = time.monotonic()
        goal = state.get("goal", "")
        model = state.get("model")
        session_id = state.get("session_id", "")
        plan = state.get("plan", [])
        results = list(state.get("results", []))
        step_index = state.get("step_index", 0)
        iterations = state.get("iterations", 0) + 1
        trace = list(state.get("trace", []))

        max_iterations = settings.max_agent_iterations
        if iterations > max_iterations:
            end = time.monotonic()
            err_msg = f"超过最大迭代次数 {max_iterations}"
            trace.append(_trace_entry(
                "execute", start, end, status="error",
                error=err_msg, step=step_index + 1, iterations=iterations,
            ))
            return {
                **state,
                "error": err_msg,
                "iterations": iterations,
                "trace": trace,
            }

        try:
            history = await memory_store.get(session_id)
            messages = [{"role": m["role"], "content": m["content"]} for m in history]
            messages.append(
                {
                    "role": "system",
                    "content": (
                        "你正在执行以下计划:\n"
                        f"{json.dumps(plan, ensure_ascii=False)}\n"
                        f"当前步骤 {step_index + 1}/{len(plan)}"
                    ),
                }
            )

            step = plan[step_index] if step_index < len(plan) else goal
            messages.append({"role": "user", "content": f"步骤 {step_index + 1}: {step}"})
            result = await llm_gateway.complete(messages, model=model)
            content = result.get("content", "")

            results.append(
                {
                    "step": step_index + 1,
                    "plan": step,
                    "result": content,
                    "stub": result.get("stub", False),
                }
            )

            try:
                await memory_store.add(
                    session_id, "assistant", f"[步骤 {step_index + 1}] {content}"
                )
            except Exception:
                pass

            end = time.monotonic()
            trace.append(_trace_entry(
                "execute", start, end,
                step=step_index + 1,
                total_steps=len(plan),
                iterations=iterations,
                stub=result.get("stub", False),
            ))
            return {
                **state,
                "results": results,
                "step_index": step_index + 1,
                "iterations": iterations,
                "trace": trace,
            }
        except Exception as e:
            end = time.monotonic()
            trace.append(_trace_entry(
                "execute", start, end, status="error",
                error=str(e), step=step_index + 1, iterations=iterations,
            ))
            return {**state, "error": str(e), "trace": trace}

    async def _summarize_node(self, state: GraphState) -> GraphState:
        """总结节点:LLM 总结执行结果。"""
        start = time.monotonic()
        goal = state.get("goal", "")
        model = state.get("model")
        session_id = state.get("session_id", "")
        results = state.get("results", [])
        trace = list(state.get("trace", []))

        try:
            results_text = "\n".join(
                [
                    f"步骤 {r['step']}: {r['plan']}\n结果: {r['result']}"
                    for r in results
                ]
            )

            messages = [
                {
                    "role": "system",
                    "content": "你是总结助手。根据任务执行结果,生成简洁的总结。",
                },
                {
                    "role": "user",
                    "content": f"目标: {goal}\n\n执行结果:\n{results_text}\n\n请总结:",
                },
            ]

            result = await llm_gateway.complete(messages, model=model)
            summary = result.get("content", "")

            try:
                await memory_store.add(session_id, "assistant", f"[总结] {summary}")
            except Exception:
                pass

            end = time.monotonic()
            trace.append(_trace_entry(
                "summarize", start, end,
                results_count=len(results),
                summary_length=len(summary),
                stub=result.get("stub", False),
            ))
            return {**state, "summary": summary, "status": "completed", "trace": trace}
        except Exception as e:
            end = time.monotonic()
            trace.append(_trace_entry(
                "summarize", start, end, status="error", error=str(e),
            ))
            return {**state, "error": str(e), "trace": trace}

    async def _error_node(self, state: GraphState) -> GraphState:
        """错误节点:记录错误状态。"""
        start = time.monotonic()
        trace = list(state.get("trace", []))
        end = time.monotonic()
        trace.append(_trace_entry(
            "error", start, end,
            error=state.get("error", "unknown"),
        ))
        return {**state, "status": "failed", "trace": trace}

    # =========================================================================
    # 条件边函数
    # =========================================================================

    def _should_execute(self, state: GraphState) -> str:
        """plan 后判断是否需要执行。"""
        if state.get("error"):
            return "error"
        plan = state.get("plan", [])
        if not plan:
            return "summarize"
        return "execute"

    def _should_continue(self, state: GraphState) -> str:
        """execute 后判断是否继续执行或进入总结。"""
        if state.get("error"):
            return "error"
        plan = state.get("plan", [])
        step_index = state.get("step_index", 0)
        iterations = state.get("iterations", 0)
        max_iterations = settings.max_agent_iterations

        if iterations > max_iterations:
            return "error"

        if step_index < len(plan):
            return "execute"
        return "summarize"

    # =========================================================================
    # 公共 API
    # =========================================================================

    async def run_graph(
        self, goal: str, session_id: str | None = None, model: str | None = None
    ) -> dict[str, Any]:
        """运行完整工作流:plan → execute → summarize。"""
        session_id = session_id or f"session-{int(datetime.utcnow().timestamp())}"

        if self._available and self._graph:
            return await self._run_with_graph(goal, session_id, model)
        return await self._run_manual(goal, session_id, model)

    async def _run_with_graph(
        self, goal: str, session_id: str, model: str | None
    ) -> dict[str, Any]:
        """使用真正的 LangGraph 图执行。"""
        initial_state: GraphState = {
            "goal": goal,
            "session_id": session_id,
            "model": model,
            "plan": [],
            "results": [],
            "summary": "",
            "error": None,
            "step_index": 0,
            "iterations": 0,
            "status": "planning",
            "trace": [],
        }

        try:
            final_state = await self._graph.ainvoke(initial_state)
            return self._build_result_from_state(final_state)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            return {
                "status": "failed",
                "goal": goal,
                "session_id": session_id,
                "plan": [],
                "results": [],
                "summary": "",
                "error": str(e),
                "iterations": 0,
                "langgraph_available": True,
                "trace": [],
            }

    async def _run_manual(
        self, goal: str, session_id: str, model: str | None
    ) -> dict[str, Any]:
        """降级:手动状态机执行(LangGraph 不可用时)。"""
        state = WorkflowState(goal, session_id, model)

        try:
            await memory_store.add(session_id, "user", goal)

            state.status = "planning"
            await self._plan_manual(state)
            if state.error:
                state.status = "failed"
                return self._build_result(state)

            state.status = "executing"
            await self._execute_manual(state)
            if state.error:
                state.status = "failed"
                return self._build_result(state)

            state.status = "summarizing"
            await self._summarize_manual(state)

            state.status = "completed" if not state.error else "failed"
            return self._build_result(state)
        except asyncio.CancelledError:
            state.status = "canceled"
            raise
        except Exception as e:
            state.error = str(e)
            state.status = "failed"
            return self._build_result(state)

    async def run_graph_stream(
        self, goal: str, session_id: str | None = None, model: str | None = None
    ):
        """流式运行工作流,yield 每个节点的事件(含 trace)。"""
        session_id = session_id or f"session-{int(datetime.utcnow().timestamp())}"
        state = WorkflowState(goal, session_id, model)

        try:
            await memory_store.add(session_id, "user", goal)
            yield {"type": "message", "role": "user", "content": goal}
            yield {"type": "status", "status": "planning"}

            yield {"type": "thinking", "message": "正在规划执行步骤..."}
            start = time.monotonic()
            await self._plan_manual(state)
            end = time.monotonic()
            state.trace.append(_trace_entry(
                "plan", start, end, plan_length=len(state.plan),
            ))
            yield {"type": "plan", "steps": state.plan}
            yield {
                "type": "trace",
                "node": "plan",
                "duration_ms": round((end - start) * 1000, 2),
                "plan_length": len(state.plan),
            }

            if state.error:
                yield {"type": "error", "message": state.error}
                return

            yield {"type": "status", "status": "executing"}
            async for event in self._execute_stream_manual(state):
                yield event

            if state.error:
                yield {"type": "error", "message": state.error}
                return

            yield {"type": "status", "status": "summarizing"}
            yield {"type": "thinking", "message": "正在总结执行结果..."}
            start = time.monotonic()
            await self._summarize_manual(state)
            end = time.monotonic()
            state.trace.append(_trace_entry(
                "summarize", start, end,
                results_count=len(state.results),
                summary_length=len(state.summary),
            ))
            yield {"type": "summary", "content": state.summary}
            yield {
                "type": "trace",
                "node": "summarize",
                "duration_ms": round((end - start) * 1000, 2),
                "results_count": len(state.results),
            }

            yield {"type": "status", "status": "completed"}
            # 最终 trace 汇总事件
            yield {
                "type": "trace_summary",
                "trace": state.trace,
                "total_nodes": len(state.trace),
                "total_duration_ms": round(
                    sum(t.get("duration_ms", 0) for t in state.trace), 2
                ),
            }
        except asyncio.CancelledError:
            yield {"type": "status", "status": "canceled"}
            raise
        except Exception as e:
            yield {"type": "error", "message": str(e)}

    # =========================================================================
    # 手动降级模式节点实现(带 trace 计时)
    # =========================================================================

    async def _plan_manual(self, state: WorkflowState):
        """手动模式:规划节点。"""
        start = time.monotonic()
        try:
            messages = [
                {
                    "role": "system",
                    "content": "你是一个任务规划助手。分析用户的目标,分解为 1-5 个可执行步骤。用 JSON 数组返回,每个元素是一个步骤描述字符串。",
                },
                {
                    "role": "user",
                    "content": f"目标: {state.goal}\n\n请返回执行步骤(JSON 数组):",
                },
            ]

            result = await llm_gateway.complete(messages, model=state.model)
            content = result.get("content", "[]")

            try:
                import re

                json_match = re.search(r"\[.*\]", content, re.DOTALL)
                if json_match:
                    state.plan = json.loads(json_match.group())
                else:
                    state.plan = [f"执行: {state.goal}"]
            except (json.JSONDecodeError, AttributeError):
                state.plan = [f"执行: {state.goal}"]

            state.plan = state.plan[:5] if len(state.plan) > 5 else state.plan
            end = time.monotonic()
            state.trace.append(_trace_entry(
                "plan", start, end,
                plan_length=len(state.plan),
                stub=result.get("stub", False),
            ))
        except Exception as e:
            end = time.monotonic()
            state.trace.append(_trace_entry(
                "plan", start, end, status="error", error=str(e),
            ))
            raise

    async def _execute_manual(self, state: WorkflowState):
        """手动模式:执行节点。"""
        history = await memory_store.get(state.session_id)
        messages = [{"role": m["role"], "content": m["content"]} for m in history]
        messages.append(
            {
                "role": "system",
                "content": (
                    "你正在执行以下计划:\n"
                    f"{json.dumps(state.plan, ensure_ascii=False)}\n"
                    f"当前步骤 {state.step_index + 1}/{len(state.plan)}"
                ),
            }
        )

        for i, step in enumerate(state.plan):
            start = time.monotonic()
            state.step_index = i
            state.iterations += 1

            if state.iterations > state.max_iterations:
                state.error = f"超过最大迭代次数 {state.max_iterations}"
                end = time.monotonic()
                state.trace.append(_trace_entry(
                    "execute", start, end, status="error",
                    error=state.error, step=i + 1, iterations=state.iterations,
                ))
                return

            try:
                messages.append({"role": "user", "content": f"步骤 {i + 1}: {step}"})
                result = await llm_gateway.complete(messages, model=state.model)
                content = result.get("content", "")

                state.results.append(
                    {
                        "step": i + 1,
                        "plan": step,
                        "result": content,
                        "stub": result.get("stub", False),
                    }
                )

                messages.append({"role": "assistant", "content": content})
                await memory_store.add(
                    state.session_id, "assistant", f"[步骤 {i + 1}] {content}"
                )
                end = time.monotonic()
                state.trace.append(_trace_entry(
                    "execute", start, end,
                    step=i + 1,
                    total_steps=len(state.plan),
                    iterations=state.iterations,
                    stub=result.get("stub", False),
                ))
            except Exception as e:
                end = time.monotonic()
                state.trace.append(_trace_entry(
                    "execute", start, end, status="error",
                    error=str(e), step=i + 1, iterations=state.iterations,
                ))
                raise

    async def _execute_stream_manual(self, state: WorkflowState):
        """手动模式:执行节点的流式版本(带 trace)。"""
        history = await memory_store.get(state.session_id)
        messages = [{"role": m["role"], "content": m["content"]} for m in history]

        for i, step in enumerate(state.plan):
            start = time.monotonic()
            state.step_index = i
            state.iterations += 1

            if state.iterations > state.max_iterations:
                state.error = f"超过最大迭代次数 {state.max_iterations}"
                end = time.monotonic()
                state.trace.append(_trace_entry(
                    "execute", start, end, status="error",
                    error=state.error, step=i + 1, iterations=state.iterations,
                ))
                return

            yield {
                "type": "step_start",
                "step": i + 1,
                "total": len(state.plan),
                "plan": step,
            }

            try:
                messages.append({"role": "user", "content": f"步骤 {i + 1}: {step}"})
                result = await llm_gateway.complete(messages, model=state.model)
                content = result.get("content", "")

                state.results.append(
                    {
                        "step": i + 1,
                        "plan": step,
                        "result": content,
                        "stub": result.get("stub", False),
                    }
                )

                messages.append({"role": "assistant", "content": content})
                await memory_store.add(
                    state.session_id, "assistant", f"[步骤 {i + 1}] {content}"
                )

                end = time.monotonic()
                duration_ms = round((end - start) * 1000, 2)
                state.trace.append(_trace_entry(
                    "execute", start, end,
                    step=i + 1,
                    total_steps=len(state.plan),
                    iterations=state.iterations,
                    stub=result.get("stub", False),
                ))

                yield {
                    "type": "step_done",
                    "step": i + 1,
                    "result": content,
                    "stub": result.get("stub", False),
                }
                yield {
                    "type": "trace",
                    "node": "execute",
                    "step": i + 1,
                    "duration_ms": duration_ms,
                }
            except Exception as e:
                end = time.monotonic()
                state.trace.append(_trace_entry(
                    "execute", start, end, status="error",
                    error=str(e), step=i + 1, iterations=state.iterations,
                ))
                raise

    async def _summarize_manual(self, state: WorkflowState):
        """手动模式:总结节点。"""
        start = time.monotonic()
        try:
            results_text = "\n".join(
                [
                    f"步骤 {r['step']}: {r['plan']}\n结果: {r['result']}"
                    for r in state.results
                ]
            )

            messages = [
                {
                    "role": "system",
                    "content": "你是总结助手。根据任务执行结果,生成简洁的总结。",
                },
                {
                    "role": "user",
                    "content": f"目标: {state.goal}\n\n执行结果:\n{results_text}\n\n请总结:",
                },
            ]

            result = await llm_gateway.complete(messages, model=state.model)
            state.summary = result.get("content", "")
            await memory_store.add(state.session_id, "assistant", f"[总结] {state.summary}")
            end = time.monotonic()
            state.trace.append(_trace_entry(
                "summarize", start, end,
                results_count=len(state.results),
                summary_length=len(state.summary),
                stub=result.get("stub", False),
            ))
        except Exception as e:
            end = time.monotonic()
            state.trace.append(_trace_entry(
                "summarize", start, end, status="error", error=str(e),
            ))
            raise

    # =========================================================================
    # 结果构建
    # =========================================================================

    def _build_result(self, state: WorkflowState) -> dict[str, Any]:
        """从手动状态构建结果。"""
        return {
            "status": state.status,
            "goal": state.goal,
            "session_id": state.session_id,
            "plan": state.plan,
            "results": state.results,
            "summary": state.summary,
            "error": state.error,
            "iterations": state.iterations,
            "langgraph_available": self._available,
            "trace": state.trace,
            "trace_summary": {
                "total_nodes": len(state.trace),
                "total_duration_ms": round(
                    sum(t.get("duration_ms", 0) for t in state.trace), 2
                ),
                "nodes": [t["node"] for t in state.trace],
            },
        }

    def _build_result_from_state(self, state: GraphState) -> dict[str, Any]:
        """从 GraphState 构建结果。"""
        trace = state.get("trace", [])
        return {
            "status": state.get("status", "completed"),
            "goal": state.get("goal", ""),
            "session_id": state.get("session_id", ""),
            "plan": state.get("plan", []),
            "results": state.get("results", []),
            "summary": state.get("summary", ""),
            "error": state.get("error"),
            "iterations": state.get("iterations", 0),
            "langgraph_available": True,
            "trace": trace,
            "trace_summary": {
                "total_nodes": len(trace),
                "total_duration_ms": round(
                    sum(t.get("duration_ms", 0) for t in trace), 2
                ),
                "nodes": [t["node"] for t in trace],
            },
        }


langgraph_service = LangGraphService()
