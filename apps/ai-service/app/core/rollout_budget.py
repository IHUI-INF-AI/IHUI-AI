# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/rollout_budget.py
"""会话树加权 token 预算与阈值提醒(2026-09-19 第二十六批,对标 Codex rollout_budget.rs)。

与引擎既有的硬预算(EngineThread.token_budget:超限拒起新轮)互补:

- **加权记账**:优先使用上游返回的 ``codex_rollout_budget_units``(计费加权
  单位);缺失时按 ``输出 × sampling_token_weight + 非缓存输入 ×
  prefill_token_weight`` 估算。权重由配置给点,默认 1.0/1.0。
- **穷尽判定**:``record_usage`` 返回是否已越过 limit_tokens,且此后恒真。
- **阈值提醒**:``reminder_at_remaining_tokens`` 是一组"剩余量阈值",每越过
  一档提醒级别 +1;``pending_reminder(thread_id, window_id)`` 按
  (线程, 窗口) 去重——同窗口已送达 ≥ 当前级别则不再提醒,跨新窗口
  (新上下文)重新提醒。``mark_reminder_delivered`` 必须在提醒真正写入
  会话历史后才调用,取消时未确认的提醒允许重试。
- **非法输入防御**:budget units 必须为有限非负数,NaN/负数直接抛
  ``RolloutBudgetError``(Codex 为 Fatal 错误)。
- **configure 一次性**:首次 configure 生效,后续调用忽略(OnceLock 语义)。
"""

from __future__ import annotations

import math
import threading
from dataclasses import dataclass, field
from typing import Any


class RolloutBudgetError(Exception):
    """预算记账输入非法(对标 CodexErr::Fatal 分支)。"""


@dataclass
class RolloutBudgetConfig:
    """预算配置(对标 RolloutBudgetConfig)。"""

    limit_tokens: int
    sampling_token_weight: float = 1.0
    prefill_token_weight: float = 1.0
    # 剩余 token 阈值列表:剩余量 ≤ 阈值即触发对应级别提醒(级别=越过的档数)
    reminder_at_remaining_tokens: tuple[int, ...] = ()

    def __post_init__(self) -> None:
        if self.limit_tokens <= 0:
            raise RolloutBudgetError("limit_tokens must be positive")
        for w in (self.sampling_token_weight, self.prefill_token_weight):
            if not math.isfinite(w) or w < 0.0:
                raise RolloutBudgetError("weights must be finite and non-negative")


@dataclass
class RolloutBudgetReminder:
    """待送达的预算提醒。"""

    remaining_tokens: int
    reminder_index: int


@dataclass
class _ThreadBudgetDelivery:
    window_id: str
    reminder_index: int


@dataclass
class _BudgetState:
    config: RolloutBudgetConfig
    weighted_tokens_used: float = 0.0
    deliveries: dict[str, _ThreadBudgetDelivery] = field(default_factory=dict)


def _non_cached_input(usage: dict[str, Any]) -> int:
    """非缓存输入 token = input_tokens - cached_input_tokens(下限 0)。

    兼容多种字段命名:input_tokens/inputTokens、cached_input_tokens/
    cachedInputTokens/prompt_cached_tokens。
    """
    input_tokens = (
        usage.get("input_tokens", usage.get("inputTokens", usage.get("prompt_tokens", 0))) or 0
    )
    cached = (
        usage.get(
            "cached_input_tokens",
            usage.get(
                "cachedInputTokens",
                usage.get("prompt_cached_tokens", 0),
            ),
        )
        or 0
    )
    try:
        return max(0, int(input_tokens) - int(cached))
    except (TypeError, ValueError):
        return 0


class RolloutBudget:
    """一个根会话树共享的预算记账与提醒状态(线程安全)。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: _BudgetState | None = None
        self._configured = False

    # ------------------------------------------------------------------
    def configure(self, config: RolloutBudgetConfig) -> None:
        """首次 configure 生效,后续调用忽略(OnceLock 语义)。"""
        with self._lock:
            if self._configured:
                return
            self._state = _BudgetState(config=config)
            self._configured = True

    @property
    def configured(self) -> bool:
        with self._lock:
            return self._configured

    # ------------------------------------------------------------------
    def record_usage(self, usage: dict[str, Any]) -> bool:
        """记账一次用量;返回预算是否已穷尽(此后恒真)。

        ``usage`` 支持两种形态:
        - 携带 ``codex_rollout_budget_units``(计费加权单位,优先采用);
        - 常规 usage 字段(output_tokens / input_tokens / cached_input_tokens)。
        """
        with self._lock:
            if self._state is None:
                return False
            config = self._state.config
            units_raw = usage.get("codex_rollout_budget_units")
            if units_raw is not None:
                try:
                    units = float(units_raw)
                except (TypeError, ValueError):
                    raise RolloutBudgetError(
                        "codex_rollout_budget_units must be a finite non-negative number"
                    ) from None
                if not math.isfinite(units) or units < 0.0:
                    raise RolloutBudgetError(
                        "codex_rollout_budget_units must be finite and non-negative"
                    )
            else:
                try:
                    output = max(0, int(usage.get("output_tokens", usage.get("outputTokens", 0)) or 0))
                except (TypeError, ValueError):
                    output = 0
                units = (
                    output * config.sampling_token_weight
                    + _non_cached_input(usage) * config.prefill_token_weight
                )
            self._state.weighted_tokens_used += units
            return self._state.weighted_tokens_used >= float(config.limit_tokens)

    # ------------------------------------------------------------------
    def weighted_tokens_used(self) -> float:
        with self._lock:
            return self._state.weighted_tokens_used if self._state else 0.0

    def tokens_left(self) -> int | None:
        """剩余 token(批 42 接线:get_context_remaining 工具消费)。

        未配置时返回 None = 未知(对标 codex TokenBudgetRemainingContext::unknown);
        已配置时返回 floor(limit - used),下限 0。
        """
        with self._lock:
            if self._state is None:
                return None
            remaining = float(self._state.config.limit_tokens) - self._state.weighted_tokens_used
            return max(0, math.floor(remaining))

    def pending_reminder(self, thread_id: str, window_id: str) -> RolloutBudgetReminder | None:
        """取该线程在当前上下文窗口中尚未送达的最高级别提醒。"""
        with self._lock:
            if self._state is None:
                return None
            remaining = max(0.0, float(self._state.config.limit_tokens) - self._state.weighted_tokens_used)
            remaining_tokens = math.floor(remaining)
            reminder_index = sum(
                1
                for threshold in self._state.config.reminder_at_remaining_tokens
                if remaining_tokens <= threshold
            )
            delivery = self._state.deliveries.get(thread_id)
            if (
                delivery is not None
                and delivery.window_id == window_id
                and delivery.reminder_index >= reminder_index
            ):
                return None
            return RolloutBudgetReminder(
                remaining_tokens=remaining_tokens, reminder_index=reminder_index
            )

    def mark_reminder_delivered(self, thread_id: str, window_id: str, reminder: RolloutBudgetReminder) -> None:
        """标记提醒已写入历史(仅此后才允许标记;取消前可重试)。"""
        with self._lock:
            if self._state is None:
                return
            self._state.deliveries[thread_id] = _ThreadBudgetDelivery(
                window_id=window_id, reminder_index=reminder.reminder_index
            )


# ===========================================================================
# 批 40 接线补充:usage 归一化 + 提醒片段构造(对标 RolloutBudgetContext 渲染)
# ===========================================================================

ROLLOUT_BUDGET_OPEN_TAG = "<rollout_budget>"
ROLLOUT_BUDGET_CLOSE_TAG = "</rollout_budget>"


def normalize_rollout_usage(usage: dict[str, Any]) -> dict[str, Any]:
    """把 LLM 响应 usage 归一化为 record_usage 可消费形态。

    - input_tokens / prompt_tokens → input_tokens
    - output_tokens / completion_tokens → output_tokens
    - cached_input_tokens / prompt_tokens_details.cached_tokens → cached_input_tokens
    无法解析时返回空 dict(调用方跳过记账)。
    """
    if not isinstance(usage, dict):
        return {}
    out: dict[str, Any] = {}
    inp = usage.get("input_tokens", usage.get("prompt_tokens"))
    if isinstance(inp, (int, float)):
        out["input_tokens"] = int(inp)
    outp = usage.get("output_tokens", usage.get("completion_tokens"))
    if isinstance(outp, (int, float)):
        out["output_tokens"] = int(outp)
    cached = usage.get("cached_input_tokens")
    if not isinstance(cached, (int, float)):
        details = usage.get("prompt_tokens_details")
        if isinstance(details, dict):
            cached = details.get("cached_tokens")
    if isinstance(cached, (int, float)):
        out["cached_input_tokens"] = int(cached)
    units = usage.get("codex_rollout_budget_units")
    if isinstance(units, (int, float)) and units >= 0:
        out["codex_rollout_budget_units"] = units
    return out


def build_rollout_budget_fragment(remaining_tokens: int) -> dict[str, Any]:
    """构造预算提醒片段(对标 RolloutBudgetContext → ResponseItem)。

    developer 角色、<rollout_budget> 标记、文案逐字对齐 codex。
    """
    body = (
        f"You have {max(0, int(remaining_tokens))} weighted tokens left "
        "in the shared session token budget."
    )
    return {
        "type": "message",
        "role": "developer",
        "content": [
            {
                "type": "input_text",
                "text": f"{ROLLOUT_BUDGET_OPEN_TAG}\n{body}\n{ROLLOUT_BUDGET_CLOSE_TAG}",
            }
        ],
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
