# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""回合细粒度错误码封闭集 —— 遵循统一工程规范。

设计依据（2026-11-18，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物 strings 逐字锚（连续 token 拼接形态）::

    activepausedblockedusage_limitedbudget_limitedcomplete
    turn_aborted session_budget_exceeded stream content_filter response_incomplete
    rate_limit_exceeded context_window_exceeded thread_not_found agent_limit_reached
    session_configured_not_first_event timeout request_timeout spawn interrupted
    unexpected_status invalid_request model_not_found invalid_prompt tool_collision
    invalid_image_request usage_limit_reached server_overloaded policy_capacity_unavailable
    flex_unavailable cyber_policy bio_policy misalignment_policy_violation
    response_stream_failed connection_failed quota_exceeded usage_not_included
    internal_server_error retry_limit internal_agent_died unsupported_operation
    refresh_token_failed gateway_login_required fatal io json tokio_join env_var
    ... active_turn_not_steerable other

取证纠偏（防后人踩）——三套枚举被 strings 拼成连续块，本模块**只取 turn 错误码轴**：
- ``active/paused/blocked/usage_limited/budget_limited/complete`` = 会话/agent **状态**轴（非错误码）；
- ``turn_aborted`` 是 turn-abort **事件标记**（其子因才是下列码）；
- ``active_turn_not_steerable``/``other`` 紧邻错误码块末尾，归入本封闭集。
本封闭集是 **strings 观察候选**（非 schema 逐字段确证）——这些 token 确切是否同一 Rust enum
的变体名、确切 serde rename 为何，未从二进制确证，已在本 docstring 与测试双重标注。

本仓分工（互补不重叠，三轴）：
- ``turn_error_kind.TurnErrorKind`` = 回合错误**语义 kind**（六档：interrupted/not_found/
  shutdown/misalignment/running/errored）—— 已有，本模块不替换；
- ``agent_failure_vocabulary`` = 错误族字符串 → **恢复族**（retryable/terminal，仅 9 族字符串）
  —— 已有，本模块不替换；
- 本模块 = **细粒度错误码封闭集** + 每码同时映射到（kind × 恢复族）**二维**——本仓此前缺失。

一轴超越：对照把 40+ 错误码散在 codex-core 各失败分支（运行时遇到才产出），且「该码重试吗、
归哪个 kind」靠分支位置隐式决定、无统一映射表。本仓让每码的（kind × 恢复族）成为**显式表驱动
映射** + 单一 `classify_turn_error_code()` 纯函数（未知码保守归 UNKNOWN/undetermined 不误判），
可 diff 可单测可挂审计。对照未提供「每码二维归属」的一览表，本仓补齐。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Final

from app.core.turn_error_kind import TurnErrorKind

__all__ = [
    "TurnErrorCode",
    "RecoveryFamily",
    "TurnErrorCodeClassification",
    "classify_turn_error_code",
    "turn_error_code_count",
    "UNKNOWN_CODE",
    "UNDETERMINED_FAMILY",
]

# 取证纠偏：以下为 turn 错误码轴的 strings 观察候选，按二进制出现序登记。
# 状态轴（active/paused/blocked/usage_limited/budget_limited/complete）与 turn_aborted
# 事件标记**不在**本封闭集（属另轴，见模块 docstring 取证纠偏）。
_TURN_ERROR_CODE_VALUES: Final = (
    "session_budget_exceeded",
    "stream",
    "content_filter",
    "response_incomplete",
    "rate_limit_exceeded",
    "context_window_exceeded",
    "thread_not_found",
    "agent_limit_reached",
    "session_configured_not_first_event",
    "timeout",
    "request_timeout",
    "spawn",
    "interrupted",
    "unexpected_status",
    "invalid_request",
    "model_not_found",
    "invalid_prompt",
    "tool_collision",
    "invalid_image_request",
    "usage_limit_reached",
    "server_overloaded",
    "policy_capacity_unavailable",
    "flex_unavailable",
    "cyber_policy",
    "bio_policy",
    "misalignment_policy_violation",
    "response_stream_failed",
    "connection_failed",
    "quota_exceeded",
    "usage_not_included",
    "internal_server_error",
    "retry_limit",
    "internal_agent_died",
    "unsupported_operation",
    "refresh_token_failed",
    "gateway_login_required",
    "fatal",
    "io",
    "json",
    "tokio_join",
    "env_var",
    "active_turn_not_steerable",
    "other",
)


class TurnErrorCode(str, Enum):  # noqa: UP042 — 改 StrEnum 会变 str() 输出,属行为重写
    """回合细粒度错误码封闭集（strings 观察候选，逐字对照二进制 token）。"""

    SESSION_BUDGET_EXCEEDED = "session_budget_exceeded"
    STREAM = "stream"
    CONTENT_FILTER = "content_filter"
    RESPONSE_INCOMPLETE = "response_incomplete"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    CONTEXT_WINDOW_EXCEEDED = "context_window_exceeded"
    THREAD_NOT_FOUND = "thread_not_found"
    AGENT_LIMIT_REACHED = "agent_limit_reached"
    SESSION_CONFIGURED_NOT_FIRST_EVENT = "session_configured_not_first_event"
    TIMEOUT = "timeout"
    REQUEST_TIMEOUT = "request_timeout"
    SPAWN = "spawn"
    INTERRUPTED = "interrupted"
    UNEXPECTED_STATUS = "unexpected_status"
    INVALID_REQUEST = "invalid_request"
    MODEL_NOT_FOUND = "model_not_found"
    INVALID_PROMPT = "invalid_prompt"
    TOOL_COLLISION = "tool_collision"
    INVALID_IMAGE_REQUEST = "invalid_image_request"
    USAGE_LIMIT_REACHED = "usage_limit_reached"
    SERVER_OVERLOADED = "server_overloaded"
    POLICY_CAPACITY_UNAVAILABLE = "policy_capacity_unavailable"
    FLEX_UNAVAILABLE = "flex_unavailable"
    CYBER_POLICY = "cyber_policy"
    BIO_POLICY = "bio_policy"
    MISALIGNMENT_POLICY_VIOLATION = "misalignment_policy_violation"
    RESPONSE_STREAM_FAILED = "response_stream_failed"
    CONNECTION_FAILED = "connection_failed"
    QUOTA_EXCEEDED = "quota_exceeded"
    USAGE_NOT_INCLUDED = "usage_not_included"
    INTERNAL_SERVER_ERROR = "internal_server_error"
    RETRY_LIMIT = "retry_limit"
    INTERNAL_AGENT_DIED = "internal_agent_died"
    UNSUPPORTED_OPERATION = "unsupported_operation"
    REFRESH_TOKEN_FAILED = "refresh_token_failed"
    GATEWAY_LOGIN_REQUIRED = "gateway_login_required"
    FATAL = "fatal"
    IO = "io"
    JSON = "json"
    TOKIO_JOIN = "tokio_join"
    ENV_VAR = "env_var"
    ACTIVE_TURN_NOT_STEERABLE = "active_turn_not_steerable"
    OTHER = "other"


class RecoveryFamily(str, Enum):  # noqa: UP042 — 改 StrEnum 会变 str() 输出,属行为重写
    """错误码的恢复族（本仓三维：可重试 / 终态 / 致命不可重试 / 未判定）。"""

    RETRYABLE = "retryable"  # 同类重试可能恢复（超时/限流/过载/瞬时连接）
    TERMINAL = "terminal"  # 终态不可重试（策略拒绝/请求非法/资源不存在）
    FATAL = "fatal"  # 环境/凭据/部署级故障，重试同请求无效
    #: 没判 = 取不到可判定的恢复族。绝不与 TERMINAL 并桶。
    UNDETERMINED = "undetermined"


# 未知码归一化占位（本仓兜底，对照无显式 unknown 成员）。
UNKNOWN_CODE = "unknown"
UNDETERMINED_FAMILY = RecoveryFamily.UNDETERMINED.value


@dataclass(frozen=True)
class TurnErrorCodeClassification:
    """一个错误码的二维归属：语义 kind + 恢复族。"""

    code: str
    kind: TurnErrorKind
    recovery: RecoveryFamily


# 表驱动映射：每码（kind × 恢复族）。优先级冲突由 classify 的显式覆盖序处理。
_CODE_MAP: Final[dict[str, TurnErrorCodeClassification]] = {
    # —— 用户主动中断（人意志凌驾自动恢复）——
    "interrupted": TurnErrorCodeClassification(
        "interrupted", TurnErrorKind.INTERRUPTED, RecoveryFamily.TERMINAL
    ),
    # —— 资源不存在 ——
    "thread_not_found": TurnErrorCodeClassification(
        "thread_not_found", TurnErrorKind.NOT_FOUND, RecoveryFamily.TERMINAL
    ),
    "model_not_found": TurnErrorCodeClassification(
        "model_not_found", TurnErrorKind.NOT_FOUND, RecoveryFamily.TERMINAL
    ),
    # —— 会话/线程关闭 ——
    "session_configured_not_first_event": TurnErrorCodeClassification(
        "session_configured_not_first_event", TurnErrorKind.SHUTDOWN, RecoveryFamily.TERMINAL
    ),
    # —— 策略对齐拒绝（Codex 独有 MISALIGNMENT 类）——
    "misalignment_policy_violation": TurnErrorCodeClassification(
        "misalignment_policy_violation", TurnErrorKind.MISALIGNMENT, RecoveryFamily.TERMINAL
    ),
    "cyber_policy": TurnErrorCodeClassification(
        "cyber_policy", TurnErrorKind.MISALIGNMENT, RecoveryFamily.TERMINAL
    ),
    "bio_policy": TurnErrorCodeClassification(
        "bio_policy", TurnErrorKind.MISALIGNMENT, RecoveryFamily.TERMINAL
    ),
    "content_filter": TurnErrorCodeClassification(
        "content_filter", TurnErrorKind.MISALIGNMENT, RecoveryFamily.TERMINAL
    ),
    # —— 预算/配额：终态（重试同请求不会恢复额度）——
    "session_budget_exceeded": TurnErrorCodeClassification(
        "session_budget_exceeded", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    "usage_limit_reached": TurnErrorCodeClassification(
        "usage_limit_reached", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    "quota_exceeded": TurnErrorCodeClassification(
        "quota_exceeded", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    "usage_not_included": TurnErrorCodeClassification(
        "usage_not_included", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    "agent_limit_reached": TurnErrorCodeClassification(
        "agent_limit_reached", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    "retry_limit": TurnErrorCodeClassification(
        "retry_limit", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    # —— 容量不可用：终态（当前能力未开通/不可用）——
    "policy_capacity_unavailable": TurnErrorCodeClassification(
        "policy_capacity_unavailable", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    "flex_unavailable": TurnErrorCodeClassification(
        "flex_unavailable", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    # —— 请求非法（4xx 语义，重试同请求无效）——
    "invalid_request": TurnErrorCodeClassification(
        "invalid_request", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    "invalid_prompt": TurnErrorCodeClassification(
        "invalid_prompt", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    "tool_collision": TurnErrorCodeClassification(
        "tool_collision", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    "invalid_image_request": TurnErrorCodeClassification(
        "invalid_image_request", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    "unexpected_status": TurnErrorCodeClassification(
        "unexpected_status", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    "unsupported_operation": TurnErrorCodeClassification(
        "unsupported_operation", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    "active_turn_not_steerable": TurnErrorCodeClassification(
        "active_turn_not_steerable", TurnErrorKind.ERRORED, RecoveryFamily.TERMINAL
    ),
    # —— 致命：环境/凭据/部署级，重试同请求无效 ——
    "refresh_token_failed": TurnErrorCodeClassification(
        "refresh_token_failed", TurnErrorKind.ERRORED, RecoveryFamily.FATAL
    ),
    "gateway_login_required": TurnErrorCodeClassification(
        "gateway_login_required", TurnErrorKind.ERRORED, RecoveryFamily.FATAL
    ),
    "internal_agent_died": TurnErrorCodeClassification(
        "internal_agent_died", TurnErrorKind.ERRORED, RecoveryFamily.FATAL
    ),
    "fatal": TurnErrorCodeClassification("fatal", TurnErrorKind.ERRORED, RecoveryFamily.FATAL),
    "landlock_sandbox_executable_not_provided": TurnErrorCodeClassification(
        "landlock_sandbox_executable_not_provided", TurnErrorKind.ERRORED, RecoveryFamily.FATAL
    ),
    # —— 可重试：超时 / 限流 / 过载 / 瞬时连接 ——
    "timeout": TurnErrorCodeClassification(
        "timeout", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE
    ),
    "request_timeout": TurnErrorCodeClassification(
        "request_timeout", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE
    ),
    "rate_limit_exceeded": TurnErrorCodeClassification(
        "rate_limit_exceeded", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE
    ),
    "server_overloaded": TurnErrorCodeClassification(
        "server_overloaded", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE
    ),
    "internal_server_error": TurnErrorCodeClassification(
        "internal_server_error", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE
    ),
    "connection_failed": TurnErrorCodeClassification(
        "connection_failed", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE
    ),
    "response_stream_failed": TurnErrorCodeClassification(
        "response_stream_failed", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE
    ),
    "stream": TurnErrorCodeClassification(
        "stream", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE
    ),
    "response_incomplete": TurnErrorCodeClassification(
        "response_incomplete", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE
    ),
    "context_window_exceeded": TurnErrorCodeClassification(
        "context_window_exceeded", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE
    ),
    "spawn": TurnErrorCodeClassification(
        "spawn", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE
    ),
    # —— 基础设施瞬时故障（io/json/tokio_join/env_var 视为可重试环境抖动）——
    "io": TurnErrorCodeClassification("io", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE),
    "json": TurnErrorCodeClassification("json", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE),
    "tokio_join": TurnErrorCodeClassification(
        "tokio_join", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE
    ),
    "env_var": TurnErrorCodeClassification(
        "env_var", TurnErrorKind.ERRORED, RecoveryFamily.RETRYABLE
    ),
    # —— 兜底 ——
    "other": TurnErrorCodeClassification(
        "other", TurnErrorKind.ERRORED, RecoveryFamily.UNDETERMINED
    ),
}

# landlock 不在 _TURN_ERROR_CODE_VALUES（二进制另起一行相邻），但属错误码轴，
# 单独登记映射（供 classify 识别，不计入封闭集成员数）。
_CODE_MAP["landlock_sandbox_executable_not_provided"] = TurnErrorCodeClassification(
    "landlock_sandbox_executable_not_provided", TurnErrorKind.ERRORED, RecoveryFamily.FATAL
)


def turn_error_code_count() -> int:
    """封闭集成员数（等于登记的枚举变体数）。"""
    return len(TurnErrorCode)


def classify_turn_error_code(code: str | None) -> TurnErrorCodeClassification:
    """给定一个原始错误码字符串，返回其（kind × 恢复族）二维归属。

    - 已知码 ⇒ 表驱动精确归属；
    - 未知/None/空串 ⇒ ``code=unknown``、kind=ERRORED、recovery=UNDETERMINED（保守兜底，
      绝不误判为可重试或终态）。对照无显式 unknown 成员，本仓补齐防误判。
    """
    if code:
        normalized = code.strip()
        # 先查封闭集成员（枚举），再查额外登记映射（landlock 等二进制另起 token）。
        member = next(
            (m for m in TurnErrorCode if m.value == normalized),
            None,
        )
        if member is not None:
            return _CODE_MAP[member.value]
        if normalized in _CODE_MAP:
            return _CODE_MAP[normalized]
    return TurnErrorCodeClassification(
        UNKNOWN_CODE, TurnErrorKind.ERRORED, RecoveryFamily.UNDETERMINED
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
