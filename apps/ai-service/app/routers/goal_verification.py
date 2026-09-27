# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""目标完成度独立校验的 HTTP 入口(AGENTS.md §8 第 3/4 步)。

机制本体在 `app/services/completion_verification.py`(逐条判定)与
`app/services/goal_round_state.py`(跨轮账本);本文件只做四件事:
① 请求体校验;② 把证据/指标透传给服务层;③ 把结论**逐条**如实回给调用方;
④ 有 `session_id` 时把这一轮记进跨轮账本,并把"该不该停"算出来。

本端点族此前的形状是"只有一个 POST、且完全无状态"(V3 #77 立票时核证的现状):
`consecutive_failures` 恒 0、没有读面、没有清账面 —— 于是 §8 第 4 步
("连续 N 轮无进展 → blocked")在这条链上**从未可能成立**:调用方每重启一次就
从头数。现在补齐的是那另一半:

- `GET  /api/agent/goal-state`  —— 读一个会话的账(轮次/连击/无进展/预算/是否收口);
- `POST /api/agent/goal-verify` —— 判 + 记账;账本已收口时**不再另起一次 judge**
  (既省一次推理费,也让"忽略评估文本"的调用方拿不到任何可当成通过的答复);
- `POST /api/agent/goal-verify/reset` —— 换目标/人工放行时清账(唯一清账出口)。

三条不可让的口径(与 `completion_verification` 同形,不在本层重新发明):

1. **"判不了"永远不折进"成立"**。逐条 verdict 是三态(met/unmet/unknown),整体
   `treat_as_complete` 只在 `status == "achieved"` 时为真;响应另给
   `undetermined_count` 与 `ledger_unreadable`,让调用方看得见"有几条根本没判出来"
   与"这一问的连击数是否可信"。
2. **认证 ≠ 授权**。`owner_user_id` 由请求体自报时**一律不信**:归属只从令牌主体
   (`core/jwt_auth.resolve_request_user_id`)取。自报值与主体不一致 ⇒ 403,且
   **发生在任何存储读取与 judge 调用之前**(用例断言"未发出查询")。
   账本已有属主而主体不符 ⇒ 403,不写账、不起 judge、不回任何存量内容。
3. **无状态调用零行为变化**。不带 `session_id` 的既有调用方(含 apps/cli 的
   `runGoalVerification`)不记本账、不受属主约束、拿到的判定与搬前逐字段等值 ——
   否则给一个不存在的会话记账,会把别人的收口结论套到无关请求上。
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator

from ..core.jwt_auth import (
    DEV_ANONYMOUS_PRINCIPAL,
    auth_globally_enforced,
    require_request_user_id,
    resolve_request_user_id,
)
from ..core.tunables import GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES
from ..services.completion_verification import (
    CriterionVerdict,
    EvidenceRecord,
    HardCriterion,
    VerificationRequest,
    verify_goal_completion,
)
from ..services.goal_round_state import (
    GoalRoundState,
    WriteReceipt,
    advance_round_state,
    decide_pause,
    get_store,
    normalize_outcome,
)

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_CRITERIA = 40
MAX_EVIDENCE = 120
MAX_EXCERPT_CHARS = 20000
MAX_SESSION_ID_CHARS = 200

#: 校验轮的整体结论封闭集(与 completion_verification.VerdictStatus 同值)
_STATUS_ACHIEVED = "achieved"
_STATUS_NOT_ACHIEVED = "not_achieved"
_STATUS_UNDETERMINED = "undetermined"
#: 账本已收口时本层给出的档:不是校验结果,是"不再受理下一轮"
_STATUS_BLOCKED = "blocked"


class CriterionIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    statement: str = Field(min_length=1, max_length=2000)
    evidence_kind: str = Field(default="manual", max_length=32)
    required: bool = True


class EvidenceIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    criterion_id: str = Field(min_length=1, max_length=64)
    source: str = Field(min_length=1, max_length=200)
    outcome: Literal["met", "unmet", "absent"] | None = None
    excerpt: str = Field(default="", max_length=MAX_EXCERPT_CHARS)
    unavailable_reason: str | None = Field(default=None, max_length=2000)
    truncated: bool = False
    captured_at: float = 0.0


class VerifyIn(BaseModel):
    goal: str = Field(default="", max_length=4000)
    criteria: list[CriterionIn]
    evidence: list[EvidenceIn] = Field(default_factory=list)
    #: 执行者自述:仅回显给调用方做对照,**不参与判定**
    executor_claim: str = Field(default="", max_length=4000)
    executor_model: str | None = Field(default=None, max_length=200)
    #: 带上它 = 这一轮要记进跨轮账本(才会触发属主校验与收口短路)。
    #: 不带 = 与接线前逐字段等值的无状态校验。
    session_id: str | None = Field(default=None, max_length=MAX_SESSION_ID_CHARS)
    #: **自报属主,一律不信**(见模块 docstring 第 2 条)。留着这个字段的唯一作用是:
    #: 它与令牌主体不一致时构成一次越权尝试 ⇒ 403;一致时它不提供任何额外权力。
    owner_user_id: str | None = Field(default=None, max_length=200)
    #: 本轮消耗的 token(调用方上报;从未上报即 None,不得当成 0)
    tokens_this_round: int | None = Field(default=None, ge=0)
    #: 预算上限(§8 budget 子命令语义)。必须为正数,0 会被读成"已耗尽"
    token_budget: int | None = Field(default=None, gt=0)

    @field_validator("session_id")
    @classmethod
    def _strip_session(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("session_id 不得为空白")
        return trimmed


class CriterionOut(BaseModel):
    criterion_id: str
    #: 三态:met / unmet / unknown。**unknown 不得被上游读成 met**(§8 第 3 步)
    verdict: str
    basis: str
    reason: str
    evidence_ids: list[str] = Field(default_factory=list)
    contradicted: bool = False
    #: 逐条回显 required:否则调用方看得见"哪条没过",却看不见"哪条没过会拦住整体"
    required: bool = True


class VerifyOut(BaseModel):
    status: str
    #: undetermined 时调用方必须按"未完成"处理,不得当成通过
    treat_as_complete: bool
    criteria: list[CriterionOut]
    independent_request_made: bool
    judge_model: str | None = None
    unavailable_reason: str | None = None
    independence_warnings: list[str] = Field(default_factory=list)
    executor_claim: str = ""
    #: 收口阈值的**权威值随响应下发**(真源 = `core/tunables.py`)。调用方(如 CLI)跑的是
    #: 它自己的循环,计数只能在端内做,但阈值不得在端内另立一份真相 —— 端内那份只是
    #: "服务端没给"时的兜底。两端各抄一份数字正是本仓反复踩过的第二真相形态。
    max_consecutive_failures: int = GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES
    #: 无状态调用恒 0(并如实标 `stateful: false`);带 session_id 时为账本累计值
    consecutive_failures: int = 0
    # —— 逐条三态的聚合位(V3 #77 第 1 项:"判不了"必须数得出来)——
    met_count: int = 0
    unmet_count: int = 0
    #: verdict=unknown 的条数。>0 而 status 仍报 achieved 是矛盾的,机制层已排除
    undetermined_count: int = 0
    #: 必需项里判不了的条数(这一档 >0 必然整体 undetermined)
    required_undetermined: int = 0
    # —— 跨轮账本位(第 2/3 项)——
    stateful: bool = False
    session_id: str | None = None
    rounds: int = 0
    stagnation: int = 0
    goal_status: str | None = None
    #: 必须停手:账本判收口(连续未过 / 无进展 / 预算耗尽)
    should_pause: bool = False
    #: 必须到人:含 should_pause,外加"账读不出来"这一型(连击被低估,不能安静续跑)
    escalate: bool = False
    pause_reason: str = ""
    #: 这一问的账落在哪一层。"memory" = 重启即失,不得被读成已持久
    ledger_storage: str = "memory"
    ledger_durable: bool = False
    #: true = 上一轮的账读不出形状(存储故障/载荷漂移)。此时 consecutive_failures
    #: 是**低估值**,调用方不得据此宣布"这才第一轮,还早"
    ledger_unreadable: bool = False
    tokens_spent: int | None = None
    token_budget: int | None = None


class GoalStateOut(BaseModel):
    """`GET /api/agent/goal-state` 的响应:账本原文 + 暂停结论(不含任何判定重算)。"""

    found: bool
    unreadable: bool
    reason: str | None = None
    state: dict[str, Any] | None = None
    should_pause: bool = False
    escalate: bool = False
    pause_reason: str = ""
    max_consecutive_failures: int = GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES
    ledger_storage: str = "memory"
    ledger_durable: bool = False


class ResetIn(BaseModel):
    session_id: str = Field(min_length=1, max_length=MAX_SESSION_ID_CHARS)
    owner_user_id: str | None = Field(default=None, max_length=200)


class ResetOut(BaseModel):
    cleared: bool
    session_id: str


def _validate_payload(payload: VerifyIn) -> None:
    if not payload.criteria:
        raise HTTPException(status_code=422, detail="criteria 不能为空")
    if len(payload.criteria) > MAX_CRITERIA:
        raise HTTPException(status_code=413, detail=f"criteria 最多 {MAX_CRITERIA} 条")
    if len(payload.evidence) > MAX_EVIDENCE:
        raise HTTPException(status_code=413, detail=f"evidence 最多 {MAX_EVIDENCE} 条")
    ids = [c.id for c in payload.criteria]
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=422, detail="criteria.id 不得重复")
    evidence_ids = [e.id for e in payload.evidence]
    if len(set(evidence_ids)) != len(evidence_ids):
        raise HTTPException(status_code=422, detail="evidence.id 不得重复")
    unknown_refs = sorted({e.criterion_id for e in payload.evidence} - set(ids))
    if unknown_refs:
        raise HTTPException(
            status_code=422,
            detail=f"证据挂到了未声明的指标: {', '.join(unknown_refs)}",
        )


def _resolve_principal(request: Request, claimed: str | None) -> str:
    """有状态调用的属主判定:**只认令牌主体**,且自报值不符即 403。

    必须在任何 store 读取与 judge 调用之前跑完 —— 判"这个会话属于谁"若先查了库,
    状态码本身就把"该会话存在"泄露给了一次未授权探测(存在性预言机)。
    """
    principal = resolve_request_user_id(request)
    if principal is None:
        if auth_globally_enforced():
            # 生产态:带会话记账必须有可证明主体,否则这本账无主可读 = 谁都能续
            raise HTTPException(status_code=401, detail="带会话的校验记账需要身份")
        principal = DEV_ANONYMOUS_PRINCIPAL
    if claimed is not None and claimed.strip() and claimed.strip() != principal:
        raise HTTPException(
            status_code=403,
            detail="请求体自报的 owner_user_id 与令牌主体不一致(不采信自报归属)",
        )
    return principal


def _assert_state_ownership(state: GoalRoundState | None, principal: str) -> None:
    """账本已有属主时,主体必须一致(认证 ≠ 授权)。"""
    stored = state.owner_user_id if state is not None else None
    if stored and stored != principal:
        raise HTTPException(status_code=403, detail="该会话的评估账本不属于当前主体")


def _aggregate(
    verdicts: list[CriterionOut], required_by_id: dict[str, bool]
) -> dict[str, int]:
    """逐条三态的聚合位。四个计数彼此不重叠地描述同一批判定。"""
    return {
        "met_count": sum(1 for v in verdicts if v.verdict == "met"),
        "unmet_count": sum(1 for v in verdicts if v.verdict == "unmet"),
        "undetermined_count": sum(1 for v in verdicts if v.verdict == "unknown"),
        "required_undetermined": sum(
            1
            for v in verdicts
            if v.verdict == "unknown" and required_by_id.get(v.criterion_id, True)
        ),
    }


def _criterion_views(
    result_criteria: Sequence[CriterionVerdict], required_by_id: dict[str, bool]
) -> list[CriterionOut]:
    return [
        CriterionOut(
            criterion_id=v.criterion_id,
            verdict=v.verdict,
            basis=v.basis,
            reason=v.reason,
            evidence_ids=list(v.evidence_ids),
            contradicted=v.contradicted,
            required=required_by_id.get(v.criterion_id, True),
        )
        for v in result_criteria
    ]


def _ledger_fields(
    state: GoalRoundState | None, receipt: WriteReceipt
) -> dict[str, Any]:
    """账本位。**只搬回执**,不在这里重算"落没落住"。

    曾经的写法是 `ledger_durable = storage == "checkpoint"` —— 那是把存储层自己报的
    事实又推导一遍。底层三层存储退化成纯内存时(未配 DATABASE_URL/REDIS_URL),
    storage 仍叫 "checkpoint" 而 durable 已是 False,这一行就会替退化后的部署背书。
    """
    return {
        "rounds": 0 if state is None else state.rounds,
        "consecutive_failures": 0 if state is None else state.consecutive_failures,
        "stagnation": 0 if state is None else state.stagnation,
        "goal_status": None if state is None else state.last_status,
        "tokens_spent": None if state is None else state.tokens_spent,
        "token_budget": None if state is None else state.token_budget,
        "ledger_storage": receipt.storage,
        "ledger_durable": receipt.durable,
    }


@router.post("/api/agent/goal-verify", response_model=VerifyOut)
async def verify_goal(payload: VerifyIn, request: Request) -> VerifyOut:
    """对一次目标完成声明跑独立校验轮;带 `session_id` 时并记账、并给出收口结论。"""
    _validate_payload(payload)
    required_by_id = {c.id: c.required for c in payload.criteria}

    # —— 有状态路径的前置:属主 + 账本读取(顺序即安全结论,见 `_resolve_principal`)
    principal: str | None = None
    previous: GoalRoundState | None = None
    ledger_unreadable = False
    ledger_reason: str | None = None
    storage = get_store().describe()
    if payload.session_id is not None:
        principal = _resolve_principal(request, payload.owner_user_id)
        read = await get_store().read(payload.session_id)
        _assert_state_ownership(read.state, principal)
        previous = read.state
        ledger_unreadable = read.unreadable
        ledger_reason = read.reason

    # —— 收口短路:账本已 blocked 就不再受理下一轮(省一次推理,也不给任何"通过"答复)
    if previous is not None and previous.blocked:
        pause = decide_pause(previous, ledger_unreadable=ledger_unreadable)
        return VerifyOut(
            status=_STATUS_BLOCKED,
            treat_as_complete=False,
            criteria=[],
            independent_request_made=False,
            unavailable_reason="连续多轮无进展/未通过,goal 已收口;需要人工重置账本"
            f"(原因:{pause.reason})",
            executor_claim=payload.executor_claim,
            stateful=True,
            session_id=payload.session_id,
            should_pause=True,
            escalate=True,
            pause_reason=pause.reason,
            ledger_unreadable=ledger_unreadable,
            **_ledger_fields(previous, storage),
        )

    criteria = [
        HardCriterion(
            id=c.id,
            statement=c.statement,
            evidence_kind=c.evidence_kind,
            required=c.required,
        )
        for c in payload.criteria
    ]
    evidence = [
        EvidenceRecord(
            id=e.id,
            criterion_id=e.criterion_id,
            source=e.source,
            outcome=None if e.outcome in (None, "absent") else e.outcome == "met",
            excerpt=e.excerpt,
            unavailable_reason=e.unavailable_reason,
            truncated=e.truncated,
            captured_at=e.captured_at,
        )
        for e in payload.evidence
    ]
    request_model = VerificationRequest(
        criteria=criteria,
        evidence=evidence,
        executor_claim=payload.executor_claim,
        executor_model=payload.executor_model,
        goal=payload.goal,
    )
    try:
        result = await verify_goal_completion(request_model)
    except Exception as exc:  # noqa: BLE001 - 校验器自身异常必须回 502 而不是 500
        logger.exception("goal-verify 执行异常")
        raise HTTPException(
            status_code=502,
            detail=f"独立校验不可用: {type(exc).__name__}: {exc}",
        ) from exc

    views = _criterion_views(result.criteria, required_by_id)
    counts = _aggregate(views, required_by_id)

    body: dict[str, Any] = {
        "status": result.status,
        # 唯一能宣布完成的盖章位:achieved 之外一律 False(含 undetermined)
        "treat_as_complete": result.status == _STATUS_ACHIEVED,
        "criteria": views,
        "independent_request_made": result.independent_request_made,
        "judge_model": result.judge_model,
        "unavailable_reason": result.unavailable_reason,
        "independence_warnings": list(result.independence_warnings),
        "executor_claim": payload.executor_claim,
        **counts,
    }

    if payload.session_id is None or principal is None:
        # 无状态:与搬前逐字段等值(只多了聚合位),不落账 ⇒ 不得假装落得住
        return VerifyOut(**body, stateful=False, **_ledger_fields(None, storage))

    state = advance_round_state(
        session_id=payload.session_id,
        owner_user_id=principal,
        outcome=normalize_outcome(
            status=result.status,
            unmet=[v.criterion_id for v in views if v.verdict != "met"],
            tokens_this_round=payload.tokens_this_round,
            token_budget=payload.token_budget,
        ),
        previous=previous,
        max_consecutive_failures=GOAL_VERIFICATION_MAX_CONSECUTIVE_FAILURES,
    )
    receipt = await get_store().write(state)
    pause = decide_pause(state, ledger_unreadable=ledger_unreadable)
    fields = _ledger_fields(state, receipt)
    if state.blocked:
        # 本轮把账推到收口:status 抬到 blocked(只会更保守,绝不会更宽松)
        body["status"] = _STATUS_BLOCKED
        body["treat_as_complete"] = False
        body["unavailable_reason"] = body.get("unavailable_reason") or (
            f"本轮后已达收口条件(原因:{pause.reason})"
        )
    return VerifyOut(
        **body,
        stateful=True,
        session_id=payload.session_id,
        should_pause=pause.pausing,
        escalate=pause.escalate,
        pause_reason=pause.reason,
        ledger_unreadable=ledger_unreadable,
        **fields,
    )


@router.get("/api/agent/goal-state", response_model=GoalStateOut)
async def read_goal_state(
    request: Request,
    session_id: str = Query(min_length=1, max_length=MAX_SESSION_ID_CHARS),
    owner_user_id: str | None = Query(default=None, max_length=200),
) -> GoalStateOut:
    """读一个会话的评估账本(第 2 项要的"上报"面;零重算,只回账本原文)。"""
    key = session_id.strip()
    if not key:
        raise HTTPException(status_code=422, detail="session_id 不得为空白")
    principal = _resolve_principal(request, owner_user_id)
    store = get_store()
    receipt = store.describe()
    read = await store.read(key)
    _assert_state_ownership(read.state, principal)
    pause = decide_pause(read.state, ledger_unreadable=read.unreadable)
    return GoalStateOut(
        found=read.found,
        unreadable=read.unreadable,
        reason=read.reason,
        state=None if read.state is None else read.state.as_view(),
        should_pause=pause.pausing,
        escalate=pause.escalate,
        pause_reason=pause.reason,
        ledger_storage=receipt.storage,
        ledger_durable=receipt.durable,
    )


@router.post("/api/agent/goal-verify/reset", response_model=ResetOut)
async def reset_goal_state(
    payload: ResetIn,
    principal: str = Depends(require_request_user_id),
) -> ResetOut:
    """清账(换目标 / 人工确认后放行)。这是 blocked 之后唯一的继续路径。

    刻意要身份(`require_request_user_id`,不给开发降级留口子之外的第二条路):
    免身份的清账 = 任何人一句话就把别人的收口抹掉,那比没有收口更糟。
    账本已有属主时只有属主能清 —— 见 `_assert_state_ownership`。
    """
    key = payload.session_id.strip()
    if not key:
        raise HTTPException(status_code=422, detail="session_id 不得为空白")
    if payload.owner_user_id is not None and payload.owner_user_id.strip():
        claimed = payload.owner_user_id.strip()
        if claimed != principal:
            raise HTTPException(
                status_code=403,
                detail="请求体自报的 owner_user_id 与令牌主体不一致(不采信自报归属)",
            )
    store = get_store()
    read = await store.read(key)
    _assert_state_ownership(read.state, principal)
    cleared = await store.clear(key)
    logger.info("goal 评估账本已重置:session=%s by=%s cleared=%s", key, principal, cleared)
    return ResetOut(cleared=cleared, session_id=key)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
