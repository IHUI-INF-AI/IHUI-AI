# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""LLM usage 跨厂商统一归一化(P0-①,2026-09-18 立,对标 Codex Harness 计量口径)。

各厂商 prompt 缓存 usage 字段形态各异,本模块把它们归一为统一契约:

  prompt_tokens        输入 token 总数(含缓存读/写;OpenAI 口径)
  completion_tokens    输出 token 总数
  total_tokens         总 token(prompt+completion 兜底回填)
  cached_tokens        缓存命中读 token(各家别名见 _CACHE_READ_ALIASES)
  cache_creation_tokens 缓存写入 token(Anthropic 专属,其余厂商为 0)

支持的输入形态(自动识别,原生字段全部原样保留):
- OpenAI:     {"prompt_tokens", "completion_tokens",
               "prompt_tokens_details": {"cached_tokens"}}
- Anthropic:  {"input_tokens", "output_tokens",
               "cache_read_input_tokens", "cache_creation_input_tokens"}
- DeepSeek:   {"prompt_tokens", "completion_tokens",
               "prompt_cache_hit_tokens", "prompt_cache_miss_tokens"}
- LiteLLM:    model_dump 后同时含 OpenAI 与 Anthropic 别名(可选字段)

设计约束:
- 纯函数、零外部依赖(core 层,providers/gateway/ledger 均可 import,无循环导入);
- 输入非 dict / 空 → 原样返回空 dict(不抛错,计量失败绝不阻塞主链路);
- 归一化只增不删:除上述五个统一键外,原始键全部透传(审计可回看原生字段)。
"""

from __future__ import annotations

from typing import Any

# 缓存命中读 token 的厂商别名(按序探测,首个命中即取)
_CACHE_READ_ALIASES = (
    "cached_tokens",                 # OpenAI prompt_tokens_details 内层键(平铺后)
    "cache_read_input_tokens",       # Anthropic 原生 / LiteLLM Usage 字段
    "prompt_cache_hit_tokens",       # DeepSeek 原生
)
# 缓存写入 token 的厂商别名(Anthropic 专属;DeepSeek/OpenAI 写入免费但仍计量)
_CACHE_WRITE_ALIASES = (
    "cache_creation_tokens",         # LiteLLM Usage 字段
    "cache_creation_input_tokens",   # Anthropic 原生
)

# 输入 token 别名(OpenAI prompt_tokens 优先,Anthropic input_tokens 兜底)
_INPUT_ALIASES = ("prompt_tokens", "input_tokens")
# 输出 token 别名
_OUTPUT_ALIASES = ("completion_tokens", "output_tokens")


def _first_int(source: dict[str, Any], keys: tuple[str, ...]) -> int | None:
    """按序探测键,返回首个非负整数值(解析失败/负数视为未提供)。"""
    for key in keys:
        if key in source:
            try:
                value = int(source[key])
            except (TypeError, ValueError):
                continue
            if value >= 0:
                return value
    return None


def _nested_int(source: dict[str, Any], outer: str, inner: str) -> int | None:
    """取嵌套 dict 的整数字段(OpenAI prompt_tokens_details.cached_tokens)。"""
    nested = source.get(outer)
    if isinstance(nested, dict) and inner in nested:
        try:
            value = int(nested[inner])
        except (TypeError, ValueError):
            return None
        if value >= 0:
            return value
    return None


def normalize_usage(raw: Any) -> dict[str, Any]:
    """把任意厂商 usage dict 归一为统一契约(纯新增键,不删原生字段)。

    非 dict 输入返回 {};缺省字段回填(输入/输出/总数互推);缓存字段
    无别名命中时置 0(显式存在,消费方无需再判 None)。
    """
    if not isinstance(raw, dict):
        return {}
    normalized = dict(raw)

    prompt_tokens = _first_int(raw, _INPUT_ALIASES) or 0
    completion_tokens = _first_int(raw, _OUTPUT_ALIASES) or 0
    # total_tokens 缺省/非法时用 prompt+completion 回填(与 OpenAI 口径一致)
    total_tokens = _first_int(raw, ("total_tokens",))
    if total_tokens is None or total_tokens < prompt_tokens + completion_tokens:
        total_tokens = prompt_tokens + completion_tokens

    cached = _first_int(raw, _CACHE_READ_ALIASES)
    if cached is None:
        # OpenAI 嵌套形态:{"prompt_tokens_details": {"cached_tokens": N}}
        cached = _nested_int(raw, "prompt_tokens_details", "cached_tokens") or 0
    cache_write = _first_int(raw, _CACHE_WRITE_ALIASES) or 0

    normalized.update(
        {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "cached_tokens": cached,
            "cache_creation_tokens": cache_write,
        }
    )
    return normalized


def extract_cache_metrics(usage: Any) -> tuple[int, int]:
    """从 usage dict 提取 (缓存读 token, 缓存写 token);非 dict 返回 (0, 0)。

    供 cost_ledger / step recorder 等只关心缓存两个字段的消费方复用,
    免去各自手写别名探测。
    """
    normalized = normalize_usage(usage)
    if not normalized:
        return 0, 0
    return int(normalized.get("cached_tokens") or 0), int(
        normalized.get("cache_creation_tokens") or 0
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
