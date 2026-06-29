"""AI Outbound intent analysis routes.

Exposes POST /analyze endpoint that:
1. Classifies user text intent via keyword matching (高/普通/低意向).
2. Determines follow-up action (transfer / end / continue).
3. Calls the LLM asynchronously to generate a reply.

Wraps the utilities in app.utils.outbound.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.schemas.common import ErrorCode, error, success
from app.security import require_login
from app.utils.outbound import _analyze_intent, _determine_action, invoke_llm

logger = logging.getLogger("outbound_routes")

router = APIRouter(prefix="/outbound", tags=["AI Outbound"])


class OutboundAnalyzeRequest(BaseModel):
    """外呼意向分析请求体."""

    text: str = Field(..., description="待分析的用户文本")


@router.post("/analyze", summary="外呼意向分析")
async def analyze_outbound(
    body: OutboundAnalyzeRequest,
    user_uuid: str = Depends(require_login),
):
    """分析用户文本意向并生成回复.

    Flow:
    1. _analyze_intent: keyword-based intent classification (高意向/普通/低意向).
    2. _determine_action: map intent to action (transfer/end/continue).
    3. invoke_llm: async LLM reply generation via DashScope.
    """
    try:
        if not body.text or not body.text.strip():
            return error("text 不能为空", ErrorCode.PARAM_MISSING)

        intent = _analyze_intent(body.text)
        action = _determine_action(intent)
        llm_response = await invoke_llm(body.text)

        return success(
            {
                "intent": intent,
                "action": action,
                "llm_response": llm_response,
            }
        )
    except Exception as e:
        logger.exception("Outbound analyze error")
        return error(f"意向分析异常: {e}", ErrorCode.INTERNAL_ERROR)
