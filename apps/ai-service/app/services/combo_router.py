"""Combo 多级 fallback 链服务(2026-07-30 立,对齐 OmniRoute Combo + 超越)。

设计参考:OmniRoute 的 combo routing(priority 链式 fallback)+ IHUI 自有增强:
- priority:按预定义链顺序 fallback(对齐 OmniRoute)
- cheapest:按价格升序选可用 provider(超越 OmniRoute,OmniRoute 无此策略)
- fusion:并发调用多个 model + judge model 票决(超越 OmniRoute,OmniRoute 有 fusion 但无 judge)

触发条件:主 provider 失败(429 配额耗尽 / timeout / 5xx 服务异常)时,
ComboRouter 接管,按策略选下一个 provider,记录 fallback 历史到 LLM_FALLBACK_TRIGGERED metric。

与现有 FallbackRouter(llm_gateway.py)的区别:
- FallbackRouter:单级 fallback(primary 失败 → fallbacks 列表顺序尝试)
- ComboRouter:多级 + 策略选择(priority/cheapest/fusion)+ 配额感知(429 自动跳过该 provider 一段时间)

配置示例(通过 configure_combos() 或环境变量 COMBO_CHAINS JSON):
{
  "maximize-free": {
    "strategy": "priority",
    "chain": ["kimi-k2", "glm-4-flash", "deepseek-chat", "stepfun/step-3.7-flash"]
  },
  "maximize-quality": {
    "strategy": "priority",
    "chain": ["claude-opus-4", "gpt-5", "gemini-3-pro"]
  },
  "cheapest-first": {
    "strategy": "cheapest",
    "chain": ["glm-4-flash", "deepseek-chat", "kimi-k2", "stepfun/step-3.7-flash"]
  },
  "fusion-vote": {
    "strategy": "fusion",
    "chain": ["gpt-4o", "claude-3.5-sonnet", "gemini-2.5-pro"],
    "judge": "gpt-4o-mini"
  }
}
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

from ..middleware.llm_metrics import (
    LLM_FALLBACK_FAILURE,
    LLM_FALLBACK_SUCCESS,
    LLM_FALLBACK_TRIGGERED,
    classify_fallback_reason,
)

logger = logging.getLogger(__name__)


class ComboStrategy(str, Enum):
    """Combo 路由策略。"""

    PRIORITY = "priority"  # 按预定义链顺序 fallback(对齐 OmniRoute)
    CHEAPEST = "cheapest"  # 按价格升序选可用 provider(超越 OmniRoute)
    FUSION = "fusion"  # 并发调用 + judge 票决(超越 OmniRoute)


@dataclass
class ComboChain:
    """单个 Combo 链配置。

    Attributes:
        name: 链名(如 "maximize-free")。
        strategy: 路由策略。
        chain: provider/model 列表(按优先级或价格升序)。
        judge: fusion 策略下的 judge model(可选)。
        description: 人类可读描述。
    """

    name: str
    strategy: ComboStrategy
    chain: list[str]
    judge: Optional[str] = None
    description: str = ""


@dataclass
class ComboFallbackRecord:
    """单次 fallback 记录(供 metric 埋点和审计)。"""

    primary_model: str
    backup_model: str
    reason: str  # timeout / rate_limit / api_error / unknown
    success: bool
    duration_ms: float = 0.0
    error: Optional[str] = None


@dataclass
class ProviderHealthState:
    """provider 健康状态(配额感知)。

    429 触发后,该 provider 在 cooldown_seconds 内被跳过(避免无谓重试)。
    """

    provider: str
    last_429_at: float = 0.0
    cooldown_seconds: float = 60.0  # 默认冷却 60 秒
    consecutive_failures: int = 0

    def is_in_cooldown(self, now: float | None = None) -> bool:
        """是否在冷却期内。"""
        if self.last_429_at == 0.0:
            return False
        current = now if now is not None else time.time()
        return (current - self.last_429_at) < self.cooldown_seconds

    def mark_429(self) -> None:
        """标记 429(配额耗尽)。"""
        self.last_429_at = time.time()
        self.consecutive_failures += 1
        # 指数退避:连续失败越多,冷却越久(上限 30 分钟)
        self.cooldown_seconds = min(60.0 * (2 ** (self.consecutive_failures - 1)), 1800.0)

    def mark_success(self) -> None:
        """标记成功(重置计数)。"""
        self.last_429_at = 0.0
        self.consecutive_failures = 0
        self.cooldown_seconds = 60.0


class ComboRouter:
    """Combo 多级 fallback 路由器。

    用法:
        router = ComboRouter()
        router.configure_combo("maximize-free", {
            "strategy": "priority",
            "chain": ["kimi-k2", "glm-4-flash", "deepseek-chat"],
        })
        result = await router.route_with_combo(
            messages=msgs,
            combo_name="maximize-free",
            primary="kimi-k2",
        )
    """

    # provider 价格表(美元/1M tokens,[input, output]),用于 cheapest 策略排序
    # 数据来源:各 provider 官网定价页(2026-07-30 快照)
    PROVIDER_PRICING: dict[str, tuple[float, float]] = {
        # 免费 provider(本地 / 免费层)
        "ollama/llama3.2": (0.0, 0.0),
        "ollama/qwen2.5:32b": (0.0, 0.0),
        "kimi-k2": (0.0, 0.0),  # Moonshot 免费
        "glm-4-flash": (0.0, 0.0),  # 智谱免费
        "deepseek-chat": (0.14, 0.28),  # DeepSeek 低价
        # 便宜 provider
        "stepfun/step-3.7-flash": (0.2, 0.4),
        "gpt-4o-mini": (0.15, 0.6),
        "claude-3.5-haiku": (0.25, 1.25),
        "gemini-1.5-flash": (0.075, 0.3),
        # 中档 provider
        "gpt-4o": (2.5, 10.0),
        "claude-3.5-sonnet": (3.0, 15.0),
        "gemini-2.5-pro": (1.25, 5.0),
        # 高档 provider
        "claude-opus-4": (15.0, 75.0),
        "gpt-5": (10.0, 30.0),
        "gemini-3-pro": (2.5, 10.0),
    }

    def __init__(self) -> None:
        self._combos: dict[str, ComboChain] = {}
        self._health: dict[str, ProviderHealthState] = {}
        self._fallback_history: list[ComboFallbackRecord] = []
        self._max_history = 1000  # 保留最近 1000 条 fallback 记录

        # 从环境变量加载默认 combo 配置
        self._load_from_env()

    def _load_from_env(self) -> None:
        """从 COMBO_CHAINS 环境变量(JSON)加载默认配置。

        示例 .env:
        COMBO_CHAINS={"maximize-free":{"strategy":"priority","chain":["kimi-k2","glm-4-flash"]}}
        """
        raw = os.environ.get("COMBO_CHAINS", "").strip()
        if not raw:
            return
        try:
            data = json.loads(raw)
            if not isinstance(data, dict):
                logger.warning("COMBO_CHAINS 环境变量不是 JSON 对象,忽略")
                return
            for name, config in data.items():
                if not isinstance(config, dict):
                    continue
                self.configure_combo(name, config)
            logger.info("从 COMBO_CHAINS 环境变量加载 %d 个 combo 配置", len(self._combos))
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning("COMBO_CHAINS 环境变量解析失败: %s", e)

    def configure_combo(self, name: str, config: dict[str, Any]) -> None:
        """配置单个 combo 链。

        Args:
            name: 链名(如 "maximize-free")。
            config: {
                "strategy": "priority" | "cheapest" | "fusion",
                "chain": ["model1", "model2", ...],
                "judge": "model_name"(fusion 策略可选),
                "description": "..."
            }
        """
        strategy_str = config.get("strategy", "priority")
        try:
            strategy = ComboStrategy(strategy_str)
        except ValueError:
            logger.warning("Combo '%s' 策略无效: %s,降级为 priority", name, strategy_str)
            strategy = ComboStrategy.PRIORITY

        chain = config.get("chain", [])
        if not isinstance(chain, list) or not chain:
            logger.warning("Combo '%s' chain 为空,跳过配置", name)
            return

        self._combos[name] = ComboChain(
            name=name,
            strategy=strategy,
            chain=list(chain),
            judge=config.get("judge"),
            description=config.get("description", ""),
        )

    def get_combo(self, name: str) -> Optional[ComboChain]:
        """获取 combo 配置。"""
        return self._combos.get(name)

    def list_combos(self) -> list[ComboChain]:
        """列出所有 combo 配置。"""
        return list(self._combos.values())

    def find_combo_for_model(self, model: str) -> Optional[str]:
        """查找 model 所属的 combo 链名(用于 llm_gateway 自动触发 Combo fallback)。

        遍历所有 combo 链,返回第一个 chain 包含该 model 的 combo 名。
        未找到返回 None(说明该 model 未配置 combo 链,走标准 FallbackRouter 路径)。

        Args:
            model: 模型名称(如 "kimi-k2" / "stepfun/step-3.7-flash")。

        Returns:
            combo 链名,或 None。
        """
        for name, combo in self._combos.items():
            if model in combo.chain:
                return name
        return None

    def _get_health(self, provider: str) -> ProviderHealthState:
        """获取或创建 provider 健康状态。"""
        if provider not in self._health:
            self._health[provider] = ProviderHealthState(provider=provider)
        return self._health[provider]

    def _filter_available(self, chain: list[str]) -> list[str]:
        """过滤掉冷却期内的 provider。"""
        now = time.time()
        return [
            p for p in chain
            if not self._get_health(p).is_in_cooldown(now)
        ]

    def _sort_by_price(self, chain: list[str]) -> list[str]:
        """按价格升序排序(cheapest 策略)。"""
        def price_key(p: str) -> float:
            pricing = self.PROVIDER_PRICING.get(p, (999.0, 999.0))
            # 用 input + output 价格之和排序(粗略)
            return pricing[0] + pricing[1]
        return sorted(chain, key=price_key)

    def _select_chain_by_strategy(
        self,
        combo: ComboChain,
        primary: Optional[str] = None,
    ) -> list[str]:
        """按策略选择最终的 provider 调用顺序。

        Args:
            combo: combo 配置。
            primary: 主 provider(若在 chain 中,放第一位;None 时不强制)。

        Returns:
            排序后的 provider 列表(已过滤冷却期内的)。
        """
        chain = list(combo.chain)

        # primary 优先(若在 chain 中)
        if primary and primary in chain:
            chain.remove(primary)
            chain.insert(0, primary)

        # 过滤冷却期内的 provider
        available = self._filter_available(chain)

        if not available:
            # 全部在冷却期,降级返回原 chain(让上层尝试,可能冷却期已过)
            logger.warning("Combo '%s' 全部 provider 在冷却期,降级使用原 chain", combo.name)
            return chain

        if combo.strategy == ComboStrategy.CHEAPEST:
            return self._sort_by_price(available)

        # priority / fusion 都按 chain 原顺序
        return available

    async def route_with_combo(
        self,
        messages: list[dict[str, Any]],
        combo_name: str,
        primary: Optional[str] = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """按 combo 策略路由 LLM 调用。

        Args:
            messages: 消息列表。
            combo_name: combo 链名。
            primary: 主 provider(失败后触发 combo fallback)。
            **kwargs: 透传给 llm_gateway.complete() 的参数。

        Returns:
            LLM 响应 dict(含 content/model/usage,失败时含 error)。
        """
        # 延迟导入避免循环依赖
        from ..core.llm_gateway import llm_gateway

        combo = self._combos.get(combo_name)
        if not combo:
            return {
                "content": "",
                "error": f"combo not found: {combo_name}",
            }

        chain = self._select_chain_by_strategy(combo, primary)

        if combo.strategy == ComboStrategy.FUSION:
            return await self._route_fusion(messages, combo, chain, **kwargs)

        # priority / cheapest:顺序尝试
        last_error: Optional[str] = None
        for i, provider in enumerate(chain):
            start = time.time()
            try:
                # 透传 _skip_fallback=True 防止 llm_gateway 内部 FallbackRouter 递归
                result = await llm_gateway.complete(
                    messages, model=provider, _skip_fallback=True, **kwargs
                )
                if not result.get("error"):
                    # 成功:标记 provider 健康 + 记录 metric
                    self._get_health(provider).mark_success()
                    if i > 0:  # i=0 是 primary 成功,不算 fallback
                        self._record_fallback(
                            primary_model=primary or chain[0],
                            backup_model=provider,
                            reason="recovered",
                            success=True,
                            duration_ms=(time.time() - start) * 1000,
                        )
                    return result
                last_error = result.get("error_message") or result.get("error")
                # 检查是否 429(配额耗尽)
                if self._is_rate_limit_error(result):
                    self._get_health(provider).mark_429()
            except Exception as e:
                last_error = str(e)
                if self._is_rate_limit_exception(e):
                    self._get_health(provider).mark_429()
                # 记录 fallback 触发
                if i > 0 or primary:
                    self._record_fallback(
                        primary_model=primary or chain[0],
                        backup_model=provider,
                        reason=classify_fallback_reason(e),
                        success=False,
                        duration_ms=(time.time() - start) * 1000,
                        error=last_error,
                    )
                continue

        return {"content": "", "error": f"combo '{combo_name}' all providers failed: {last_error}"}

    async def _route_fusion(
        self,
        messages: list[dict[str, Any]],
        combo: ComboChain,
        chain: list[str],
        **kwargs: Any,
    ) -> dict[str, Any]:
        """fusion 策略:并发调用多个 model + judge model 票决。

        流程:
        1. 并发调用 chain 中所有 model(return_exceptions=True 防止单个失败崩溃)
        2. 收集所有成功响应
        3. 若有 judge model,把所有响应喂给 judge 票决最佳答案
        4. 无 judge 时,取第一个成功响应
        """
        from ..core.llm_gateway import llm_gateway

        # 1. 并发调用
        tasks = [
            llm_gateway.complete(messages, model=p, _skip_fallback=True, **kwargs)
            for p in chain
        ]
        proposals = await asyncio.gather(*tasks, return_exceptions=True)

        # 2. 收集成功响应
        successful: list[tuple[str, dict[str, Any]]] = []
        for provider, proposal in zip(chain, proposals):
            if isinstance(proposal, Exception):
                logger.warning("fusion provider %s 异常: %s", provider, proposal)
                continue
            if isinstance(proposal, dict) and not proposal.get("error"):
                successful.append((provider, proposal))

        if not successful:
            return {"content": "", "error": f"fusion combo '{combo.name}' all proposers failed"}

        # 3. 有 judge 时票决
        if combo.judge and len(successful) > 1:
            proposal_texts = [
                p.get("content", "") for _, p in successful if p.get("content")
            ]
            if proposal_texts:
                agg_messages = messages + [{
                    "role": "user",
                    "content": (
                        "以下是多个模型的回答,请综合给出最佳答案(可融合各方优点):\n\n"
                        + "\n\n---\n\n".join(proposal_texts)
                    ),
                }]
                try:
                    judge_result = await llm_gateway.complete(
                        agg_messages, model=combo.judge, _skip_fallback=True, **kwargs
                    )
                    if not judge_result.get("error"):
                        judge_result["model"] = combo.judge
                        judge_result["fusion_proposers"] = [p for p, _ in successful]
                        return judge_result
                except Exception as e:
                    logger.warning("fusion judge %s 失败: %s,降级取第一个", combo.judge, e)

        # 4. 无 judge 或 judge 失败:取第一个成功响应
        first_provider, first_result = successful[0]
        first_result["model"] = first_provider
        first_result["fusion_proposers"] = [p for p, _ in successful]
        return first_result

    def _is_rate_limit_error(self, result: dict[str, Any]) -> bool:
        """检查 LLM 响应是否是 429 错误。

        检查 error / error_message / message 三个字段(任一命中即判 429):
        - error:可能是 True/False 布尔,也可能是错误描述字符串
        - error_message:llm_gateway 标准错误字段
        - message:某些 provider 的错误响应字段
        """
        parts = [
            str(result.get("error", "")),
            str(result.get("error_message", "")),
            str(result.get("message", "")),
        ]
        combined = " ".join(parts).lower()
        return "429" in combined or "rate limit" in combined or "quota" in combined

    def _is_rate_limit_exception(self, exc: BaseException) -> bool:
        """检查异常是否是 429 错误。"""
        combined = f"{type(exc).__name__} {exc}".lower()
        return (
            "429" in combined
            or "ratelimit" in combined
            or "rate_limit" in combined
            or "rate limit" in combined
        )

    def _record_fallback(
        self,
        primary_model: str,
        backup_model: str,
        reason: str,
        success: bool,
        duration_ms: float = 0.0,
        error: Optional[str] = None,
    ) -> None:
        """记录 fallback 历史 + Prometheus metric。"""
        record = ComboFallbackRecord(
            primary_model=primary_model,
            backup_model=backup_model,
            reason=reason,
            success=success,
            duration_ms=duration_ms,
            error=error,
        )
        self._fallback_history.append(record)
        if len(self._fallback_history) > self._max_history:
            self._fallback_history = self._fallback_history[-self._max_history:]

        # Prometheus metric 埋点(失败不阻塞业务)
        try:
            LLM_FALLBACK_TRIGGERED.labels(
                primary_model=primary_model,
                backup_model=backup_model,
                reason=reason,
            ).inc()
            if success:
                LLM_FALLBACK_SUCCESS.labels(
                    primary_model=primary_model,
                    backup_model=backup_model,
                ).inc()
            else:
                LLM_FALLBACK_FAILURE.labels(
                    primary_model=primary_model,
                    backup_model=backup_model,
                ).inc()
        except Exception as metric_err:
            logger.warning("Combo fallback metric 记录失败(忽略): %s", metric_err)

    def get_fallback_history(self, limit: int = 100) -> list[ComboFallbackRecord]:
        """获取最近的 fallback 历史(供 Dashboard 展示)。"""
        return self._fallback_history[-limit:]

    def get_provider_health(self) -> dict[str, dict[str, Any]]:
        """获取所有 provider 健康状态(供 Dashboard 展示)。"""
        now = time.time()
        return {
            provider: {
                "in_cooldown": health.is_in_cooldown(now),
                "last_429_at": health.last_429_at,
                "cooldown_seconds": health.cooldown_seconds,
                "consecutive_failures": health.consecutive_failures,
            }
            for provider, health in self._health.items()
        }


# 全局单例(对齐 fallback_router / moa_router 模式)
combo_router = ComboRouter()
