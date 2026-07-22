"""Agent 工具调用循环 v2(2026-07-22 立,完整 ReAct 循环,替代 agent_loop.py 半成品)。

相比 agent_loop.py(第一轮就 break):
- 完整 ReAct 循环(Reason → Act → Observe → 重复直到完成)
- 工具调用解析(LLM 返回 tool_calls → 执行 → 结果回填 → 继续)
- 最大迭代数限制(防无限循环)
- 并行工具调用(同一轮多个 tool_calls 并行执行)
- 工具执行超时 + 错误处理
- 完整 trace(每轮 reasoning/action/observation)
- 提前终止条件(LLM 返回无 tool_calls / 用户中断 / max_iterations)
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


@dataclass
class ToolDefinition:
    """工具定义。"""

    name: str
    description: str
    parameters: dict  # JSON Schema
    executor: Callable[..., Any]  # async (args: dict) -> dict


@dataclass
class ToolCall:
    """单次工具调用。"""

    id: str
    name: str
    args: dict


@dataclass
class ToolResult:
    """工具执行结果。"""

    tool_call_id: str
    name: str
    result: Any
    error: Optional[str] = None
    duration_ms: float = 0.0


@dataclass
class LoopIteration:
    """单轮迭代记录。"""

    iteration: int
    reasoning: str = ""  # LLM 的思考(assistant message content),run() 内回填
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_results: list[ToolResult] = field(default_factory=list)
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_ms: float = 0.0


@dataclass
class AgentLoopResult:
    """Agent 循环结果。"""

    success: bool
    final_response: str  # LLM 最终回复(无 tool_calls 的那一轮)
    iterations: list[LoopIteration]
    total_duration_ms: float
    total_tokens_used: int  # 估算
    stop_reason: str  # completed / max_iterations / error / no_tools
    error: Optional[str] = None


class AgentLoopV2:
    """完整 ReAct 工具调用循环。

    用法:
        loop = AgentLoopV2(
            llm_complete_fn=my_llm_call,  # async (messages, tools) -> {content, tool_calls}
            tools=[...],
            max_iterations=10,
        )
        result = await loop.run([
            {"role": "system", "content": "你是一个助手"},
            {"role": "user", "content": "帮我查一下天气"},
        ])
        print(result.final_response)
    """

    def __init__(
        self,
        llm_complete_fn: Callable[..., Any],
        tools: list[ToolDefinition],
        max_iterations: int = 10,
        tool_timeout: float = 60.0,
        parallel_tool_calls: bool = True,
    ):
        """
        Args:
            llm_complete_fn: async (messages: list, tools: list[dict]) -> dict
                            返回 {"content": str, "tool_calls": list[{"id","name","args"}] | None}
            tools: 工具定义列表
            max_iterations: 最大迭代轮数(防无限循环)
            tool_timeout: 单个工具执行超时(秒)
            parallel_tool_calls: 同一轮多个工具是否并行执行
        """
        self._llm_complete = llm_complete_fn
        self._tools: dict[str, ToolDefinition] = {t.name: t for t in tools}
        self.max_iterations = max_iterations
        self.tool_timeout = tool_timeout
        self.parallel_tool_calls = parallel_tool_calls

    async def run(self, messages: list[dict[str, Any]]) -> AgentLoopResult:
        """执行完整 ReAct 循环。"""
        start_time = datetime.now(timezone.utc)
        iterations: list[LoopIteration] = []
        total_tokens = 0

        # 构建 tools schema(给 LLM)
        tools_schema = self._build_tools_schema()

        for i in range(1, self.max_iterations + 1):
            iter_start = datetime.now(timezone.utc)
            iteration = LoopIteration(iteration=i, start_time=iter_start.isoformat())

            try:
                # 1. 调 LLM(带 tools)
                llm_response = await self._llm_complete(messages, tools_schema)

                content = llm_response.get("content", "")
                tool_calls_raw = llm_response.get("tool_calls")

                iteration.reasoning = content

                # 估算 token(粗略)
                total_tokens += len(content) // 4 + 50

                # 2. 无 tool_calls → 循环完成
                if not tool_calls_raw:
                    iteration.end_time = datetime.now(timezone.utc).isoformat()
                    iteration.duration_ms = (
                        (datetime.now(timezone.utc) - iter_start).total_seconds() * 1000
                    )
                    iterations.append(iteration)

                    return AgentLoopResult(
                        success=True,
                        final_response=content,
                        iterations=iterations,
                        total_duration_ms=(
                            (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
                        ),
                        total_tokens_used=total_tokens,
                        stop_reason="completed",
                    )

                # 3. 解析 tool_calls
                tool_calls: list[ToolCall] = []
                for tc_raw in tool_calls_raw:
                    tc = ToolCall(
                        id=tc_raw.get("id", f"call_{len(tool_calls)}"),
                        name=tc_raw.get("name", ""),
                        args=tc_raw.get("args", {}),
                    )
                    tool_calls.append(tc)
                iteration.tool_calls = tool_calls

                # 4. 把 assistant message(含 tool_calls)加入 messages
                messages.append(
                    {
                        "role": "assistant",
                        "content": content,
                        "tool_calls": [
                            {"id": tc.id, "name": tc.name, "args": tc.args} for tc in tool_calls
                        ],
                    }
                )

                # 5. 执行工具
                tool_results = await self._execute_tools(tool_calls)
                iteration.tool_results = tool_results

                # 6. 把工具结果加入 messages
                for tr in tool_results:
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tr.tool_call_id,
                            "name": tr.name,
                            "content": json.dumps(
                                tr.result if not tr.error else {"error": tr.error},
                                ensure_ascii=False,
                            ),
                        }
                    )

                iteration.end_time = datetime.now(timezone.utc).isoformat()
                iteration.duration_ms = (
                    (datetime.now(timezone.utc) - iter_start).total_seconds() * 1000
                )
                iterations.append(iteration)

                logger.info(
                    "Agent 循环第 %d 轮:执行 %d 个工具,耗时 %.0fms",
                    i,
                    len(tool_calls),
                    iteration.duration_ms,
                )

            except Exception as e:
                logger.error("Agent 循环第 %d 轮异常: %s", i, e)
                iteration.end_time = datetime.now(timezone.utc).isoformat()
                iteration.duration_ms = (
                    (datetime.now(timezone.utc) - iter_start).total_seconds() * 1000
                )
                iterations.append(iteration)

                return AgentLoopResult(
                    success=False,
                    final_response="",
                    iterations=iterations,
                    total_duration_ms=(
                        (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
                    ),
                    total_tokens_used=total_tokens,
                    stop_reason="error",
                    error=str(e),
                )

        # 达到 max_iterations
        return AgentLoopResult(
            success=False,
            final_response="",
            iterations=iterations,
            total_duration_ms=(
                (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            ),
            total_tokens_used=total_tokens,
            stop_reason="max_iterations",
            error=f"达到最大迭代数 {self.max_iterations}",
        )

    async def _execute_tools(self, tool_calls: list[ToolCall]) -> list[ToolResult]:
        """执行工具调用(并行或串行)。"""
        if self.parallel_tool_calls and len(tool_calls) > 1:
            # 并行执行
            tasks = [self._execute_single(tc) for tc in tool_calls]
            results = await asyncio.gather(*tasks, return_exceptions=False)
            return list(results)
        else:
            # 串行执行
            results: list[ToolResult] = []
            for tc in tool_calls:
                result = await self._execute_single(tc)
                results.append(result)
            return results

    async def _execute_single(self, tc: ToolCall) -> ToolResult:
        """执行单个工具调用(含超时 + 错误处理)。"""
        start = time.time()

        tool = self._tools.get(tc.name)
        if not tool:
            return ToolResult(
                tool_call_id=tc.id,
                name=tc.name,
                result=None,
                error=f"工具 {tc.name} 不存在",
                duration_ms=0,
            )

        try:
            result = await asyncio.wait_for(
                tool.executor(tc.args),
                timeout=self.tool_timeout,
            )
            return ToolResult(
                tool_call_id=tc.id,
                name=tc.name,
                result=result,
                duration_ms=(time.time() - start) * 1000,
            )
        except asyncio.TimeoutError:
            return ToolResult(
                tool_call_id=tc.id,
                name=tc.name,
                result=None,
                error=f"工具执行超时({self.tool_timeout}s)",
                duration_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            return ToolResult(
                tool_call_id=tc.id,
                name=tc.name,
                result=None,
                error=str(e),
                duration_ms=(time.time() - start) * 1000,
            )

    def _build_tools_schema(self) -> list[dict]:
        """构建 tools schema(给 LLM 的 function calling 格式)。"""
        return [
            {
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                },
            }
            for t in self._tools.values()
        ]
