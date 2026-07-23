"""LLM 成本预算治理器 — 横切关注点,控制所有超越功能的 LLM 调用成本。

6 大超越支柱都有 LLM 调用:
- Rules: auto_generate / predict_effect
- Hook: auto_orchestrate / health_forecast
- Spec: split_tasks / enhance_spec / apply_spec
- Context: _summarize / _evaluate_compression_quality
- Subagent: AutoPlan / EvolutionTerminal
- Terminal: suggest / diagnose

本模块提供:
1. 全局 Token / 成本预算(日 / 小时 / 支柱分配)
2. 自动降级(超 90% 切换更便宜模型)
3. 硬停止(超 100% 拒绝调用)
4. 用量追踪(Redis 持久化,内存降级)
5. 用量汇总 / 趋势 / 成本分解
6. 装饰器 with_budget 自动 check + record

使用方式:
    from app.services.llm_budget_governor import (
        llm_budget_governor, with_budget, BudgetExceededError,
    )

    # 检查预算
    result = await llm_budget_governor.check_budget("rules", estimated_tokens=2000)
    if not result.allowed:
        raise BudgetExceededError(result.reason, result.usage_percent, result.remaining_tokens)
    model = result.degrade_to_model or "gpt-4o"

    # 记录用量
    await llm_budget_governor.record_usage(
        pillar="rules", model=model,
        input_tokens=1500, output_tokens=500,
        action="auto_generate", request_id="req-123",
    )

    # 装饰器(自动 check + record)
    @with_budget("rules", "auto_generate")
    async def auto_generate_rules(...): ...
"""

from __future__ import annotations

import asyncio
import functools
import json
import logging
import os
import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# Redis key 模板
_REDIS_KEY_USAGE = "hub:budget:usage"                       # sorted set: score=ts, member=JSON
_REDIS_KEY_DAILY = "hub:budget:daily:{date}"                # hash: field=tokens|cost
_REDIS_KEY_HOURLY = "hub:budget:hourly:{hour}"              # hash: field=tokens|cost
_REDIS_KEY_PILLAR = "hub:budget:pillar:{pillar}:{date}"     # hash: field=tokens|cost
_REDIS_KEY_CONFIG = "hub:budget:config"                     # hash: 配置覆盖
# 内存降级上限
_MEMORY_USAGE_MAX = 10000
# 支柱白名单
_VALID_PILLARS = {"rules", "hook", "spec", "context", "subagent", "terminal"}


def _now_iso() -> str:
    """UTC ISO 8601 时间戳。"""
    return datetime.now(timezone.utc).isoformat()


def _today_key() -> str:
    """当日日期 key(UTC,YYYY-MM-DD)。"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _hour_key() -> str:
    """当小时 key(UTC,YYYY-MM-DD-HH)。"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d-%H")


def _date_from_days_ago(days: int) -> str:
    """N 天前的日期 key。"""
    return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")


@dataclass
class BudgetConfig:
    """预算配置。"""

    daily_token_limit: int = 2_000_000       # 每日 Token 上限
    daily_cost_limit_usd: float = 10.0       # 每日成本上限($)
    hourly_token_limit: int = 200_000        # 每小时 Token 上限
    warning_threshold: float = 0.8           # 80% 预警
    critical_threshold: float = 0.95         # 95% 严重
    auto_degrade_at: float = 0.9             # 90% 自动降级(切换到更便宜模型)
    hard_stop_at: float = 1.0                # 100% 硬停止
    # 按支柱分配预算比例
    pillar_ratios: dict = field(default_factory=lambda: {
        "rules": 0.10,
        "hook": 0.10,
        "spec": 0.20,
        "context": 0.25,
        "subagent": 0.25,
        "terminal": 0.10,
    })
    # 模型成本表(每 1K token 美元)
    model_cost_table: dict = field(default_factory=lambda: {
        "gpt-4o": {"input": 0.0025, "output": 0.01},
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
        "gpt-4-turbo": {"input": 0.01, "output": 0.03},
        "claude-3-opus": {"input": 0.015, "output": 0.075},
        "claude-3-sonnet": {"input": 0.003, "output": 0.015},
        "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
        "default": {"input": 0.002, "output": 0.008},
    })
    # 降级链(预算紧张时切换,从贵到便宜)
    degrade_chain: list = field(default_factory=lambda: [
        "gpt-4o", "gpt-4o-mini",  # 优先降级到 mini
    ])


@dataclass
class UsageRecord:
    """单次 LLM 调用用量记录。"""

    pillar: str          # rules/hook/spec/context/subagent/terminal
    model: str           # gpt-4o/gpt-4o-mini/...
    input_tokens: int
    output_tokens: int
    cost_usd: float
    timestamp: str       # ISO 8601
    request_id: str      # 关联请求 ID
    action: str          # auto_generate/summarize/orchestrate/...


@dataclass
class BudgetCheckResult:
    """预算检查结果。"""

    allowed: bool                  # 是否允许调用
    degrade_to_model: Optional[str]  # 建议降级到的模型(None=不降级)
    reason: str                    # 原因说明
    usage_percent: float           # 当前用量百分比
    pillar_usage_percent: float    # 支柱用量百分比
    remaining_tokens: int          # 剩余 Token
    remaining_cost_usd: float      # 剩余成本


class BudgetExceededError(Exception):
    """预算超限异常。"""

    def __init__(
        self,
        message: str,
        usage_percent: float = 0.0,
        remaining_tokens: int = 0,
    ) -> None:
        super().__init__(message)
        self.usage_percent = usage_percent
        self.remaining_tokens = remaining_tokens


class LLMBudgetGovernor:
    """LLM 成本预算治理器 — 全局 Token/成本预算 + 自动降级 + 用量追踪。

    设计:
    - Redis 优先(sorted set + hash 累加器),失败降级到内存 deque
    - 与 orchestration_hub 集成用延迟 import,避免循环依赖;import 失败时静默跳过事件发射
    - 所有方法 async,可被 6 大支柱统一调用
    """

    def __init__(self, config: Optional[BudgetConfig] = None) -> None:
        self.config = config or BudgetConfig()
        self._redis: Any = None
        self._redis_inited = False
        # 内存降级:用量记录 deque + 累加器
        self._memory_usage: deque = deque(maxlen=_MEMORY_USAGE_MAX)
        self._memory_daily: dict[str, dict[str, float]] = {}    # date -> {tokens, cost}
        self._memory_hourly: dict[str, dict[str, float]] = {}   # hour -> {tokens, cost}
        self._memory_pillar: dict[str, dict[str, dict[str, float]]] = {}  # pillar -> date -> {tokens, cost}
        self._degraded_models: dict[str, str] = {}  # pillar -> 当前降级到的模型

    # ------------------------------------------------------------------
    # Redis 连接
    # ------------------------------------------------------------------

    async def _ensure_redis(self) -> Any:
        """惰性获取 Redis 连接(复用现有模式),失败返回 None。"""
        if self._redis_inited:
            return self._redis
        self._redis_inited = True
        url = os.environ.get("REDIS_URL")
        if not url:
            return None
        try:
            import redis.asyncio as aioredis  # type: ignore[import-untyped]

            self._redis = aioredis.from_url(url, decode_responses=True)
        except Exception as e:
            logger.debug("Redis 初始化失败,降级为内存模式: %s", e)
            self._redis = None
        return self._redis

    # ------------------------------------------------------------------
    # 内部:成本计算
    # ------------------------------------------------------------------

    def _calc_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """计算单次调用成本(美元)。未知模型用 default 费率。"""
        table = self.config.model_cost_table
        rates = table.get(model) or table.get("default") or {"input": 0.002, "output": 0.008}
        cost = (input_tokens / 1000.0) * rates.get("input", 0.002) + \
               (output_tokens / 1000.0) * rates.get("output", 0.008)
        return round(cost, 6)

    # ------------------------------------------------------------------
    # 内部:用量累加与读取(Redis + 内存降级)
    # ------------------------------------------------------------------

    async def _incr_usage(
        self,
        date_key: str,
        hour_key: str,
        pillar: str,
        tokens: int,
        cost: float,
    ) -> None:
        """累加当日/当小时/当支柱用量。Redis 失败降级内存。

        内存降级时统一用完整 Redis key 作为 store key,保证与 _get_period_usage /
        _get_pillar_usage 的读取 key 一致(读取侧用 redis_key_fn() / 完整 pillar key)。
        """
        daily_key = _REDIS_KEY_DAILY.format(date=date_key)
        hourly_key = _REDIS_KEY_HOURLY.format(hour=hour_key)
        pillar_key = _REDIS_KEY_PILLAR.format(pillar=pillar, date=date_key)
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                pipe = redis.pipeline()
                pipe.hincrby(daily_key, "tokens", tokens)
                pipe.hincrbyfloat(daily_key, "cost", cost)
                pipe.hincrby(hourly_key, "tokens", tokens)
                pipe.hincrbyfloat(hourly_key, "cost", cost)
                pipe.hincrby(pillar_key, "tokens", tokens)
                pipe.hincrbyfloat(pillar_key, "cost", cost)
                await pipe.execute()
                return
            except Exception as e:
                logger.debug("Redis 用量累加失败,降级内存: %s", e)
        # 内存降级(用完整 Redis key,与读取侧一致)
        self._incr_memory(self._memory_daily, daily_key, tokens, cost)
        self._incr_memory(self._memory_hourly, hourly_key, tokens, cost)
        self._memory_pillar.setdefault(pillar, {})
        self._incr_memory(self._memory_pillar[pillar], pillar_key, tokens, cost)

    @staticmethod
    def _incr_memory(
        store: dict[str, dict[str, float]],
        key: str,
        tokens: int,
        cost: float,
    ) -> None:
        bucket = store.setdefault(key, {"tokens": 0, "cost": 0.0})
        bucket["tokens"] += tokens
        bucket["cost"] = round(bucket["cost"] + cost, 6)

    async def _get_period_usage(
        self,
        redis_key_fn: Callable[[], str],
        memory: dict[str, dict[str, float]],
    ) -> dict[str, float]:
        """读取某周期(daily/hourly)累计用量。"""
        key = redis_key_fn()
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                tokens_raw = await redis.hget(key, "tokens")
                cost_raw = await redis.hget(key, "cost")
                return {
                    "tokens": int(tokens_raw) if tokens_raw else 0,
                    "cost": float(cost_raw) if cost_raw else 0.0,
                }
            except Exception as e:
                logger.debug("Redis 读取用量失败,降级内存: %s", e)
        bucket = memory.get(key, {"tokens": 0, "cost": 0.0})
        return {"tokens": int(bucket["tokens"]), "cost": float(bucket["cost"])}

    async def _get_pillar_usage(self, pillar: str, date_key: str) -> dict[str, float]:
        """读取单支柱当日用量。"""
        pkey = _REDIS_KEY_PILLAR.format(pillar=pillar, date=date_key)
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                tokens_raw = await redis.hget(pkey, "tokens")
                cost_raw = await redis.hget(pkey, "cost")
                return {
                    "tokens": int(tokens_raw) if tokens_raw else 0,
                    "cost": float(cost_raw) if cost_raw else 0.0,
                }
            except Exception as e:
                logger.debug("Redis 读取支柱用量失败,降级内存: %s", e)
        bucket = self._memory_pillar.get(pillar, {}).get(pkey, {"tokens": 0, "cost": 0.0})
        return {"tokens": int(bucket["tokens"]), "cost": float(bucket["cost"])}

    async def _scan_records(self, period: str) -> list[dict]:
        """扫描某周期的用量记录(用于按支柱/模型/action 分解)。"""
        now = datetime.now(timezone.utc)
        if period == "today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end = now
        elif period == "hour":
            start = now.replace(minute=0, second=0, microsecond=0)
            end = now
        elif period == "week":
            end = now
            start = end - timedelta(days=7)
        else:
            start = end = now

        records: list[dict] = []
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                members = await redis.zrangebyscore(
                    _REDIS_KEY_USAGE,
                    start.timestamp(),
                    end.timestamp(),
                )
                for m in members:
                    try:
                        records.append(json.loads(m))
                    except Exception:
                        continue
                return records
            except Exception as e:
                logger.debug("Redis zrangebyscore 失败,降级内存: %s", e)
        # 内存降级:扫描 deque
        for r in self._memory_usage:
            try:
                ts = datetime.fromisoformat(r.timestamp)
            except Exception:
                continue
            if start <= ts <= end:
                records.append({
                    "pillar": r.pillar, "model": r.model,
                    "input_tokens": r.input_tokens, "output_tokens": r.output_tokens,
                    "cost_usd": r.cost_usd, "action": r.action,
                    "request_id": r.request_id, "timestamp": r.timestamp,
                })
        return records

    async def _emit_event(self, event_type: str, payload: dict) -> None:
        """发射事件到 orchestration_hub(延迟 import 避免循环依赖;import 失败静默跳过)。"""
        try:
            from .orchestration_hub import orchestration_hub  # type: ignore[import-untyped]
        except Exception:
            return  # orchestration_hub 不存在或 import 失败,静默跳过
        try:
            emit = getattr(orchestration_hub, "emit_event", None) or \
                   getattr(orchestration_hub, "emit", None)
            if emit is None:
                return
            result = emit(event_type, payload)
            if asyncio.iscoroutine(result):
                await result
        except Exception as e:
            logger.debug("事件发射失败(忽略): %s", e)

    def _pick_degrade_model(self, pillar: str) -> Optional[str]:
        """从降级链选下一个更便宜的模型。"""
        chain = self.config.degrade_chain
        if not chain or len(chain) < 2:
            return None
        current = self._degraded_models.get(pillar)
        if current is None:
            # 未降级 → 降到链中第 2 个(第一档降级)
            return chain[1]
        try:
            idx = chain.index(current)
        except ValueError:
            # 当前降级模型不在链中 → 直接给最便宜档
            return chain[-1]
        if idx + 1 < len(chain):
            return chain[idx + 1]
        return chain[-1]  # 已在最便宜档

    # ------------------------------------------------------------------
    # 公开 API
    # ------------------------------------------------------------------

    async def record_usage(
        self,
        pillar: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        action: str,
        request_id: str = "",
    ) -> UsageRecord:
        """记录一次 LLM 调用用量。

        - 计算 cost_usd(从 model_cost_table 查询,未知模型用 default)
        - 写入 Redis sorted set(score=timestamp,member=JSON)(key: hub:budget:usage)
        - 写入 Redis hash 累加器(hub:budget:daily:{date} / hub:budget:hourly:{hour} / hub:budget:pillar:{pillar}:{date})
        - 失败降级到内存 deque
        - 返回 UsageRecord
        """
        if pillar not in _VALID_PILLARS:
            logger.warning("未知支柱 %r,记录但不计入预算分配", pillar)
        cost = self._calc_cost(model, input_tokens, output_tokens)
        ts = _now_iso()
        rid = request_id or uuid.uuid4().hex
        record = UsageRecord(
            pillar=pillar,
            model=model,
            input_tokens=int(input_tokens),
            output_tokens=int(output_tokens),
            cost_usd=cost,
            timestamp=ts,
            request_id=rid,
            action=action,
        )
        date_key = _today_key()
        hour_key = _hour_key()
        total_tokens = int(input_tokens) + int(output_tokens)

        # 写 sorted set(Redis)/ deque(内存)
        redis = await self._ensure_redis()
        member = json.dumps({
            "pillar": pillar, "model": model,
            "input_tokens": int(input_tokens), "output_tokens": int(output_tokens),
            "cost_usd": cost, "timestamp": ts,
            "request_id": rid, "action": action,
        }, ensure_ascii=False)
        if redis is not None:
            try:
                score = datetime.now(timezone.utc).timestamp()
                await redis.zadd(_REDIS_KEY_USAGE, {member: score})
            except Exception as e:
                logger.debug("Redis zadd 用量失败,降级内存: %s", e)
                self._memory_usage.append(record)
        else:
            self._memory_usage.append(record)

        # 累加 daily/hourly/pillar
        await self._incr_usage(date_key, hour_key, pillar, total_tokens, cost)
        return record

    async def check_budget(
        self,
        pillar: str,
        estimated_tokens: int = 0,
    ) -> BudgetCheckResult:
        """检查预算是否允许调用。

        - 读取当日/当小时累计用量
        - 对比 config 限制
        - 返回 BudgetCheckResult(allowed/degrade_to_model/reason/usage_summary)
        - 超过 warning_threshold → 发射 budget.warning 事件(通过 orchestration_hub,延迟 import 避免循环)
        - 超过 auto_degrade_at → 返回 degrade_to_model(从 degrade_chain 选下一个)
        - 超过 hard_stop_at → allowed=False
        """
        date_key = _today_key()
        daily = await self._get_period_usage(
            lambda: _REDIS_KEY_DAILY.format(date=date_key),
            self._memory_daily,
        )
        hourly = await self._get_period_usage(
            lambda: _REDIS_KEY_HOURLY.format(hour=_hour_key()),
            self._memory_hourly,
        )
        pillar_usage = await self._get_pillar_usage(pillar, date_key)

        daily_tokens = daily["tokens"]
        daily_cost = daily["cost"]
        hourly_tokens = hourly["tokens"]

        # 用量百分比(取 token 与 cost 的最大占比,避免单一维度失真)
        token_pct = daily_tokens / self.config.daily_token_limit if self.config.daily_token_limit > 0 else 0.0
        cost_pct = daily_cost / self.config.daily_cost_limit_usd if self.config.daily_cost_limit_usd > 0 else 0.0
        hourly_pct = hourly_tokens / self.config.hourly_token_limit if self.config.hourly_token_limit > 0 else 0.0
        usage_percent = max(token_pct, cost_pct, hourly_pct)

        # 支柱维度
        pillar_ratio = self.config.pillar_ratios.get(pillar, 0.0)
        pillar_token_limit = int(self.config.daily_token_limit * pillar_ratio)
        pillar_usage_percent = (
            pillar_usage["tokens"] / pillar_token_limit if pillar_token_limit > 0 else 0.0
        )

        remaining_tokens = max(0, self.config.daily_token_limit - daily_tokens)
        remaining_cost = max(0.0, self.config.daily_cost_limit_usd - daily_cost)

        # 硬停止
        if usage_percent >= self.config.hard_stop_at:
            await self._emit_event("budget.critical", {
                "pillar": pillar, "usage_percent": usage_percent,
                "daily_tokens": daily_tokens, "daily_cost": daily_cost,
            })
            return BudgetCheckResult(
                allowed=False,
                degrade_to_model=None,
                reason=f"已达硬停止阈值({usage_percent:.1%} ≥ {self.config.hard_stop_at:.0%})",
                usage_percent=usage_percent,
                pillar_usage_percent=pillar_usage_percent,
                remaining_tokens=remaining_tokens,
                remaining_cost_usd=remaining_cost,
            )

        # 自动降级
        degrade_to: Optional[str] = None
        if usage_percent >= self.config.auto_degrade_at or \
           pillar_usage_percent >= self.config.auto_degrade_at:
            degrade_to = self._pick_degrade_model(pillar)
            if degrade_to is not None:
                self._degraded_models[pillar] = degrade_to
            await self._emit_event("budget.degrade", {
                "pillar": pillar, "degrade_to": degrade_to,
                "usage_percent": usage_percent,
                "pillar_usage_percent": pillar_usage_percent,
            })

        # 严重 / 预警阈值事件
        if usage_percent >= self.config.critical_threshold:
            await self._emit_event("budget.critical", {
                "pillar": pillar, "usage_percent": usage_percent,
            })
        elif usage_percent >= self.config.warning_threshold:
            await self._emit_event("budget.warning", {
                "pillar": pillar, "usage_percent": usage_percent,
            })

        reason = "预算充足"
        if degrade_to:
            reason = f"已超降级阈值(全局 {usage_percent:.1%}/支柱 {pillar_usage_percent:.1%}),建议切换到 {degrade_to}"

        return BudgetCheckResult(
            allowed=True,
            degrade_to_model=degrade_to,
            reason=reason,
            usage_percent=usage_percent,
            pillar_usage_percent=pillar_usage_percent,
            remaining_tokens=remaining_tokens,
            remaining_cost_usd=remaining_cost,
        )

    async def get_usage_summary(self, period: str = "today") -> dict:
        """用量汇总。

        - period: today/hour/week/pillar:{name}
        - 返回 {total_tokens, total_cost, by_pillar: {pillar: {tokens, cost}}, by_model: {model: {tokens, cost}}, limit, usage_percent}
        """
        if period.startswith("pillar:"):
            name = period.split(":", 1)[1]
            return await self.get_pillar_budget(name)

        if period == "today":
            date_key = _today_key()
            usage = await self._get_period_usage(
                lambda: _REDIS_KEY_DAILY.format(date=date_key),
                self._memory_daily,
            )
            limit_tokens = self.config.daily_token_limit
            limit_cost = self.config.daily_cost_limit_usd
            scan_period = "today"
        elif period == "hour":
            hour_key = _hour_key()
            usage = await self._get_period_usage(
                lambda: _REDIS_KEY_HOURLY.format(hour=hour_key),
                self._memory_hourly,
            )
            limit_tokens = self.config.hourly_token_limit
            limit_cost = self.config.daily_cost_limit_usd / 24.0
            scan_period = "hour"
        elif period == "week":
            agg = {"tokens": 0, "cost": 0.0}
            for d in range(7):
                dk = _date_from_days_ago(d)
                u = await self._get_period_usage(
                    lambda dk=dk: _REDIS_KEY_DAILY.format(date=dk),
                    self._memory_daily,
                )
                agg["tokens"] += u["tokens"]
                agg["cost"] = round(agg["cost"] + u["cost"], 6)
            usage = agg
            limit_tokens = self.config.daily_token_limit * 7
            limit_cost = self.config.daily_cost_limit_usd * 7
            scan_period = "week"
        else:
            return {"error": f"未知 period: {period}"}

        # 按支柱/模型分解(从 sorted set 或内存 deque 扫描记录)
        by_pillar: dict[str, dict[str, float]] = {}
        by_model: dict[str, dict[str, float]] = {}
        records = await self._scan_records(scan_period)
        for r in records:
            p = r.get("pillar", "unknown")
            m = r.get("model", "unknown")
            t = int(r.get("input_tokens", 0)) + int(r.get("output_tokens", 0))
            c = float(r.get("cost_usd", 0.0))
            bp = by_pillar.setdefault(p, {"tokens": 0, "cost": 0.0})
            bp["tokens"] += t
            bp["cost"] = round(bp["cost"] + c, 6)
            bm = by_model.setdefault(m, {"tokens": 0, "cost": 0.0})
            bm["tokens"] += t
            bm["cost"] = round(bm["cost"] + c, 6)

        usage_percent = 0.0
        if limit_tokens > 0:
            usage_percent = max(usage_percent, usage["tokens"] / limit_tokens)
        if limit_cost > 0:
            usage_percent = max(usage_percent, usage["cost"] / limit_cost)

        return {
            "total_tokens": usage["tokens"],
            "total_cost": usage["cost"],
            "by_pillar": by_pillar,
            "by_model": by_model,
            "limit": {"tokens": limit_tokens, "cost": limit_cost},
            "usage_percent": round(usage_percent, 4),
        }

    async def get_usage_trend(self, days: int = 7) -> list[dict]:
        """用量趋势(最近 N 天,按天聚合)。返回 [{date, tokens, cost, by_pillar: {...}}]"""
        trend: list[dict] = []
        for d in range(days - 1, -1, -1):
            dk = _date_from_days_ago(d)
            usage = await self._get_period_usage(
                lambda dk=dk: _REDIS_KEY_DAILY.format(date=dk),
                self._memory_daily,
            )
            # 按支柱分解当日
            by_pillar: dict[str, dict[str, float]] = {}
            for p in _VALID_PILLARS:
                pu = await self._get_pillar_usage(p, dk)
                if pu["tokens"] > 0 or pu["cost"] > 0:
                    by_pillar[p] = pu
            trend.append({
                "date": dk,
                "tokens": usage["tokens"],
                "cost": usage["cost"],
                "by_pillar": by_pillar,
            })
        return trend

    async def get_pillar_budget(self, pillar: str) -> dict:
        """单支柱预算详情。返回 {allocated_limit, used_tokens, used_cost, remaining, usage_percent, degraded_model}"""
        date_key = _today_key()
        usage = await self._get_pillar_usage(pillar, date_key)
        ratio = self.config.pillar_ratios.get(pillar, 0.0)
        allocated_tokens = int(self.config.daily_token_limit * ratio)
        allocated_cost = self.config.daily_cost_limit_usd * ratio
        usage_percent = 0.0
        if allocated_tokens > 0:
            usage_percent = max(usage_percent, usage["tokens"] / allocated_tokens)
        if allocated_cost > 0:
            usage_percent = max(usage_percent, usage["cost"] / allocated_cost)
        return {
            "pillar": pillar,
            "allocated_limit": {"tokens": allocated_tokens, "cost": round(allocated_cost, 4)},
            "used_tokens": usage["tokens"],
            "used_cost": usage["cost"],
            "remaining": {
                "tokens": max(0, allocated_tokens - usage["tokens"]),
                "cost": round(max(0.0, allocated_cost - usage["cost"]), 6),
            },
            "usage_percent": round(usage_percent, 4),
            "degraded_model": self._degraded_models.get(pillar),
        }

    async def reset_degradation(self, pillar: str) -> bool:
        """重置支柱降级状态(恢复到原始模型)。"""
        if pillar in self._degraded_models:
            del self._degraded_models[pillar]
            await self._emit_event("budget.degrade_reset", {"pillar": pillar})
            return True
        return False

    async def update_config(self, config: dict) -> BudgetConfig:
        """更新预算配置(部分更新,存 Redis hash hub:budget:config)。"""
        if "daily_token_limit" in config:
            self.config.daily_token_limit = int(config["daily_token_limit"])
        if "daily_cost_limit_usd" in config:
            self.config.daily_cost_limit_usd = float(config["daily_cost_limit_usd"])
        if "hourly_token_limit" in config:
            self.config.hourly_token_limit = int(config["hourly_token_limit"])
        if "warning_threshold" in config:
            self.config.warning_threshold = float(config["warning_threshold"])
        if "critical_threshold" in config:
            self.config.critical_threshold = float(config["critical_threshold"])
        if "auto_degrade_at" in config:
            self.config.auto_degrade_at = float(config["auto_degrade_at"])
        if "hard_stop_at" in config:
            self.config.hard_stop_at = float(config["hard_stop_at"])
        if "pillar_ratios" in config and isinstance(config["pillar_ratios"], dict):
            total = sum(float(v) for v in config["pillar_ratios"].values())
            if abs(total - 1.0) > 0.05:
                logger.warning("pillar_ratios 总和 %.3f 偏离 1.0,仍接受", total)
            self.config.pillar_ratios = dict(config["pillar_ratios"])
        if "model_cost_table" in config and isinstance(config["model_cost_table"], dict):
            self.config.model_cost_table.update(config["model_cost_table"])
        if "degrade_chain" in config and isinstance(config["degrade_chain"], list):
            self.config.degrade_chain = list(config["degrade_chain"])

        # 持久化到 Redis
        redis = await self._ensure_redis()
        if redis is not None:
            try:
                mapping = {
                    "daily_token_limit": str(self.config.daily_token_limit),
                    "daily_cost_limit_usd": str(self.config.daily_cost_limit_usd),
                    "hourly_token_limit": str(self.config.hourly_token_limit),
                    "warning_threshold": str(self.config.warning_threshold),
                    "critical_threshold": str(self.config.critical_threshold),
                    "auto_degrade_at": str(self.config.auto_degrade_at),
                    "hard_stop_at": str(self.config.hard_stop_at),
                    "pillar_ratios": json.dumps(self.config.pillar_ratios, ensure_ascii=False),
                    "degrade_chain": json.dumps(self.config.degrade_chain, ensure_ascii=False),
                }
                await redis.hset(_REDIS_KEY_CONFIG, mapping=mapping)
            except Exception as e:
                logger.debug("Redis 配置持久化失败(忽略): %s", e)
        return self.config

    async def get_cost_breakdown(self, period: str = "today") -> dict:
        """成本分解(按支柱 + 按模型 + 按 action)。返回 {by_pillar, by_model, by_action, total}"""
        records = await self._scan_records(period)
        by_pillar: dict[str, dict[str, float]] = {}
        by_model: dict[str, dict[str, float]] = {}
        by_action: dict[str, dict[str, float]] = {}
        total_tokens = 0
        total_cost = 0.0
        for r in records:
            p = r.get("pillar", "unknown")
            m = r.get("model", "unknown")
            a = r.get("action", "unknown")
            t = int(r.get("input_tokens", 0)) + int(r.get("output_tokens", 0))
            c = float(r.get("cost_usd", 0.0))
            for store, k in ((by_pillar, p), (by_model, m), (by_action, a)):
                b = store.setdefault(k, {"tokens": 0, "cost": 0.0})
                b["tokens"] += t
                b["cost"] = round(b["cost"] + c, 6)
            total_tokens += t
            total_cost = round(total_cost + c, 6)
        return {
            "by_pillar": by_pillar,
            "by_model": by_model,
            "by_action": by_action,
            "total": {"tokens": total_tokens, "cost": total_cost},
        }


def with_budget(pillar: str, action: str) -> Callable:
    """装饰器:自动检查预算 + 记录用量。

    用法:
        @with_budget("rules", "auto_generate")
        async def auto_generate_rules(...):
            ...

    自动在调用前 check_budget,调用后 record_usage。
    超预算时抛出 BudgetExceededError(或返回降级信号)。
    被装饰函数若返回 dict 且含 model/input_tokens/output_tokens,则自动记录用量;
    否则仅检查不记录(避免对无 LLM 调用的函数误记)。
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # 调用前:检查预算
            check = await llm_budget_governor.check_budget(pillar)
            if not check.allowed:
                raise BudgetExceededError(
                    f"[{pillar}/{action}] 预算超限:{check.reason}",
                    usage_percent=check.usage_percent,
                    remaining_tokens=check.remaining_tokens,
                )
            # 执行原函数
            result = await func(*args, **kwargs)
            # 调用后:若结果含用量信息,记录
            if isinstance(result, dict):
                model = result.get("model") or result.get("llm_model")
                in_tok = result.get("input_tokens") or result.get("prompt_tokens")
                out_tok = result.get("output_tokens") or result.get("completion_tokens")
                if model and in_tok is not None and out_tok is not None:
                    await llm_budget_governor.record_usage(
                        pillar=pillar,
                        model=str(model),
                        input_tokens=int(in_tok),
                        output_tokens=int(out_tok),
                        action=action,
                        request_id=str(result.get("request_id", "")),
                    )
            return result

        return wrapper

    return decorator


# 模块级单例
llm_budget_governor = LLMBudgetGovernor()
