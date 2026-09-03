# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""多智能体团队协作路由(Agent Teams)。

端点清单:
    1. POST /orchestration/teams/round     — 一呃团队 fan-out + 聚合(真实并行派发)
    2. POST /orchestration/teams/run       — 多轮团队协作(聚合摘要回传下一轮)
    3. POST /orchestration/teams/aggregate — 对已收集结果做纯聚合(不派发,演示闭环)

注册到 main.py:app.include_router(team_orchestration.router, prefix="/api",
                                  tags=["orchestration-teams"])
"""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..services.agent_teams import (
    ResultAggregator,
    TeamContributor,
    team_orchestrator,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class TeamTask(BaseModel):
    """单个 fan-out 子任务。"""

    name: str = Field(..., description="目标 agent 名称")
    task: str = Field(..., description="子任务描述")
    context: dict[str, Any] | None = Field(None, description="可选上下文")
    conclusion: str = Field("", description="可选简短结论标签(供共识/冲突检测)")


class TeamRoundBody(BaseModel):
    objective: str = Field(..., description="本轮团队目标")
    tasks: list[TeamTask] = Field(..., description="并行派发的子任务")
    strategy: str = Field("merge", description="merge/best_of/consensus")
    max_concurrency: int = Field(5, ge=1, le=20)


class RoundSpec(BaseModel):
    tasks: list[TeamTask] = Field(default_factory=list)
    strategy: str = Field("merge", description="merge/best_of/consensus")
    max_concurrency: int = Field(5, ge=1, le=20)


class TeamRunBody(BaseModel):
    objective: str = Field(..., description="多轮团队总目标")
    rounds: list[RoundSpec] = Field(..., description="逐轮任务/策略")


class TeamAggregateBody(BaseModel):
    """对已收集结果做纯聚合(无需重新派发)。"""

    contributors: list[dict[str, Any]] = Field(..., description="TeamContributor 的 dict 列表")
    strategy: str = Field("merge", description="merge/best_of/consensus")


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.post("/orchestration/teams/round")
async def run_team_round(body: TeamRoundBody) -> dict[str, Any]:
    """并行 fan-out 多个 subagent 并做结构化聚合,产成回传主循环的 summary_context。"""
    try:
        result = await team_orchestrator.run_round(
            objective=body.objective,
            tasks=[t.model_dump() for t in body.tasks],
            strategy=body.strategy,  # type: ignore[arg-type]
            max_concurrency=body.max_concurrency,
        )
        return {"code": 0, "message": "success", "data": result.to_dict()}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/orchestration/teams/run")
async def run_team_multi_rounds(body: TeamRunBody) -> dict[str, Any]:
    """多轮团队协作:每轮聚合摘要经 round_context 回传给下一轮 subagent。"""
    try:
        data = await team_orchestrator.run_multi_rounds(
            objective=body.objective,
            rounds=[r.model_dump() for r in body.rounds],
        )
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/orchestration/teams/aggregate")
async def aggregate_results(body: TeamAggregateBody) -> dict[str, Any]:
    """纯聚合已收集的 subagent 结果(不派发,便于主循环复用既有产出)。"""
    try:
        contributors = [
            TeamContributor.from_task_result(c) for c in body.contributors
        ]
        data = ResultAggregator.aggregate(
            contributors, body.strategy  # type: ignore[arg-type]
        )
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
