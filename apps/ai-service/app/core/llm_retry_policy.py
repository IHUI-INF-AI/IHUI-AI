# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""LLM 重试策略路由:provider 级错误码白名单、模式与退避曲线。

为什么单独一层(对照 DSH `dsh-llm-retry` 的 `ResolvedRetryPolicy`):
`agent_loop_v2._llm_call_with_retry` 此前只有"次数 + 指数退避 + 抖动",没有
provider 策略面 —— 无法表达"这家 provider 的 429 可重试、那家的 400 不可"，
也没有 `always` 档与稳定 retryId 供事件消费方关联同一次重试链。

三条纪律:
- 缺省零行为变化:未注入策略时 `mode=normal`、`retryable_codes=None`（不设白名单）、
  次数仍由 `llm_retry_max` 决定、曲线仍由 `llm_retry_backoff` 决定；
- `always` 只放宽"次数"一项,`cancelled` 永不重试,退避曲线/服务端 Retry-After 优先
  的既有判据一条不改；
- retryId 由 `(session_id, iteration)` 确定性派生,同一会话续跑同一轮拿到同一 id,
  不依赖本地 sqlite 或进程内随机数。
"""

from __future__ import annotations

import hashlib
import os
import random
from collections.abc import Callable, Mapping
from dataclasses import dataclass, replace
from typing import Final, Literal

RetryMode = Literal["normal", "always"]

#: `always` 档的硬上界。不是"不设上限"——进程必须能停,20 是防止上游长期故障把
#: 一轮请求挂成无限循环的兜底；正常 provider 不会走到这里。
MAX_ALWAYS_ATTEMPTS: Final = 20

#: 永不重试的错误族。用户取消必须立即生效,与策略模式无关。
NEVER_RETRY_CODES: Final = frozenset({"cancelled"})

_ENV_MODE: Final = "IHUI_LLM_RETRY_MODE"
_ENV_CODES: Final = "IHUI_LLM_RETRYABLE_CODES"
_ENV_MAX_DELAY: Final = "IHUI_LLM_RETRY_MAX_DELAY_S"


@dataclass(frozen=True)
class LlmRetryPolicy:
    """provider 路由面的重试策略。

    `retryable_codes=None` = 不设白名单（除 `cancelled` 外都可重试），保持既有行为；
    显式给集合 = 只重试集合内的错误族（`unknown` 不会被静默当成可重试）。
    `max_retries=None` = 沿用调用方的 `llm_retry_max`；显式给值则覆盖它。
    """

    mode: RetryMode = "normal"
    retryable_codes: frozenset[str] | None = None
    initial_delay_s: float = 1.5
    max_delay_s: float = float("inf")
    jitter_ratio: float = 0.5
    max_retries: int | None = None

    def __post_init__(self) -> None:
        if self.mode not in ("normal", "always"):
            raise ValueError(f"非法 LLM 重试模式: {self.mode!r}")
        if self.initial_delay_s < 0:
            raise ValueError("LLM 重试初始退避不得为负")
        if self.max_delay_s < 0:
            raise ValueError("LLM 重试最大退避不得为负")
        if not 0 <= self.jitter_ratio <= 1:
            raise ValueError("LLM 重试抖动比必须在 [0,1]")
        if self.max_retries is not None and self.max_retries < 0:
            raise ValueError("LLM 重试次数不得为负")

    def allows(self, error_code: str) -> bool:
        """该错误族是否允许重试。空/未知族在显式白名单下不被当成可重试。"""
        if error_code in NEVER_RETRY_CODES:
            return False
        if self.retryable_codes is None:
            return True
        return error_code in self.retryable_codes

    def attempt_limit(self, configured_retries: int) -> int:
        """重试次数上限（不含首次）。always 档取硬上界；normal 档尊重显式覆盖。"""
        if self.mode == "always":
            return MAX_ALWAYS_ATTEMPTS
        if self.max_retries is not None:
            return self.max_retries
        return max(0, configured_retries)

    def backoff_s(
        self, attempt: int, *, rng: Callable[[], float] | None = None
    ) -> float:
        """本地指数退避。曲线与既有实现逐字同形：initial * 2^attempt * (1-j+r*j)。"""
        factor = 1.0 - self.jitter_ratio + (rng or random.random)() * self.jitter_ratio
        delay = self.initial_delay_s * (2 ** max(0, attempt)) * factor
        return min(delay, self.max_delay_s)


def retry_id_for(session_id: str | None, iteration: int) -> str:
    """确定性 retryId：同一 (session, iteration) 在续跑后仍是同一个值。"""
    seed = f"{session_id or 'anonymous'}:{max(0, iteration)}".encode()
    return "llmretry-" + hashlib.sha256(seed).hexdigest()[:16]


def _parse_codes(raw: str | None) -> frozenset[str] | None:
    if raw is None:
        return None
    values = frozenset(part.strip() for part in raw.split(",") if part.strip())
    return values or None


def resolve_llm_retry_policy(
    policy: LlmRetryPolicy | None,
    *,
    configured_retries: int,
    configured_backoff: float,
    environ: Mapping[str, str] | None = None,
) -> LlmRetryPolicy:
    """构造入口：显式策略 > env > 既有参数（缺省与接线前逐字同值）。"""
    env = os.environ if environ is None else environ
    if policy is not None:
        return policy
    mode = (env.get(_ENV_MODE) or "normal").strip().lower()
    if mode not in ("normal", "always"):
        raise ValueError(f"非法 {_ENV_MODE}: {mode!r}（取值必须为 normal / always）")
    max_delay_raw = env.get(_ENV_MAX_DELAY)
    try:
        max_delay = float(max_delay_raw) if max_delay_raw else float("inf")
    except ValueError as exc:
        raise ValueError(f"非法 {_ENV_MAX_DELAY}: {max_delay_raw!r}") from exc
    return LlmRetryPolicy(
        mode=mode,  # type: ignore[arg-type]  # 上方已闭合校验
        retryable_codes=_parse_codes(env.get(_ENV_CODES)),
        initial_delay_s=configured_backoff,
        max_delay_s=max_delay,
    )


def with_policy_overrides(
    policy: LlmRetryPolicy,
    *,
    mode: RetryMode | None = None,
    retryable_codes: frozenset[str] | None = None,
    max_retries: int | None = None,
) -> LlmRetryPolicy:
    """测试/调用方显式覆盖入口；未给的字段保持原值。"""
    updates: dict[str, object] = {}
    if mode is not None:
        updates["mode"] = mode
    if retryable_codes is not None:
        updates["retryable_codes"] = retryable_codes
    if max_retries is not None:
        updates["max_retries"] = max_retries
    return replace(policy, **updates)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
