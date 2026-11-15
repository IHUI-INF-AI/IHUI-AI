# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器交互原语参数边界 + 对话框语义 — 复现 Codex 26.1111 CUA(2026-11-15 取证)。

取证来源
--------
``.ihui-agent/tmp/goal-codex-r11/cua-api-types-truth-source.md`` §3(三级交互原语,
明文 TS 逐字直读)+ §6 复现清单第 4/5 条。**行为/设计对照复现**,不粘专有源码。

对照 IHUI 缺口
--------------
``browser_replay`` 坐标 click 用 ``mouse.click(x, y)``,**不支持**:
- 鼠标按钮枚举(1-left/2-middle/3-right/**4-back/5-forward** 侧键);
- duration(0–30s,**长按/拖拽语义**);
- keypress(点击时按住的修饰键 / 整序列组合键);
- 拖拽 = **点列路径**(支持曲线/复杂拖拽),非起止两点;
- 对话框一等 API(Alert/Confirm/Prompt/BeforeUnload)—— 全仓 grep 零命中。

本模块给这些参数边界做**纯函数校验 + 归一 + 语义映射**,供回放执行器在
调 Playwright 前先校一次(越界即拒,不静默夹紧),并把 Codex 侧键枚举
映射到 Playwright ``mouse.click(button=...)`` 的 ``"left"/"middle"/"right"``。

与既有层关系
------------
不改 ``browser_replay`` 现有执行路径(零回归),只新增参数校验判据,供
调用方在分派 click/drag/keypress 前调用。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# ── 鼠标按钮枚举(Codex 1-5,含侧键 4-back / 5-forward) ─────────────────────

MOUSE_BUTTONS: dict[int, str] = {
    1: "left",
    2: "middle",
    3: "right",
    4: "back",
    5: "forward",
}

# Playwright mouse.click 只认 left/middle/right;back/forward 由上层映射到
# browser back/forward 导航(非 mouse button 参数)。
_PLAYWRIGHT_MOUSE_BUTTONS: frozenset[str] = frozenset({"left", "middle", "right"})

# ── 时长边界(Codex duration 0–30s) ────────────────────────────────────────

DURATION_MIN_S = 0.0
DURATION_MAX_S = 30.0


@dataclass(frozen=True)
class ClickParams:
    """归一后的点击参数(校验通过的形态)。"""

    x: int
    y: int
    button: str  # left/middle/right(已映射;back/forward 在 is_navigation_button)
    duration_s: float  # 按住秒数(0 = 普通点击,>0 = 长按)
    keypress: tuple[str, ...]  # 点击时按住的修饰键(如 ("shift","a"))


@dataclass(frozen=True)
class DragParams:
    """归一后的拖拽参数:点列路径(非起止两点)。"""

    path: tuple[tuple[int, int], ...]  # 至少 2 个点;支持曲线
    button: str
    keys: tuple[str, ...]  # 拖拽全程按住的键


class InteractionParamError(ValueError):
    """交互参数越界(越界即拒,不静默夹紧)。"""


def is_navigation_mouse_button(button: int | str) -> bool:
    """是否为导航侧键(back/forward)—— 需映射到 browser 导航而非 mouse.click。"""
    if isinstance(button, str):
        return button in ("back", "forward")
    return button in (4, 5)


def normalize_click_params(raw: dict[str, Any]) -> ClickParams:
    """把 Codex ClickOptions 归一为校验通过的 ClickParams(纯函数)。

    越界(按钮非 1-5、duration 负/超 30s、缺 x/y、非整数坐标)即抛
    ``InteractionParamError``,不静默夹紧(Codex 语义:边界是契约)。
    """
    x_raw, y_raw = raw.get("x"), raw.get("y")
    if not isinstance(x_raw, (int, float)) or not isinstance(y_raw, (int, float)):
        raise InteractionParamError("click 需要数值 x,y 坐标")
    if isinstance(x_raw, float) and not x_raw.is_integer():
        raise InteractionParamError(f"click x 须整数坐标,得到 {x_raw}")
    if isinstance(y_raw, float) and not y_raw.is_integer():
        raise InteractionParamError(f"click y 须整数坐标,得到 {y_raw}")
    x, y = int(x_raw), int(y_raw)

    button_raw = raw.get("button", 1)
    if not isinstance(button_raw, int) or button_raw not in MOUSE_BUTTONS:
        raise InteractionParamError(
            f"button 须 1-5(1=left,2=middle,3=right,4=back,5=forward),得到 {button_raw!r}"
        )
    button = MOUSE_BUTTONS[button_raw]

    duration_raw = raw.get("duration", 0)
    if not isinstance(duration_raw, (int, float)) or isinstance(duration_raw, bool):
        raise InteractionParamError(f"duration 须数值秒数,得到 {duration_raw!r}")
    duration_s = float(duration_raw)
    if duration_s < DURATION_MIN_S or duration_s > DURATION_MAX_S:
        raise InteractionParamError(
            f"duration 须在 [{DURATION_MIN_S},{DURATION_MAX_S}] 秒(长按语义),得到 {duration_s}"
        )

    keypress = _coerce_keypress(raw.get("keypress"))
    return ClickParams(x=x, y=y, button=button, duration_s=duration_s, keypress=keypress)


def normalize_drag_params(raw: dict[str, Any]) -> DragParams:
    """把 Codex DragOptions 归一为点列路径(纯函数)。

    path 至少 2 点;每点须 {x,y};越界按钮同 click 规则。
    """
    path_raw = raw.get("path")
    if not isinstance(path_raw, (list, tuple)) or len(path_raw) < 2:
        raise InteractionParamError("drag path 须至少 2 个点(点列路径,非起止两点)")
    points: list[tuple[int, int]] = []
    for i, pt in enumerate(path_raw):
        if not isinstance(pt, dict):
            raise InteractionParamError(f"drag path[{i}] 须 {{x,y}} 对象")
        px, py = pt.get("x"), pt.get("y")
        if not isinstance(px, (int, float)) or not isinstance(py, (int, float)):
            raise InteractionParamError(f"drag path[{i}] 缺数值 x,y")
        points.append((int(px), int(py)))
    button = MOUSE_BUTTONS.get(raw.get("button", 1), "left")
    keys = _coerce_keypress(raw.get("keys"))
    return DragParams(path=tuple(points), button=button, keys=keys)


def _coerce_keypress(raw: Any) -> tuple[str, ...]:
    """keypress 归一为字符串元组(容忍 list / 单串 / None)。"""
    if raw is None:
        return ()
    if isinstance(raw, str):
        return (raw,) if raw.strip() else ()
    if isinstance(raw, (list, tuple)):
        out: list[str] = []
        for item in raw:
            if isinstance(item, str) and item.strip():
                out.append(item.strip())
        return tuple(out)
    return ()


# ── 对话框一等 API(Codex §6 复现清单第 5 条) ───────────────────────────────

DIALOG_ALERT = "alert"
DIALOG_CONFIRM = "confirm"
DIALOG_PROMPT = "prompt"
DIALOG_BEFORE_UNLOAD = "beforeunload"

DIALOG_TYPES: tuple[str, ...] = (
    DIALOG_ALERT,
    DIALOG_CONFIRM,
    DIALOG_PROMPT,
    DIALOG_BEFORE_UNLOAD,
)

# 各对话框类型的语义:是否可 dismiss / 是否有可输入文本字段
_DIALOG_SEMANTICS: dict[str, dict[str, bool]] = {
    DIALOG_ALERT: {"can_accept": False, "has_prompt_text": False},  # 只有 OK,无输入
    DIALOG_CONFIRM: {"can_accept": True, "has_prompt_text": False},  # OK / Cancel
    DIALOG_PROMPT: {"can_accept": True, "has_prompt_text": True},  # OK / Cancel + 输入
    DIALOG_BEFORE_UNLOAD: {"can_accept": True, "has_prompt_text": False},  # 离开 / 留下
}


@dataclass(frozen=True)
class DialogDisposition:
    """对话框处置结果(accept / dismiss + 可选输入文本)。"""

    dialog_type: str
    accepted: bool  # accept=True(OK/离开);False=dismiss(Cancel/留下)
    prompt_text: str | None = None  # 仅 prompt 类型有输入字段


def validate_dialog_disposition(dialog_type: str, *, accepted: bool, prompt_text: str | None = None) -> DialogDisposition:
    """校验对话框处置是否符合该类型的语义(纯函数)。

    - alert 不可 accept-with-text、无 Cancel ⇒ accepted 必须由调用方给
      (alert 只能 OK,这里 accepted 传 True 表示点 OK);
    - 非 prompt 类型不接受 prompt_text;
    - 未知类型即拒。
    """
    if dialog_type not in _DIALOG_SEMANTICS:
        raise InteractionParamError(
            f"未知对话框类型 {dialog_type!r},合法:{', '.join(DIALOG_TYPES)}"
        )
    semantics = _DIALOG_SEMANTICS[dialog_type]
    if prompt_text is not None and not semantics["has_prompt_text"]:
        raise InteractionParamError(f"{dialog_type} 对话框没有输入字段,不接受 prompt_text")
    return DialogDisposition(dialog_type=dialog_type, accepted=accepted, prompt_text=prompt_text)


__all__ = [
    "MOUSE_BUTTONS",
    "DURATION_MIN_S",
    "DURATION_MAX_S",
    "DIALOG_TYPES",
    "DIALOG_ALERT",
    "DIALOG_CONFIRM",
    "DIALOG_PROMPT",
    "DIALOG_BEFORE_UNLOAD",
    "ClickParams",
    "DragParams",
    "DialogDisposition",
    "InteractionParamError",
    "is_navigation_mouse_button",
    "normalize_click_params",
    "normalize_drag_params",
    "validate_dialog_disposition",
]
