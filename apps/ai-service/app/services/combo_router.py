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
import re
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

from ..middleware.llm_metrics import (
    LLM_FALLBACK_FAILURE,
    LLM_FALLBACK_SUCCESS,
    LLM_FALLBACK_TRIGGERED,
    LLM_FUSION_FAILURE,
    LLM_FUSION_JUDGE_CALLED,
    LLM_FUSION_PROPOSERS_CALLED,
    LLM_FUSION_SUCCESS,
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
        judge_mode: fusion 策略下 judge 的工作模式:
            - "merge"(默认):judge 综合各方优点产出融合答案。
            - "vote":judge 评估每个 proposal 的质量(1-10 分),选出最佳,
              返回 ``fusion_vote_result`` 字段含评分详情。
        max_concurrency: fusion 策略下并发调用 proposer 的上限(默认 5,
            避免一次 fusion 调用打爆 provider)。
    """

    name: str
    strategy: ComboStrategy
    chain: list[str]
    judge: Optional[str] = None
    description: str = ""
    judge_mode: str = "merge"  # "merge" | "vote"
    max_concurrency: int = 5


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
                "judge_mode": "merge" | "vote"(fusion 策略可选,默认 "merge"),
                "max_concurrency": int(fusion 策略可选,默认 5),
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

        # judge_mode 校验:仅 merge/vote 合法,其他值降级为 merge
        judge_mode = config.get("judge_mode", "merge")
        if judge_mode not in ("merge", "vote"):
            logger.warning(
                "Combo '%s' judge_mode 无效: %s,降级为 merge", name, judge_mode
            )
            judge_mode = "merge"

        # max_concurrency 校验:必须 >=1,否则用默认 5
        max_concurrency_raw = config.get("max_concurrency", 5)
        if (
            not isinstance(max_concurrency_raw, int)
            or isinstance(max_concurrency_raw, bool)
            or max_concurrency_raw < 1
        ):
            logger.warning(
                "Combo '%s' max_concurrency 无效: %r,降级为 5", name, max_concurrency_raw
            )
            max_concurrency = 5
        else:
            max_concurrency = max_concurrency_raw

        self._combos[name] = ComboChain(
            name=name,
            strategy=strategy,
            chain=list(chain),
            judge=config.get("judge"),
            description=config.get("description", ""),
            judge_mode=judge_mode,
            max_concurrency=max_concurrency,
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
        """fusion 策略:并发调用多个 model + judge model 票决/融合,带降级路径。

        流程:
        1. 用 ``asyncio.Semaphore`` 限制并发 proposer 数(``combo.max_concurrency``)
        2. 并发调用 chain 中所有 model(return_exceptions=True 防止单个失败崩溃)
        3. 收集所有成功响应
        4. 全失败 → 记录 ``LLM_FUSION_FAILURE`` + 返回 error
        5. 有 judge 且 >1 个成功 → 走 merge / vote 模式:
           - merge:judge 融合各方优点产出综合答案
           - vote:judge 评估每个 proposal(1-10 分),选出最佳,返回评分详情
           judge 成功 → 记录 ``LLM_FUSION_JUDGE_CALLED`` + ``LLM_FUSION_SUCCESS``
           judge 失败(judge 异常 / vote JSON 非法)→ 记录 ``LLM_FUSION_FAILURE`` + 降级取第一个
        6. 无 judge 或 ≤1 个成功 → 取第一个成功,记录 ``LLM_FUSION_SUCCESS``
        """
        from ..core.llm_gateway import llm_gateway

        # 1. 并发限流(Semaphore 上限 ≥1,防御 max_concurrency 配置为 0 的边界)
        max_conc = max(1, combo.max_concurrency)
        semaphore = asyncio.Semaphore(max_conc)

        async def _call_with_limit(provider: str) -> dict[str, Any]:
            async with semaphore:
                return await llm_gateway.complete(
                    messages, model=provider, _skip_fallback=True, **kwargs
                )

        # 2. 并发调用
        tasks = [_call_with_limit(p) for p in chain]
        proposals = await asyncio.gather(*tasks, return_exceptions=True)

        # 3. Metric:proposers_called(每次 fusion 触发记一次)
        self._safe_metric_inc(
            LLM_FUSION_PROPOSERS_CALLED,
            combo_name=combo.name,
            proposer_count=str(len(chain)),
        )

        # 4. 收集成功响应
        successful: list[tuple[str, dict[str, Any]]] = []
        for provider, proposal in zip(chain, proposals):
            if isinstance(proposal, Exception):
                logger.warning("fusion proposer %s 异常: %s", provider, proposal)
                continue
            if isinstance(proposal, dict) and not proposal.get("error"):
                successful.append((provider, proposal))

        # 5. 全 proposer 失败
        if not successful:
            self._safe_metric_inc(
                LLM_FUSION_FAILURE,
                combo_name=combo.name,
                reason="all_proposers_failed",
            )
            return {
                "content": "",
                "error": f"fusion combo '{combo.name}' all proposers failed",
            }

        # 6. 有 judge 且 >1 个成功 → 走 merge / vote
        judge_result: Optional[dict[str, Any]] = None
        failure_reason = ""
        if combo.judge and len(successful) > 1:
            if combo.judge_mode == "vote":
                judge_result, failure_reason = await self._run_judge_vote(
                    messages, combo, successful, **kwargs
                )
            else:
                judge_result, failure_reason = await self._run_judge_merge(
                    messages, combo, successful, **kwargs
                )

            if judge_result is not None:
                # judge 成功产出
                self._safe_metric_inc(
                    LLM_FUSION_JUDGE_CALLED,
                    combo_name=combo.name,
                    judge_model=combo.judge or "",
                    judge_mode=combo.judge_mode,
                )
                self._safe_metric_inc(LLM_FUSION_SUCCESS, combo_name=combo.name)
                return judge_result

            # judge 失败 → 记录 FAILURE + 降级到第一个
            logger.warning(
                "fusion judge %s (mode=%s) 失败: %s,降级取第一个成功 proposal",
                combo.judge, combo.judge_mode, failure_reason,
            )
            self._safe_metric_inc(
                LLM_FUSION_FAILURE,
                combo_name=combo.name,
                reason=failure_reason,
            )

        # 7. 无 judge / judge 失败 / 仅 1 个成功 → 取第一个
        first_provider, first_raw = successful[0]
        first_result = dict(first_raw)  # 避免修改原 dict
        first_result["model"] = first_provider
        first_result["fusion_proposers"] = [p for p, _ in successful]
        first_result["fusion_judge_mode"] = (
            combo.judge_mode if (combo.judge and len(successful) > 1) else "none"
        )
        self._safe_metric_inc(LLM_FUSION_SUCCESS, combo_name=combo.name)
        return first_result

    async def _run_judge_merge(
        self,
        messages: list[dict[str, Any]],
        combo: ComboChain,
        successful: list[tuple[str, dict[str, Any]]],
        **kwargs: Any,
    ) -> tuple[Optional[dict[str, Any]], str]:
        """merge 模式 judge:综合各方优点产出融合答案。

        Returns:
            ``(judge_result, failure_reason)``。成功时 ``failure_reason`` 为空字符串;
            失败时 ``judge_result`` 为 None,``failure_reason`` 为
            ``"judge_call_failed"`` 或 ``"judge_no_content"``。
        """
        from ..core.llm_gateway import llm_gateway

        proposal_texts = [
            p.get("content", "") for _, p in successful if p.get("content")
        ]
        if not proposal_texts:
            return None, "judge_no_content"

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
        except Exception as e:
            logger.warning("fusion merge judge %s 调用异常: %s", combo.judge, e)
            return None, "judge_call_failed"

        if not isinstance(judge_result, dict) or judge_result.get("error"):
            return None, "judge_call_failed"
        if not judge_result.get("content"):
            return None, "judge_no_content"

        merged = dict(judge_result)
        merged["model"] = combo.judge
        merged["fusion_proposers"] = [p for p, _ in successful]
        merged["fusion_judge_mode"] = "merge"
        return merged, ""

    async def _run_judge_vote(
        self,
        messages: list[dict[str, Any]],
        combo: ComboChain,
        successful: list[tuple[str, dict[str, Any]]],
        **kwargs: Any,
    ) -> tuple[Optional[dict[str, Any]], str]:
        """vote 模式 judge:评估每个 proposal(1-10 分),选出最佳。

        Returns:
            ``(judge_result, failure_reason)``。成功时返回最佳 proposal dict +
            ``fusion_vote_result`` 字段含评分详情;失败时 ``judge_result`` 为 None,
            ``failure_reason`` 为 ``"judge_call_failed"`` / ``"judge_no_content"``
            / ``"judge_invalid_json"``。
        """
        from ..core.llm_gateway import llm_gateway

        original_question = self._extract_original_question(messages)

        # 构造候选回答块(1-based 索引,与 successful 位置对齐,便于 best_index 反查)
        candidate_lines: list[str] = []
        has_any_content = False
        for idx, (provider, proposal) in enumerate(successful, start=1):
            content = proposal.get("content", "")
            if not isinstance(content, str):
                content = str(content) if content else ""
            if not content:
                content = "(empty)"
            else:
                has_any_content = True
            candidate_lines.append(f"[{idx}] {provider}: {content}")
        if not has_any_content:
            return None, "judge_no_content"

        candidate_block = "\n".join(candidate_lines)
        prompt = (
            "以下是多个模型对同一问题的回答,请评估每个回答的质量(1-10 分),选出最佳回答。\n\n"
            f"问题:{original_question}\n\n"
            f"候选回答:\n{candidate_block}\n\n"
            "请输出 JSON:\n"
            '{"best_index": 1, "scores": '
            '[{"index": 1, "score": 8, "reason": "..."}], "reason": "..."}'
        )
        agg_messages = messages + [{"role": "user", "content": prompt}]

        try:
            judge_raw = await llm_gateway.complete(
                agg_messages, model=combo.judge, _skip_fallback=True, **kwargs
            )
        except Exception as e:
            logger.warning("fusion vote judge %s 调用异常: %s", combo.judge, e)
            return None, "judge_call_failed"

        if not isinstance(judge_raw, dict) or judge_raw.get("error"):
            return None, "judge_call_failed"

        judge_content = judge_raw.get("content", "")
        if not isinstance(judge_content, str) or not judge_content:
            return None, "judge_no_content"

        # 解析 vote JSON
        vote_data = self._parse_vote_json(judge_content, total=len(successful))
        if vote_data is None:
            logger.warning(
                "fusion vote judge %s 返回非法 JSON(前 200 字符): %r",
                combo.judge, judge_content[:200],
            )
            return None, "judge_invalid_json"

        best_index = vote_data["best_index"]
        # best_index 已在 _parse_vote_json 校验 1..total,直接取
        best_provider, best_proposal = successful[best_index - 1]
        result = dict(best_proposal)
        result["model"] = best_provider
        result["fusion_proposers"] = [p for p, _ in successful]
        result["fusion_judge_mode"] = "vote"
        result["fusion_vote_result"] = vote_data
        result["fusion_judge_model"] = combo.judge
        return result, ""

    def _parse_vote_json(
        self, content: str, total: int
    ) -> Optional[dict[str, Any]]:
        """解析 vote judge 返回的 JSON(支持 markdown fence / 裸 JSON / 文本前后)。

        Args:
            content: judge 返回的原始文本。
            total: 成功 proposal 总数(用于校验 best_index 上界)。

        Returns:
            解析后的 dict:
            - ``best_index``: int(1-based,1..total)
            - ``scores``: list[dict[str, Any]](每项含 index/score/reason)
            - ``reason``: str
            解析失败返回 None。
        """
        parsed: Any = None

        # 1. 直接 parse
        try:
            parsed = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            pass

        # 2. markdown fence ```json ... ``` 或 ``` ... ```
        if parsed is None:
            match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
            if match:
                try:
                    parsed = json.loads(match.group(1))
                except (json.JSONDecodeError, TypeError):
                    pass

        # 3. 从首个 { 到末尾 } 的最大跨度提取
        if parsed is None:
            start = content.find("{")
            end = content.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    parsed = json.loads(content[start:end + 1])
                except (json.JSONDecodeError, TypeError):
                    pass

        if not isinstance(parsed, dict):
            return None

        # 校验 best_index(必须是 1..total 之间的 int,bool 不算)
        best_index_raw = parsed.get("best_index")
        if not isinstance(best_index_raw, int) or isinstance(best_index_raw, bool):
            return None
        if best_index_raw < 1 or best_index_raw > total:
            return None

        # 校验 scores(可选,缺省为空列表)
        scores_raw = parsed.get("scores", [])
        scores: list[dict[str, Any]] = []
        if isinstance(scores_raw, list):
            for s in scores_raw:
                if isinstance(s, dict):
                    scores.append({
                        "index": s.get("index", 0),
                        "score": s.get("score", 0),
                        "reason": s.get("reason", ""),
                    })

        # 校验 reason(可选,缺省为空字符串,非 str 转 str)
        reason_raw = parsed.get("reason", "")
        reason = reason_raw if isinstance(reason_raw, str) else str(reason_raw)

        return {
            "best_index": best_index_raw,
            "scores": scores,
            "reason": reason,
        }

    def _extract_original_question(
        self, messages: list[dict[str, Any]]
    ) -> str:
        """从 messages 提取最后一条 user 消息 content 作为原问题。

        支持纯字符串 content 和多模态 list content(取首项 text)。
        找不到时返回 ``"(unknown)"``。
        """
        for msg in reversed(messages):
            if not isinstance(msg, dict):
                continue
            if msg.get("role") == "user":
                content = msg.get("content", "")
                if isinstance(content, str):
                    return content
                if isinstance(content, list) and content:
                    first = content[0]
                    if isinstance(first, dict):
                        text = first.get("text", "")
                        if isinstance(text, str):
                            return text
                return "(unknown)"
        return "(unknown)"

    def _safe_metric_inc(self, counter: Any, **labels: Any) -> None:
        """安全递增 Prometheus Counter(失败不阻塞业务)。

        Args:
            counter: ``prometheus_client.Counter`` 实例(duck-typed,避免硬依赖类型)。
            **labels: 标签键值对(值会被 ``str()`` 转换)。
        """
        try:
            str_labels = {k: str(v) for k, v in labels.items()}
            counter.labels(**str_labels).inc()
        except Exception as e:
            logger.warning("Fusion metric 记录失败(忽略): %s", e)

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
