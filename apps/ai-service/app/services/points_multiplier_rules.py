"""GENERATED FILE — DO NOT EDIT.

来源: packages/shared/src/constants/points-multiplier-rules.json
重新生成: node scripts/gen-points-multiplier-rules.mjs(改动请改 JSON)

积分消耗倍数关键词推断的规则数据(与 TS 侧同一份 JSON 派生,跨语言一致性由
scripts/tests/points-multiplier-parity.test.mjs 与 ai-service pytest 双重钉住)。
"""

from __future__ import annotations

from typing import NamedTuple


class RuleLayer(NamedTuple):
    """一条关键词规则层:命中即返回该档(元组顺序 = 判定优先级)。"""

    tier: str
    contains_any: tuple[str, ...]
    contains_all: tuple[str, ...]
    exclusions: tuple[tuple[str, tuple[str, ...]], ...]


TIERS: dict[str, float] = {
    "free": 0.0,
    "economy": 1.0,
    "standard": 3.0,
    "premium": 10.0,
    "flagship": 30.0,
    "fallback": 1.0,
}

IHUI_MODEL_MAP: dict[str, float] = {
    "ihui/auto-model": 3.0,
    "ihui/minimax-m2.7": 6.0,
    "ihui/minimax-m2.7-highspeed": 15.0,
    "ihui/minimax-m3": 15.0,
    "ihui/deepseek-v4-flash-0731": 15.0,
    "ihui/glm-5.1": 18.0,
    "ihui/glm-5.2": 18.0,
    "ihui/glm-5.3-flash": 18.0,
    "ihui/kimi-k2.6": 18.0,
    "ihui/deepseek-v4-pro": 18.0,
    "ihui/deepseek-v4-pro-0813": 18.0,
    "ihui/grok-4.5": 18.0,
    "ihui/glm-5.3": 30.0,
    "ihui/gpt-5.6": 30.0,
    "ihui/grok-4.6": 30.0,
    "ihui/qwen3.7-max": 30.0,
    "ihui/kimi-k2.7-code": 30.0,
}

# 顺序敏感:免费 → 经济(轻量后缀优先) → 旗舰 → 高级(gemini pro) → 高级 → 标准。
ORDERED_RULES: tuple[RuleLayer, ...] = (
    RuleLayer(
        tier="free",
        contains_any=("ollama", "llama", "llm7", "pollinations", "aihorde", "opencode_zen",),
        contains_all=(),
        exclusions=(),
    ),
    RuleLayer(
        tier="economy",
        contains_any=("mini", "nano", "haiku", "flash", "lite", "ocr", "small", "luna", "sao10k", "smol", "hunyuan-2.0-thinking",),
        contains_all=(),
        exclusions=(("mini", ("gemini",)),),
    ),
    RuleLayer(
        tier="flagship",
        contains_any=("opus", "o1-preview", "o1", "o3", "gpt-5.4-pro", "gpt-5.5", "gpt-5.5-pro", "gpt-5.6-sol", "gpt-5.6-terra",),
        contains_all=(),
        exclusions=(),
    ),
    RuleLayer(
        tier="premium",
        contains_any=(),
        contains_all=("gemini", "pro",),
        exclusions=(),
    ),
    RuleLayer(
        tier="premium",
        contains_any=("gpt-5", "gpt-4-turbo", "gpt-4.5", "qwen-max-longcontext",),
        contains_all=(),
        exclusions=(),
    ),
    RuleLayer(
        tier="standard",
        contains_any=("sonnet", "gpt-4o", "gpt-4.1", "deepseek", "glm-4", "qwen-max", "thinking",),
        contains_all=(),
        exclusions=(),
    ),
)
