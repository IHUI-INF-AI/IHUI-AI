"""LLM 用量统计服务 — 按 provider/model/user 统计 token 用量 + 估算成本。

数据存储: 内存 dict 存储（进程内），Redis 可用时持久化。
成本估算: 按各厂商公开定价表（每百万 token 价格）。
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)

# 厂商定价表(每百万 token 价格,单位:美元)
# 来源:各厂商官方定价页面(2026-08)
PROVIDER_PRICING: dict[str, dict[str, float]] = {
    "openai": {"input": 2.50, "output": 10.00},  # GPT-4o
    "anthropic": {"input": 3.00, "output": 15.00},  # Claude 3.5 Sonnet
    "stepfun": {"input": 0.50, "output": 2.00},  # Step 系列
    "agnes": {"input": 0.50, "output": 2.00},  # Agnes AI
    "cloudflare_workers_ai": {"input": 0.00, "output": 0.00},  # 免费
    "nvidia_nim": {"input": 0.00, "output": 0.00},  # 免费
    "gemini": {"input": 0.10, "output": 0.40},  # Gemini 2.0 Flash
    "groq": {"input": 0.00, "output": 0.00},  # 免费
    "openrouter": {"input": 1.00, "output": 3.00},  # 平均
    "ollama": {"input": 0.00, "output": 0.00},  # 本地
    "stub": {"input": 0.00, "output": 0.00},  # stub 免费
}
DEFAULT_PRICING = {"input": 1.00, "output": 3.00}  # 未知厂商兜底

# 默认配额(每月 token 上限)
DEFAULT_QUOTA_LIMIT = 10_000_000


@dataclass
class UsageRecord:
    id: str
    provider: str
    model: str
    user_id: str
    input_tokens: int
    output_tokens: int
    estimated_cost: float  # 美元
    timestamp: float
    session_id: str = ""


def _estimate_cost(provider: str, input_tokens: int, output_tokens: int) -> float:
    """按定价表估算单次调用成本(美元)。"""
    pricing = PROVIDER_PRICING.get(provider, DEFAULT_PRICING)
    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return round(input_cost + output_cost, 4)


class LLMUsageService:
    def __init__(self, quota_limit: int = DEFAULT_QUOTA_LIMIT):
        self._records: list[UsageRecord] = []
        self._max_records = 10000
        self._quota_limit = quota_limit

    def record_usage(
        self,
        provider: str,
        model: str,
        user_id: str,
        input_tokens: int,
        output_tokens: int,
        session_id: str = "",
    ) -> UsageRecord:
        """记录一次 LLM 调用用量。"""
        cost = _estimate_cost(provider, input_tokens, output_tokens)
        record = UsageRecord(
            id=uuid.uuid4().hex[:12],
            provider=provider,
            model=model,
            user_id=user_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost=cost,
            timestamp=time.time(),
            session_id=session_id,
        )
        self._records.append(record)
        # 限制内存记录数
        if len(self._records) > self._max_records:
            self._records = self._records[-self._max_records:]
        logger.info(
            "record_usage: user=%s provider=%s model=%s input=%d output=%d cost=%.4f",
            user_id, provider, model, input_tokens, output_tokens, cost,
        )
        return record

    def get_user_stats(self, user_id: str, days: int = 7) -> dict[str, Any]:
        """获取用户用量统计。"""
        cutoff = time.time() - days * 86400
        user_records = [r for r in self._records if r.user_id == user_id and r.timestamp >= cutoff]

        total_input = sum(r.input_tokens for r in user_records)
        total_output = sum(r.output_tokens for r in user_records)
        total_tokens = total_input + total_output
        total_cost = round(sum(r.estimated_cost for r in user_records), 4)

        # 按天汇总
        daily: dict[str, dict[str, int | float]] = {}
        for r in user_records:
            day_key = datetime.fromtimestamp(r.timestamp).strftime("%Y-%m-%d")
            if day_key not in daily:
                daily[day_key] = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost": 0.0}
            daily[day_key]["input_tokens"] += r.input_tokens
            daily[day_key]["output_tokens"] += r.output_tokens
            daily[day_key]["total_tokens"] += r.input_tokens + r.output_tokens
            daily[day_key]["cost"] += r.estimated_cost

        # 按模型汇总
        model_breakdown: dict[str, dict[str, int | float]] = {}
        for r in user_records:
            key = f"{r.provider}/{r.model}"
            if key not in model_breakdown:
                model_breakdown[key] = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost": 0.0, "calls": 0}
            model_breakdown[key]["input_tokens"] += r.input_tokens
            model_breakdown[key]["output_tokens"] += r.output_tokens
            model_breakdown[key]["total_tokens"] += r.input_tokens + r.output_tokens
            model_breakdown[key]["cost"] += r.estimated_cost
            model_breakdown[key]["calls"] += 1

        # 按厂商汇总
        provider_breakdown: dict[str, dict[str, int | float]] = {}
        for r in user_records:
            p = r.provider
            if p not in provider_breakdown:
                provider_breakdown[p] = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "cost": 0.0, "calls": 0}
            provider_breakdown[p]["input_tokens"] += r.input_tokens
            provider_breakdown[p]["output_tokens"] += r.output_tokens
            provider_breakdown[p]["total_tokens"] += r.input_tokens + r.output_tokens
            provider_breakdown[p]["cost"] += r.estimated_cost
            provider_breakdown[p]["calls"] += 1

        # 每日 breakdown 排序
        daily_sorted = dict(sorted(daily.items()))

        return {
            "user_id": user_id,
            "days": days,
            "total_tokens": total_tokens,
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "total_cost": total_cost,
            "total_calls": len(user_records),
            "daily_breakdown": daily_sorted,
            "model_breakdown": model_breakdown,
            "provider_breakdown": provider_breakdown,
        }

    def get_global_stats(self, days: int = 7) -> dict[str, Any]:
        """获取全局用量统计。"""
        cutoff = time.time() - days * 86400
        recent = [r for r in self._records if r.timestamp >= cutoff]

        total_input = sum(r.input_tokens for r in recent)
        total_output = sum(r.output_tokens for r in recent)
        total_tokens = total_input + total_output
        total_cost = round(sum(r.estimated_cost for r in recent), 4)
        active_users = len({r.user_id for r in recent})

        return {
            "days": days,
            "total_tokens": total_tokens,
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "total_cost": total_cost,
            "total_calls": len(recent),
            "active_users": active_users,
        }

    def get_quota_info(self, user_id: str) -> dict[str, Any]:
        """获取用户配额信息。"""
        # 本月用量
        now = datetime.now()
        month_start = datetime(now.year, now.month, 1).timestamp()
        month_records = [r for r in self._records if r.user_id == user_id and r.timestamp >= month_start]
        used_tokens = sum(r.input_tokens + r.output_tokens for r in month_records)
        quota_limit = self._quota_limit
        remaining = max(0, quota_limit - used_tokens)
        usage_percent = round((used_tokens / quota_limit) * 100, 2) if quota_limit > 0 else 0.0

        return {
            "user_id": user_id,
            "used_tokens": used_tokens,
            "quota_limit": quota_limit,
            "remaining": remaining,
            "usage_percent": usage_percent,
        }


# 全局单例
usage_service = LLMUsageService()