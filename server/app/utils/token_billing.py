"""Bug-145: Token 精确计费与超限熔断.
设计:
  - 字符/Token 计数 (中英混合)
  - 模型定价表 (input/output 单价)
  - 预算管控: 用户/租户级 每日/每月额度
  - 实时累计, 超出熔断
  - 用量审计
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class ChargeResult(StrEnum):
    OK = "OK"
    EXCEEDED = "EXCEEDED"
    INVALID = "INVALID"
    DISABLED = "DISABLED"


@dataclass
class ModelPrice:
    model: str
    input_per_1k: float  # 元 / 1k tokens
    output_per_1k: float


@dataclass
class TokenUsage:
    input_tokens: int
    output_tokens: int
    cost: float = 0.0
    ts: float = field(default_factory=time.time)


@dataclass
class Budget:
    user_id: str
    daily_limit: float
    monthly_limit: float
    daily_used: float = 0.0
    monthly_used: float = 0.0
    day_key: str = ""
    month_key: str = ""
    disabled: bool = False


# 内置模型价目 (元/1k tokens) - 示意
DEFAULT_PRICES = [
    ModelPrice("gpt-4", input_per_1k=0.21, output_per_1k=0.42),
    ModelPrice("gpt-4o", input_per_1k=0.018, output_per_1k=0.036),
    ModelPrice("gpt-3.5", input_per_1k=0.0035, output_per_1k=0.0105),
    ModelPrice("claude-opus", input_per_1k=0.15, output_per_1k=0.75),
    ModelPrice("claude-sonnet", input_per_1k=0.022, output_per_1k=0.11),
    ModelPrice("deepseek-chat", input_per_1k=0.001, output_per_1k=0.002),
    ModelPrice("qwen-turbo", input_per_1k=0.003, output_per_1k=0.006),
    ModelPrice("mock", input_per_1k=0.0, output_per_1k=0.0),
]


def estimate_tokens(text: str) -> int:
    """混合中英 token 估算.
    1 中文 ≈ 1.6 token, 1 英文单词 ≈ 1.3 token, 数字/标点 ≈ 0.5 token.
    简化估算: 总字符数 / 1.7."""
    if not text:
        return 0
    return max(1, int(len(text) / 1.7))


def estimate_messages_tokens(messages: list[dict[str, Any]]) -> int:
    total = 0
    for m in messages:
        c = m.get("content", "")
        if isinstance(c, str):
            total += estimate_tokens(c)
        elif isinstance(c, list):
            for part in c:
                if isinstance(part, dict):
                    total += estimate_tokens(str(part.get("text", "")))
        # 角色 + 框架 4 token
        total += 4
    return total + 2  # 对话额外开销


class TokenGuard:
    """Token 计费与预算熔断器."""

    def __init__(self, prices: list[ModelPrice] | None = None) -> None:
        self._lock = threading.RLock()
        self._prices: dict[str, ModelPrice] = {p.model: p for p in (prices or DEFAULT_PRICES)}
        self._budgets: dict[str, Budget] = {}
        self._usage_log: list[tuple[str, str, TokenUsage]] = []
        self._stats = {"charged": 0, "rejected": 0, "estimated_tokens": 0, "actual_tokens": 0, "total_cost": 0.0}

    def _now(self) -> float:
        return time.time()

    def _day_key(self) -> str:
        t = time.localtime()
        return f"{t.tm_year}-{t.tm_mon:02d}-{t.tm_mday:02d}"

    def _month_key(self) -> str:
        t = time.localtime()
        return f"{t.tm_year}-{t.tm_mon:02d}"

    def set_price(self, model: str, input_per_1k: float, output_per_1k: float) -> None:
        with self._lock:
            self._prices[model] = ModelPrice(model=model, input_per_1k=input_per_1k, output_per_1k=output_per_1k)

    def get_price(self, model: str) -> ModelPrice | None:
        with self._lock:
            return self._prices.get(model)

    def set_budget(self, user_id: str, daily_limit: float, monthly_limit: float) -> Budget:
        with self._lock:
            b = self._budgets.get(user_id) or Budget(
                user_id=user_id, daily_limit=daily_limit, monthly_limit=monthly_limit
            )
            b.daily_limit = daily_limit
            b.monthly_limit = monthly_limit
            self._budgets[user_id] = b
            return b

    def get_budget(self, user_id: str) -> Budget | None:
        with self._lock:
            return self._budgets.get(user_id)

    def _reset_if_needed(self, b: Budget) -> None:
        dk = self._day_key()
        mk = self._month_key()
        if b.day_key != dk:
            b.day_key = dk
            b.daily_used = 0.0
        if b.month_key != mk:
            b.month_key = mk
            b.monthly_used = 0.0

    def compute_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        with self._lock:
            p = self._prices.get(model)
            if p is None:
                return 0.0
            return round((input_tokens / 1000.0) * p.input_per_1k + (output_tokens / 1000.0) * p.output_per_1k, 6)

    def check(self, user_id: str, model: str, input_tokens: int, output_tokens: int) -> tuple[ChargeResult, float, str]:
        with self._lock:
            b = self._budgets.get(user_id)
            if b is None:
                return ChargeResult.OK, 0.0, "no_budget"
            if b.disabled:
                self._stats["rejected"] += 1
                return ChargeResult.DISABLED, 0.0, "user_disabled"
            self._reset_if_needed(b)
            cost = self.compute_cost(model, input_tokens, output_tokens)
            if b.daily_used + cost > b.daily_limit:
                self._stats["rejected"] += 1
                return ChargeResult.EXCEEDED, cost, "daily_exceeded"
            if b.monthly_used + cost > b.monthly_limit:
                self._stats["rejected"] += 1
                return ChargeResult.EXCEEDED, cost, "monthly_exceeded"
            return ChargeResult.OK, cost, "ok"

    def charge(
        self, user_id: str, model: str, input_tokens: int, output_tokens: int, request_id: str = ""
    ) -> tuple[ChargeResult, float, str]:
        with self._lock:
            self._stats["estimated_tokens"] += input_tokens + output_tokens
        result, cost, reason = self.check(user_id, model, input_tokens, output_tokens)
        if result != ChargeResult.OK:
            return result, cost, reason
        with self._lock:
            b = self._budgets.get(user_id)
            if b is not None:
                b.daily_used += cost
                b.monthly_used += cost
            usage = TokenUsage(input_tokens=input_tokens, output_tokens=output_tokens, cost=cost)
            self._usage_log.append((user_id, request_id, usage))
            if len(self._usage_log) > 10000:
                self._usage_log = self._usage_log[-10000:]
            self._stats["charged"] += 1
            self._stats["actual_tokens"] += input_tokens + output_tokens
            self._stats["total_cost"] += cost
        return ChargeResult.OK, cost, "ok"

    def disable_user(self, user_id: str, disabled: bool = True) -> bool:
        with self._lock:
            b = self._budgets.get(user_id)
            if b is None:
                return False
            b.disabled = disabled
            return True

    def usage(self, user_id: str | None = None, limit: int = 100) -> list[tuple[str, str, TokenUsage]]:
        with self._lock:
            log = self._usage_log
        if user_id is not None:
            log = [(u, r, t) for u, r, t in log if u == user_id]
        return log[-limit:]

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {
                **self._stats,
                "models": len(self._prices),
                "users_with_budget": len(self._budgets),
            }
