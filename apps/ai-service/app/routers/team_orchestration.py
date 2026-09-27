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

from ..core.executor_switch import (
    LoopV2ConvergencePilotError,
    guard_loop_v2_pilot,
    take_loop_v2_handoff,
)
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
        # D6①/G1 收敛开关接线点(2026-09-27 由"裸守卫"改为消费 handoff 的形态)。
        # 为什么本站在 v2 档仍走"缺投影 ⇒ 显式拒绝"而不是真的跑一次单体循环:
        #   1) 一轮团队 = fan-out N 个 member + 结构化聚合(contributors/aggregate/
        #      summary_context)。本站手上只有 objective 与 tasks,**没有** agent 定义
        #      可投影(member 的 AgentDefinition 在 orchestrator 注册表里,按名字查);
        #   2) 收敛其实**已经发生在叶子** —— team_orchestrator._default_runner →
        #      agent_orchestrator.invoke_parallel → invoke → _run_agent(surface
        #      ``agent_orchestrator._run_agent``)逐个 member 走 v2,并各自带回
        #      iterations/tool_calls。在轮这一层再套一个"整轮单体 agent"会把
        #      fan-out 换成一次执行,那是对外语义变更(需裁决),不是本票的活。
        #   3) 用编造出来的 system_prompt 跑一趟、再拿它顶替 contributors 列表,
        #      正是本仓反复登记的"看起来执行了"那一型,比抛错更坏。
        # 所以:legacy 档返回 None ⇒ guard 空操作 ⇒ 与改前逐字等价;loop_v2 档由底座
        # 抛 AGENT_LOOP_V2_PILOT_NOT_WIRED(既有 except 转 {code:500}),且下面这行
        # 之前不会触达 team_orchestrator —— 零双重执行。
        handoff = await take_loop_v2_handoff("routers/team_orchestration.run_team_round")
        if handoff is not None:  # pragma: no cover - 当前装配下不可达,理由见上
            raise LoopV2ConvergencePilotError(
                "routers/team_orchestration.run_team_round",
                handoff.decided_mode,
                "本站拿到了单次收敛结果,但 TeamRoundResult(contributors/aggregate/"
                "summary_context)无法由一次单体执行诚实产出 —— 拒绝静默丢弃",
            )
        guard_loop_v2_pilot("routers/team_orchestration.run_team_round")

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
