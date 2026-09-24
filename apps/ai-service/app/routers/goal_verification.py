# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""目标完成度独立校验的 HTTP 入口。

机制本体在 `app/services/completion_verification.py`;本文件只做:
① 请求体校验;② 把证据/指标透传给服务层;③ 把结论如实回给调用方。

刻意不做两件事:
- 不做鉴权(与仓库内其他 /api/* 路由同口径,由边缘网关收口);
- 不缓存结论 —— 校验轮的意义就在于"每次都重新对着证据判一次"。
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.completion_verification import (
    EvidenceRecord,
    HardCriterion,
    VerificationRequest,
    verify_goal_completion,
)

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_CRITERIA = 40
MAX_EVIDENCE = 120
MAX_EXCERPT_CHARS = 20000


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


class CriterionOut(BaseModel):
    criterion_id: str
    verdict: str
    basis: str
    reason: str
    evidence_ids: list[str] = Field(default_factory=list)
    contradicted: bool = False


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


@router.post("/api/agent/goal-verify", response_model=VerifyOut)
async def verify_goal(payload: VerifyIn) -> VerifyOut:
    """对一次目标完成声明跑独立校验轮。"""
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
    request = VerificationRequest(
        criteria=criteria,
        evidence=evidence,
        executor_claim=payload.executor_claim,
        executor_model=payload.executor_model,
        goal=payload.goal,
    )
    try:
        result = await verify_goal_completion(request)
    except Exception as exc:  # noqa: BLE001 - 校验器自身异常必须回 502 而不是 500
        logger.exception("goal-verify 执行异常")
        raise HTTPException(
            status_code=502,
            detail=f"独立校验不可用: {type(exc).__name__}: {exc}",
        ) from exc

    body: dict[str, Any] = {
        "status": result.status,
        "treat_as_complete": result.status == "achieved",
        "criteria": [
            CriterionOut(
                criterion_id=v.criterion_id,
                verdict=v.verdict,
                basis=v.basis,
                reason=v.reason,
                evidence_ids=list(v.evidence_ids),
                contradicted=v.contradicted,
            )
            for v in result.criteria
        ],
        "independent_request_made": result.independent_request_made,
        "judge_model": result.judge_model,
        "unavailable_reason": result.unavailable_reason,
        "independence_warnings": list(result.independence_warnings),
        "executor_claim": payload.executor_claim,
    }
    return VerifyOut(**body)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
