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
    D121 片一(团队共享任务列表):
    4. GET    /orchestration/teams/{team_id}/tasks                  — 列任务
    5. POST   /orchestration/teams/{team_id}/tasks                  — 建任务
    6. PATCH  /orchestration/teams/{team_id}/tasks/{task_id}        — 改标题/状态/持有者
    7. POST   /orchestration/teams/{team_id}/tasks/{task_id}/claim  — 并发安全认领
    8. DELETE /orchestration/teams/{team_id}/tasks/{task_id}        — 删任务
    换手事件(owner 变更)不在这里开新帧:投到既有编排事件总线,读出口是
    GET /api/orchestration/events?event_type=subagent.handoff。

注册到 main.py:app.include_router(team_orchestration.router, prefix="/api",
                                  tags=["orchestration-teams"])
"""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..core.executor_switch import (
    LoopV2ConvergencePilotError,
    guard_loop_v2_pilot,
    take_loop_v2_handoff,
)
from ..services.agent_teams import (
    ResultAggregator,
    TeamContributor,
    TeamTaskMutation,
    team_orchestrator,
    team_task_board,
)
from ..services.dag_scheduler import KANBAN_TASK_STATUSES

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
# 团队任务板请求模型(D121 片一;extra="forbid" = 多余字段直接 422,不静默吞)
# ---------------------------------------------------------------------------


def _validate_kanban_status(value: str) -> str:
    """status 收窄:成员集合单一真相源 = dag_scheduler.KANBAN_TASK_STATUSES。"""
    if value not in KANBAN_TASK_STATUSES:
        raise ValueError(
            "status 必须是下列之一: " + ", ".join(KANBAN_TASK_STATUSES)
        )
    return value


class TeamTaskCreateBody(BaseModel):
    """新建团队共享任务。"""

    model_config = ConfigDict(extra="forbid", strict=True)

    title: str = Field(..., min_length=1, max_length=200, description="任务标题")
    owner: str = Field("", max_length=64, description="初始持有者(空=无人持有)")
    status: str = Field("todo", description="kanban 状态词")

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("title 不能为空白")
        return stripped

    @field_validator("status")
    @classmethod
    def _status_in_vocabulary(cls, value: str) -> str:
        return _validate_kanban_status(value)


class TeamTaskUpdateBody(BaseModel):
    """改任务。未给的字段不改;`owner` 给空串 = 释放持有者(同样算一次换手)。"""

    model_config = ConfigDict(extra="forbid", strict=True)

    title: str | None = Field(None, min_length=1, max_length=200)
    status: str | None = Field(None, description="kanban 状态词")
    owner: str | None = Field(None, max_length=64)
    reason: str = Field("", max_length=200, description="换手原因(写进事件载荷)")

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("title 不能为空白")
        return stripped

    @field_validator("status")
    @classmethod
    def _status_in_vocabulary(cls, value: str | None) -> str | None:
        return None if value is None else _validate_kanban_status(value)


class TeamTaskClaimBody(BaseModel):
    """认领任务。"""

    model_config = ConfigDict(extra="forbid", strict=True)

    owner: str = Field(..., min_length=1, max_length=64, description="认领者")

    @field_validator("owner")
    @classmethod
    def _owner_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("owner 不能为空白")
        return stripped


# 任务板写操作的机器可读 reason → 业务码(404 找不到 / 409 已被别人认领)
_TASK_MUTATION_CODES: dict[str, int] = {
    "not_found": 404,
    "already_claimed": 409,
}


def _task_mutation_response(mutation: TeamTaskMutation) -> dict[str, Any]:
    """把 TeamTaskMutation 映射成统一信封 —— 成功码只在 ok 时为 0。"""
    if mutation.ok:
        task = mutation.task
        return {
            "code": 0,
            "message": "success",
            "data": task.to_wire() if task is not None else None,
        }
    code = _TASK_MUTATION_CODES.get(mutation.reason, 500)
    return {"code": code, "message": mutation.reason, "data": None}


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


# ---------------------------------------------------------------------------
# 团队共享任务列表(D121 片一)
#
# 为什么单独开这组路由而不是塞进 /round:任务板是**跨轮次、跨成员**的共享状态,
# 它的生命周期比一次 fan-out 长(轮次结束任务还在),放在 round 上会让"这一轮跑完
# 了"被误读成"任务没了"。
# ---------------------------------------------------------------------------


@router.get("/orchestration/teams/{team_id}/tasks")
async def list_team_tasks(team_id: str) -> dict[str, Any]:
    """列某团队的全部任务(稳定排序:创建时刻 → id)。"""
    try:
        tasks = team_task_board.list_tasks(team_id)
        return {
            "code": 0,
            "message": "success",
            "data": {
                "teamId": team_id,
                "tasks": [task.to_wire() for task in tasks],
                "total": len(tasks),
            },
        }
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/orchestration/teams/{team_id}/tasks")
async def create_team_task(team_id: str, body: TeamTaskCreateBody) -> dict[str, Any]:
    """新建任务。刚建好且带 owner 时不发换手事件(是从无到有,不是换手)。"""
    try:
        task = team_task_board.create(
            team_id=team_id,
            title=body.title,
            owner=body.owner.strip(),
            status=body.status,
        )
        return {"code": 0, "message": "success", "data": task.to_wire()}
    except ValueError as e:
        return {"code": 400, "message": str(e), "data": None}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.patch("/orchestration/teams/{team_id}/tasks/{task_id}")
async def update_team_task(
    team_id: str, task_id: str, body: TeamTaskUpdateBody
) -> dict[str, Any]:
    """改标题/状态/持有者。owner 变更 → 发 `subagent.handoff` 事件。"""
    try:
        mutation = await team_task_board.update(
            team_id,
            task_id,
            title=body.title,
            status=body.status,
            owner=body.owner.strip() if body.owner is not None else None,
            reason=body.reason,
        )
        return _task_mutation_response(mutation)
    except ValueError as e:
        return {"code": 400, "message": str(e), "data": None}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/orchestration/teams/{team_id}/tasks/{task_id}/claim")
async def claim_team_task(
    team_id: str, task_id: str, body: TeamTaskClaimBody
) -> dict[str, Any]:
    """认领任务。已被他人持有时返回 code 409(带当前任务快照,便于前端刷新)。"""
    try:
        mutation = await team_task_board.claim(team_id, task_id, body.owner)
        return _task_mutation_response(mutation)
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.delete("/orchestration/teams/{team_id}/tasks/{task_id}")
async def delete_team_task(team_id: str, task_id: str) -> dict[str, Any]:
    """删任务。不存在返回 code 404(不谎报成功)。"""
    try:
        if not team_task_board.delete(team_id, task_id):
            return {"code": 404, "message": "not_found", "data": None}
        return {"code": 0, "message": "success", "data": {"id": task_id}}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
