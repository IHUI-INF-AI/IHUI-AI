# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Best-of-N 同任务多副本自动择优路由(2026-09-07 立)。

POST /api/best-of-n/run
    body: {messages, model?, n?, evaluatorModel?, sessionId?}
    resp: {code:0, message:"ok", data:BestOfNResult.to_dict()}
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..services.best_of_n import MAX_N, BestOfNError, best_of_n_runner

logger = logging.getLogger(__name__)

router = APIRouter()


class BestOfNRequest(BaseModel):
    """Best-of-N 请求体。"""

    messages: list[dict[str, Any]] = Field(min_length=1)
    model: str | None = None
    n: int = Field(default=3, ge=1, le=MAX_N)
    evaluatorModel: str | None = None
    sessionId: str = ""


def _get_user_id(request: Request) -> str:
    """从 JWT 中间件回填的 state 取 user_id(未认证为空串,不影响主流程)。"""
    return str(getattr(request.state, "user_id", "") or "")


@router.post("/best-of-n/run")
async def run_best_of_n(req: BestOfNRequest, request: Request) -> dict[str, Any]:
    """同任务 N 副本并行执行 → LLM 评审 → 自动择优。"""
    try:
        result = await best_of_n_runner.run(
            req.messages,
            model=req.model,
            n=req.n,
            evaluator_model=req.evaluatorModel,
            session_id=req.sessionId,
            user_id=_get_user_id(request),
        )
        return {"code": 0, "message": "ok", "data": result.to_dict()}
    except BestOfNError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001 — 网关层统一 502 兜底
        logger.exception("[best-of-n] run failed")
        raise HTTPException(status_code=502, detail=f"best-of-n 执行失败: {e}") from e
