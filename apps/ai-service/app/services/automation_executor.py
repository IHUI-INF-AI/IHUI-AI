"""自动化任务执行器(对标 Trae Work Automations + Codex)。

让 configure_automation_task 工具真实执行多步骤自动化任务:遍历 steps,动态调用
mcp_server._TOOL_HANDLERS[step.tool](step.args),记录每步 trace,支持 retry / abort /
fallback / on_success 回调。stub 模式返回 mock trace,便于本地开发与测试。
"""

from __future__ import annotations

import logging
import time
from typing import Any

from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

_VALID_TASK_TYPES = {"browser_automation", "computer_automation", "data_pipeline", "workflow"}


def validate_task_config(task_config: dict) -> tuple[bool, str]:
    """校验必填字段 task_id / task_type / steps。Returns (ok, message)。"""
    if not isinstance(task_config, dict):
        return False, "task_config must be a dict"
    for field in ("task_id", "task_type", "steps"):
        if not task_config.get(field):
            return False, f"missing required field: {field}"
    if task_config["task_type"] not in _VALID_TASK_TYPES:
        return False, f"invalid task_type: {task_config['task_type']}"
    steps = task_config["steps"]
    if not isinstance(steps, list) or not steps:
        return False, "steps must be a non-empty list"
    return True, ""


async def execute_step(step: dict, context: dict) -> dict[str, Any]:
    """执行单步:动态 import mcp_server,调用 _TOOL_HANDLERS[step.tool](step.args)。

    Returns: trace 项 {step_index, tool, args, result, duration_ms, ok, error_code?}
    """
    from . import mcp_server

    tool = step.get("tool", "")
    args = step.get("args") or {}
    expect = step.get("expect")
    start = time.perf_counter()
    trace: dict[str, Any] = {
        "step_index": context.get("step_index", 0),
        "tool": tool,
        "args": args,
    }
    handler = mcp_server._TOOL_HANDLERS.get(tool)
    if handler is None:
        trace.update(result={"ok": False, "errorCode": "TOOL_NOT_FOUND",
                             "message": f"unknown tool: {tool}"},
                     ok=False, error_code="TOOL_NOT_FOUND",
                     duration_ms=int((time.perf_counter() - start) * 1000))
        return trace
    try:
        result = await handler(args)
        ok = bool(result.get("ok", True)) if isinstance(result, dict) else True
        if ok and expect and isinstance(expect, dict):
            for k, v in expect.items():
                if (result or {}).get(k) != v:
                    ok = False
                    trace["expect_mismatch"] = {"field": k, "expected": v, "actual": (result or {}).get(k)}
                    break
        trace["result"] = result
        trace["ok"] = ok
        if not ok:
            trace["error_code"] = str((result or {}).get("errorCode", "STEP_FAILED"))
    except Exception as e:
        trace.update(result=None, ok=False, error_code="STEP_EXCEPTION",
                     exception=f"{type(e).__name__}: {str(e)[:200]}")
    trace["duration_ms"] = int((time.perf_counter() - start) * 1000)
    return trace


async def handle_success(task_config: dict, trace: list[dict]) -> dict[str, Any]:
    """全步骤成功后执行 on_success action(callback / save_artifact / next_workflow)。"""
    on_success = task_config.get("on_success") or {}
    action = on_success.get("action", "")
    target = on_success.get("target")
    info: dict[str, Any] = {"action": action, "target": target}
    if action == "callback" and target:
        info["callback_dispatched"] = target
    elif action == "save_artifact" and target:
        info["artifact_id"] = target
    elif action == "next_workflow" and target:
        info["next_workflow"] = target
    return info


async def handle_failure(task_config: dict, failed_step: dict) -> dict[str, Any]:
    """步骤失败时按 on_failure.action 决定后续动作(retry / abort / fallback)。"""
    on_failure = task_config.get("on_failure") or {}
    action = on_failure.get("action", "abort")
    info: dict[str, Any] = {"action": action, "failed_step_index": failed_step.get("step_index"),
                           "error_code": failed_step.get("error_code")}
    if action == "fallback":
        info["fallback_steps_count"] = len(on_failure.get("fallback_steps") or [])
    return info


async def execute_automation_task(task_config: dict) -> dict[str, Any]:
    """执行自动化任务。遍历 steps,记录 trace,按 on_failure / on_success 控制流程。"""
    ok, msg = validate_task_config(task_config)
    if not ok:
        return {"ok": False, "errorCode": "INVALID_CONFIG", "message": msg, "trace": []}

    task_id = task_config["task_id"]

    # stub 模式:返回 mock trace,不真实执行工具(便于本地开发与测试)
    if llm_gateway._is_stub_mode():
        mock_trace = [
            {"step_index": i, "tool": s.get("tool", ""), "args": s.get("args", {}),
             "result": {"ok": True, "mock": True}, "duration_ms": 0, "ok": True}
            for i, s in enumerate(task_config["steps"])
        ]
        return {"ok": True, "stub": True, "trace": mock_trace, "task_id": task_id,
                "message": "stub mode: mock trace"}

    on_failure = task_config.get("on_failure") or {}
    action = on_failure.get("action", "abort")
    max_retries = int(on_failure.get("max_retries", 0)) if action == "retry" else 0
    trace: list[dict[str, Any]] = []

    for i, step in enumerate(task_config["steps"]):
        step_traces: list[dict[str, Any]] = []
        st = await execute_step(step, {"step_index": i})
        step_traces.append(st)

        if not st["ok"]:
            cur_action = action
            if cur_action == "retry":
                retried_ok = False
                for attempt in range(1, max_retries + 1):
                    rt = await execute_step(step, {"step_index": i})
                    rt["retry_attempt"] = attempt
                    step_traces.append(rt)
                    if rt["ok"]:
                        retried_ok = True
                        break
                if not retried_ok:
                    # 重试用尽:有 fallback_steps 则降级,否则 abort
                    cur_action = "fallback" if on_failure.get("fallback_steps") else "abort"

            if cur_action == "fallback":
                fb_steps = on_failure.get("fallback_steps") or []
                fb_ok = True
                for j, fb_step in enumerate(fb_steps):
                    ft = await execute_step(fb_step, {"step_index": i + j + 1})
                    ft["fallback"] = True
                    step_traces.append(ft)
                    if not ft["ok"]:
                        fb_ok = False
                        break
                if not fb_ok:
                    trace.extend(step_traces)
                    return {"ok": False, "errorCode": "FALLBACK_FAILED",
                            "message": f"fallback failed at step {i}",
                            "trace": trace, "task_id": task_id}
            elif cur_action == "abort":
                trace.extend(step_traces)
                failure_info = await handle_failure(task_config, st)
                return {"ok": False, "errorCode": "STEP_FAILED",
                        "message": f"step {i} ({step.get('tool')}) aborted: {st.get('error_code')}",
                        "trace": trace, "failure": failure_info, "task_id": task_id}

        trace.extend(step_traces)

    success_info = await handle_success(task_config, trace)
    return {"ok": True, "trace": trace, "task_id": task_id,
            "success": success_info, "stub": False}
