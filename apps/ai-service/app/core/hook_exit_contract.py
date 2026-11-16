# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外部实现 hook event 完整枚举 + exit-code 契约 —— 遵循统一工程规范。

设计依据（2026-11-16，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物 `codex_core::hook_runtime` + `hooks::src::events::*`：
hook event 完整枚举与 exit-code-2 必须携带 stderr 的契约（逐字文案见下常量）。

管：① hook event 封闭集（Codex 全 14 项，本仓 hook_runtime.HookKind 仅 6 项，本模块补齐
完整清单作为对照真相源）；② exit-code 契约判定 —— exit 2 表「干预」（阻塞/拒绝/反馈/
续跑提示），且**必须**在 stderr 写对应载荷，否则契约违规。纯函数判据层。

不管：hook 的注册/执行/超时（hook_runtime.py 已做）、事件分发、hook 输出如何并入上下文。

本仓分工（互补不重叠）：hook_runtime.py 是执行器（超时/deny/outcome）；本模块是**枚举
封闭集 + 进程退出码契约校验**——填空白。Codex exit-code 契约是可判定的：exit 2 干预且
缺 stderr 载荷 ⇒ 违约（对照逐字报错）。

一轴超越：对照把「exit 2 必带 stderr」散在各 events/*.rs 的运行时分支，且每类事件要求
的 stderr 载荷**不同**（blocking reason / denial reason / feedback / continuation prompt）
——本仓把「哪类事件要求哪类载荷」表驱动化，单一校验函数覆盖全部事件，可 diff 可单测。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

__all__ = [
    "CodexHookEvent",
    "ExitCodeViolation",
    "required_stderr_payload",
    "check_hook_exit",
    "CODEX_HOOK_EVENT_TOTAL",
    "CODEX_ERR_EXIT2_NO_BLOCKING_REASON",
    "CODEX_ERR_EXIT2_NO_DENIAL_REASON",
    "CODEX_ERR_EXIT2_NO_FEEDBACK",
    "CODEX_ERR_EXIT2_NO_CONTINUATION",
    "CODEX_ERR_EXIT_NO_STATUS",
    "CODEX_ERR_INVALID_JSON",
]

# 逐字错误锚（测试按常量断言，不手抄）
CODEX_ERR_EXIT2_NO_BLOCKING_REASON = (
    "exited with code 2 but did not write a blocking reason to stderr"
)
CODEX_ERR_EXIT2_NO_DENIAL_REASON = (
    "exited with code 2 but did not write a denial reason to stderr"
)
CODEX_ERR_EXIT2_NO_FEEDBACK = (
    "exited with code 2 but did not write feedback to stderr"
)
CODEX_ERR_EXIT2_NO_CONTINUATION = (
    "exited with code 2 but did not write a continuation prompt to stderr"
)
CODEX_ERR_EXIT_NO_STATUS = "hook exited without a status code"
CODEX_ERR_INVALID_JSON = "hook returned invalid {} JSON output"


class CodexHookEvent(str, Enum):  # noqa: UP042 — 改 StrEnum 会变 str() 输出,属行为重写
    """Codex hook event 封闭集（14 项，取证自 hook_runtime.rs + events/*.rs）。

    本仓 hook_runtime.HookKind 仅 6 项；本枚举是**对照真相源**，补齐全部事件供
    差距审计与未来扩展，不替换既有 HookKind。
    """

    PRE_TOOL_USE = "pre_tool_use"
    PERMISSION_REQUEST = "permission_request"
    POST_TOOL_USE = "post_tool_use"
    PRE_COMPACT = "pre_compact"
    POST_COMPACT = "post_compact"
    SESSION_START = "session_start"
    SESSION_END = "session_end"
    USER_PROMPT_SUBMIT = "user_prompt_submit"
    SUBAGENT_START = "subagent_start"
    SUBAGENT_STOP = "subagent_stop"
    STOP = "stop"
    INTERRUPT = "interrupt"
    PRE_MODEL_REQUEST = "pre_model_request"
    POST_MODEL_REQUEST = "post_model_request"


CODEX_HOOK_EVENT_TOTAL: int = len(CodexHookEvent)  # 14


@dataclass(frozen=True)
class ExitCodeViolation:
    """exit-code 契约判定：违规类型 + 逐字 codex 错误锚（合规时 codex_error=None）。"""

    ok: bool
    codex_error: str | None = None
    detail: str = ""


def required_stderr_payload(event: CodexHookEvent) -> str | None:
    """exit 2 时该事件**必须**写在 stderr 的载荷类型（取证逐字映射）。

    返回 None = 该事件 exit 2 无 stderr 载荷要求（本轮取证未见者，不猜）。
    """
    mapping: dict[CodexHookEvent, str] = {
        CodexHookEvent.PRE_TOOL_USE: "blocking_reason",
        CodexHookEvent.PERMISSION_REQUEST: "denial_reason",
        CodexHookEvent.POST_TOOL_USE: "feedback",
        CodexHookEvent.STOP: "continuation_prompt",
        CodexHookEvent.SUBAGENT_STOP: "continuation_prompt",
    }
    return mapping.get(event)


def check_hook_exit(
    *,
    event: CodexHookEvent,
    has_status_code: bool,
    exit_code: int | None,
    stderr_has_payload: bool,
    json_valid: bool | None = None,
) -> ExitCodeViolation:
    """按 Codex exit-code 契约校验一次 hook 进程退出。

    判据链（优先级从上到下）：

    1. 进程无状态码 ⇒ 违约（EXIT_NO_STATUS）。
    2. 退出码 != 2：正常结束；若产出 JSON 且解析失败 ⇒ 违约（INVALID_JSON）。
    3. 退出码 == 2（干预）：stderr 未写该事件要求的载荷 ⇒ 违约（逐字锚）。
    4. exit 2 且 stderr 载荷齐备 ⇒ 合规。
    """
    if not has_status_code:
        return ExitCodeViolation(
            ok=False,
            codex_error=CODEX_ERR_EXIT_NO_STATUS,
            detail="hook process terminated without an exit code",
        )
    if exit_code != 2:
        if json_valid is False:
            return ExitCodeViolation(
                ok=False,
                codex_error=CODEX_ERR_INVALID_JSON.format(event.value),
                detail=f"hook returned invalid {event.value} JSON output",
            )
        return ExitCodeViolation(ok=True, detail=f"exit code {exit_code}, no intervention")
    required = required_stderr_payload(event)
    if required is not None and not stderr_has_payload:
        anchor = {
            "blocking_reason": CODEX_ERR_EXIT2_NO_BLOCKING_REASON,
            "denial_reason": CODEX_ERR_EXIT2_NO_DENIAL_REASON,
            "feedback": CODEX_ERR_EXIT2_NO_FEEDBACK,
            "continuation_prompt": CODEX_ERR_EXIT2_NO_CONTINUATION,
        }[required]
        return ExitCodeViolation(
            ok=False,
            codex_error=anchor,
            detail=f"{event.value} exit 2 requires {required} on stderr",
        )
    return ExitCodeViolation(
        ok=True,
        detail=f"{event.value} exit 2 intervention with required stderr payload",
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
