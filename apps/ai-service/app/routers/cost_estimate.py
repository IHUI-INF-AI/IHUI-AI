# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""
成本预检 API(P3 #43 成本协商代理,2026-09-16 立)。

对标竞品全部只有事后账单的代差能力:chat 流**开始前**按消息历史估算本次消耗,
前端据此渲染协商条(用户偏好开关控制)与流内「实际 vs 预估」对比。

估算法(有意保守简单,后续可细化):
- tokensIn = sum(每条消息字符数) / 3(中文为主场景的近似,向上取整)
- tokensOut 默认 = tokensIn × 1.5(问答场景经验比)
- 费用走 core.model_pricing.estimate_cost_usd(既有口径:运行时覆盖 > 模型前缀
  > 厂商兜底 > 全局默认;priced=False 表示未命中模型级价目,仅兜底价参考)
"""

from __future__ import annotations

import math
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..core.model_pricing import estimate_cost_usd

router = APIRouter()


class CostEstimateMessage(BaseModel):
    role: str = Field(default="user")
    content: str = Field(default="")


class CostEstimateRequest(BaseModel):
    model: str = Field(min_length=1)
    messages: list[CostEstimateMessage] = Field(min_length=1)
    # 输出/输入 token 经验比(允许调用方覆盖,默认 1.5)
    outputRatio: float = Field(default=1.5, gt=0)


def estimate_tokens(chars: int) -> int:
    """字符数 → token 近似(中文为主场景:约 3 字符/token,向上取整)。"""
    if chars <= 0:
        return 0
    return math.ceil(chars / 3)


@router.post("/chat/cost-estimate")
async def chat_cost_estimate(req: CostEstimateRequest) -> dict[str, Any]:
    total_chars = sum(len(m.content or "") for m in req.messages)
    tokens_in = estimate_tokens(total_chars)
    tokens_out = math.ceil(tokens_in * req.outputRatio)
    est = estimate_cost_usd(req.model, tokens_in, tokens_out)
    data = {
        "model": req.model,
        "estimatedTokensIn": tokens_in,
        "estimatedTokensOut": tokens_out,
        # USD 金额(round 6 位,与计价服务口径一致);前端如需 CNY 自行按汇率展示
        "estimatedCostUsd": est["cost_usd"],
        # False = 未命中模型级价目,仅厂商兜底/全局默认价,数字仅供参考
        "priced": not est["estimated"],
    }
    return {"code": 0, "message": "ok", "data": data}
