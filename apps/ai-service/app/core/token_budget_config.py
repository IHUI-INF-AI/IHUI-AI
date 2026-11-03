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
