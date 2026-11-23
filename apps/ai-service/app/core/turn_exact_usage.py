# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""精确逐次尝试 / 整轮 token 记账(对齐 DSH `dsh-token-meter` 的 `turn-usage.ts`)。

与 `turn_token_usage.py` 的分工:
  - `TurnTokenUsage` 是按模型分组的**遥测直方图**,允许缺字段补 0;
  - 本模块是**能否声称精确**的判据:任何一次尝试缺必需桶、计数不安全、
    精确总量与环境矛盾,整轮就返回 ``None``;可选桶只有在**每一次**尝试都
    报告时才汇总,不用 0 冒充"没报"。

调用方只传原始 provider usage,不在这里做任何估算。`raw_usage_shape` 负责
保留"上游没报这一维"的 ``None`` 语义。
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Any

from .usage_cache import raw_usage_shape

MAX_SAFE_INTEGER = 2**53 - 1


def _safe_count(value: Any) -> int | None:
    """非负安全整数;bool / 负数 / 浮点 / 超界一律 None。"""
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    if value < 0 or value > MAX_SAFE_INTEGER:
        return None
    return value


def _safe_sum(values: Iterable[int]) -> int | None:
    total = 0
    for value in values:
        if not isinstance(value, int) or value < 0:
            return None
        total += value
        if total > MAX_SAFE_INTEGER:
            return None
    return total


@dataclass(frozen=True)
class AttemptUsage:
    """一次计费请求尝试的精确用量。required 桶一定存在;可选桶 None = 上游未报。"""

    uncached_input_tokens: int
    prompt_tokens: int
    output_tokens: int
    total_tokens: int
    cache_read_tokens: int | None = None
    cache_write_tokens: int | None = None
    reasoning_tokens: int | None = None
    provider: str | None = None
    model: str | None = None


@dataclass(frozen=True)
class ExactTurnUsage:
    """整轮精确汇总。可选桶只有在全部尝试都报告时才出现。"""

    uncached_input_tokens: int
    prompt_tokens: int
    output_tokens: int
    total_tokens: int
    cache_read_tokens: int | None = None
    cache_write_tokens: int | None = None
    reasoning_tokens: int | None = None
    routes: tuple[tuple[str, str], ...] = ()

    def as_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "uncachedInputTokens": self.uncached_input_tokens,
            "promptTokens": self.prompt_tokens,
            "outputTokens": self.output_tokens,
            "totalTokens": self.total_tokens,
        }
        if self.cache_read_tokens is not None:
            out["cacheReadTokens"] = self.cache_read_tokens
        if self.cache_write_tokens is not None:
            out["cacheWriteTokens"] = self.cache_write_tokens
        if self.reasoning_tokens is not None:
            out["reasoningTokens"] = self.reasoning_tokens
        if self.routes:
            out["routes"] = [
                {"provider": provider, "model": model} for provider, model in self.routes
            ]
        return out


def parse_attempt_usage(raw: Any) -> AttemptUsage | None:
    """把一次 provider usage 解析成精确尝试;任一矛盾/缺桶返回 ``None``。"""
    shape = raw_usage_shape(raw)
    if not shape:
        return None
    prompt_style = shape.get("prompt_style")
    prompt_tokens = _safe_count(shape.get("prompt_tokens"))
    output_tokens = _safe_count(shape.get("output_tokens"))
    if prompt_style not in ("total", "uncached") or prompt_tokens is None:
        return None
    if output_tokens is None:
        return None
    cache_read_raw = shape.get("cache_read_tokens")
    cache_write_raw = shape.get("cache_write_tokens")
    cache_read = _safe_count(cache_read_raw) if cache_read_raw is not None else None
    cache_write = _safe_count(cache_write_raw) if cache_write_raw is not None else None
    if cache_read_raw is not None and cache_read is None:
        return None
    if cache_write_raw is not None and cache_write is None:
        return None

    if prompt_style == "uncached":
        prompt_total = prompt_tokens + (cache_read or 0) + (cache_write or 0)
        uncached_input = prompt_tokens
    else:
        prompt_total = prompt_tokens
        uncached_input = prompt_total - (cache_read or 0) - (cache_write or 0)
        if uncached_input < 0:
            return None
    if prompt_total > MAX_SAFE_INTEGER:
        return None

    raw_total = shape.get("total_tokens")
    exact_prompt = prompt_total
    if raw_total is not None:
        exact_total = _safe_count(raw_total)
        if exact_total is None:
            return None
        exact_prompt = exact_total - output_tokens
        if exact_prompt < 0 or exact_prompt < prompt_total:
            return None
        if cache_read is not None and cache_write is not None and exact_prompt != prompt_total:
            return None
    else:
        # 没有精确总量时,只有缓存读写两维都知道才能推导出精确总量。
        if cache_read is None or cache_write is None:
            return None
        exact_total = _safe_sum((prompt_total, output_tokens))
        if exact_total is None:
            return None

    reasoning_raw = shape.get("reasoning_tokens")
    reasoning = _safe_count(reasoning_raw) if reasoning_raw is not None else None
    if reasoning_raw is not None and reasoning is None:
        return None
    if reasoning is not None and reasoning > output_tokens:
        return None

    provider = raw.get("provider") if isinstance(raw, dict) else None
    model = raw.get("model") if isinstance(raw, dict) else None
    route_provider = str(provider) if isinstance(provider, str) and provider else None
    route_model = str(model) if isinstance(model, str) and model else None
    return AttemptUsage(
        uncached_input_tokens=uncached_input,
        prompt_tokens=exact_prompt,
        output_tokens=output_tokens,
        total_tokens=exact_total,
        cache_read_tokens=cache_read,
        cache_write_tokens=cache_write,
        reasoning_tokens=reasoning,
        provider=route_provider,
        model=route_model,
    )


def aggregate_attempts(attempts: Sequence[AttemptUsage]) -> ExactTurnUsage | None:
    """汇总一次完整轮次;空列表返回 ``None``。"""
    if not attempts:
        return None
    uncached = _safe_sum(a.uncached_input_tokens for a in attempts)
    prompt = _safe_sum(a.prompt_tokens for a in attempts)
    output = _safe_sum(a.output_tokens for a in attempts)
    total = _safe_sum(a.total_tokens for a in attempts)
    if uncached is None or prompt is None or output is None or total is None:
        return None

    def _optional_sum(field: str) -> int | None:
        values = [getattr(a, field) for a in attempts]
        if any(not isinstance(v, int) for v in values):
            return None
        return _safe_sum([v for v in values if isinstance(v, int)])

    cache_read = _optional_sum("cache_read_tokens")
    cache_write = _optional_sum("cache_write_tokens")
    reasoning = _optional_sum("reasoning_tokens")

    routes: tuple[tuple[str, str], ...] = ()
    attributed = [(a.provider, a.model) for a in attempts]
    if all(p and m for p, m in attributed):
        routes = tuple(sorted({(str(p), str(m)) for p, m in attributed}))
    return ExactTurnUsage(
        uncached_input_tokens=uncached,
        prompt_tokens=prompt,
        output_tokens=output,
        total_tokens=total,
        cache_read_tokens=cache_read,
        cache_write_tokens=cache_write,
        reasoning_tokens=reasoning,
        routes=routes,
    )


def summarize_attempts_for_display(
    attempts: Sequence[AttemptUsage],
) -> dict[str, Any] | None:
    """单轮内多次尝试 → 旧 `perIteration` 形状(六桶 + attemptCount)。

    可选桶只有在本次迭代内每次尝试都报告时才出现;不把缺省折成 0。
    """
    exact = aggregate_attempts(attempts)
    if exact is None:
        return None
    out: dict[str, Any] = {
        "input_tokens": exact.prompt_tokens,
        "output_tokens": exact.output_tokens,
        "total_tokens": exact.total_tokens,
        "attemptCount": len(attempts),
    }
    if exact.cache_read_tokens is not None:
        out["cached_tokens"] = exact.cache_read_tokens
    if exact.cache_write_tokens is not None:
        out["cache_creation_tokens"] = exact.cache_write_tokens
    if exact.reasoning_tokens is not None:
        out["reasoning_output_tokens"] = exact.reasoning_tokens
    return out


def iteration_attempts(iteration: Any) -> list[Any]:
    """读取一次迭代的原始 usage 尝试(兼容 dataclass / dict / 旧 usage 单例)。"""
    if isinstance(iteration, dict):
        attempts = iteration.get("usage_attempts")
        if isinstance(attempts, list) and attempts:
            return attempts
        usage = iteration.get("usage")
        return [usage] if isinstance(usage, dict) and usage else []
    attempts = getattr(iteration, "usage_attempts", None)
    if isinstance(attempts, list) and attempts:
        return attempts
    usage = getattr(iteration, "usage", None)
    return [usage] if isinstance(usage, dict) and usage else []


def derive_exact_turn_usage_from_iterations(
    iterations: Iterable[Any],
) -> ExactTurnUsage | None:
    """从 `LoopIteration`/dict 列表推导整轮精确用量;缺任一次尝试即不可声称精确。"""
    attempts: list[AttemptUsage] = []
    for iteration in iterations:
        raw_attempts = iteration_attempts(iteration)
        if not raw_attempts:
            return None
        for raw in raw_attempts:
            parsed = parse_attempt_usage(raw)
            if parsed is None:
                return None
            attempts.append(parsed)
    return aggregate_attempts(attempts)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
