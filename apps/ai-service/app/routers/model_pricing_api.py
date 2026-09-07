# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:模型价表只读 API(P3-9 成本真网计价 — 看板数据出口)。

"""模型价表只读路由(P3-9)。

- GET /api/model-pricing → 单一价目源(app/core/model_pricing.py)的全量快照:
  模型级价目(前缀匹配表)/厂商级兜底/运行时覆盖/覆盖率统计。
  供 web admin「模型定价」看板展示价表覆盖率与估算 vs 价表口径。

安全:复用全局 JWT 中间件(与 /cost-ledger/* 同级);信封契约 {code,message,data}。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from ..core import model_pricing

router = APIRouter(prefix="/model-pricing", tags=["model-pricing"])

# 价表口径说明(数据来源与生效口径,随真源注释同步维护)
PRICING_SOURCE_META = {
    "source": "public-rates",
    "note": "公开牌价(2025 下半年口径),USD per 1M tokens;精确计费以厂商账单为准",
}


def build_pricing_snapshot() -> dict[str, Any]:
    """组装价表全量快照(纯函数,便于测试;router 仅做信封包装)。"""
    models = [
        {"model": key, "input": float(price["input"]), "output": float(price["output"])}
        for key, price in sorted(
            model_pricing._MODEL_PRICES_PER_1M.items(),
            key=lambda kv: len(kv[0]),
            reverse=True,
        )
    ]
    providers = {
        key: {"input": float(price["input"]), "output": float(price["output"])}
        for key, price in model_pricing.PROVIDER_PRICES_PER_1M.items()
    }
    overrides = {
        key: {"input": float(price["input"]), "output": float(price["output"])}
        for key, price in model_pricing.get_overrides().items()
    }
    return {
        "models": models,
        "providers": providers,
        "overrides": overrides,
        "coverage": {
            "model_count": len(models),
            "provider_count": len(providers),
            "override_count": len(overrides),
        },
        "meta": dict(PRICING_SOURCE_META),
    }


@router.get("", response_model=None)
async def get_model_pricing() -> dict[str, Any]:
    """返回单一价目源全量快照(模型级/厂商级/覆盖/覆盖率)。"""
    return {"code": 0, "message": "ok", "data": build_pricing_snapshot()}


__all__ = ["router", "get_model_pricing", "build_pricing_snapshot"]
