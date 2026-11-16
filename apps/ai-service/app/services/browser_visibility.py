# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器可见性能力 — 复现 Codex 26.1111 browser.capabilities.visibility。

取证来源
--------
``.ihui-agent/tmp/goal-codex-r11/cua-browser-capability-spec.md`` §3(browser 级
visibility)::

    visibility: get() / set(bool) — 控制浏览器是否对用户可见
    (默认后台跑, 用户要看才 set(true))。

Codex 语义:浏览器 agent 默认**后台运行**(headless / 不打扰用户),只有当
用户需要"看着 agent 操作"或交付需要 proof-of-work 截图内嵌时,才显式
``set(true)`` 把浏览器带到前台。这是一个**有状态的能力开关**,不是一次性参数:
- ``get()``:读当前可见性状态;
- ``set(bool)``:切可见性,返回切换结果;
- 默认值 = 不可见(后台),与 Codex "默认后台跑" 对齐。

对照 IHUI 缺口
--------------
``browser_hub`` 有 headless 启动参数,但**可见性是一等能力开关**这件事没有
独立语义:没有"当前是否可见"的运行时读数、没有"切可见性须有据(用户要看 /
proof-of-work)"的准入闸、没有"后台→前台"的切换账。本模块补齐这三点。

设计要点(纯函数状态机,零 IO)
------------------------------
1. ``VisibilityState``:不可见(默认)/ 可见 两态;
2. ``BrowserVisibility``:线程安全的状态机,持当前态;``get`` 读、``set`` 切;
3. ``set`` 带 **准入理由**:切到可见须有依据(用户要看 / proof-of-work 交付),
   无据即拒(防 agent 随意把浏览器弹到前台打断用户);
4. 切换留 **审计线索**(before/after + reason),与 ``browser_audit_trail`` 同范式。

与既有层关系
------------
- ``browser_hub``:启动参数 headless 决定初始态;本模块管运行时的可见性读写;
- ``browser_proof_of_work``:改状态后须截图内嵌 → 那一刻须 ``set(True)``;
- 不真操作窗口(零 IO),只管状态机与准入判据,真带到前台由调用方执行。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from threading import RLock


class VisibilityReason(StrEnum):
    """切可见性的准入理由(切到可见须有据)。"""

    USER_REQUESTED = "user_requested"  # 用户明确要看 agent 操作
    PROOF_OF_WORK = "proof_of_work"  # 改状态后须截图内嵌交付
    BACKGROUND = "background"  # 切回后台(默认,无需理由)


class VisibilityError(ValueError):
    """可见性切换被拒(无据切到可见 / 非法状态)。"""


@dataclass(frozen=True)
class VisibilityChange:
    """一次可见性切换的结果(含审计线索)。"""

    before: bool
    after: bool
    reason: str
    changed: bool
    detail: str


class BrowserVisibility:
    """浏览器可见性状态机(线程安全,默认不可见=后台)。

    用法::

        vis = BrowserVisibility()
        vis.get()                       # False(默认后台)
        vis.set(True, reason=VisibilityReason.USER_REQUESTED)  # 带据切前台
        vis.set(True)                   # VisibilityError: 切可见无据即拒
        vis.set(False)                  # 切回后台(无需理由)
    """

    def __init__(self, *, initially_visible: bool = False) -> None:
        self._lock = RLock()
        self._visible = bool(initially_visible)
        self._history: list[VisibilityChange] = []

    def get(self) -> bool:
        """读当前可见性(纯读,加锁)。"""
        with self._lock:
            return self._visible

    def set(self, visible: bool, *, reason: VisibilityReason | str | None = None) -> VisibilityChange:
        """切可见性(纯状态机,不真操作窗口)。

        - 切到**可见**须带准入理由(user_requested / proof_of_work);无据即拒
          (防 agent 随意把浏览器弹到前台打断用户)。
        - 切到**不可见**(后台)无需理由 —— 这是默认态、不打扰用户。
        - 状态未变(重复 set 同值)不算切换,直接返回 changed=False。
        """
        if not isinstance(visible, bool):
            raise VisibilityError(f"visible 须布尔,得到 {visible!r}")
        with self._lock:
            before = self._visible
            if visible == before:
                change = VisibilityChange(
                    before=before,
                    after=visible,
                    reason=_reason_str(reason) if reason else VisibilityReason.BACKGROUND.value,
                    changed=False,
                    detail=f"可见性已是 {visible},无变化。",
                )
                return change
            if visible and not _has_show_reason(reason):
                raise VisibilityError(
                    "切到可见须带准入理由(user_requested / proof_of_work):"
                    "默认后台运行,无据弹到前台会打断用户。"
                )
            self._visible = visible
            rsn = _reason_str(reason) if reason else (
                VisibilityReason.BACKGROUND.value if not visible else ""
            )
            change = VisibilityChange(
                before=before,
                after=visible,
                reason=rsn,
                changed=True,
                detail=(
                    f"浏览器可见性 {before} → {visible}"
                    + (f"(理由:{rsn})" if rsn else "")
                    + "。"
                ),
            )
            self._history.append(change)
            return change

    def history(self) -> tuple[VisibilityChange, ...]:
        """返回切换账(newest last,与 audit_trail 的 newest-first 相反,此处按发生序)。"""
        with self._lock:
            return tuple(self._history)

    def reset(self) -> None:
        """重置为默认后台态(测试/新会话用)。"""
        with self._lock:
            self._visible = False
            self._history.clear()


def _reason_str(reason: VisibilityReason | str | None) -> str:
    return reason.value if isinstance(reason, VisibilityReason) else (reason or "")


def _has_show_reason(reason: VisibilityReason | str | None) -> bool:
    """切到可见是否带合法准入理由。"""
    if reason is None:
        return False
    rsn = _reason_str(reason)
    return rsn in (VisibilityReason.USER_REQUESTED.value, VisibilityReason.PROOF_OF_WORK.value)


__all__ = [
    "VisibilityReason",
    "VisibilityError",
    "VisibilityChange",
    "BrowserVisibility",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
