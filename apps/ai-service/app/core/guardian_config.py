# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/guardian_config.py
"""Guardian v2 配置层(逆向 codex.exe,2026-11-16)。

对标 Codex ``GuardianV2ConfigToml``(19 字段)与
``GuardianV2TranscriptConfigToml``(7 字段),取证来自 ``codex.exe`` 静态字符串
(见 ``.ihui-agent/tmp/goal-codex/evidence/guardian-config-fields-scan.mjs``,
struct 字段序列逐字对齐 + 校验错误原文命中)。

**GuardianV2ConfigToml 19 字段**(codex.exe 原词):
``sync_elastic_budgeting / sync_elastic_sections / transcript_mode /
async_classifier_mode / async_classifier_conversation_token_limit / free_guardian /
thread_context / persist_scores / classifier_instructions / review_threshold /
max_tool_call_lag / reasoning_effort / max_action_tokens /
max_classifier_instruction_tokens / reuse_parent_compaction /
max_parent_compaction_tokens / review_scope / transcript``。

**GuardianV2TranscriptConfigToml 7 字段**:``max_message_entry_tokens /
max_tool_entry_tokens / max_message_transcript_tokens /
max_tool_transcript_tokens / max_recent_non_user_entries``(另含 sources /
include_images,本仓聚焦前 5 个数值限制)。

**codex.exe 校验约束**(逐字对齐错误原文,validate 逐条复现):
- ``Guardian v2 review_threshold must be between 0.0 and 1.0``;
- ``Guardian v2 transcript max_…_entry_tokens must not exceed max_…_transcript_tokens``;
- ``Guardian v2 transcript max_recent_non_user_entries must be positive``;
- ``Guardian v2 async_classifier_conversation_token_limit must be positive``。

为什么单独立文件:已复现的 ``guardian_scoring.py`` 把滑窗决策写死为模块常量
(``PREDICTIVE_WINDOW_RECENT=5`` / 阻断档=high+),配置层让它**可配置**——
``review_threshold`` 派生阻断档、``review_scope`` 驱动滑窗、token 限制做校验,
同时保留 Codex 默认值作为基线。安全语义:校验 fail-closed(非法配置报错、
绝不静默放行),``review_threshold`` 缺省 None = 用 Codex 默认阻断档。

设计纪律:纯 dataclass、无 IO、不解析 TOML(调用方若从 toml 读,自行喂字段)。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Final

from app.core.guardian_risk import GuardianRiskLevel

__all__ = [
    "GuardianV2TranscriptConfig",
    "GuardianV2ReviewScopeConfig",
    "GuardianV2Config",
    "GuardianConfigError",
    "default_guardian_v2_config",
]


class GuardianConfigError(ValueError):
    """Guardian 配置非法(fail-closed:调用方须拒绝启动/拒绝评分)。"""


@dataclass
class GuardianV2TranscriptConfig:
    """transcript 截断配置(逐字对齐 Codex 7 字段中的 5 个数值限制)。"""

    max_message_entry_tokens: int | None = None
    max_tool_entry_tokens: int | None = None
    max_message_transcript_tokens: int | None = None
    max_tool_transcript_tokens: int | None = None
    max_recent_non_user_entries: int | None = None

    def validate(self) -> list[str]:
        """复现 codex.exe 校验约束,返回错误列表(空 = 合法)。"""
        errors: list[str] = []
        pairs = (
            ("max_message_entry_tokens", self.max_message_entry_tokens, "max_message_transcript_tokens", self.max_message_transcript_tokens),
            ("max_tool_entry_tokens", self.max_tool_entry_tokens, "max_tool_transcript_tokens", self.max_tool_transcript_tokens),
        )
        for entry_name, entry, transcript_name, transcript in pairs:
            if entry is not None and transcript is not None and entry > transcript:
                errors.append(
                    f"Guardian v2 transcript {entry_name} must not exceed {transcript_name}"
                )
        if self.max_recent_non_user_entries is not None and self.max_recent_non_user_entries <= 0:
            errors.append(
                "Guardian v2 transcript max_recent_non_user_entries must be positive"
            )
        return errors


@dataclass
class GuardianV2ReviewScopeConfig:
    """review_scope 配置(逐字对齐 Codex 2 字段)。"""

    computer_use_only: bool = False
    sandboxed_exec_commands: bool = False


@dataclass
class GuardianV2Config:
    """Guardian v2 配置(逐字对齐 Codex 19 字段 + 嵌套 transcript/review_scope)。"""

    sync_elastic_budgeting: bool | None = None
    sync_elastic_sections: bool | None = None
    transcript_mode: str | None = None  # "limited" | "full"
    async_classifier_mode: str | None = None  # deprecated/ignored per codex
    async_classifier_conversation_token_limit: int | None = None
    free_guardian: bool | None = None
    thread_context: bool | None = None
    persist_scores: bool | None = None
    classifier_instructions: str | None = None
    review_threshold: float | None = None
    max_tool_call_lag: int | None = None
    reasoning_effort: str | None = None
    max_action_tokens: int | None = None
    max_classifier_instruction_tokens: int | None = None
    reuse_parent_compaction: bool | None = None
    max_parent_compaction_tokens: int | None = None
    review_scope: GuardianV2ReviewScopeConfig = field(default_factory=GuardianV2ReviewScopeConfig)
    transcript: GuardianV2TranscriptConfig = field(default_factory=GuardianV2TranscriptConfig)
    # 第 19 字段(Codex struct 尾部);codex.exe 中作为开关出现,本仓对齐字段位。
    limited: bool | None = None

    def validate(self) -> list[str]:
        """校验全配置,返回错误列表(空 = 合法)。fail-closed:非法即报错。"""
        errors: list[str] = []
        if self.review_threshold is not None and not (0.0 <= self.review_threshold <= 1.0):
            errors.append("Guardian v2 review_threshold must be between 0.0 and 1.0")
        if (
            self.async_classifier_conversation_token_limit is not None
            and self.async_classifier_conversation_token_limit <= 0
        ):
            errors.append(
                "Guardian v2 async_classifier_conversation_token_limit must be positive"
            )
        errors.extend(self.transcript.validate())
        return errors

    def blocking_risk_level(self) -> GuardianRiskLevel:
        """由 ``review_threshold`` 派生阻断档,接线 ``classify_needs_blocking_review``。

        - ``review_threshold is None``(Codex 默认)→ high(high+ 阻断,Prompt 原文);
        - ``0.0 <= threshold < 0.5`` → medium(medium+ 阻断,更激进);
        - ``threshold >= 0.5`` → critical(仅 critical 阻断,更宽松)。

        返回的档位语义 = "该档及以上触发阻断复核";调用方把它作为滑窗
        决策的内在风险门槛(替代写死的 ``is_blocking``)。
        """
        if self.review_threshold is None:
            return GuardianRiskLevel.HIGH
        if self.review_threshold < 0.5:
            return GuardianRiskLevel.MEDIUM
        return GuardianRiskLevel.CRITICAL

    def predictive_window(self) -> tuple[int, int]:
        """由 review_scope 驱动的滑窗 ``(recent, ahead)``。

        默认 (5, 2) 逐字对齐 Codex Prompt;``computer_use_only`` 收紧到 (3, 1)
        (浏览器/电脑操作上下文更短、更需即时复核)。
        """
        if self.review_scope.computer_use_only:
            return (3, 1)
        return (5, 2)


def default_guardian_v2_config() -> GuardianV2Config:
    """Codex 默认配置基线(review_threshold=None → high+ 阻断,滑窗 (5,2))。"""
    return GuardianV2Config()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
