# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器 REPL 执行纪律 — 复现 Codex 26.1111 api-use-behavior §4.3。

取证来源
--------
``.ihui-agent/tmp/goal-codex-r11/cua-browser-capability-spec.md`` §4.3::

    REPL 状态持久: const 稳定句柄 / let 变值, 重赋值而非重声明;
    禁 globalThis、禁 reacquire 句柄除非失效。
    每次交互前先看清屏幕: 点/滚/输后取最便宜的状态校验 —
      要 DOM 真值用 DOM snapshot, 要视觉确认用截图, 默认不要两个都要。
    交互无效时不要盲目重复也不要立刻降级到坐标点击;
      先查可见状态有无 blocker。
    已在目标 URL 的 tab 不要重复 goto (会 reload 丢用户在填的内容),
      要刷新用 tab.reload()。
    browser.history() 可能要用户批准, 绝不投机调用;
      要用就一次聚焦调用带日期边界。
    查询类任务: 一次聚焦直达 URL 或参数化搜索,
      不要迭代猜 URL 变体/候选数组。

对照 IHUI 缺口
--------------
Codex 上述 5 条浏览器 REPL 纪律未系统化复现——本模块补齐:
  1. REPL 声明纪律（const 稳定 / let 重赋值 / 禁 globalThis / 禁重声明）；
  2. 刷新路径守卫（已聚焦 tab 禁 goto → 用 reload，防丢用户输入）；
  3. 状态校验选路（DOM snapshot 拿真值 / 截图视觉确认 / 默认择一）；
  4. 交互无效的升级路径（先查 blocker，禁盲目重复，禁立刻降级坐标）；
  5. history 投机调用守卫（须日期边界 + 焦点 + 用户批准）。

设计要点（纯函数，零 IO）
------------------------
1. ``validate_repl_declaration``：声明语句 → ``{action, handle, forbidden}``；
2. ``check_tab_refresh_path``：goto/reload 择路（已在目标 URL → reload）；
3. ``choose_state_verification``：dom_truth / visual / both → 择最便宜；
4. ``diagnose_failing_interaction``：无效交互 → 先查 blocker，禁重复/禁降级；
5. ``guard_history_call``：history() 须边界 + 焦点 + 批准，禁投机。

与既有层关系
--------------
- ``interaction_tier``：判定升级到哪层；本模块管 REPL 执行内部纪律（声明/刷新/校验选路）；
- ``confirmation_policy``：动作前确认；本模块管执行中纪律（重声明、重复 goto）；
- ``proof_of_work``：改状态后截图内嵌；本模块管改状态**前**的校验选路。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum

# ── REPL 声明纪律 ──────────────────────────────────────────────────────────


class DeclarationAction(StrEnum):
    """REPL 声明/赋值动作分类。"""

    CONST_HANDLE = "const_handle"  # const 稳定句柄（允许）
    LET_REASSIGN = "let_reassign"  # let 重赋值（允许，勿重声明）
    REDECLARE = "redeclare"  # 重声明（违规：句柄失效）
    GLOBALTHIS = "globalthis"  # 挂 globalThis（违规）
    REACQUIRE = "reacquire"  # reacquire 句柄（违规，除非失效）


@dataclass(frozen=True)
class ReplDeclarationCheck:
    """一次 REPL 声明/赋值的纪律判定。"""

    action: str  # ``DeclarationAction`` 之一
    allowed: bool
    handle_name: str | None
    detail: str


# 检测 globalThis 赋值（点号访问 / 括号访问 均拦）
_GLOBALTHIS_RE = re.compile(
    r"\bglobalThis\s*(?:\[\s*['\"]?([\w$]+)['\"]?\s*\]|\.([\w$]+))", re.IGNORECASE
)
# 检测 const/let/var 声明
_DECL_RE = re.compile(r"\b(const|let|var)\s+([\w$]+)\s*=")
# 检测裸重赋值（let 变量）
_REASSIGN_RE = re.compile(r"^\s*([\w$]+)\s*=\s*[^=]")


def validate_repl_declaration(
    statement: str,
    *,
    known_let_vars: set[str] | None = None,
) -> ReplDeclarationCheck:
    """判定一条 REPL 声明/赋值语句是否符合状态纪律（纯函数）。

    Codex §4.3："const 稳定句柄 / let 变值, 重赋值而非重声明; 禁 globalThis、
    禁 reacquire 句柄除非失效。"

    参数 known_let_vars：此前 let 声明过的变量名集合；若裸重赋值命中，
    视为 let_reassign；若 const 重声明同名 const，视为 redeclare。
    """
    stmt = (statement or "").strip()
    known = known_let_vars or set()

    # 1) globalThis 挂载 → 违规
    m = _GLOBALTHIS_RE.search(stmt)
    if m:
        return ReplDeclarationCheck(
            action=DeclarationAction.GLOBALTHIS.value,
            allowed=False,
            handle_name=m.group(1),
            detail="禁 globalThis 挂载句柄：会污染全局、跨回合漂移。用 const/let 局部绑定。",
        )

    # 2) const/let/var 显式声明
    m = _DECL_RE.search(stmt)
    if m:
        kind, name = m.group(1), m.group(2)
        if kind == "const":
            return ReplDeclarationCheck(
                action=DeclarationAction.CONST_HANDLE.value,
                allowed=True,
                handle_name=name,
                detail=f"const {name}: 稳定句柄（允许），保持不变引用、不重声明。",
            )
        # let / var
        if name in known:
            return ReplDeclarationCheck(
                action=DeclarationAction.REDECLARE.value,
                allowed=False,
                handle_name=name,
                detail=f"{name} 已声明过：重赋值即可，勿重声明（会使句柄失效）。",
            )
        return ReplDeclarationCheck(
            action=DeclarationAction.LET_REASSIGN.value,
            allowed=True,
            handle_name=name,
            detail=f"let {name}: 可变值（允许）；后续重赋值、勿重声明。",
        )

    # 3) 裸重赋值
    m = _REASSIGN_RE.match(stmt)
    if m:
        name = m.group(1)
        return ReplDeclarationCheck(
            action=DeclarationAction.LET_REASSIGN.value,
            allowed=True,
            handle_name=name,
            detail=f"{name} = ...: let 重赋值（允许）。",
        )

    # 4) 其他语句（表达式/调用等）不拦
    return ReplDeclarationCheck(
        action=DeclarationAction.LET_REASSIGN.value,
        allowed=True,
        handle_name=None,
        detail="非声明语句，不涉状态纪律。",
    )


# ── 刷新路径守卫 ───────────────────────────────────────────────────────────


@dataclass(frozen=True)
class TabRefreshDecision:
    """goto/reload 择路判定。"""

    should_goto: bool  # 是否允许 goto
    should_reload: bool  # 是否应改用 tab.reload()
    detail: str


def check_tab_refresh_path(
    *,
    already_at_target_url: bool,
    has_unsaved_user_input: bool = False,
) -> TabRefreshDecision:
    """已在目标 URL 的 tab 禁重复 goto → 用 reload（防丢用户在填的内容）。

    Codex §4.3："已在目标 URL 的 tab 不要重复 goto (会 reload 丢用户在填的内容),
    要刷新用 tab.reload()。"
    """
    if already_at_target_url:
        if has_unsaved_user_input:
            return TabRefreshDecision(
                should_goto=False,
                should_reload=True,
                detail="已在目标 URL 且有未保存用户输入：重复 goto 会 reload 丢内容，用 tab.reload()。",
            )
        return TabRefreshDecision(
            should_goto=False,
            should_reload=True,
            detail="已在目标 URL：重复 goto 无效且多余，用 tab.reload()。",
        )
    return TabRefreshDecision(
        should_goto=True,
        should_reload=False,
        detail="不在目标 URL：goto 是正确路径。",
    )


# ── 状态校验选路 ───────────────────────────────────────────────────────────


class VerificationMode(StrEnum):
    """状态校验模式（择最便宜）。"""

    DOM_SNAPSHOT = "dom_snapshot"  # 要 DOM 真值
    SCREENSHOT = "screenshot"  # 要视觉确认
    BOTH = "both"  # 默认禁（两个都要）


@dataclass(frozen=True)
class VerificationChoice:
    """校验模式择路判定。"""

    mode: str  # ``VerificationMode`` 之一
    should_dom_snapshot: bool
    should_screenshot: bool
    detail: str


def choose_state_verification(
    *,
    need_dom_truth: bool,
    need_visual_confirmation: bool,
    state_changing_action_done: bool = False,
) -> VerificationChoice:
    """择最便宜的状态校验路径（默认不要两个都要）。

    Codex §4.3："要 DOM 真值用 DOM snapshot, 要视觉确认用截图, 默认不要两个都要。"
    改状态动作完成后（proof-of-work 场景）允许 both：须内嵌截图交付。
    """
    if state_changing_action_done:
        return VerificationChoice(
            mode=VerificationMode.BOTH.value,
            should_dom_snapshot=True,
            should_screenshot=True,
            detail="改状态动作完成（proof-of-work 场景）：DOM 校验 + 截图内嵌交付，均须。",
        )
    if need_dom_truth and need_visual_confirmation:
        return VerificationChoice(
            mode=VerificationMode.DOM_SNAPSHOT.value,
            should_dom_snapshot=True,
            should_screenshot=False,
            detail="默认择一：DOM snapshot 优先（更便宜、能拿真值）；视觉确认有明确需要才补截图。",
        )
    if need_dom_truth:
        return VerificationChoice(
            mode=VerificationMode.DOM_SNAPSHOT.value,
            should_dom_snapshot=True,
            should_screenshot=False,
            detail="要 DOM 真值：用 DOM snapshot。",
        )
    if need_visual_confirmation:
        return VerificationChoice(
            mode=VerificationMode.SCREENSHOT.value,
            should_dom_snapshot=False,
            should_screenshot=True,
            detail="要视觉确认：用截图。",
        )
    return VerificationChoice(
        mode=VerificationMode.DOM_SNAPSHOT.value,
        should_dom_snapshot=True,
        should_screenshot=False,
        detail="默认取最便宜：DOM snapshot。",
    )


# ── 交互无效的升级路径 ─────────────────────────────────────────────────────


class FailedInteractionAction(StrEnum):
    """交互无效时的正确动作。"""

    INVESTIGATE_BLOCKER = "investigate_blocker"  # 先查可见状态有无 blocker
    RETRY_SAME = "retry_same"  # 盲目重复（违规）
    DOWNGRADE_TO_COORDS = "downgrade_to_coords"  # 立刻降级坐标（违规）
    ESCALATE_TO_COORDS = "escalate_to_coords"  # 查过 blocker 后才升级（允许）


@dataclass(frozen=True)
class FailedInteractionDecision:
    """无效交互处置判定。"""

    action: str  # ``FailedInteractionAction`` 之一
    allowed: bool
    detail: str


def diagnose_failing_interaction(
    *,
    attempts: int,
    blocker_investigated: bool = False,
) -> FailedInteractionDecision:
    """交互无效时按纪律升级（先查 blocker，禁盲目重复、禁立刻降级坐标）。

    Codex §4.3："交互无效时不要盲目重复也不要立刻降级到坐标点击;
    先查可见状态有无 blocker。"
    """
    if not blocker_investigated:
        if attempts == 1:
            return FailedInteractionDecision(
                action=FailedInteractionAction.INVESTIGATE_BLOCKER.value,
                allowed=True,
                detail="首次无效：先取可见状态查有无 blocker（覆盖层/弹窗/禁用态/动画）。",
            )
        return FailedInteractionDecision(
            action=FailedInteractionAction.INVESTIGATE_BLOCKER.value,
            allowed=False,
            detail=f"已无效 {attempts} 次仍未查 blocker：不要盲目重复，先查可见状态。",
        )
    # 已查过 blocker 仍未解决 → 可升级坐标
    return FailedInteractionDecision(
        action=FailedInteractionAction.ESCALATE_TO_COORDS.value,
        allowed=True,
        detail="已查 blocker 未解：可升级到坐标点击（有据升级，非盲目降级）。",
    )


# ── history 投机调用守卫 ───────────────────────────────────────────────────


@dataclass(frozen=True)
class HistoryCallDecision:
    """browser.history() 调用守卫判定。"""

    should_proceed: bool
    blockers: list[str]
    detail: str


def guard_history_call(
    *,
    has_date_bounds: bool,
    has_focused_query: bool,
    user_approved: bool,
) -> HistoryCallDecision:
    """history() 须日期边界 + 焦点查询 + 用户批准，禁投机调用。

    Codex §4.3："browser.history() 可能要用户批准, 绝不投机调用;
    要用就一次聚焦调用带日期边界。"
    """
    blockers: list[str] = []
    if not has_date_bounds:
        blockers.append("缺日期边界")
    if not has_focused_query:
        blockers.append("缺聚焦查询（勿迭代猜 URL 变体）")
    if not user_approved:
        blockers.append("缺用户批准（history 可能要批准）")
    if blockers:
        return HistoryCallDecision(
            should_proceed=False,
            blockers=blockers,
            detail="不投机调用 history()：" + "；".join(blockers) + "。",
        )
    return HistoryCallDecision(
        should_proceed=True,
        blockers=[],
        detail="有日期边界 + 聚焦查询 + 用户批准：可一次聚焦调用 history()。",
    )


__all__ = [
    "DeclarationAction",
    "ReplDeclarationCheck",
    "validate_repl_declaration",
    "TabRefreshDecision",
    "check_tab_refresh_path",
    "VerificationMode",
    "VerificationChoice",
    "choose_state_verification",
    "FailedInteractionAction",
    "FailedInteractionDecision",
    "diagnose_failing_interaction",
    "HistoryCallDecision",
    "guard_history_call",
]
