"""Agent 工具调用循环 v2(2026-07-22 立,完整 ReAct 循环,替代 agent_loop.py 半成品)。

相比 agent_loop.py(第一轮就 break):
- 完整 ReAct 循环(Reason → Act → Observe → 重复直到完成)
- 工具调用解析(LLM 返回 tool_calls → 执行 → 结果回填 → 继续)
- 最大迭代数限制(防无限循环)
- 并行工具调用(同一轮多个 tool_calls 并行执行)
- 工具执行超时 + 错误处理
- 完整 trace(每轮 reasoning/action/observation)
- 提前终止条件(LLM 返回无 tool_calls / 用户中断 / max_iterations)
- 2026-07-22 Wave 9: checkpoint + 断点续跑(每轮 iteration 后保存,
  异常/暂停/取消时保存,可从 checkpoint_id 恢复继续执行)
"""

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from .agent_checkpoint import (
    AgentCheckpointManager,
    AgentLoopCheckpoint,
    get_agent_checkpoint_manager,
)

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
    stop_reason: str  # completed / max_iterations / error / no_tools / paused / cancelled
    error: Optional[str] = None
    # Wave 9:暂停/取消/失败时保存的 checkpoint_id(便于后续 resume),正常完成时为 None
    checkpoint_id: Optional[str] = None


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
        enable_checkpoint: bool = True,
        session_id: Optional[str] = None,
        checkpoint_manager: Optional[AgentCheckpointManager] = None,
    ):
        """
        Args:
            llm_complete_fn: async (messages: list, tools: list[dict]) -> dict
                            返回 {"content": str, "tool_calls": list[{"id","name","args"}] | None}
            tools: 工具定义列表
            max_iterations: 最大迭代轮数(防无限循环)
            tool_timeout: 单个工具执行超时(秒)
            parallel_tool_calls: 同一轮多个工具是否并行执行
            enable_checkpoint: 是否启用 checkpoint(每轮 iteration 后保存状态,
                               异常/暂停/取消时也保存,支持 resume_from_checkpoint)
            session_id: agent loop 会话 id(不传则首次 run 时自动生成 uuid4 hex),
                        同一 session_id 的 checkpoint 可通过 load_latest_by_session 查询
            checkpoint_manager: 自定义 checkpoint 管理器(不传则用全局单例)
        """
        self._llm_complete = llm_complete_fn
        self._tools: dict[str, ToolDefinition] = {t.name: t for t in tools}
        self.max_iterations = max_iterations
        self.tool_timeout = tool_timeout
        self.parallel_tool_calls = parallel_tool_calls

        # Wave 9 checkpoint 配置
        self.enable_checkpoint = enable_checkpoint
        self._session_id: Optional[str] = session_id
        self._checkpoint_manager: AgentCheckpointManager = (
            checkpoint_manager
            if checkpoint_manager is not None
            else get_agent_checkpoint_manager()
        )

        # 运行时状态(每次 run() 开始时重置)
        self._messages: Optional[list[dict[str, Any]]] = None
        self._current_iteration: int = 0
        self._tool_state: dict[str, Any] = {}
        self._pause_requested: bool = False
        self._cancel_requested: bool = False

    def _ensure_session_id(self) -> str:
        """获取或自动生成 session_id。"""
        if self._session_id is None:
            self._session_id = uuid.uuid4().hex
        return self._session_id

    def _reset_run_state(self) -> None:
        """每次 run/resume 开始前重置运行时状态。"""
        self._pause_requested = False
        self._cancel_requested = False
        self._current_iteration = 0

    async def _save_checkpoint_safe(
        self,
        iteration: int,
        messages: list[dict[str, Any]],
        status: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Optional[str]:
        """安全保存 checkpoint(失败只 log warning,不阻塞 loop)。返回 checkpoint_id 或 None。"""
        if not self.enable_checkpoint:
            return None
        try:
            session_id = self._ensure_session_id()
            return await self._checkpoint_manager.save_checkpoint(
                session_id=session_id,
                iteration=iteration,
                messages=messages,
                tool_state=self._tool_state,
                status=status,
                metadata=metadata,
            )
        except Exception as e:
            logger.warning("Agent 循环 checkpoint 保存失败(iter=%d status=%s): %s", iteration, status, e)
            return None

    async def run(self, messages: list[dict[str, Any]]) -> AgentLoopResult:
        """执行完整 ReAct 循环。

        签名与 v2 初版保持一致(不破坏 11 个已有测试用例)。
        Wave 9 扩展:每轮 iteration 结束后自动 checkpoint(若 enable_checkpoint),
        异常/暂停/取消时也保存 checkpoint,便于 resume_from_checkpoint 续跑。
        """
        self._reset_run_state()
        self._ensure_session_id()
        self._messages = messages
        return await self._run_loop(
            messages=messages,
            start_iteration=1,
            prior_iterations=[],
            prior_tokens=0,
            start_time=datetime.now(timezone.utc),
        )

    async def _run_loop(
        self,
        messages: list[dict[str, Any]],
        start_iteration: int,
        prior_iterations: list[LoopIteration],
        prior_tokens: int,
        start_time: datetime,
    ) -> AgentLoopResult:
        """内部循环实现(run 与 resume_from_checkpoint 共享)。

        Args:
            messages: 消息历史(原地追加)
            start_iteration: 起始 iteration 编号(run=1, resume=checkpoint.iteration+1)
            prior_iterations: 之前已有的 iteration 记录(resume 时不恢复 trace,留空)
            prior_tokens: 之前已用的 token 估算
            start_time: 本次循环开始时间(用于 total_duration_ms)
        """
        iterations: list[LoopIteration] = list(prior_iterations)
        total_tokens = prior_tokens
        tools_schema = self._build_tools_schema()

        for i in range(start_iteration, self.max_iterations + 1):
            # Wave 9:检查暂停/取消标志(在 LLM 调用前)
            if self._cancel_requested:
                checkpoint_id = await self._save_checkpoint_safe(
                    iteration=i - 1, messages=messages, status="cancelled",
                )
                return AgentLoopResult(
                    success=False,
                    final_response="",
                    iterations=iterations,
                    total_duration_ms=(
                        (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
                    ),
                    total_tokens_used=total_tokens,
                    stop_reason="cancelled",
                    error=f"用户取消(iteration {i})",
                    checkpoint_id=checkpoint_id,
                )
            if self._pause_requested:
                checkpoint_id = await self._save_checkpoint_safe(
                    iteration=i - 1, messages=messages, status="paused",
                )
                return AgentLoopResult(
                    success=False,
                    final_response="",
                    iterations=iterations,
                    total_duration_ms=(
                        (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
                    ),
                    total_tokens_used=total_tokens,
                    stop_reason="paused",
                    error=f"用户暂停(iteration {i}),可凭 checkpoint_id 续跑",
                    checkpoint_id=checkpoint_id,
                )

            self._current_iteration = i
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

                # Wave 9:每轮 iteration 结束后 checkpoint(status=running)
                await self._save_checkpoint_safe(
                    iteration=i, messages=messages, status="running",
                )

            except Exception as e:
                logger.error("Agent 循环第 %d 轮异常: %s", i, e)
                iteration.end_time = datetime.now(timezone.utc).isoformat()
                iteration.duration_ms = (
                    (datetime.now(timezone.utc) - iter_start).total_seconds() * 1000
                )
                iterations.append(iteration)

                # Wave 9:异常时保存 checkpoint(status=failed),便于后续 resume
                checkpoint_id = await self._save_checkpoint_safe(
                    iteration=i, messages=messages, status="failed",
                    metadata={"error": str(e)},
                )

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
                    checkpoint_id=checkpoint_id,
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

    async def resume_from_checkpoint(self, checkpoint_id: str) -> AgentLoopResult:
        """从 checkpoint 恢复并继续执行下一轮 iteration。

        Args:
            checkpoint_id: checkpoint id(由 pause/cancel/异常时返回,或通过
                          checkpoint_manager.list_checkpoints 查询)

        Returns:
            AgentLoopResult:从 checkpoint.iteration+1 继续执行的循环结果

        Raises:
            ValueError: checkpoint 不存在或已过期
        """
        checkpoint: Optional[AgentLoopCheckpoint] = await self._checkpoint_manager.load_checkpoint(
            checkpoint_id
        )
        if checkpoint is None:
            raise ValueError(f"checkpoint {checkpoint_id} 不存在或已过期")

        if checkpoint.status == "completed":
            # 已完成的 checkpoint 无需续跑
            return AgentLoopResult(
                success=True,
                final_response="",
                iterations=[],
                total_duration_ms=0.0,
                total_tokens_used=0,
                stop_reason="completed",
                error="checkpoint 已 completed,无需续跑",
                checkpoint_id=checkpoint_id,
            )

        if checkpoint.status == "cancelled":
            logger.warning("checkpoint %s 状态为 cancelled,仍允许续跑(用户显式 resume)", checkpoint_id)

        # 恢复状态
        self._session_id = checkpoint.session_id
        # 深拷贝消息历史,避免污染 checkpoint 存储中的引用
        messages = json.loads(json.dumps(checkpoint.messages, ensure_ascii=False))
        self._messages = messages
        self._tool_state = json.loads(json.dumps(checkpoint.tool_state, ensure_ascii=False))
        self._reset_run_state()

        start_iteration = checkpoint.iteration + 1
        if start_iteration > self.max_iterations:
            return AgentLoopResult(
                success=False,
                final_response="",
                iterations=[],
                total_duration_ms=0.0,
                total_tokens_used=0,
                stop_reason="max_iterations",
                error=f"checkpoint iteration {checkpoint.iteration} 已达 max_iterations {self.max_iterations}",
                checkpoint_id=checkpoint_id,
            )

        logger.info(
            "Agent 循环从 checkpoint %s 恢复,session=%s,从 iteration %d 续跑",
            checkpoint_id,
            checkpoint.session_id,
            start_iteration,
        )

        return await self._run_loop(
            messages=messages,
            start_iteration=start_iteration,
            prior_iterations=[],
            prior_tokens=0,
            start_time=datetime.now(timezone.utc),
        )

    async def pause(self) -> Optional[str]:
        """暂停当前 loop。

        若 loop 正在运行:设置 _pause_requested 标志,loop 在下一轮 iteration 开始前
        检测到并保存 checkpoint(status=paused),通过 AgentLoopResult.checkpoint_id 返回。
        若 loop 未运行:从最近一次 _messages 状态保存 checkpoint 并返回 checkpoint_id。

        Returns:
            checkpoint_id(若保存成功)或 None(无活动 loop 且无历史状态)
        """
        self._pause_requested = True
        if self._messages is not None:
            return await self._save_checkpoint_safe(
                iteration=self._current_iteration,
                messages=self._messages,
                status="paused",
            )
        return None

    async def cancel(self) -> Optional[str]:
        """取消当前 loop。

        若 loop 正在运行:设置 _cancel_requested 标志,loop 在下一轮 iteration 开始前
        检测到并保存 checkpoint(status=cancelled),通过 AgentLoopResult.checkpoint_id 返回。
        若 loop 未运行:从最近一次 _messages 状态保存 checkpoint 并返回 checkpoint_id。

        Returns:
            checkpoint_id(若保存成功)或 None(无活动 loop 且无历史状态)
        """
        self._cancel_requested = True
        if self._messages is not None:
            return await self._save_checkpoint_safe(
                iteration=self._current_iteration,
                messages=self._messages,
                status="cancelled",
            )
        return None

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
