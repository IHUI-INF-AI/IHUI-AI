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
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..core.llm_gateway import llm_gateway
from ..services.agent_loop_v2 import AgentLoopV2, ToolDefinition
from ..services.plan_mode import (
    READONLY_TOOLS,
    create_draft,
    plan_store,
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
    session_id: Optional[str] = Field(None, description="关联会话 ID(可选)")
    model: Optional[str] = Field(None, description="指定模型(可选)")


class PlanDecisionRequest(BaseModel):
    """计划决策请求(批准/拒绝)。"""

    approve: bool = Field(..., description="true=批准执行,false=拒绝")
    edited_plan_md: Optional[str] = Field(
        None, description="用户编辑后的计划 markdown(可选,批准时以此为准)"
    )
    tools: Optional[list[str]] = Field(
        None,
        description="限定执行工具名(必须是只读子集;省略=全部只读工具)",
    )


# ---------------------------------------------------------------------------
# 执行器接线(本地最小等价版:import 自 agent_loop_v2 与 llm_gateway,
# 不依赖正在被 W1 改造的 agents.py)
# ---------------------------------------------------------------------------

def _make_loop_v2_llm(model: Optional[str]) -> Any:
    """构造 AgentLoopV2 的 llm_complete_fn(包装 llm_gateway.complete)。"""

    async def _llm(messages: list[dict[str, Any]], tools: list[Any]) -> dict[str, Any]:
        result = await llm_gateway.complete(messages, model=model)
        tool_calls = result.get("tool_calls")
        converted: Optional[list[dict[str, Any]]] = None
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
                converted.append({
                    "id": tc.get("id", ""),
                    "name": fn.get("name", ""),
                    "args": args,
                })
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
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------

@router.post("/agent-plan")
async def create_plan(req: CreatePlanRequest) -> dict[str, Any]:
    """创建计划草稿(只读阶段)。

    返回 data: {plan_id, plan_md, readonly_tools}
    """
    record = await create_draft(
        goal=req.goal, session_id=req.session_id, model=req.model
    )
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
        raise HTTPException(status_code=404, detail=f"计划不存在或已过期: {plan_id}")
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
        },
    }


@router.post("/agent-plan/{plan_id}/decision")
async def decide_plan(plan_id: str, req: PlanDecisionRequest) -> dict[str, Any]:
    """批准/拒绝计划。

    - approve=false:status -> rejected
    - approve=true :status -> executing,用 AgentLoopV2 **同步执行**(工具集 =
      READONLY_TOOLS ∩ 请求 tools 或全部只读),把(可能被用户编辑过的)plan_md
      作为 system 上下文 + goal 作为 user 消息;完成后 status -> done/failed,
      result 入 data 返回。
    """
    try:
        rec = plan_store.get(plan_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"计划不存在或已过期: {plan_id}")

    # 拒绝路径
    if not req.approve:
        try:
            validate_transition(rec.status, "rejected")
        except ValueError as e:
            raise HTTPException(status_code=409, detail=str(e))
        rec.status = "rejected"
        rec.updated_at = _now()
        plan_store.save(rec)
        return {
            "code": 0,
            "message": "ok",
            "data": {"plan_id": rec.plan_id, "status": rec.status},
        }

    # 批准路径:校验状态机(draft -> executing)
    try:
        validate_transition(rec.status, "executing")
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # 用户编辑后的计划以 edited_plan_md 为准
    if req.edited_plan_md is not None and req.edited_plan_md.strip():
        rec.plan_md = req.edited_plan_md

    # 计算执行工具集 = READONLY_TOOLS ∩ (请求 tools 或全部只读)
    requested: Optional[frozenset[str]] = (
        frozenset(req.tools) if req.tools else None
    )
    tool_names = (
        requested & READONLY_TOOLS if requested is not None else READONLY_TOOLS
    )

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
        logger.exception("计划执行异常(plan_id=%s): %s", plan_id, e)
        rec.status = "failed"
        rec.result = {"success": False, "error": str(e), "stop_reason": "error"}

    rec.updated_at = _now()
    plan_store.save(rec)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "plan_id": rec.plan_id,
            "status": rec.status,
            "result": rec.result,
        },
    }
