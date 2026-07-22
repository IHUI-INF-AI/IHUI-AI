"""POST /api/v1/ai/agent/invoke — 智能体调用端点(单 agent + 编排)。

业务流:
1. 单 agent invoke: 直接调用指定 agent 执行任务
2. Pipeline: 串行编排多个 agent,前一个 output 作为后一个 input
3. Parallel: 并行调用多个 agent,合并结果
4. List agents: 列出可用 agent 列表

支持:
- 5 个默认 agent(researcher / coder / reviewer / architect / debugger)
- 自定义 agent 注册
- 完整 trace 返回
- stub 降级
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ...services.agent_orchestrator import (
    AgentDefinition,
    agent_orchestrator,
)
from ...services.task_decomposer import task_decomposer

router = APIRouter()


class AgentInvokeRequest(BaseModel):
    """单 agent 调用请求。"""

    agent: str = Field(..., description="agent 名称")
    message: str = Field(..., description="用户输入")
    session_id: str | None = Field(None, description="会话 ID")
    model: str | None = Field(None, description="模型覆盖")


class PipelineStep(BaseModel):
    """Pipeline 步骤。"""

    agent: str = Field(..., description="agent 名称")
    input_template: str = Field(
        "{input}",
        description="输入模板,支持 {input} {prev_output} {step} 占位符",
    )


class PipelineRequest(BaseModel):
    """Pipeline 执行请求。"""

    steps: list[PipelineStep] = Field(..., description="步骤列表")
    initial_input: str = Field(..., description="初始输入")
    session_id: str | None = Field(None, description="共享 session id")


class ParallelRequest(BaseModel):
    """并行执行请求。"""

    items: list[dict[str, Any]] = Field(..., description="[{agent, input}, ...]")
    session_id: str | None = Field(None, description="共享 session id")


class RegisterAgentRequest(BaseModel):
    """注册自定义 agent 请求。"""

    name: str = Field(..., description="agent 唯一名称")
    description: str = Field("", description="agent 描述")
    system_prompt: str = Field(..., description="agent 系统提示词")
    tools: list[str] = Field(default_factory=list, description="可用工具列表")
    model: str | None = Field(None, description="默认模型")
    max_iterations: int = Field(5, ge=1, le=20, description="最大迭代次数")
    metadata: dict[str, Any] = Field(default_factory=dict, description="元数据")


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.post("/agent/invoke")
async def agent_invoke(req: AgentInvokeRequest) -> dict[str, Any]:
    """单 agent 调用。"""
    try:
        result = await agent_orchestrator.invoke(
            agent_name=req.agent,
            user_input=req.message,
            session_id=req.session_id,
            model_override=req.model,
        )
        return {
            "code": 0 if result.status == "completed" else 1,
            "message": "ok" if result.status == "completed" else result.error or "failed",
            "data": agent_orchestrator.step_result_to_dict(result),
        }
    except Exception as e:
        return {
            "code": 500,
            "message": f"agent 调用失败: {e}",
            "data": {"error": str(e)},
        }


@router.post("/agent/pipeline")
async def agent_pipeline(req: PipelineRequest) -> dict[str, Any]:
    """串行 pipeline 编排。"""
    try:
        steps_dict = [s.model_dump() for s in req.steps]
        result = await agent_orchestrator.run_pipeline(
            steps=steps_dict,
            initial_input=req.initial_input,
            session_id=req.session_id,
        )
        return {
            "code": 0 if result.status == "completed" else 1,
            "message": "ok" if result.status == "completed" else "pipeline failed",
            "data": agent_orchestrator.orchestration_to_dict(result),
        }
    except Exception as e:
        return {
            "code": 500,
            "message": f"pipeline 执行失败: {e}",
            "data": {"error": str(e)},
        }


@router.post("/agent/parallel")
async def agent_parallel(req: ParallelRequest) -> dict[str, Any]:
    """并行多 agent 编排。"""
    try:
        result = await agent_orchestrator.run_parallel(
            agent_inputs=req.items,
            session_id=req.session_id,
        )
        return {
            "code": 0 if result.status == "completed" else 1,
            "message": "ok" if result.status == "completed" else "partial failed",
            "data": agent_orchestrator.orchestration_to_dict(result),
        }
    except Exception as e:
        return {
            "code": 500,
            "message": f"parallel 执行失败: {e}",
            "data": {"error": str(e)},
        }


@router.get("/agent/list")
async def list_agents() -> dict[str, Any]:
    """列出所有可用 agent。"""
    agents = agent_orchestrator.registry.list_agents()
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "agents": [a.to_dict() for a in agents],
            "count": len(agents),
        },
    }


@router.post("/agent/register")
async def register_agent(req: RegisterAgentRequest) -> dict[str, Any]:
    """注册自定义 agent。"""
    agent = AgentDefinition(
        name=req.name,
        description=req.description,
        system_prompt=req.system_prompt,
        tools=req.tools,
        model=req.model,
        max_iterations=req.max_iterations,
        metadata=req.metadata,
    )
    ok = agent_orchestrator.registry.register(agent)
    if not ok:
        raise HTTPException(status_code=400, detail="无效的 agent 名称")
    return {
        "code": 0,
        "message": "ok",
        "data": agent.to_dict(),
    }


# ---------------------------------------------------------------------------
# P3-3 调度系统端点:任务分解 + 分解式执行
# ---------------------------------------------------------------------------


class DecomposeRequest(BaseModel):
    """任务分解请求(P3-3)。"""

    task: str = Field(..., description="任务描述")
    available_agents: list[dict[str, Any]] = Field(
        default_factory=list,
        description="可用 agent 列表 [{name, capabilities: []}]",
    )
    strategy: str = Field("dag", description="分解策略:sequential/parallel/dag/recursive")
    max_sub_tasks: int = Field(10, ge=1, le=50, description="最大子任务数")


class RunDecomposedRequest(BaseModel):
    """分解式执行请求(P3-3)。"""

    task: str = Field(..., description="任务描述")
    strategy: str = Field("dag", description="分解策略:sequential/parallel/dag/recursive")
    session_id: str | None = Field(None, description="会话 ID")


@router.post("/agent/decompose")
async def agent_decompose(req: DecomposeRequest) -> dict[str, Any]:
    """任务分解:LLM 驱动分解为子任务 + 拓扑排序 + 并行批次计算。

    返回 TaskDecompositionResult(subTasks / executionOrder / parallelBatches / strategy)。
    """
    try:
        result = await task_decomposer.decompose({
            "task": req.task,
            "availableAgents": req.available_agents,
            "strategy": req.strategy,
            "maxSubTasks": req.max_sub_tasks,
        })
        return {
            "code": 0,
            "message": "ok",
            "data": result.to_dict(),
        }
    except Exception as e:
        return {
            "code": 500,
            "message": f"任务分解失败: {e}",
            "data": {"error": str(e)},
        }


@router.post("/agent/run-decomposed")
async def agent_run_decomposed(req: RunDecomposedRequest) -> dict[str, Any]:
    """分解式执行:任务分解 → 调度分配 → 按并行批次执行 → 重试/故障转移 → 汇总。

    返回 OrchestrationResult(steps / finalOutput / status / totalDurationMs / trace)。
    """
    try:
        result = await agent_orchestrator.run_decomposed(
            task=req.task,
            strategy=req.strategy,
            session_id=req.session_id,
        )
        return {
            "code": 0 if result.status == "completed" else 1,
            "message": "ok" if result.status == "completed" else "decomposed run failed",
            "data": agent_orchestrator.orchestration_to_dict(result),
        }
    except Exception as e:
        return {
            "code": 500,
            "message": f"分解式执行失败: {e}",
            "data": {"error": str(e)},
        }
