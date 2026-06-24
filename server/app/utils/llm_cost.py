"""Bug-84: LLM 调用成本计量.

设计:
  - 内置主流模型按 token 单价表 (USD per 1K tokens)
  - 每次 chat / completion 记录: model, prompt_tokens, completion_tokens, cost_usd
  - 支持自定义价格覆盖 (register_model)
  - 维度统计: 按 model / tenant / user / day 聚合
  - 月底账单: get_billing(month="2026-06")
  - 单次限价: cost_cap_usd 防止失控

使用:
    from app.utils.llm_cost import llm_cost_meter, record_llm_call

    cost = record_llm_call(model="gpt-4o", prompt_tokens=1000, completion_tokens=500,
                           tenant_id="t1", user_id="u1")
"""

import json
import logging
import os
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# 主流模型价格 (USD per 1K tokens) - 公开价目, 仅参考
DEFAULT_PRICING: dict[str, dict[str, float]] = {
    # OpenAI
    "gpt-4o": {"prompt": 0.005, "completion": 0.015},
    "gpt-4o-mini": {"prompt": 0.00015, "completion": 0.0006},
    "gpt-4-turbo": {"prompt": 0.010, "completion": 0.030},
    "gpt-3.5-turbo": {"prompt": 0.0005, "completion": 0.0015},
    "o1-preview": {"prompt": 0.015, "completion": 0.060},
    "o1-mini": {"prompt": 0.003, "completion": 0.012},
    # Anthropic
    "claude-3-5-sonnet": {"prompt": 0.003, "completion": 0.015},
    "claude-3-haiku": {"prompt": 0.00025, "completion": 0.00125},
    "claude-3-opus": {"prompt": 0.015, "completion": 0.075},
    # 国产
    "deepseek-chat": {"prompt": 0.00014, "completion": 0.00028},
    "qwen-plus": {"prompt": 0.0008, "completion": 0.002},
    "glm-4": {"prompt": 0.001, "completion": 0.001},
    "ernie-4.0": {"prompt": 0.004, "completion": 0.008},
}

DEFAULT_LOG_PATH = os.environ.get("ZHS_AUDIT_DIR", "audit") + "/llm_cost.jsonl"


@dataclass
class CostRecord:
    model: str
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float
    tenant_id: str = ""
    user_id: str = ""
    call_id: str = ""
    ts: float = field(default_factory=time.time)
    trace_id: str = ""

    def to_dict(self) -> dict:
        return {
            "ts": round(self.ts, 3),
            "model": self.model,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "cost_usd": round(self.cost_usd, 6),
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "call_id": self.call_id,
            "trace_id": self.trace_id,
        }


class LlmCostMeter:
    """LLM 成本计量器."""

    def __init__(self, log_path: str = DEFAULT_LOG_PATH):
        self._lock = threading.Lock()
        self._pricing: dict[str, dict[str, float]] = {m: dict(p) for m, p in DEFAULT_PRICING.items()}
        self._log_path = log_path
        self._records: deque[CostRecord] = deque(maxlen=10000)
        # 按 (model, day) / (tenant, day) 聚合
        self._by_model_day: dict[tuple, float] = defaultdict(float)
        self._by_tenant_day: dict[tuple, float] = defaultdict(float)
        self._by_user_day: dict[tuple, float] = defaultdict(float)
        self._total_calls = 0
        self._total_cost = 0.0
        self._rejected = 0  # 触发 cap
        self._cap_per_call: float | None = None

    def set_cap_per_call(self, cap_usd: float | None) -> None:
        """单次调用成本上限. None=不限."""
        with self._lock:
            self._cap_per_call = cap_usd

    def register_model(self, model: str, prompt: float, completion: float) -> None:
        """注册或覆盖模型价格 (USD per 1K tokens)."""
        with self._lock:
            self._pricing[model] = {"prompt": float(prompt), "completion": float(completion)}

    def get_pricing(self, model: str) -> dict[str, float] | None:
        with self._lock:
            return self._pricing.get(model)

    def calc_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        """计算本次调用的成本 (USD)."""
        with self._lock:
            p = self._pricing.get(model)
        if p is None:
            # 未知模型, 默认按 0 价 (不抛错, 记录 warning)
            logger.warning(f"llm_cost: unknown model {model!r}, cost=0")
            return 0.0
        cost = (prompt_tokens / 1000.0) * p["prompt"] + (completion_tokens / 1000.0) * p["completion"]
        return round(cost, 6)

    def record(
        self,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        tenant_id: str = "",
        user_id: str = "",
        call_id: str = "",
        trace_id: str = "",
    ) -> CostRecord:
        """记录一次 LLM 调用. 若超 cap 返回的 record.cost_usd 仍为真实值, 但 rejected 计数 +1."""
        rejected = False
        with self._lock:
            # cost 计算 + cap 判断 + 记录写入合并为单次临界区, 避免两次加锁间的 race.
            # 注意: 不可在此处调用 self.calc_cost (它内部也会获取 self._lock, 不可重入会死锁),
            # 因此把定价查找与成本计算内联.
            p = self._pricing.get(model)
            if p is None:
                logger.warning(f"llm_cost: unknown model {model!r}, cost=0")
                cost = 0.0
            else:
                cost = (prompt_tokens / 1000.0) * p["prompt"] + (completion_tokens / 1000.0) * p["completion"]
                cost = round(cost, 6)

            if self._cap_per_call is not None and cost > self._cap_per_call:
                self._rejected += 1
                rejected = True

            rec = CostRecord(
                model=model,
                prompt_tokens=int(prompt_tokens),
                completion_tokens=int(completion_tokens),
                cost_usd=cost,
                tenant_id=tenant_id,
                user_id=user_id,
                call_id=call_id,
                trace_id=trace_id,
            )
            self._records.append(rec)
            self._total_calls += 1
            self._total_cost += cost
            day = time.strftime("%Y-%m-%d", time.localtime(rec.ts))
            self._by_model_day[(model, day)] += cost
            if tenant_id:
                self._by_tenant_day[(tenant_id, day)] += cost
            if user_id:
                self._by_user_day[(user_id, day)] += cost
        self._persist(rec)
        if rejected:
            logger.warning(f"llm_cost: cap exceeded call_id={call_id} model={model} cost={cost:.4f}")
        return rec

    def _persist(self, rec: CostRecord) -> None:
        try:
            os.makedirs(os.path.dirname(self._log_path) or ".", exist_ok=True)
            with open(self._log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec.to_dict(), ensure_ascii=False) + "\n")
        except Exception as e:
            logger.debug(f"llm_cost persist fail: {e!r}")

    def get_billing(
        self,
        month: str | None = None,
        tenant_id: str | None = None,
    ) -> dict:
        """按月/租户聚合账单."""
        if month is None:
            month = time.strftime("%Y-%m", time.localtime())
        month_prefix = month
        with self._lock:
            bills_by_tenant: dict[str, float] = defaultdict(float)
            bills_by_user: dict[str, float] = defaultdict(float)
            bills_by_model: dict[str, float] = defaultdict(float)
            total = 0.0
            calls = 0
            for r in self._records:
                if not time.strftime("%Y-%m", time.localtime(r.ts)).startswith(month_prefix):
                    continue
                if tenant_id and r.tenant_id != tenant_id:
                    continue
                total += r.cost_usd
                calls += 1
                if r.tenant_id:
                    bills_by_tenant[r.tenant_id] += r.cost_usd
                if r.user_id:
                    bills_by_user[r.user_id] += r.cost_usd
                bills_by_model[r.model] += r.cost_usd
        return {
            "month": month,
            "tenant_id": tenant_id or "*",
            "total_calls": calls,
            "total_cost_usd": round(total, 4),
            "by_tenant": {k: round(v, 4) for k, v in sorted(bills_by_tenant.items(), key=lambda x: -x[1])[:20]},
            "by_user": {k: round(v, 4) for k, v in sorted(bills_by_user.items(), key=lambda x: -x[1])[:20]},
            "by_model": {k: round(v, 4) for k, v in sorted(bills_by_model.items(), key=lambda x: -x[1])[:20]},
        }

    def list_models(self) -> list[str]:
        with self._lock:
            return sorted(self._pricing.keys())

    def stats(self) -> dict:
        with self._lock:
            return {
                "total_calls": self._total_calls,
                "total_cost_usd": round(self._total_cost, 4),
                "rejected_by_cap": self._rejected,
                "model_count": len(self._pricing),
                "in_memory_records": len(self._records),
                "cap_per_call": self._cap_per_call,
            }

    def reset(self) -> None:
        with self._lock:
            self._records.clear()
            self._by_model_day.clear()
            self._by_tenant_day.clear()
            self._by_user_day.clear()
            self._total_calls = 0
            self._total_cost = 0.0
            self._rejected = 0


# 全局单例
llm_cost_meter = LlmCostMeter()


def record_llm_call(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    tenant_id: str = "",
    user_id: str = "",
    call_id: str = "",
    trace_id: str = "",
) -> CostRecord:
    """便捷函数: 调全局单例记录."""
    return llm_cost_meter.record(
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        tenant_id=tenant_id,
        user_id=user_id,
        call_id=call_id,
        trace_id=trace_id,
    )
