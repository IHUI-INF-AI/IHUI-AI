"""AI 助教路由(3 端点) — 学科讲解 / 提示引导 / AI 出题。

挂载到 main.py,prefix=/api/ai-tutor, tags=["ai-tutor"]。
对应 app/services/ai_tutor.py 三个核心函数:
- POST /api/ai-tutor/explain → explain_concept
- POST /api/ai-tutor/hint    → give_hint
- POST /api/ai-tutor/quiz    → generate_quiz
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.ai_tutor import (
    SUBJECT_VALID,
    explain_concept,
    generate_quiz,
    give_hint,
)

router = APIRouter(prefix="/api/ai-tutor", tags=["ai-tutor"])


class ExplainRequest(BaseModel):
    """学科讲解请求。"""

    subject: str = Field(
        ...,
        description="学科(math/physics/chemistry/biology/english/history/geography)",
    )
    question: str = Field(..., description="学生问题")
    context: dict[str, Any] | None = Field(
        None,
        description="上下文 {chapter, knowledge_points, difficulty}",
    )


class HintRequest(BaseModel):
    """提示引导请求。"""

    subject: str = Field(..., description="学科")
    question: str = Field(..., description="学生问题")
    context: dict[str, Any] | None = Field(
        None,
        description="上下文 {chapter, knowledge_points, difficulty}",
    )


class QuizRequest(BaseModel):
    """AI 出题请求。"""

    subject: str = Field(..., description="学科")
    context: dict[str, Any] | None = Field(
        None,
        description="上下文 {chapter, knowledge_points, difficulty}",
    )
    count: int = Field(1, ge=1, le=10, description="出题数量(1-10)")


def _validate_subject(subject: str) -> None:
    """校验学科是否在支持列表内,否则抛 400。"""
    if subject not in SUBJECT_VALID:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的学科: {subject},支持: {sorted(SUBJECT_VALID)}",
        )


@router.post("/explain")
async def explain(req: ExplainRequest) -> dict[str, Any]:
    """学科概念讲解。

    返回 {answer, knowledge_points, follow_up_questions, resources}。
    """
    _validate_subject(req.subject)
    return await explain_concept(req.subject, req.question, req.context)


@router.post("/hint")
async def hint(req: HintRequest) -> dict[str, Any]:
    """提示引导(不直接给答案,引导学生思考)。

    返回 {hint, next_step_hint, encouragement}。
    """
    _validate_subject(req.subject)
    return await give_hint(req.subject, req.question, req.context)


@router.post("/quiz")
async def quiz(req: QuizRequest) -> dict[str, Any]:
    """AI 出题。

    返回 {questions: [{question_text, options, answer, explanation, knowledge_points, difficulty}]}。
    """
    _validate_subject(req.subject)
    return await generate_quiz(req.subject, req.context, req.count)


__all__ = ["router"]
