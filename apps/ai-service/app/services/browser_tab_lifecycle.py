# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器 Tab 生命周期与所有权协议 — 复现 Codex 26.1111 tab lifecycle。

取证来源
--------
``.ihui-agent/tmp/goal-codex-r11/cua-browser-safety-and-tab-lifecycle.md``
§C(Tab 生命周期)/ §D(Tab Claiming)/ §B(Visibility),明文逐字直读::

    "Agent 建的 tab 是临时的,turn 结束自动关闭,除非标记。"
    tab.markDeliverable():live tab 本身是面向用户的输出/要求保持打开的页
      (创建/编辑的文档、表格、幻灯、仪表盘、checkout、已提交表单结果)。
    tab.markHandoff():仅当后续 turn 须从该 live 页继续(等用户输入、登录、
      批准、支付、CAPTCHA、未完成工作流)。
    "标记是 turn 作用域的,最新标记胜出。下一 turn 恢复会话时,之前的 handoff
      标记被清除,须重新标记须存活的 tab。"
    "一个 tab 同一时间只能被一个 browser session 控制;claim 失败(他会话控制)
      就换 tab 或新建。"
    "已 claim 但未标记的用户 tab 会被释放出 browser-session 控制、保持打开。"

对照 IHUI 缺口
--------------
- ``browser_hub`` 有 tab 会话,但**无 markDeliverable/markHandoff/ephemeral
  默认 + turn 作用域标记 + 单会话独占 claim** 的生命周期协议 ⇒ 多 turn 浏览器
  任务(登录→续操作)的页面存活无法表达,turn 结束要么全关要么全留。

设计要点(纯函数状态机,零 IO)
------------------------------
1. **三态 tab 归属** ``TabOwnership``:agent_created(ephemeral)/ claimed_user /
   user_unclaimed;
2. **两型存活标记** ``TabMark``:deliverable(面向用户输出,须保持打开)/
   handoff(下 turn 须续);标记 turn 作用域,最新胜出;
3. **turn 收尾清理** ``settle_turn``:agent_created 未标记 → 关;
   deliverable → 留;handoff → 本 turn 末暂留,下 turn 开头清除标记须重新标记;
   claimed_user 未标记 → 释放出会话控制但保持打开;
4. **单会话独占 claim** ``claim_tab``:被他会话控制即 claim 失败(不抢,换 tab)。

与既有层的关系
--------------
- 只做"tab 归属/标记/收尾清理/claim"纯状态机,不开真浏览器、不真关进程(那是
  ``browser_hub``);调用方据 ``settle_turn`` 返回的处置决定实际关闭/保留;
- 与 ``browser_audit_trail``(改动账)、``browser_proof_of_work``(交付闸)互补。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from threading import RLock


class TabOwnership(StrEnum):
    """tab 归属(Codex:agent 建的临时 / 已 claim 用户 / 未 claim 用户)。"""

    AGENT_CREATED = "agent_created"  # agent 新建,ephemeral 默认
    CLAIMED_USER = "claimed_user"  # 已 claim 的用户 tab
    USER_UNCLAIMED = "user_unclaimed"  # 列出但未 claim 的用户 tab


class TabMark(StrEnum):
    """存活标记(Codex markDeliverable / markHandoff)。"""

    DELIVERABLE = "deliverable"  # 面向用户输出,须保持打开
    HANDOFF = "handoff"  # 下 turn 须从该 live 页继续


MARKS: tuple[str, ...] = tuple(m.value for m in TabMark)


class TabDisposition(StrEnum):
    """turn 收尾时一个 tab 的处置(Codex 生命周期语义)。"""

    CLOSE = "close"  # 关闭(ephemeral 未标记)
    KEEP_OPEN = "keep_open"  # 保持打开(deliverable / 未标记用户 tab)
    RELEASE_AND_KEEP = "release_and_keep"  # 释放出会话控制但保持打开
    KEEP_PENDING_REMARK = "keep_pending_remark"  # 暂留,下 turn 须重新标记


@dataclass
class TabState:
    """单个 tab 的生命周期状态(可变,由协议推进)。"""

    tab_id: str
    ownership: TabOwnership
    controlling_session: str | None = None  # 控制它的会话 id(独占)
    mark: TabMark | None = None  # 当前存活标记(turn 作用域)
    mark_turn: int | None = None  # 打标记的 turn 号
    opened_turn: int = 0  # 打开/创建时的 turn 号

    def to_dict(self) -> dict[str, object]:
        return {
            "tab_id": self.tab_id,
            "ownership": self.ownership.value,
            "controlling_session": self.controlling_session,
            "mark": self.mark.value if self.mark else None,
            "mark_turn": self.mark_turn,
            "opened_turn": self.opened_turn,
        }


@dataclass(frozen=True)
class SettleOutcome:
    """turn 收尾对单个 tab 的处置结果。"""

    tab_id: str
    disposition: TabDisposition
    cleared_mark: bool  # 是否清除了旧 handoff 标记
    detail: str


@dataclass(frozen=True)
class ClaimOutcome:
    """claim 一个用户 tab 的结果(单会话独占)。"""

    ok: bool
    tab_id: str
    controlling_session: str | None
    detail: str


class BrowserTabLifecycle:
    """浏览器 tab 生命周期与所有权协议(线程安全纯状态机)。

    用法::

        lc = BrowserTabLifecycle()
        lc.create_tab("t1", turn=1)                       # agent 建临时 tab
        lc.mark_tab("t1", TabMark.HANDOFF, turn=1)         # 下 turn 须续
        outcomes = lc.settle_turn(turn=1)                  # 收尾:handoff 暂留
        lc.begin_turn(turn=2)                              # 开新 turn:清旧 handoff
        lc.mark_tab("t1", TabMark.HANDOFF, turn=2)         # 须重新标记
    """

    def __init__(self) -> None:
        self._lock = RLock()
        self._tabs: dict[str, TabState] = {}

    # ── tab 创建 / claim ────────────────────────────────────────────────

    def create_tab(self, tab_id: str, *, turn: int) -> TabState:
        """agent 新建 tab(ephemeral 默认,归属本会话)。"""
        with self._lock:
            state = TabState(
                tab_id=tab_id,
                ownership=TabOwnership.AGENT_CREATED,
                controlling_session="self",
                opened_turn=turn,
            )
            self._tabs[tab_id] = state
            return state

    def register_user_tab(self, tab_id: str, *, controlling_session: str | None) -> TabState:
        """登记一个用户 tab;``controlling_session`` 为 None = 未 claim。"""
        with self._lock:
            state = TabState(
                tab_id=tab_id,
                ownership=(
                    TabOwnership.CLAIMED_USER
                    if controlling_session
                    else TabOwnership.USER_UNCLAIMED
                ),
                controlling_session=controlling_session,
            )
            self._tabs[tab_id] = state
            return state

    def claim_tab(self, tab_id: str, *, session_id: str) -> ClaimOutcome:
        """claim 一个用户 tab;被他会话控制即失败(不抢,换 tab)。"""
        with self._lock:
            state = self._tabs.get(tab_id)
            if state is None:
                return ClaimOutcome(False, tab_id, None, f"tab {tab_id!r} 不存在。")
            if state.controlling_session and state.controlling_session != session_id:
                return ClaimOutcome(
                    False,
                    tab_id,
                    state.controlling_session,
                    f"tab {tab_id!r} 已被会话 {state.controlling_session!r} 控制,"
                    "单会话独占:换 tab 或新建,不抢。",
                )
            state.ownership = TabOwnership.CLAIMED_USER
            state.controlling_session = session_id
            return ClaimOutcome(True, tab_id, session_id, "claim 成功。")

    # ── 存活标记(turn 作用域,最新胜出) ─────────────────────────────────

    def mark_tab(self, tab_id: str, mark: TabMark, *, turn: int) -> bool:
        """打存活标记;最新标记胜出。tab 不存在返回 False。"""
        with self._lock:
            state = self._tabs.get(tab_id)
            if state is None:
                return False
            state.mark = mark
            state.mark_turn = turn
            return True

    # ── turn 收尾 / 开新 turn ───────────────────────────────────────────

    def settle_turn(self, *, turn: int) -> list[SettleOutcome]:
        """turn 收尾:按 Codex 生命周期决定每个 tab 的处置(不真关,返回处置)。"""
        outcomes: list[SettleOutcome] = []
        with self._lock:
            for state in self._tabs.values():
                outcomes.append(self._settle_one(state, turn=turn))
        return outcomes

    def begin_turn(self, *, turn: int) -> list[str]:
        """开新 turn:清除所有**旧 handoff 标记**(须重新标记才能续存活)。

        Codex:"下一 turn 恢复会话时,之前的 handoff 标记被清除"。返回被清标记的
        tab id 列表。deliverable 标记不在此清除(它面向用户输出,跨 turn 留)。
        """
        cleared: list[str] = []
        with self._lock:
            for state in self._tabs.values():
                if state.mark is TabMark.HANDOFF and state.mark_turn is not None and state.mark_turn < turn:
                    state.mark = None
                    state.mark_turn = None
                    cleared.append(state.tab_id)
        return cleared

    def _settle_one(self, state: TabState, *, turn: int) -> SettleOutcome:
        if state.ownership is TabOwnership.AGENT_CREATED:
            if state.mark is TabMark.DELIVERABLE:
                return SettleOutcome(
                    state.tab_id,
                    TabDisposition.KEEP_OPEN,
                    False,
                    "agent 建的 deliverable tab:面向用户输出,保持打开。",
                )
            if state.mark is TabMark.HANDOFF:
                return SettleOutcome(
                    state.tab_id,
                    TabDisposition.KEEP_PENDING_REMARK,
                    False,
                    "agent 建的 handoff tab:本 turn 末暂留,下 turn 须重新标记。",
                )
            return SettleOutcome(
                state.tab_id,
                TabDisposition.CLOSE,
                False,
                "agent 建的临时 tab 未标记:turn 结束自动关闭(ephemeral 默认)。",
            )
        # 用户 tab:已 claim 未标记 → 释放出会话控制但保持打开
        if state.ownership is TabOwnership.CLAIMED_USER and state.mark is None:
            return SettleOutcome(
                state.tab_id,
                TabDisposition.RELEASE_AND_KEEP,
                False,
                "已 claim 未标记的用户 tab:释放出会话控制,保持打开。",
            )
        # 未 claim 用户 tab / 已标记用户 tab → 保持打开
        return SettleOutcome(
            state.tab_id,
            TabDisposition.KEEP_OPEN,
            False,
            "用户 tab:保持打开(不在本会话可关范围)。",
        )

    def get_tab(self, tab_id: str) -> TabState | None:
        with self._lock:
            return self._tabs.get(tab_id)

    def list_tabs(self) -> list[TabState]:
        with self._lock:
            return list(self._tabs.values())


# ── 可见性默认后台判定(Codex §B Visibility) ─────────────────────────────────


class VisibilityIntent(StrEnum):
    """用户意图分类(Codex:默认后台,仅"展示给用户"才前台)。"""

    SHOW_TO_USER = "show_to_user"  # 为其打开 URL / 展示当前 tab / 测试时保持可见
    ANSWER_QUESTION = "answer_question"  # 导航只是回答问题/验证行为(不须可见)
    BACKGROUND_TASK = "background_task"  # 后台跑(默认)


@dataclass(frozen=True)
class VisibilityDecision:
    """可见性判定(默认后台,仅展示意图才前台)。"""

    should_be_visible: bool
    intent: str
    detail: str


def decide_visibility(intent: str) -> VisibilityDecision:
    """浏览器可见性判定:默认后台,仅"展示给用户"意图才前台(Codex §B)。

    Codex:"导航只是回答问题/验证行为的手段时不显示;localhost 目标与普通页面
    导航本身不需要可见。"仅当用户请求本质是"把页面摆到面前/让用户看交互"才显示。
    """
    key = (intent or "").strip().lower()
    if key == VisibilityIntent.SHOW_TO_USER.value:
        return VisibilityDecision(
            should_be_visible=True,
            intent=VisibilityIntent.SHOW_TO_USER.value,
            detail="用户请求本质是展示页面/看交互,设为可见。",
        )
    if key in (VisibilityIntent.ANSWER_QUESTION.value, VisibilityIntent.BACKGROUND_TASK.value):
        return VisibilityDecision(
            should_be_visible=False,
            intent=key,
            detail="导航只是回答问题/验证行为/后台任务,保持后台(省资源防误触)。",
        )
    # 未命中:默认后台(失效方向是少打扰用户,不是误弹窗)
    return VisibilityDecision(
        should_be_visible=False,
        intent=key or "unknown",
        detail=f"意图 {intent!r} 未明确要求展示,默认后台(Codex:默认后台跑浏览器)。",
    )


__all__ = [
    "TabOwnership",
    "TabMark",
    "MARKS",
    "TabDisposition",
    "TabState",
    "SettleOutcome",
    "ClaimOutcome",
    "BrowserTabLifecycle",
    "VisibilityIntent",
    "VisibilityDecision",
    "decide_visibility",
]
