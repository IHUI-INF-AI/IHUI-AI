"""dispatch_subagent 工具的派发逻辑封装。

为 mcp_server._tool_dispatch_subagent 提供独立服务层,支持:
1. 单任务派发(dispatch_single):调用 AgentOrchestrator.invoke
2. 多任务并行派发(dispatch_parallel):调用 AgentOrchestrator.invoke_parallel(带并发限制)
3. 入参校验(validate_dispatch_request):识别单任务 / 多任务模式并归一化

设计原则:
- 错误响应统一 {ok: False, errorCode, message} 格式
- stub 模式(llm_gateway._is_stub_mode() 为 True)返回 mock 响应,便于本地开发与测试
- 不修改 agent_orchestrator / mcp_server,主 agent 后续统一注册
"""

from __future__ import annotations

import logging
from typing import Any

from ..core.llm_gateway import llm_gateway
from .agent_orchestrator import agent_orchestrator

logger = logging.getLogger(__name__)

# 并行任务上限(防止资源耗尽)
_MAX_PARALLEL_TASKS = 10


def _is_stub_mode() -> bool:
    """是否为 stub 模式(无任何 LLM API key 配置)。"""
    return bool(llm_gateway._is_stub_mode())


def _agent_exists(name: str) -> bool:
    return agent_orchestrator.registry.get(name) is not None


# =============================================================================
# 单任务派发
# =============================================================================


async def dispatch_single(
    agent_name: str,
    task: str,
    session_id: str | None = None,
) -> dict[str, Any]:
    """单任务派发:调用 AgentOrchestrator.invoke。

    返回 {ok, agent_name, output, status, duration_ms, iterations, tool_calls, error}。
    agent 不存在时返回 {ok:False, errorCode:"AGENT_NOT_FOUND"}。
    stub 模式下返回 mock 成功响应。
    """
    if not agent_name or not task:
        return {
            "ok": False,
            "errorCode": "MISSING_PARAMS",
            "message": "agent_name 和 task 必填",
        }
    if not _agent_exists(agent_name):
        return {
            "ok": False,
            "errorCode": "AGENT_NOT_FOUND",
            "message": f"Agent 不存在: {agent_name}",
            "agent_name": agent_name,
        }

    if _is_stub_mode():
        return {
            "ok": True,
            "agent_name": agent_name,
            "output": f"[stub] mock response from {agent_name} for: {task[:100]}",
            "status": "completed",
            "duration_ms": 0.0,
            "iterations": 0,
            "tool_calls": [],
            "error": None,
        }

    result = await agent_orchestrator.invoke(
        agent_name=agent_name,
        user_input=task,
        session_id=session_id,
    )
    return {
        "ok": result.status == "completed",
        "agent_name": result.agent_name,
        "output": result.output,
        "status": result.status,
        "duration_ms": result.duration_ms,
        "iterations": result.iterations,
        "tool_calls": result.tool_calls,
        "error": result.error,
    }


# =============================================================================
# 多任务并行派发
# =============================================================================


async def dispatch_parallel(
    tasks: list[dict[str, Any]],
    max_concurrency: int = 5,
) -> dict[str, Any]:
    """多任务并行派发:调用 AgentOrchestrator.invoke_parallel(带 Semaphore 并发限制)。

    返回 {ok, total, succeeded, failed, results: [{agent_name, status, output, error, duration_ms}]}。
    tasks 为空 → {ok:False, errorCode:"EMPTY_TASKS"}
    tasks 超 10 个 → {ok:False, errorCode:"TOO_MANY_TASKS", message:"max 10 parallel tasks"}
    stub 模式下返回 mock 全成功(未知 agent 标 failed)。
    """
    if not tasks:
        return {"ok": False, "errorCode": "EMPTY_TASKS", "message": "tasks 列表为空"}
    if len(tasks) > _MAX_PARALLEL_TASKS:
        return {
            "ok": False,
            "errorCode": "TOO_MANY_TASKS",
            "message": f"max {_MAX_PARALLEL_TASKS} parallel tasks",
        }

    if _is_stub_mode():
        results: list[dict[str, Any]] = []
        for t in tasks:
            name = str(t.get("name") or t.get("agent_name") or "")
            task_desc = str(t.get("task") or "")
            if not _agent_exists(name):
                results.append({
                    "agent_name": name,
                    "status": "failed",
                    "output": "",
                    "error": f"Agent 不存在: {name}",
                    "duration_ms": 0.0,
                })
            else:
                results.append({
                    "agent_name": name,
                    "status": "completed",
                    "output": f"[stub] mock response from {name} for: {task_desc[:100]}",
                    "error": None,
                    "duration_ms": 0.0,
                })
        succeeded = sum(1 for r in results if r["status"] == "completed")
        return {
            "ok": True,
            "total": len(results),
            "succeeded": succeeded,
            "failed": len(results) - succeeded,
            "results": results,
        }

    orch_result = await agent_orchestrator.invoke_parallel(tasks, max_concurrency=max_concurrency)
    if not orch_result.get("ok"):
        # invoke_parallel 仅在 tasks 为空时返回 ok:False(已前置拦截),兜底透传
        return orch_result

    # 映射 results:name → agent_name
    mapped: list[dict[str, Any]] = []
    for r in orch_result.get("results", []):
        mapped.append({
            "agent_name": r.get("name", ""),
            "status": r.get("status", "failed"),
            "output": r.get("output", ""),
            "error": r.get("error"),
            "duration_ms": r.get("duration_ms", 0.0),
        })
    return {
        "ok": True,
        "total": orch_result.get("total", 0),
        "succeeded": orch_result.get("succeeded", 0),
        "failed": orch_result.get("failed", 0),
        "results": mapped,
    }


# =============================================================================
# 入参校验
# =============================================================================


async def validate_dispatch_request(args: dict[str, Any]) -> dict[str, Any]:
    """校验 dispatch_subagent 工具入参,识别单任务 / 多任务模式并归一化。

    支持两种模式:
    - 单任务:args = {agent_name, task}(name 作为 agent_name 别名)
    - 多任务:args = {tasks: [{agent_name, task}, ...]}

    返回:
        {ok: True, mode: "single"|"parallel", normalized: {name, task} | [{name, task}, ...]}
        {ok: False, errorCode, message}  # 校验失败
    """
    if not isinstance(args, dict):
        return {
            "ok": False,
            "errorCode": "INVALID_PARAMS",
            "message": "args 必须为 dict",
        }

    tasks = args.get("tasks")
    if tasks is not None:
        if not isinstance(tasks, list):
            return {
                "ok": False,
                "errorCode": "INVALID_PARAMS",
                "message": "tasks 必须为数组",
            }
        if len(tasks) == 0:
            return {"ok": False, "errorCode": "EMPTY_TASKS", "message": "tasks 列表为空"}
        if len(tasks) > _MAX_PARALLEL_TASKS:
            return {
                "ok": False,
                "errorCode": "TOO_MANY_TASKS",
                "message": f"max {_MAX_PARALLEL_TASKS} parallel tasks",
            }
        normalized: list[dict[str, str]] = []
        for t in tasks:
            if not isinstance(t, dict):
                return {
                    "ok": False,
                    "errorCode": "INVALID_PARAMS",
                    "message": "tasks 每项必须为 dict",
                }
            name = str(t.get("agent_name") or t.get("name") or "")
            task_desc = str(t.get("task") or "")
            if not name or not task_desc:
                return {
                    "ok": False,
                    "errorCode": "INVALID_PARAMS",
                    "message": "每个 task 需含 agent_name 和 task",
                }
            normalized.append({"name": name, "task": task_desc})
        return {"ok": True, "mode": "parallel", "normalized": normalized}

    # 单任务模式
    name = str(args.get("agent_name") or args.get("name") or "")
    task_desc = str(args.get("task") or "")
    if not name or not task_desc:
        return {
            "ok": False,
            "errorCode": "INVALID_PARAMS",
            "message": "需提供 agent_name+task 或 tasks 数组",
        }
    return {"ok": True, "mode": "single", "normalized": {"name": name, "task": task_desc}}
