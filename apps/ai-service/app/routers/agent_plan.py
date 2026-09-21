# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Plan Mode(计划模式)路由。

全新端点族(不碰现有 agents.py 路由),对标 Claude Code Plan Mode:
- POST /agent-plan :创建计划草稿(只读阶段,LLM 生成可编辑计划)
- GET  /agent-plan/{plan_id} :查询计划状态与内容
- POST /agent-plan/{plan_id}/decision :用户批准/拒绝

计划阶段限定只读工具的意义:
=======================
计划阶段的核心约束是"只许看、不许改"。create_draft 本身不调用任何工具;
只有当用户批准(decision.approve=true)后,才用 AgentLoopV2 **同步执行**计划,
且执行工具集被严格限制为 READONLY_TOOLS 的子集(用户还可在 decision.tools 中
进一步收窄)。这样确保:计划期不会因 LLM 自主决策而意外改写文件/执行命令/
写库/控制电脑;真正有副作用的动作只有在用户明确确认计划后才可能发生,
且仍被约束在只读工具范围内。这符合"先对齐意图、再执行"的安全协作范式。
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..core.llm_gateway import llm_gateway
from ..services.agent_loop_v2 import AgentLoopV2, ToolDefinition
from ..services.plan_mode import (
    READONLY_TOOLS,
    TASK_STATUSES,
    create_draft,
    diff_versions,
    list_versions,
    plan_store,
    refine_plan,
    sync_tasks,
    update_task_status,
    validate_transition,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class CreatePlanRequest(BaseModel):
    """创建计划草稿请求。"""

    goal: str = Field(..., description="计划目标/任务描述")
    session_id: str | None = Field(None, description="关联会话 ID(可选)")
    model: str | None = Field(None, description="指定模型(可选)")


class PlanDecisionRequest(BaseModel):
    """计划决策请求(批准/拒绝/改签)。

    兼容既有 `approve` 布尔语义:
    - approve=True :立即批准并执行(等价 action=approve)
    - approve=False:拒绝(等价 action=reject)
    需显式区分"仅批准门不执行 / 修改后重提"时,用 `action`:
    - action=approve_only :仅将计划置为 approved(不触发执行)
    - action=revise       :细化新版本(version bump + reason),回到 pending_approval
    """

    approve: bool = Field(..., description="true=批准执行,false=拒绝(兼容遗留调用)")
    action: str = Field(
        "default",
        description="决策动作: default|approve|approve_only|reject|revise",
    )
    edited_plan_md: str | None = Field(
        None, description="用户编辑后的计划 markdown(可选;批准/改签时以此为准)"
    )
    reason: str | None = Field(None, description="决策说明(拒绝原因 / 改签原因,写入版本历史可追溯)")
    tools: list[str] | None = Field(
        None,
        description="限定执行工具名(必须是只读子集;省略=全部只读工具)",
    )


class PlanVersionDiffRequest(BaseModel):
    """版本 diff 请求(查询参数,用 from_version / to_version)。"""

    from_version: int = Field(1, description="起始版本号")
    to_version: int | None = Field(None, description="目标版本号(空=当前版本)")


class TaskStatusRequest(BaseModel):
    """更新单个 task 状态请求。"""

    status: str = Field(..., description="done|pending|blocked")


# ---------------------------------------------------------------------------
# 执行器接线(本地最小等价版:import 自 agent_loop_v2 与 llm_gateway,
# 不依赖正在被 W1 改造的 agents.py)
# ---------------------------------------------------------------------------


def _make_loop_v2_llm(model: str | None) -> Any:
    """构造 AgentLoopV2 的 llm_complete_fn(包装 llm_gateway.complete)。"""

    async def _llm(messages: list[dict[str, Any]], tools: list[Any]) -> dict[str, Any]:
        result = await llm_gateway.complete(messages, model=model)
        tool_calls = result.get("tool_calls")
        converted: list[dict[str, Any]] | None = None
        if tool_calls:
            converted = []
            for tc in tool_calls:
                fn = tc.get("function") or {}
                raw = fn.get("arguments") or "{}"
                if isinstance(raw, str):
                    try:
                        args = json.loads(raw)
                    except (ValueError, TypeError):
                        args = {}
                else:
                    args = raw
                converted.append(
                    {
                        "id": tc.get("id", ""),
                        "name": fn.get("name", ""),
                        "args": args,
                    }
                )
        return {
            "content": result.get("content", ""),
            "tool_calls": converted,
        }

    return _llm


def _build_readonly_tools(tool_names: frozenset[str]) -> list[ToolDefinition]:
    """从 mcp_server 构建只读工具定义(白名单过滤)。"""
    from ..services.mcp_server import mcp_server

    tools: list[ToolDefinition] = []
    for mt in mcp_server.list_tools():
        if mt.name not in tool_names:
            continue

        async def _exec(args: dict[str, Any], _name: str = mt.name) -> Any:
            return await mcp_server.call_tool(_name, args)

        tools.append(
            ToolDefinition(
                name=mt.name,
                description=mt.description,
                parameters=mt.input_schema,
                executor=_exec,
            )
        )
    return tools


def _now() -> str:
    """当前 UTC ISO8601 时间戳。"""
    return datetime.now(UTC).isoformat()


async def _execute_plan(rec: Any, tool_names: frozenset[str]) -> dict[str, Any]:
    """批准后执行计划:进入 executing,用 AgentLoopV2 同步执行(只读工具集)。

    就地修改 rec.status / rec.result / rec.updated_at 并保存。
    Args:
        rec: 计划记录
        tool_names: 已计算好的执行工具集(必须 ⊆ READONLY_TOOLS)
    Returns: 执行结果 dict({status, result})。
    """
    rec.status = "executing"
    rec.updated_at = _now()
    plan_store.save(rec)
    try:
        loop = AgentLoopV2(
            llm_complete_fn=_make_loop_v2_llm(None),
            tools=_build_readonly_tools(tool_names),
            max_iterations=8,
            enable_checkpoint=False,
            enable_memory=False,
            approval_enabled=False,
        )
        loop_result = await loop.run(
            [
                {"role": "system", "content": rec.plan_md},
                {"role": "user", "content": rec.goal},
            ]
        )
        rec.status = "done" if loop_result.success else "failed"
        rec.result = {
            "success": loop_result.success,
            "final_response": getattr(loop_result, "final_response", ""),
            "stop_reason": loop_result.stop_reason,
            "error": getattr(loop_result, "error", None),
            "iterations": len(getattr(loop_result, "iterations", []) or []),
        }
    except Exception as e:  # 执行异常 -> failed,不吞异常信息
        logger.exception("计划执行异常(plan_id=%s): %s", rec.plan_id, e)
        rec.status = "failed"
        rec.result = {"success": False, "error": str(e), "stop_reason": "error"}

    rec.updated_at = _now()
    plan_store.save(rec)
    return {"plan_id": rec.plan_id, "status": rec.status, "result": rec.result}


def _resolve_requested_tools(tools: list[str] | None) -> frozenset[str]:
    """计算执行工具集 = READONLY_TOOLS ∩ (请求 tools 或全部只读)。"""
    requested = frozenset(tools) if tools else None
    return requested & READONLY_TOOLS if requested is not None else READONLY_TOOLS


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.post("/agent-plan")
async def create_plan(req: CreatePlanRequest) -> dict[str, Any]:
    """创建计划草稿(只读阶段)。

    返回 data: {plan_id, plan_md, readonly_tools}
    """
    record = await create_draft(goal=req.goal, session_id=req.session_id, model=req.model)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "plan_id": record.plan_id,
            "plan_md": record.plan_md,
            "readonly_tools": sorted(record.readonly_tools),
        },
    }


@router.get("/agent-plan/{plan_id}")
async def get_plan(plan_id: str) -> dict[str, Any]:
    """查询计划状态与内容。"""
    try:
        rec = plan_store.get(plan_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"计划不存在或已过期: {plan_id}") from None
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "plan_id": rec.plan_id,
            "goal": rec.goal,
            "status": rec.status,
            "plan_md": rec.plan_md,
            "readonly_tools": sorted(rec.readonly_tools),
            "session_id": rec.session_id,
            "created_at": rec.created_at,
            "updated_at": rec.updated_at,
            "result": rec.result,
            "version": rec.version,
            "tasks": rec.tasks,
        },
    }


# ---------------------------------------------------------------------------
# 版本历史与 diff(审计"最终执行的是哪个版本、为何")
# ---------------------------------------------------------------------------


@router.get("/agent-plan/{plan_id}/versions")
async def list_plan_versions(plan_id: str) -> dict[str, Any]:
    """列出计划版本历史(含当前版本,按 version 升序)。"""
    try:
        rec = plan_store.get(plan_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"计划不存在或已过期: {plan_id}") from None
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "plan_id": rec.plan_id,
            "current_version": rec.version,
            "versions": list_versions(rec, include_plan_md=False),
        },
    }


@router.get("/agent-plan/{plan_id}/versions/diff")
async def diff_plan_versions(
    plan_id: str,
    from_version: int,
    to_version: int | None = None,
) -> dict[str, Any]:
    """对两个历史版本做轻量行级 diff。"""
    try:
        rec = plan_store.get(plan_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"计划不存在或已过期: {plan_id}") from None
    target = rec.version if to_version is None else to_version
    try:
        diff = diff_versions(rec, from_version, target)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "plan_id": rec.plan_id,
            "from_version": from_version,
            "to_version": target,
            "diff": diff,
        },
    }


# ---------------------------------------------------------------------------
# 任务化执行(plan tasks):把获批计划展开为可勾选 task 序列
# ---------------------------------------------------------------------------


@router.post("/agent-plan/{plan_id}/tasks/sync")
async def sync_plan_tasks(plan_id: str) -> dict[str, Any]:
    """按当前计划内容(重新)展开为可勾选 task 序列,保留同名任务已有状态。"""
    try:
        rec = plan_store.get(plan_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"计划不存在或已过期: {plan_id}") from None
    sync_tasks(rec)
    plan_store.save(rec)
    return _tasks_response(rec)


@router.get("/agent-plan/{plan_id}/tasks")
async def get_plan_tasks(plan_id: str) -> dict[str, Any]:
    """查询计划的 task 列表与进度摘要。"""
    try:
        rec = plan_store.get(plan_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"计划不存在或已过期: {plan_id}") from None
    return _tasks_response(rec)


@router.post("/agent-plan/{plan_id}/tasks/{task_id}/status")
async def set_plan_task_status(
    plan_id: str, task_id: str, req: TaskStatusRequest
) -> dict[str, Any]:
    """更新单个 task 状态(done/pending/blocked)。"""
    try:
        rec = plan_store.get(plan_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"计划不存在或已过期: {plan_id}") from None
    ok = update_task_status(rec, task_id, req.status)
    if not ok:
        raise HTTPException(
            status_code=400,
            detail=f"task 不存在或状态非法: {task_id}/{req.status}",
        ) from None
    plan_store.save(rec)
    return _tasks_response(rec)


def _tasks_response(rec: Any) -> dict[str, Any]:
    """构造 task 响应(列表 + done/total 摘要)。"""
    tasks = list(rec.tasks)
    done = sum(1 for t in tasks if t.get("status") == "done")
    blocked = sum(1 for t in tasks if t.get("status") == "blocked")
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "plan_id": rec.plan_id,
            "tasks": tasks,
            "summary": {"total": len(tasks), "done": done, "blocked": blocked},
            "task_statuses": sorted(TASK_STATUSES),
        },
    }


@router.post("/agent-plan/{plan_id}/decision")
async def decide_plan(plan_id: str, req: PlanDecisionRequest) -> dict[str, Any]:
    """批准/拒绝/改签计划(审批门控闭环)。

    动作分发(action):
    - approve / approve=True (default) : pending_approval|draft|approved -> executing,
      用 AgentLoopV2 同步执行(工具集 = READONLY_TOOLS ∩ 请求 tools 或全部只读)。
    - approve_only                       : pending_approval|draft -> approved(只开门不执行,
      后续可通过 approve=True 启动 executing)。
    - reject / approve=False (default)   : -> rejected;若带 edited_plan_md 则记为新版本。
    - revise                             : 细化新版本(version bump + reason),
      回到 pending_approval 重新等待审批(可反复改签)。

    带修改指示时(revise / approve 且提供 edited_plan_md),先 refine_plan 产生新版本,
    保证"最终执行的是哪个版本、为何"可追溯。
    """
    try:
        rec = plan_store.get(plan_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"计划不存在或已过期: {plan_id}") from None

    action = (req.action or "default").strip().lower()
    edited_md = req.edited_plan_md if (req.edited_plan_md or "").strip() else None
    # 显式 action 优先;未指定则回落兼容遗留 approve 布尔语义
    if action in ("", "default"):
        action = "approve" if req.approve else "reject"

    # ---- 改签:细化新版本,回到 pending_approval ----
    if action == "revise":
        try:
            validate_transition(rec.status, "pending_approval")
        except ValueError as e:
            raise HTTPException(status_code=409, detail=str(e)) from None
        if not edited_md:
            # 改签至少需要给出新的计划内容(或修改指示),否则无意义
            raise HTTPException(
                status_code=400,
                detail="改签(revise)需提供 edited_plan_md 新计划内容",
            )
        refine_plan(rec, edited_md, reason=req.reason or "revise", channel="user")
        rec.status = "pending_approval"
        plan_store.save(rec)
        return {
            "code": 0,
            "message": "ok",
            "data": {
                "plan_id": rec.plan_id,
                "status": rec.status,
                "version": rec.version,
            },
        }

    # ---- 仅批准门(不执行) ----
    if action == "approve_only":
        try:
            validate_transition(rec.status, "approved")
        except ValueError as e:
            raise HTTPException(status_code=409, detail=str(e)) from None
        if edited_md:
            refine_plan(rec, edited_md, reason=req.reason or "approve edit", channel="user")
        rec.status = "approved"
        rec.updated_at = _now()
        plan_store.save(rec)
        return {
            "code": 0,
            "message": "ok",
            "data": {"plan_id": rec.plan_id, "status": rec.status, "version": rec.version},
        }

    # ---- 拒绝 ----
    if action == "reject":
        try:
            validate_transition(rec.status, "rejected")
        except ValueError as e:
            raise HTTPException(status_code=409, detail=str(e)) from None
        if edited_md:
            refine_plan(rec, edited_md, reason=req.reason or "reject", channel="user")
        rec.status = "rejected"
        rec.updated_at = _now()
        plan_store.save(rec)
        return {
            "code": 0,
            "message": "ok",
            "data": {"plan_id": rec.plan_id, "status": rec.status, "version": rec.version},
        }

    # ---- 批准并执行(approve) ----
    if action == "approve":
        try:
            validate_transition(rec.status, "executing")
        except ValueError as e:
            raise HTTPException(status_code=409, detail=str(e)) from None
        if edited_md:
            refine_plan(rec, edited_md, reason=req.reason or "approve", channel="user")
        tool_names = _resolve_requested_tools(req.tools)
        data = await _execute_plan(rec, tool_names)
        data["version"] = rec.version
        return {"code": 0, "message": "ok", "data": data}

    raise HTTPException(status_code=400, detail=f"未知决策动作: {action}")
