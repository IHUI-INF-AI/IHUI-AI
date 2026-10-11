# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D176 任务回顾→移交新任务(2026-09-30 用户拍板立项)——交接文档生成出口。

把 `app/core/context_fragments.build_recap_prompt / parse_recap_response` 这对既有
机器从"内部 developer 片段"(agent_loop_v2 默认关的注入通道,产物不回传)提升为
对外端点:入 thread_id + purpose,取线程历史(session_store.resume)组装有界补课
提示词,LLM 生成 {summary, next_action}。

身份纪律(§5b):user_id 只从承载层 Depends(get_current_user_id) 进来,
用于鉴权存在性,不从请求体取;线程归属判定沿用 session_store 的既有语义。
"""

from __future__ import annotations

import asyncio
import logging

import litellm
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.context_fragments import build_recap_prompt, parse_recap_response
from app.core.jwt_auth import get_current_user_id
from app.routers.sessions import get_session_store
from app.services.session_store import ThreadNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter()

_RECAP_TIMEOUT_S = 60.0


class RecapHandoffRequest(BaseModel):
    thread_id: str = Field(min_length=1)
    purpose: str = Field(default="", max_length=2000)


@router.post("/agent/recap/handoff")
async def generate_recap_handoff(
    req: RecapHandoffRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, object]:
    """生成交接文档(有界补课说明)。身份只取承载层 user_id。"""
    store = get_session_store()
    try:
        messages = store.resume(req.thread_id)
    except ThreadNotFoundError:
        raise HTTPException(status_code=404, detail="thread not found") from None
    history = "\n".join(
        f"{m.role}: {m.content}" for m in messages if (m.content or "").strip()
    )
    purpose = req.purpose.strip()
    if purpose:
        history = f"{history}\n\n交接目的:{purpose}"
    prompt = build_recap_prompt(history)
    try:
        resp = await asyncio.wait_for(
            litellm.acompletion(
                model=settings.litellm_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
            ),
            timeout=_RECAP_TIMEOUT_S,
        )
    except TimeoutError:
        raise HTTPException(status_code=504, detail="recap generation timed out") from None
    except Exception as exc:  # noqa: BLE001 - litellm 异常族不稳定,统一按上游失败兜底
        logger.warning("recap handoff generation failed for user=%s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail="recap generation failed") from None
    text = str(resp.choices[0].message.content or "")
    parsed = parse_recap_response(text)
    return {
        "code": 0,
        "message": "ok",
        "data": {"summary": parsed["summary"], "next_action": parsed["next_action"]},
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
