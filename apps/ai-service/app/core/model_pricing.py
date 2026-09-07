# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""模型价目单一来源(2026-09-07 收口,GAP-PLAN"成本真网计价"落地)。

此前 cost_ledger / llm_budget_governor / llm_usage_service 三处各自维护价目表,
数值停留在 2024(gpt-4o/claude-3 时代)且互相漂移。本模块为唯一事实来源:

匹配优先级:  set_model_pricing 运行时覆盖 > 模型级前缀匹配 > 厂商级兜底 > 全局默认
单位口径:    美元 / 1M tokens(对外 helper 提供 per-1K 换算,兼容旧调用方)
数值口径:    各厂商公开页目估算值(2025 下半年公开定价),仅用于成本估算,
            精确计费以厂商账单为准;estimated=True 表示走了兜底价。

与 apps/api ai_pricing 表的分工(2026-09-07 对齐,防误合并):
  - 本模块:ai-service 进程内估算价(静态公开价+运行时覆盖),用于 cost 缺失时
    的即时估算/预算扣减,零外部依赖,重启即回静态值。
  - ai_pricing(apps/api,litellm-price-sync 每 24h 同步 LiteLLM 公开价表
    +frankfurter 实时汇率):计费/展示口径的持久化真网价,分/千 token。
  两者单位与用途不同,勿互相替代;若未来要求 ai-service 估算价与计费价严格
  一致,应通过 set_model_pricing 由管理面注入 ai_pricing 快照,而非删本模块。
"""

from __future__ import annotations

import threading
from typing import Any

# ---------------------------------------------------------------------------
# 运行时覆盖(进程级,精确模型名匹配,优先级最高)
# ---------------------------------------------------------------------------
_OVERRIDES: dict[str, dict[str, float]] = {}
_LOCK = threading.Lock()


def set_model_pricing(model: str, input_per_1m: float, output_per_1m: float) -> None:
    """运行时注入/覆盖某模型单价(USD per 1M tokens)。精确名匹配。"""
    key = str(model or "").strip().lower()
    if not key:
        return
    with _LOCK:
        _OVERRIDES[key] = {"input": float(input_per_1m), "output": float(output_per_1m)}


# ---------------------------------------------------------------------------
# 模型级价目(前缀匹配;键按长度降序匹配,"gpt-4o-mini" 先于 "gpt-4o")
# USD per 1M tokens,公开定价(2025 下半年口径)
# ---------------------------------------------------------------------------
_MODEL_PRICES_PER_1M: dict[str, dict[str, float]] = {
    # OpenAI
    "gpt-5-nano": {"input": 0.05, "output": 0.40},
    "gpt-5-mini": {"input": 0.25, "output": 2.00},
    "gpt-5": {"input": 1.25, "output": 10.00},
    "o4-mini": {"input": 1.10, "output": 4.40},
    "o3-mini": {"input": 1.10, "output": 4.40},
    "o3": {"input": 2.00, "output": 8.00},
    "gpt-4.1-nano": {"input": 0.10, "output": 0.40},
    "gpt-4.1-mini": {"input": 0.40, "output": 1.60},
    "gpt-4.1": {"input": 2.00, "output": 8.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4-turbo": {"input": 10.00, "output": 30.00},
    # Anthropic
    "claude-opus-4": {"input": 15.00, "output": 75.00},
    "claude-3-opus": {"input": 15.00, "output": 75.00},
    "claude-sonnet-4": {"input": 3.00, "output": 15.00},
    "claude-3-7-sonnet": {"input": 3.00, "output": 15.00},
    "claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
    "claude-3-5-haiku": {"input": 0.80, "output": 4.00},
    "claude-3-haiku": {"input": 0.25, "output": 1.25},
    # Google
    "gemini-2.5-pro": {"input": 1.25, "output": 10.00},
    "gemini-2.5-flash": {"input": 0.30, "output": 2.50},
    "gemini-2.0-flash-lite": {"input": 0.075, "output": 0.30},
    "gemini-2.0-flash": {"input": 0.10, "output": 0.40},
    "gemini-1.5-pro": {"input": 1.25, "output": 5.00},
    "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
    # DeepSeek
    "deepseek-reasoner": {"input": 0.55, "output": 2.19},
    "deepseek-chat": {"input": 0.27, "output": 1.10},
    # 智谱
    "glm-4.5-air": {"input": 0.20, "output": 1.10},
    "glm-4.5": {"input": 0.60, "output": 2.20},
    "glm-4-flash": {"input": 0.0, "output": 0.0},
    "glm-4-plus": {"input": 6.90, "output": 6.90},
    # 字节豆包(火山引擎)
    "doubao-seed": {"input": 0.24, "output": 2.24},
    "doubao-1.5-pro": {"input": 0.11, "output": 0.28},
    "doubao-pro": {"input": 0.11, "output": 0.28},
    # 阿里通义
    "qwen-turbo": {"input": 0.05, "output": 0.20},
    "qwen-plus": {"input": 0.40, "output": 1.20},
    "qwen-max": {"input": 1.60, "output": 6.40},
    # Moonshot
    "kimi-k2": {"input": 0.60, "output": 2.50},
    "moonshot-v1": {"input": 1.71, "output": 1.71},
}

# ---------------------------------------------------------------------------
# 厂商级兜底(模型级未命中时使用;llm_usage_service.PROVIDER_PRICING 同源引用)
# ---------------------------------------------------------------------------
PROVIDER_PRICES_PER_1M: dict[str, dict[str, float]] = {
    "openai": {"input": 2.50, "output": 10.00},
    "anthropic": {"input": 3.00, "output": 15.00},
    "gemini": {"input": 0.30, "output": 2.50},
    "google": {"input": 0.30, "output": 2.50},
    "deepseek": {"input": 0.27, "output": 1.10},
    "zhipu": {"input": 0.60, "output": 2.20},
    "volcengine": {"input": 0.24, "output": 2.24},
    "doubao": {"input": 0.24, "output": 2.24},
    "dashscope": {"input": 0.40, "output": 1.20},
    "qwen_local": {"input": 0.0, "output": 0.0},
    "moonshot": {"input": 0.60, "output": 2.50},
    "stepfun": {"input": 0.50, "output": 2.00},
    "tencent_hunyuan": {"input": 1.00, "output": 4.00},
    "openrouter": {"input": 1.00, "output": 3.00},
    "agnes": {"input": 0.50, "output": 2.00},
    # 免费/本地后端
    "ollama": {"input": 0.0, "output": 0.0},
    "lmstudio": {"input": 0.0, "output": 0.0},
    "llama_cpp": {"input": 0.0, "output": 0.0},
    "groq": {"input": 0.0, "output": 0.0},
    "cloudflare_workers_ai": {"input": 0.0, "output": 0.0},
    "nvidia_nim": {"input": 0.0, "output": 0.0},
    "stub": {"input": 0.0, "output": 0.0},
}

# 全局默认(模型与厂商均未命中)
DEFAULT_PRICE_PER_1M: dict[str, float] = {"input": 1.00, "output": 3.00}

# 按键长度降序排列(前缀匹配特异性优先)
_SORTED_MODEL_KEYS: list[str] = sorted(_MODEL_PRICES_PER_1M, key=len, reverse=True)


def _normalize(model: str) -> str:
    """小写 + 去空白。"""
    return str(model or "").strip().lower()


def _model_candidates(model: str) -> list[str]:
    """候选匹配名:完整名 + LiteLLM 风格 'provider/model' 的斜杠后缀。"""
    normalized = _normalize(model)
    if not normalized:
        return []
    candidates = [normalized]
    if "/" in normalized:
        suffix = normalized.rsplit("/", 1)[-1]
        if suffix and suffix not in candidates:
            candidates.append(suffix)
    return candidates


def resolve_model_pricing_per_1m(model: str, provider: str | None = None) -> dict[str, float]:
    """解析某模型单价(USD per 1M tokens)。

    优先级: 运行时覆盖 > 模型级前缀匹配 > 厂商级兜底 > 全局默认。
    """
    for candidate in _model_candidates(model):
        with _LOCK:
            override = _OVERRIDES.get(candidate)
        if override:
            return dict(override)
        for key in _SORTED_MODEL_KEYS:
            if candidate == key or candidate.startswith(key):
                return dict(_MODEL_PRICES_PER_1M[key])

    provider_key = _normalize(provider or "")
    if provider_key and provider_key in PROVIDER_PRICES_PER_1M:
        return dict(PROVIDER_PRICES_PER_1M[provider_key])
    return dict(DEFAULT_PRICE_PER_1M)


def is_model_price_known(model: str) -> bool:
    """模型是否命中运行时覆盖或模型级价目(未命中=走了兜底价)。"""
    for candidate in _model_candidates(model):
        with _LOCK:
            if candidate in _OVERRIDES:
                return True
        for key in _SORTED_MODEL_KEYS:
            if candidate == key or candidate.startswith(key):
                return True
    return False


def estimate_cost_usd(
    model: str, tokens_in: int, tokens_out: int, provider: str | None = None
) -> dict[str, Any]:
    """按模型估算成本(USD,round 6 位)。

    返回 {"cost_usd", "estimated"};estimated=True 表示未命中模型级价目,
    用了厂商兜底价或全局默认价(口径与 cost_ledger.estimated 一致)。
    """
    rates = resolve_model_pricing_per_1m(model, provider)
    cost = (float(tokens_in) / 1_000_000.0) * float(rates["input"]) + (
        float(tokens_out) / 1_000_000.0
    ) * float(rates["output"])
    return {"cost_usd": round(cost, 6), "estimated": not is_model_price_known(model)}


def snapshot_per_1k(models: list[str]) -> dict[str, dict[str, float]]:
    """按名称列表生成 per-1K 费率快照(含 default 兜底)。

    供旧式"精确名查表"调用方(如 llm_budget_governor.model_cost_table)使用,
    免去各处手抄价格;运行时调价仍走 set_model_pricing(影响 resolve,不影响已生成快照)。
    """
    table: dict[str, dict[str, float]] = {}
    for name in models:
        rates = resolve_model_pricing_per_1m(name)
        table[name] = {"input": rates["input"] / 1000.0, "output": rates["output"] / 1000.0}
    table["default"] = {
        "input": DEFAULT_PRICE_PER_1M["input"] / 1000.0,
        "output": DEFAULT_PRICE_PER_1M["output"] / 1000.0,
    }
    return table
