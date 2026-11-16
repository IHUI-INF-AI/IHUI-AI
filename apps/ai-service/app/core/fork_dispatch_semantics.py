# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""Fork 派发语义（对标 Codex 26.1111 warm_fork 派发模式 + fork_turns 上下文传播）。

设计依据（2026-11-16，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物 codex-core / app-server 的 fork 请求处理（`app-server/src/request_processors/
thread_fork_goal.rs` + `in_process.rs`）：
- fork 派发模式：**in-process**（app-server 内部 fork，`disable_in_process_fallback`
  控制 fallback）vs **out-of-process**（独立进程 spawn）。
- `fork_turns` 上下文传播封闭集：`all`（全量历史）/ `none`（仅初始 prompt）/
  正整数 N（最近 N turn）。
- fork 拒绝条件逐字：
    `Cannot fork into this worktree because developer instructions differ.`
    `Forking with images requires a prompt`
    `Ephemeral forks require a prompt`
    `Forking with output options requires a prompt`
    `` `codex fork --worktree` requires an explicit session ID ``
- full-history fork 继承约束逐字：`Full-history forks ... inherit the parent model and
  reasoning effort and do not accept overrides.`

管：给定 fork 请求（fork_turns / 是否带 prompt / 是否带 images / 是否 ephemeral /
是否 worktree / developer_instructions 是否一致 / 是否带 output options），判定派发
这一步该怎么走 —— DISPATCH_IN_PROCESS / DISPATCH_OUT_OF_PROCESS（fallback）/ REJECT
（命中拒绝条件）。

不管：resume kind 分类（turn_resume_kind）、fork 后的 thread 持久化、真实进程 spawn。

一轴超越：对照把 fork 派发决策散在 app-server request processor 各处 fallthrough
（先检查 prompt，再检查 worktree，再决定 in/out-of-process），**full-history fork
不允许 model/reasoning_effort override**这一约束只在文档字符串里逐字出现、无显式判据。
本仓提前为纯函数：一次校验完所有拒绝条件（不是 fail-fast 遇首即停）+ in/out-of-process
派发判据显式化 + fork_turns 封闭集可机检。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

# ── 对照物逐字锚（防篡改证据，全部来自 strings）────────────────────────────
VERBATIM_WORKTREE_DEV_INSTRUCTIONS_DIFFER = (
    "Cannot fork into this worktree because developer instructions differ."
)
VERBATIM_IMAGES_REQUIRE_PROMPT = "Forking with images requires a prompt"
VERBATIM_EPHEMERAL_REQUIRE_PROMPT = "Ephemeral forks require a prompt"
VERBATIM_OUTPUT_OPTIONS_REQUIRE_PROMPT = (
    "Forking with output options requires a prompt"
)
VERBATIM_WORKTREE_REQUIRES_SESSION_ID = (
    "`codex fork --worktree` requires an explicit session ID"
)
VERBATIM_FULL_HISTORY_INHERIT_MODEL = (
    "Full-history forks (`fork_turns` omitted or `\"all\"`) inherit the parent "
    "model and reasoning effort and do not accept overrides."
)
VERBATIM_IN_PROCESS_FALLBACK_DISABLED = "disable_in_process_fallback"

# fork_turns 封闭集（`all` / `none` / 正整数 N）
FORK_TURNS_ALL = "all"
FORK_TURNS_NONE = "none"
VALID_FORK_TURNS_STRINGS: frozenset[str] = frozenset({FORK_TURNS_ALL, FORK_TURNS_NONE})


class ForkDispatch(StrEnum):
    """fork 派发模式。"""

    IN_PROCESS = "IN_PROCESS"  # app-server 内部 fork
    OUT_OF_PROCESS = "OUT_OF_PROCESS"  # 独立进程 spawn（fallback）


class ForkVerdict(StrEnum):
    """fork 准入判定。"""

    DISPATCH = "DISPATCH"  # 允许 fork，按 dispatch_mode 派发
    REJECT = "REJECT"  # 命中拒绝条件


@dataclass(frozen=True)
class ForkRequest:
    """fork 请求字段（对标 thread_fork_goal.rs 的入参）。"""

    has_prompt: bool = False
    has_images: bool = False
    has_output_options: bool = False
    ephemeral: bool = False
    worktree: bool = False
    has_explicit_session_id: bool = False
    developer_instructions_match: bool = True  # worktree 目标 vs 当前
    # fork_turns: "all" / "none" / 正整数 N（None = 省略，等价 "all"）
    fork_turns: str | int | None = None
    # override 尝试（full-history fork 下违规）
    model_override: str | None = None
    reasoning_effort_override: str | None = None
    # in-process fallback 开关（对标 disable_in_process_fallback）
    disable_in_process_fallback: bool = False


@dataclass(frozen=True)
class ForkDecision:
    """fork 决策输出。"""

    verdict: ForkVerdict
    dispatch_mode: ForkDispatch | None  # verdict=REJECT 时为 None
    rejections: tuple[str, ...]  # 逐字拒绝原因（可多条）
    context_propagation: str  # fork_turns 归一化后的值（all / none / N）

    @property
    def ok(self) -> bool:
        return self.verdict is ForkVerdict.DISPATCH

    def to_dict(self) -> dict[str, Any]:
        return {
            "verdict": self.verdict.value,
            "dispatch_mode": self.dispatch_mode.value if self.dispatch_mode else None,
            "rejections": list(self.rejections),
            "context_propagation": self.context_propagation,
        }


def normalize_fork_turns(fork_turns: str | int | None) -> str | int:
    """归一化 fork_turns：None → "all"（省略等价全量）；校验字符串封闭集。

    非法字符串抛 ValueError（fail-closed，交由 decide_fork 转 REJECT）。
    """
    if fork_turns is None:
        return FORK_TURNS_ALL
    if isinstance(fork_turns, bool):  # bool 是 int 子类，显式排除
        raise ValueError(f"invalid fork_turns: {fork_turns}")
    if isinstance(fork_turns, int):
        if fork_turns < 0:
            raise ValueError(f"fork_turns must be non-negative, got {fork_turns}")
        return fork_turns
    if fork_turns in VALID_FORK_TURNS_STRINGS:
        return fork_turns
    raise ValueError(
        f"invalid fork_turns: {fork_turns!r} (expected 'all', 'none', or non-negative int)"
    )


def decide_fork(req: ForkRequest) -> ForkDecision:
    """给定 fork 请求，判定准入 + 派发模式 + 上下文传播。

    判定优先级（对标 thread_fork_goal.rs fallthrough 顺序，一次报全部拒绝）：
      1. worktree + developer_instructions 不一致 → REJECT（逐字锚）。
      2. worktree + 无 explicit session_id → REJECT（逐字锚）。
      3. images + 无 prompt → REJECT（逐字锚）。
      4. ephemeral + 无 prompt → REJECT（逐字锚）。
      5. output_options + 无 prompt → REJECT（逐字锚）。
      6. fork_turns 归一化失败（非法字符串/负数）→ REJECT。
      7. full-history fork（all）+ model/reasoning_effort override → REJECT（逐字锚）。
      8. 全部通过 → DISPATCH；dispatch_mode = IN_PROCESS，除非
         disable_in_process_fallback=True → OUT_OF_PROCESS。
    """
    rejections: list[str] = []

    # 1. worktree developer instructions 冲突
    if req.worktree and not req.developer_instructions_match:
        rejections.append(VERBATIM_WORKTREE_DEV_INSTRUCTIONS_DIFFER)

    # 2. worktree 需要显式 session_id
    if req.worktree and not req.has_explicit_session_id:
        rejections.append(VERBATIM_WORKTREE_REQUIRES_SESSION_ID)

    # 3-5. images / ephemeral / output_options 均要求 prompt
    if req.has_images and not req.has_prompt:
        rejections.append(VERBATIM_IMAGES_REQUIRE_PROMPT)
    if req.ephemeral and not req.has_prompt:
        rejections.append(VERBATIM_EPHEMERAL_REQUIRE_PROMPT)
    if req.has_output_options and not req.has_prompt:
        rejections.append(VERBATIM_OUTPUT_OPTIONS_REQUIRE_PROMPT)

    # 6. fork_turns 归一化
    try:
        normalized_turns = normalize_fork_turns(req.fork_turns)
    except ValueError as exc:
        rejections.append(str(exc))
        normalized_turns = FORK_TURNS_ALL  # 占位（反正 verdict=REJECT）

    # 7. full-history fork 不允许 override
    if normalized_turns == FORK_TURNS_ALL:
        if req.model_override is not None:
            rejections.append(VERBATIM_FULL_HISTORY_INHERIT_MODEL)
        if req.reasoning_effort_override is not None:
            rejections.append(VERBATIM_FULL_HISTORY_INHERIT_MODEL)

    if rejections:
        return ForkDecision(
            verdict=ForkVerdict.REJECT,
            dispatch_mode=None,
            rejections=tuple(rejections),
            context_propagation=str(normalized_turns),
        )

    # 8. 派发模式
    dispatch = (
        ForkDispatch.OUT_OF_PROCESS
        if req.disable_in_process_fallback
        else ForkDispatch.IN_PROCESS
    )
    return ForkDecision(
        verdict=ForkVerdict.DISPATCH,
        dispatch_mode=dispatch,
        rejections=(),
        context_propagation=str(normalized_turns),
    )


def fork_turns_closed_set() -> frozenset[str]:
    """返回 fork_turns 字符串封闭集（all / none），供编排层校验。"""
    return VALID_FORK_TURNS_STRINGS


def is_full_history_fork(fork_turns: str | int | None) -> bool:
    """判断是否 full-history fork（省略或 "all"）。"""
    return fork_turns is None or fork_turns == FORK_TURNS_ALL
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
