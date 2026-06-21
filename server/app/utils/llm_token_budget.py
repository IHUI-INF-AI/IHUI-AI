"""Bug-108: LLM Token 预算.

设计:
  - 按 (tenant_id, model) 维度设置预算: 1 分钟 / 1 小时 / 1 天 / 1 月
  - 滑动窗口消费记录 (deque)
  - 消费时按窗口减少 (gc + 减法)
  - 超限降级策略: 拒绝 / 排队 / 切换廉价模型
  - 实时统计 + Prometheus 友好输出
"""

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass
from enum import StrEnum

logger = logging.getLogger(__name__)


class BudgetPolicy(StrEnum):
    REJECT = "reject"  # 超限直接拒绝
    QUEUE = "queue"  # 入队等待
    DOWNGRADE = "downgrade"  # 切到 fallback_model
    ALLOW = "allow"  # 允许, 仅审计


@dataclass
class TokenBudget:
    tenant_id: str
    model: str
    per_minute: int = 100_000
    per_hour: int = 1_000_000
    per_day: int = 10_000_000
    per_month: int = 100_000_000
    fallback_model: str = ""
    policy: str = BudgetPolicy.REJECT.value
    updated_at: float = 0.0

    def to_dict(self) -> dict:
        return self.__dict__.copy()

    @classmethod
    def from_dict(cls, d: dict) -> "TokenBudget":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class Consumption:
    ts: float
    tokens: int
    model: str
    request_id: str = ""


class TokenBudgetController:
    """按 (tenant, model) 的 Token 预算控制器."""

    # 1 个月按 30 天计算
    MONTH_SEC = 30 * 24 * 3600

    def __init__(self):
        self._lock = threading.Lock()
        # (tenant, model) -> TokenBudget
        self._budgets: dict[tuple[str, str], TokenBudget] = {}
        # (tenant, model) -> deque[Consumption]
        self._consumptions: dict[tuple[str, str], deque[Consumption]] = {}

    def set_budget(
        self,
        tenant_id: str,
        model: str,
        per_minute: int | None = None,
        per_hour: int | None = None,
        per_day: int | None = None,
        per_month: int | None = None,
        fallback_model: str = "",
        policy: str = BudgetPolicy.REJECT.value,
    ) -> TokenBudget:
        key = (tenant_id, model)
        with self._lock:
            old = self._budgets.get(key)
            b = TokenBudget(
                tenant_id=tenant_id,
                model=model,
                per_minute=per_minute if per_minute is not None else (old.per_minute if old else 100_000),
                per_hour=per_hour if per_hour is not None else (old.per_hour if old else 1_000_000),
                per_day=per_day if per_day is not None else (old.per_day if old else 10_000_000),
                per_month=per_month if per_month is not None else (old.per_month if old else 100_000_000),
                fallback_model=fallback_model or (old.fallback_model if old else ""),
                policy=policy,
                updated_at=time.time(),
            )
            self._budgets[key] = b
            self._consumptions.setdefault(key, deque())
            return b

    def get_budget(self, tenant_id: str, model: str) -> TokenBudget | None:
        with self._lock:
            return self._budgets.get((tenant_id, model))

    def list_budgets(self, tenant_id: str | None = None) -> list[TokenBudget]:
        with self._lock:
            arr = list(self._budgets.values())
        if tenant_id:
            arr = [b for b in arr if b.tenant_id == tenant_id]
        return arr

    def remove_budget(self, tenant_id: str, model: str) -> bool:
        with self._lock:
            existed = self._budgets.pop((tenant_id, model), None) is not None
            self._consumptions.pop((tenant_id, model), None)
            return existed

    def _prune(self, dq: deque[Consumption], now: float) -> None:
        """淘汰超过 30 天的消费记录 (月窗口外的)."""
        cutoff = now - self.MONTH_SEC
        while dq and dq[0].ts < cutoff:
            dq.popleft()

    def _windowed_total(self, dq: deque[Consumption], now: float, window_sec: float) -> int:
        cutoff = now - window_sec
        total = 0
        for c in dq:
            if c.ts >= cutoff:
                total += c.tokens
        return total

    def check(
        self,
        tenant_id: str,
        model: str,
        tokens_estimated: int = 0,
    ) -> dict[str, object]:
        """检查预算是否允许, 返回 (ok, reason, fallback_model, current)."""
        key = (tenant_id, model)
        with self._lock:
            b = self._budgets.get(key)
            if b is None:
                return {"ok": True, "reason": "no_budget_set", "fallback_model": ""}
            dq = self._consumptions.setdefault(key, deque())
            now = time.time()
            self._prune(dq, now)
            cur_min = self._windowed_total(dq, now, 60.0)
            cur_hour = self._windowed_total(dq, now, 3600.0)
            cur_day = self._windowed_total(dq, now, 24 * 3600.0)
            cur_month = self._windowed_total(dq, now, self.MONTH_SEC)
            if cur_min + tokens_estimated > b.per_minute:
                return {
                    "ok": False,
                    "reason": "per_minute",
                    "fallback_model": b.fallback_model,
                    "current": {"min": cur_min, "hour": cur_hour, "day": cur_day, "month": cur_month},
                    "limit": {"per_minute": b.per_minute},
                }
            if cur_hour + tokens_estimated > b.per_hour:
                return {
                    "ok": False,
                    "reason": "per_hour",
                    "fallback_model": b.fallback_model,
                    "current": {"min": cur_min, "hour": cur_hour, "day": cur_day, "month": cur_month},
                    "limit": {"per_hour": b.per_hour},
                }
            if cur_day + tokens_estimated > b.per_day:
                return {
                    "ok": False,
                    "reason": "per_day",
                    "fallback_model": b.fallback_model,
                    "current": {"min": cur_min, "hour": cur_hour, "day": cur_day, "month": cur_month},
                    "limit": {"per_day": b.per_day},
                }
            if cur_month + tokens_estimated > b.per_month:
                return {
                    "ok": False,
                    "reason": "per_month",
                    "fallback_model": b.fallback_model,
                    "current": {"min": cur_min, "hour": cur_hour, "day": cur_day, "month": cur_month},
                    "limit": {"per_month": b.per_month},
                }
            return {
                "ok": True,
                "reason": "within_budget",
                "fallback_model": "",
                "current": {"min": cur_min, "hour": cur_hour, "day": cur_day, "month": cur_month},
            }

    def consume(
        self,
        tenant_id: str,
        model: str,
        tokens: int,
        request_id: str = "",
    ) -> dict[str, object]:
        """记录消费, 同时检查预算."""
        key = (tenant_id, model)
        with self._lock:
            b = self._budgets.get(key)
            if b is None:
                # 没设置预算, 不计入
                return {"ok": True, "reason": "no_budget_set", "consumed": 0}
            dq = self._consumptions.setdefault(key, deque())
            now = time.time()
            self._prune(dq, now)
            dq.append(Consumption(ts=now, tokens=tokens, model=model, request_id=request_id))
            cur_min = self._windowed_total(dq, now, 60.0)
            cur_hour = self._windowed_total(dq, now, 3600.0)
            cur_day = self._windowed_total(dq, now, 24 * 3600.0)
            cur_month = self._windowed_total(dq, now, self.MONTH_SEC)
            over = cur_min > b.per_minute or cur_hour > b.per_hour or cur_day > b.per_day or cur_month > b.per_month
        return {
            "ok": not over,
            "reason": "over_after_consume" if over else "within_budget",
            "consumed": tokens,
            "current": {"min": cur_min, "hour": cur_hour, "day": cur_day, "month": cur_month},
            "fallback_model": b.fallback_model if over else "",
        }

    def refund(
        self,
        tenant_id: str,
        model: str,
        tokens: int,
    ) -> bool:
        """退款 (从最近的消费中减回 tokens)."""
        key = (tenant_id, model)
        with self._lock:
            dq = self._consumptions.get(key)
            if dq is None or not dq:
                return False
            remaining = tokens
            while dq and remaining > 0:
                last = dq[-1]
                if last.tokens <= remaining:
                    dq.pop()
                    remaining -= last.tokens
                else:
                    # 替换最后一个 (Consumption 不是 mutable, 用 pop+append)
                    dq.pop()
                    dq.append(
                        Consumption(
                            ts=last.ts, tokens=last.tokens - remaining, model=last.model, request_id=last.request_id
                        )
                    )
                    remaining = 0
            return True

    def apply_policy(
        self,
        check_result: dict[str, object],
        tenant_id: str | None = None,
        model: str | None = None,
    ) -> dict[str, object]:
        """根据预算策略处理 check 结果.
        tenant_id/model 提供时, 按 (tenant, model) 查 budget 的 policy;
        不提供时, 默认 reject (简化行为)."""
        b = check_result
        if b.get("ok"):
            return {"action": "allow", "fallback_model": ""}
        reason = b.get("reason", "")
        fallback = b.get("fallback_model", "")
        # 默认 reject
        action = "reject"
        if tenant_id is not None and model is not None:
            with self._lock:
                bud = self._budgets.get((tenant_id, model))
            if bud is not None:
                action = bud.policy  # REJECT / QUEUE / DOWNGRADE / ALLOW
        return {
            "action": action,
            "reason": reason,
            "fallback_model": fallback,
        }

    def get_usage(self, tenant_id: str, model: str) -> dict[str, int]:
        key = (tenant_id, model)
        with self._lock:
            dq = self._consumptions.get(key)
            if dq is None:
                return {"min": 0, "hour": 0, "day": 0, "month": 0, "total_records": 0}
            now = time.time()
            self._prune(dq, now)
            return {
                "min": self._windowed_total(dq, now, 60.0),
                "hour": self._windowed_total(dq, now, 3600.0),
                "day": self._windowed_total(dq, now, 24 * 3600.0),
                "month": self._windowed_total(dq, now, self.MONTH_SEC),
                "total_records": len(dq),
            }

    def stats(self) -> dict:
        with self._lock:
            return {
                "budget_count": len(self._budgets),
                "total_records": sum(len(d) for d in self._consumptions.values()),
            }

    def clear(self) -> None:
        with self._lock:
            self._budgets.clear()
            self._consumptions.clear()


# 全局单例
token_budget = TokenBudgetController()
