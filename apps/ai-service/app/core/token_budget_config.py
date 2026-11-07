# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:token 预算配置与模型自带默认 — 对标 codex config TokenBudgetConfig。

参照源码:
- codex-rs/core/src/config/mod.rs L1152-1240(TokenBudgetConfig + validate)
- codex-rs/core/src/session/token_budget.rs(resolve_token_budget /
  has_explicit_settings / apply_experimental_context 语义)

ihui 侧语义映射:
- configured_token_budget 来自引擎静态配置(auto_compact_threshold 等已有,
  本模块只承载 reminder 模板/引导消息/压缩兜底 prompt 这批"消息面"配置)。
- 模型自带默认(model-owned defaults)取自 provider_caps 的 model_messages
  token_budget 段;用户显式配置优先于模型默认。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

TOKEN_BUDGET_REMINDER_MESSAGE_TEMPLATE_MAX_BYTES = 2000
TOKEN_BUDGET_GUIDANCE_MESSAGE_MAX_BYTES = 2000
AUTO_COMPACT_FALLBACK_PROMPT_MAX_BYTES = 2000


class TokenBudgetConfigError(ValueError):
    """对标 codex validate() 的 InvalidInput 错误族。"""


@dataclass
class TokenBudgetConfig:
    """对标 codex TokenBudgetConfig 六字段(逐字对齐默认值语义)。"""

    use_history_notes_extension: bool = False
    reminder_threshold_tokens: int | None = None
    reminder_message_template: str = ""
    guidance_message: str | None = None
    auto_compact_fallback_prompt: str | None = None
    auto_compact_fallback_buffer_tokens: int | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def validate(self) -> None:
        """逐条对齐 codex validate() 的错误文案与判定顺序。"""
        if self.reminder_threshold_tokens is not None and self.reminder_threshold_tokens <= 0:
            raise TokenBudgetConfigError(
                "features.token_budget.reminder_threshold_tokens must be positive"
            )
        if not self.reminder_message_template.strip():
            raise TokenBudgetConfigError(
                "features.token_budget.reminder_message_template must not be empty"
            )
        if (
            len(self.reminder_message_template.encode("utf-8"))
            > TOKEN_BUDGET_REMINDER_MESSAGE_TEMPLATE_MAX_BYTES
        ):
            raise TokenBudgetConfigError(
                "features.token_budget.reminder_message_template must not exceed "
                f"{TOKEN_BUDGET_REMINDER_MESSAGE_TEMPLATE_MAX_BYTES} bytes"
            )
        if self.guidance_message is not None and (
            len(self.guidance_message.encode("utf-8")) > TOKEN_BUDGET_GUIDANCE_MESSAGE_MAX_BYTES
        ):
            raise TokenBudgetConfigError(
                "features.token_budget.guidance_message must not exceed "
                f"{TOKEN_BUDGET_GUIDANCE_MESSAGE_MAX_BYTES} bytes"
            )
        if self.auto_compact_fallback_prompt is not None and (
            len(self.auto_compact_fallback_prompt.encode("utf-8"))
            > AUTO_COMPACT_FALLBACK_PROMPT_MAX_BYTES
        ):
            raise TokenBudgetConfigError(
                "features.token_budget.auto_compact_fallback_prompt must not exceed "
                f"{AUTO_COMPACT_FALLBACK_PROMPT_MAX_BYTES} bytes"
            )
        if self.auto_compact_fallback_prompt is not None and (
            self.auto_compact_fallback_buffer_tokens is None
        ):
            raise TokenBudgetConfigError(
                "features.token_budget.auto_compact_fallback_buffer_tokens is required "
                "when auto_compact_fallback_prompt is set"
            )
        if self.auto_compact_fallback_buffer_tokens is not None and (
            self.auto_compact_fallback_buffer_tokens <= 0
        ):
            raise TokenBudgetConfigError(
                "features.token_budget.auto_compact_fallback_buffer_tokens must be positive"
            )

    def fallback_buffer_tokens(self) -> int | None:
        """对标 codex fallback_buffer_tokens():无兜底 prompt 时返回 None。"""
        if self.auto_compact_fallback_prompt is None:
            return None
        return self.auto_compact_fallback_buffer_tokens


def has_explicit_settings(configured: TokenBudgetConfig | None) -> bool:
    """对标 codex has_explicit_settings():探测显式偏好(模型默认应用前)。

    use_history_notes_extension 不算显式设置(它是开关副作用);
    其余字段任一非默认即视为显式。
    """
    if configured is None:
        return False
    probe = TokenBudgetConfig(
        reminder_threshold_tokens=configured.reminder_threshold_tokens,
        reminder_message_template=configured.reminder_message_template,
        guidance_message=configured.guidance_message,
        auto_compact_fallback_prompt=configured.auto_compact_fallback_prompt,
        auto_compact_fallback_buffer_tokens=configured.auto_compact_fallback_buffer_tokens,
    )
    defaults = TokenBudgetConfig(reminder_message_template="")
    return probe != defaults


def resolve_token_budget(
    configured: TokenBudgetConfig | None,
    use_model_defaults: bool,
    model_defaults: dict[str, Any] | None,
) -> TokenBudgetConfig | None:
    """对标 codex resolve_token_budget():用户配置与模型默认合成。

    - use_model_defaults=False → 原样返回用户配置。
    - 模型无 defaults(model_messages.token_budget 缺失) → 原样返回用户配置。
    - 模型默认覆盖 reminder_threshold_tokens/reminder_message_template/
      guidance_message/auto_compact_fallback_prompt/auto_compact_fallback_buffer_tokens;
      use_history_notes_extension 仅当用户有配置时保留 True。
    - 合成结果 validate 失败 → 警告并回退用户配置(对齐 tracing::warn 语义,
      ihui 侧静默回退即可,由调用方决定是否记录)。
    """
    if not use_model_defaults:
        return configured
    if not model_defaults:
        return configured
    candidate = TokenBudgetConfig(
        use_history_notes_extension=configured is not None and configured.use_history_notes_extension,
        reminder_threshold_tokens=model_defaults.get("reminder_threshold_tokens"),
        reminder_message_template=str(model_defaults.get("reminder_message_template", "")),
        guidance_message=model_defaults.get("guidance_message"),
        auto_compact_fallback_prompt=model_defaults.get("auto_compact_fallback_prompt"),
        auto_compact_fallback_buffer_tokens=model_defaults.get(
            "auto_compact_fallback_buffer_tokens"
        ),
    )
    try:
        candidate.validate()
    except TokenBudgetConfigError:
        return configured
    return candidate


USAGE_PURPOSES = ("compact", "summary", "request", "inputTokens")
_USAGE_SEVERITY = ("preMessage", "warning", "critical", "emergency")


def _usage_ratio(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    if number != number or not 0 < number <= 1:
        return None
    return number


def _model_override(overrides: object, model: str | None) -> object:
    if not isinstance(overrides, dict) or not model:
        return None
    if model in overrides:
        return overrides[model]
    for key, value in overrides.items():
        if isinstance(key, str) and (model.startswith(key + "-") or model.startswith(key + "/")):
            return value
    return None


def classify_usage_pressure(
    table: object,
    purpose: str,
    *,
    used: object,
    capacity: object,
    model: str | None = None,
) -> dict[str, str]:
    """按用途桶判断上下文压力。表缺失、档位坏掉、用量量不到,都是未判定。

    观察:对照程序把用量分成 compact / summary / request / inputTokens 四桶,
    桶内是 0 到 1 的比例;compact 还可以按模型名覆盖 emergency。
    本函数不抄那组比例。调用方给表。模型覆盖值非法时不退回桶内原值。
    """
    if purpose not in USAGE_PURPOSES or not isinstance(table, dict):
        return {"disposition": "unjudged", "reason": "table-absent"}
    bucket = table.get(purpose)
    if not isinstance(bucket, dict):
        return {"disposition": "unjudged", "reason": "purpose-absent"}
    ratios: dict[str, float] = {}
    for level in _USAGE_SEVERITY:
        if level not in bucket:
            continue
        parsed = _usage_ratio(bucket[level])
        if parsed is None:
            return {"disposition": "unjudged", "reason": "level-invalid"}
        ratios[level] = parsed
    if "modelOverrides" in bucket and "emergency" in ratios:
        override = _model_override(bucket.get("modelOverrides"), model)
        if override is not None:
            parsed = _usage_ratio(override)
            if parsed is None:
                return {"disposition": "unjudged", "reason": "override-invalid"}
            ratios["emergency"] = parsed
    if not ratios:
        return {"disposition": "unjudged", "reason": "levels-absent"}
    if isinstance(capacity, bool) or not isinstance(capacity, (int, float)) or float(capacity) <= 0:
        return {"disposition": "unjudged", "reason": "capacity-invalid"}
    if isinstance(used, bool) or not isinstance(used, (int, float)) or float(used) < 0:
        return {"disposition": "unjudged", "reason": "used-invalid"}
    share = float(used) / float(capacity)
    hit = "clear"
    for level in _USAGE_SEVERITY:
        line = ratios.get(level)
        if line is not None and share >= line:
            hit = level
    return {"disposition": hit, "reason": "measured"}


def _measured_count(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    if number != number:
        return None
    return number


def compact_decision(
    tokens: object,
    threshold: object,
    table: object = None,
    *,
    capacity: object = None,
    model: str | None = None,
) -> dict[str, Any]:
    """是否该压缩。绝对 token 上限仍是原来那条线。

    没给用途表时只看绝对上限。给了表且 compact 桶到了 emergency 也压缩。
    表在但判不出时,不把「判不出」当成已经越过比例线。
    """
    used = _measured_count(tokens)
    limit = _measured_count(threshold)
    absolute = used is not None and limit is not None and limit > 0 and used >= limit
    if table is None:
        return {"compact": absolute, "pressure": None}
    verdict = classify_usage_pressure(
        table,
        "compact",
        used=tokens,
        capacity=capacity,
        model=model,
    )
    before_message = classify_usage_pressure(
        table,
        "inputTokens",
        used=tokens,
        capacity=capacity,
        model=model,
    )
    pre_hit = before_message["disposition"] in {"preMessage", "warning", "critical", "emergency"}
    return {
        "compact": absolute or verdict["disposition"] == "emergency" or pre_hit,
        "pressure": verdict,
        "preMessage": before_message,
    }


def apply_pre_message_compact_pct(table: object, pct: object) -> dict[str, Any]:
    """把发消息前的压缩线写成调用方给的比例。不改入参。

    比例必须在 0 到 1 之间,并且严格低于同一桶里已经有的 warning / critical / emergency。
    写上去会打乱这四档次序时,原表不动。
    """
    ratio = _usage_ratio(pct)
    if ratio is None:
        return {
            "ok": False,
            "table": table if isinstance(table, dict) else None,
            "reason": "pct-invalid",
        }
    if table is None:
        base: dict[str, Any] = {}
    elif isinstance(table, dict):
        base = dict(table)
    else:
        return {"ok": False, "table": None, "reason": "table-invalid"}
    current = base.get("inputTokens")
    if current is None:
        bucket: dict[str, Any] = {}
    elif isinstance(current, dict):
        bucket = dict(current)
    else:
        return {"ok": False, "table": base, "reason": "bucket-invalid"}
    for level in ("warning", "critical", "emergency"):
        if level not in bucket:
            continue
        existing = _usage_ratio(bucket[level])
        if existing is None or ratio >= existing:
            return {"ok": False, "table": base, "reason": "order-invalid"}
    bucket["preMessage"] = ratio
    base["inputTokens"] = bucket
    return {"ok": True, "table": base, "reason": "applied"}


def pre_message_compact_pct_of(table: object) -> float | None:
    if not isinstance(table, dict):
        return None
    bucket = table.get("inputTokens")
    if not isinstance(bucket, dict):
        return None
    return _usage_ratio(bucket.get("preMessage"))
