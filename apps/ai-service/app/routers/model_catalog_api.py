# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型目录判定内部端点(2026-11-20 立)—— 供 apps/api 号池腿复用同一套代次判据。

为什么需要
--------
平台目录(/llm/models)在 ai-service 出口做了两件事:`model_catalog.annotate_models` 打
category/model_tier(含同系列版本比较),`model_catalog_policy.filter_frontier` 摘掉明确
过时的旧代。但「我的号池」那条腿(/api/account-pool/models)由 apps/api 自己拼装
(ai_model_config 预置行 + 上游 listModels 现拉),只过「上游清单交集 + down」,没有任何
代次维度 —— 平台上还挂着的 kimi-k2.5 / glm-4.7 会原样出现在选择器默认区,而平台目录里
同一个模型早已被摘掉。

apps/api 跑在 Node 侧,无法 import 本侧的 Python 判据;若在 TS 里再抄一份旧代清单,就是
第二份真相源(§0.6)。故把判据经本内部端点暴露出去,api 侧只做消费。

端点
----
POST /internal/model-catalog/classify
  入参: {"models": [{"id": "...", "provider": "..."}]}(单批上限 500)
  出参: {"items": [{id, provider, category, model_tier, family, generation,
                    classify_reason, hidden}]}
  hidden 与选择器口径同源(model_catalog_policy.is_hidden_from_selector):命中过时清单、
  版本比较判 legacy、用途不在 chat/vision 三条并集;2026-11-20 机主定档取消「历史模型」
  折叠区,这些一律不展示。开关 MODEL_CATALOG_HIDE_LEGACY 与 /llm/models 出口共用。

POST /internal/model-catalog/auto-complexity
  入参: {"prompt_tail": "<截断后的本轮 prompt>", "prompt_chars": <全文字符数>, "has_tools": bool}
  出参: {"complexity": "trivial|simple|moderate|complex|expert"}
  2026-11-22 立:聊天 auto 模式整合号池候选的决策腿。apps/api 的 /api/chat/auto-resolve
  需要按任务复杂度决定"号池模型够不够格"(复杂任务号池没有 latest 档就维持平台 premium),
  复杂度判据单一真相源在 services/model_router.py 的 assess_complexity —— 与网关
  _resolve_auto_model 的复杂度升级是同一个函数(§0.6),api 侧经本端点消费,不复制关键词表。

失效方向
--------
本端点不做任何"猜代次":拿不到判据就 5xx / 网络错,调用方 fail-open(不隐藏、不标代次)。
绝不把"没判定"渲染成"旧代",否则用户自己的号池会被打空。
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.internal_secret_auth import authorize_internal_secret_call
from app.services.model_catalog import annotate_models
from app.services.model_catalog_policy import is_hidden_from_selector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/model-catalog", tags=["model-catalog-internal"])

#: 单批上限:号池实际规模在几十~几百,500 足够且能拦住无界请求。
MAX_BATCH = 500


class ModelRef(BaseModel):
    """一条待判定模型(provider 与 id 成对,id 可能是 `<平台>/<上游名>` 形态)。"""

    id: str = Field(min_length=1, max_length=200)
    provider: str = Field(default="", max_length=100)


class ClassifyIn(BaseModel):
    models: list[ModelRef] = Field(default_factory=list)


async def _require_internal(request: Request) -> None:
    """内网鉴权:X-Internal-Secret 族统一出口(票优先;兼容档才认旧密钥)。"""
    await authorize_internal_secret_call(request.headers, expected_scope="model-catalog")


@router.post("/classify")
async def classify(request: Request, payload: ClassifyIn) -> dict[str, Any]:
    """批量判定号池模型的用途分类与代次(除鉴权外纯函数,零 I/O)。"""
    await _require_internal(request)
    if len(payload.models) > MAX_BATCH:
        raise HTTPException(status_code=413, detail=f"单批最多 {MAX_BATCH} 条")

    # annotate_models 原地写 category/model_tier/family/generation/classify_reason,
    # 且"同系列版本比较"这一趟用整批上下文 —— 这一批就是号池的全部候选,
    # 跨平台同族(如 workbuddy/kimi-k2.5 与 workbuddy/kimi-k3)仍能互相压代次。
    dicts: list[dict[str, Any]] = [
        {"id": m.id, "provider": m.provider} for m in payload.models
    ]
    annotate_models(dicts)
    # hidden 走策略模块本身而不是自己重读清单(§0.6 单一真相源):
    #   清单命中 / 版本比较判 legacy / 用途不在 chat+vision ⇒ 选择器不展示
    #   (2026-11-20 机主定档:取消「历史模型」折叠区,旧代与专用用途一律隐藏)。
    # 开关 MODEL_CATALOG_HIDE_LEGACY 的语义与 /llm/models 出口共用同一实现。
    items = [
        {
            "id": str(m.get("id") or ""),
            "provider": str(m.get("provider") or ""),
            "category": str(m.get("category") or "chat"),
            "model_tier": str(m.get("model_tier") or "standard"),
            "family": str(m.get("family") or ""),
            "generation": m.get("generation"),
            "classify_reason": str(m.get("classify_reason") or ""),
            "hidden": is_hidden_from_selector(m),
        }
        for m in dicts
    ]
    hidden_count = sum(1 for item in items if item["hidden"])
    logger.info(
        "[model-catalog/classify] 判定 %d 条,其中按过时清单隐藏 %d 条",
        len(items),
        hidden_count,
    )
    return {"items": items}


class AutoComplexityIn(BaseModel):
    """聊天 auto 决策腿的复杂度评估入参(与 assess_complexity 的实参同口径)。"""

    prompt_tail: str = Field(default="", max_length=20_000)
    prompt_chars: int = Field(default=0, ge=0)
    has_tools: bool = False


@router.post("/auto-complexity")
async def auto_complexity(request: Request, payload: AutoComplexityIn) -> dict[str, Any]:
    """评估本轮 prompt 的任务复杂度(判据单源 model_router.assess_complexity)。

    与网关 _resolve_auto_model 的复杂度升级同一函数 —— api 决策腿问的是"号池候选
    够不够格",网关问的是"要不要升 premium",两侧必须用同一把尺子,否则会出现
    "决策腿判简单走了号池、网关判复杂升 premium"的自相矛盾。
    prompt_chars 是前端统计的全文字符数(尾部截断防丢长文信号),token 数按
    assess_complexity 同款 len//4 口径折算。
    """
    await _require_internal(request)
    from app.services.model_router import model_router

    complexity = model_router.assess_complexity(
        prompt=payload.prompt_tail,
        token_count=max(0, payload.prompt_chars // 4),
        has_tools=payload.has_tools,
    )
    return {"complexity": complexity.value}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
