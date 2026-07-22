"""Agent 循环执行器。

循环调用 LLM + 工具,直到完成或达到 max_iterations。
维护 _running 字典跟踪执行状态。
新增 run_stream 流式执行方法,通过异步生成器 yield 每一步事件。
"""

import asyncio
import json
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from ..core.config import settings
from ..core.llm_gateway import llm_gateway
from .memory import memory_store
from .mcp_server import mcp_server
from .project_memory import build_system_prompt


class AgentExecutor:
    """Agent 循环执行器。"""

    def __init__(self) -> None:
        # 运行中任务: task_id -> 状态信息
        self._running: dict[str, dict[str, Any]] = {}

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _new_task_id() -> str:
        return uuid.uuid4().hex[:12]

    def list_running(self) -> dict[str, dict[str, Any]]:
        """返回所有运行中/已完成任务的快照。"""
        return {tid: dict(info) for tid, info in self._running.items()}

    def status(self, task_id: str) -> dict[str, Any] | None:
        """查询任务状态,不存在返回 None。"""
        info = self._running.get(task_id)
        return dict(info) if info else None

    def cancel(self, task_id: str) -> bool:
        """取消任务。返回是否成功取消。"""
        info = self._running.get(task_id)
        if not info:
            return False
        if info["status"] in {"completed", "failed", "canceled"}:
            return False
        info["status"] = "canceled"
        info["updated_at"] = self._now()
        info["message"] = "任务已被取消"
        return True

    @staticmethod
    def _parse_tool_calls(llm_result: dict[str, Any], content: str) -> list[dict[str, Any]]:
        """解析 LLM 输出中的 tool_call。

        优先 OpenAI function calling 原生格式(llm_gateway 已提取 tool_calls 字段),
        降级解析 ```tool_call\\n{"name":...,"arguments":{...}}\\n``` 文本块。
        返回 [{"name": str, "arguments": dict}] 列表。
        """
        calls: list[dict[str, Any]] = []
        # 1. OpenAI function calling 原生格式
        raw = llm_result.get("tool_calls")
        if raw and isinstance(raw, list):
            for tc in raw:
                fn = tc.get("function", {}) if isinstance(tc, dict) else {}
                name = fn.get("name", "")
                args_str = fn.get("arguments", "")
                try:
                    args = json.loads(args_str) if args_str else {}
                except (json.JSONDecodeError, TypeError):
                    args = {}
                if name:
                    calls.append({"name": name, "arguments": args})
            if calls:
                return calls
        # 2. 降级:解析 ```tool_call``` 文本块
        for m in re.finditer(r"```tool_call\s*(\{.*?\})\s*```", content, re.DOTALL):
            try:
                obj = json.loads(m.group(1))
                name = obj.get("name", "")
                if name:
                    calls.append({"name": name, "arguments": obj.get("arguments", {}) or {}})
            except (json.JSONDecodeError, TypeError):
                continue
        return calls

    async def run(
        self,
        goal: str,
        session_id: str | None = None,
        model: str | None = None,
        max_iterations: int | None = None,
        tools: list[str] | None = None,
    ) -> dict[str, Any]:
        """执行 agent 循环。

        Args:
            goal: 本次 agent 的目标/用户输入。
            session_id: 会话 ID,为空则新建。
            model: 指定模型,为空使用默认。
            max_iterations: 最大迭代次数,为空使用配置默认。
            tools: 允许调用的工具名列表,为空则不调用工具。

        Returns:
            包含 task_id/session_id/status/iterations/steps/result 的字典。
        """
        task_id = self._new_task_id()
        sid = session_id or uuid.uuid4().hex[:12]
        max_iter = max_iterations if max_iterations is not None else settings.max_agent_iterations

        self._running[task_id] = {
            "task_id": task_id,
            "session_id": sid,
            "goal": goal,
            "status": "running",
            "iterations": 0,
            "steps": [],
            "created_at": self._now(),
            "updated_at": self._now(),
        }

        # 记录用户输入
        await memory_store.add(sid, "user", goal, {"task_id": task_id})

        steps: list[dict[str, Any]] = []
        final_content = ""
        error: str | None = None

        try:
            for i in range(max_iter):
                # 检查是否被取消
                if self._running[task_id]["status"] == "canceled":
                    break

                self._running[task_id]["iterations"] = i + 1

                # 取出会话历史作为上下文
                history = await memory_store.get(sid)
                messages = [
                    {"role": "system", "content": build_system_prompt(sid)}
                ]
                messages.extend(
                    {"role": m["role"], "content": m["content"]} for m in history
                )

                # 调用 LLM
                llm_result = await llm_gateway.complete(messages, model=model)
                assistant_content = str(llm_result.get("content", ""))
                await memory_store.add(sid, "assistant", assistant_content, {"iteration": i + 1})

                step = {
                    "iteration": i + 1,
                    "type": "llm",
                    "content": assistant_content,
                    "stub": llm_result.get("stub", False),
                }
                steps.append(step)

                # stub 模式或无工具配置: 直接结束循环
                if llm_result.get("stub") or not tools:
                    final_content = assistant_content
                    break

                # 解析 tool_call(优先 OpenAI function calling,降级 ```tool_call``` 文本块)
                tool_calls = self._parse_tool_calls(llm_result, assistant_content)
                if not tool_calls:
                    # 无 tool_call: LLM 认为任务完成
                    final_content = assistant_content
                    break

                # 执行工具(白名单过滤),结果回填 memory,继续下一轮迭代
                for tc in tool_calls:
                    tool_name = tc["name"]
                    tool_args = tc["arguments"]
                    if tool_name not in tools:
                        skip_msg = f"工具 {tool_name} 不在白名单 {tools} 内,跳过"
                        steps.append({
                            "iteration": i + 1,
                            "type": "tool",
                            "tool_name": tool_name,
                            "tool_args": tool_args,
                            "content": skip_msg,
                            "status": "skipped",
                        })
                        await memory_store.add(sid, "tool", skip_msg, {"tool_name": tool_name, "tool_args": tool_args})
                        continue
                    try:
                        tool_result = await mcp_server.call_tool(tool_name, tool_args)
                        tool_content = json.dumps(tool_result, ensure_ascii=False, default=str)
                        step_status = "ok"
                    except Exception as e:
                        # 工具执行失败: 错误回填给 LLM 让它决定下一步,不中断循环
                        tool_content = f"工具 {tool_name} 执行失败: {e}"
                        step_status = "error"
                    steps.append({
                        "iteration": i + 1,
                        "type": "tool",
                        "tool_name": tool_name,
                        "tool_args": tool_args,
                        "content": tool_content,
                        "status": step_status,
                    })
                    await memory_store.add(sid, "tool", tool_content, {"tool_name": tool_name, "tool_args": tool_args})
                # 有 tool_call 已执行,继续下一轮迭代(让 LLM 基于工具结果决定下一步)

            if self._running[task_id]["status"] != "canceled":
                self._running[task_id]["status"] = "completed"

        except Exception as e:
            error = str(e)
            self._running[task_id]["status"] = "failed"
            self._running[task_id]["error"] = error

        self._running[task_id]["updated_at"] = self._now()
        self._running[task_id]["steps"] = steps

        # 任务完成后异步触发 Skill 自进化评估(不阻塞返回)
        if self._running[task_id]["status"] == "completed":
            try:
                from .skills import SkillEvolutionService, skill_registry

                evolution = SkillEvolutionService()
                asyncio.create_task(evolution.evaluate({
                    "taskId": task_id,
                    "sessionId": sid,
                    "goal": goal,
                    "steps": steps,
                    "finalResult": final_content,
                    "existingSkills": [s.name for s in skill_registry.list()],
                }))
            except Exception:
                pass  # 自进化失败不影响主流程

        return {
            "task_id": task_id,
            "session_id": sid,
            "status": self._running[task_id]["status"],
            "iterations": self._running[task_id]["iterations"],
            "steps": steps,
            "result": final_content,
            "error": error,
        }

    async def run_stream(
        self,
        goal: str,
        session_id: str | None = None,
        model: str | None = None,
        max_iterations: int | None = None,
        tools: list[str] | None = None,
    ) -> Any:
        """流式执行 agent,yield 每一步的事件。

        Args:
            goal: 本次 agent 的目标/用户输入。
            session_id: 会话 ID,为空则新建。
            model: 指定模型,为空使用默认。
            max_iterations: 最大迭代次数(保留参数,当前实现单轮)。
            tools: 允许调用的工具名列表(保留参数)。

        Yields:
            事件字典,类型包括 message/thinking/usage/status/error。
        """
        task_id = f"task-{id(goal)}"
        session_id = session_id or f"session-{int(time.time())}"
        max_iter = max_iterations or settings.max_agent_iterations  # noqa: F841

        self._running[task_id] = {
            "task_id": task_id,
            "session_id": session_id,
            "status": "running",
            "started_at": datetime.utcnow().isoformat(),
        }

        try:
            # 保存用户输入到记忆
            await memory_store.add(session_id, "user", goal)
            yield {"type": "message", "role": "user", "content": goal, "task_id": task_id}

            # 获取历史消息
            history = await memory_store.get(session_id)
            messages = [{"role": m["role"], "content": m["content"]} for m in history]

            yield {"type": "thinking", "task_id": task_id, "message": "正在思考..."}

            # 调用 LLM
            result = await llm_gateway.complete(messages, model=model)

            # 保存 assistant 响应
            assistant_content = result.get("content", "")
            await memory_store.add(session_id, "assistant", assistant_content)

            yield {
                "type": "message",
                "role": "assistant",
                "content": assistant_content,
                "task_id": task_id,
                "stub": result.get("stub", False),
            }

            if result.get("usage"):
                yield {"type": "usage", "task_id": task_id, "usage": result["usage"]}

            self._running[task_id]["status"] = "completed"
            yield {"type": "status", "task_id": task_id, "status": "completed"}
        except asyncio.CancelledError:
            self._running[task_id]["status"] = "canceled"
            yield {"type": "status", "task_id": task_id, "status": "canceled"}
            raise
        except Exception as e:
            self._running[task_id]["status"] = "failed"
            self._running[task_id]["error"] = str(e)
            yield {"type": "error", "task_id": task_id, "message": str(e)}


agent_executor = AgentExecutor()
