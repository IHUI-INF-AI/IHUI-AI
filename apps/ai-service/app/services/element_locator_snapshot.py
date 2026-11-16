# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ElementInfo 统一元素快照 — 统一实现 26.1111 CUA ElementInfo 模型(2026-11-15 取证)。

设计依据
--------
``内部规格`` §2(R11c,api.json
``types[name].text`` **明文 TS 按行为规格**,非反编译)。这是**行为/设计对照复现**。

对照 IHUI 缺口
--------------
``browser_replay`` 的 click/type 目标是**单个 selector 或 x,y 二选一**
(``target.get("selector")`` / ``target.get("x")``),selector 失败没有降级候选;
Codex ElementInfo 给的是**多候选降级快照**:

- ``selector.candidates``:排序的选择器候选(首选失败可降级到次选);
- ``selector.primary``:首选选择器;
- ``selector.frameSelectors``:进入元素前需先进入的 frame 选择器路径(跨 iframe);
- ``visibleText`` / ``ariaName`` / ``role``:语义定位线索。

本模块把"元素定位目标"从单 selector 升级为**带降级候选 + frame 路径的快照**,
供回放执行器逐候选尝试(首选命中即用,失败降级到次选)。

设计要点(纯函数,零 IO)
------------------------
- ``normalize_element_target``:把各种入参形状(裸 selector 字符串 / 单 selector dict /
  candidates dict / ElementInfo dict)归一为统一 ``ElementTargetSnapshot``;
- ``resolve_selector_candidates``:产出有序候选列表(primary 优先 + candidates 补齐去重);
- 与既有层关系:不改 ``browser_replay`` 现有单-selector 执行路径(零回归),只新增
  快照归一 + 候选降级判据,供调用方逐候选回退。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# frame 路径分隔(Codex frameSelectors 是"进入元素前需先进入的 frame 选择器"序列)
_FRAME_SEP = ">>"


@dataclass(frozen=True)
class ElementSelector:
    """元素选择器快照(Codex ElementInfoSelector 语义)。"""

    candidates: tuple[str, ...] = ()  # 排序的选择器候选(首选在前)
    frame_selectors: tuple[str, ...] = ()  # 进入元素前需先进入的 frame 选择器
    primary: str | None = None  # 首选选择器(如有)

    @property
    def ordered(self) -> tuple[str, ...]:
        """有序候选:primary 置首(若在 candidates 内),其余按 candidates 顺序,去重。"""
        ordered: list[str] = []
        if self.primary:
            ordered.append(self.primary)
        for c in self.candidates:
            if c and c not in ordered:
                ordered.append(c)
        return tuple(ordered)


@dataclass(frozen=True)
class ElementTargetSnapshot:
    """元素定位目标快照(Codex ElementInfo 的定位子集)。"""

    selector: ElementSelector
    visible_text: str | None = None  # 可见文本 / 选中项文本 / 可见表单值
    aria_name: str | None = None  # 可访问名
    role: str | None = None  # 计算 ARIA role
    tag_name: str | None = None  # 小写 HTML 标签名
    test_id: str | None = None  # 配置的 test id 属性

    @property
    def has_fallback(self) -> bool:
        """是否有降级候选(候选数 > 1)。"""
        return len(self.selector.ordered) > 1


def _coerce_candidates(raw: Any) -> tuple[str, ...]:
    """把 candidates 字段归一为字符串元组(容忍 list / 单串 / None)。"""
    if raw is None:
        return ()
    if isinstance(raw, str):
        return (raw,) if raw.strip() else ()
    if isinstance(raw, (list, tuple)):
        out: list[str] = []
        for item in raw:
            if isinstance(item, str) and item.strip() and item not in out:
                out.append(item)
        return tuple(out)
    return ()


def _coerce_frame_path(raw: Any) -> tuple[str, ...]:
    """把 frame 路径归一为元组。

    容忍:list(逐段)/ 单串(按 ``>>`` 分隔)。空段丢弃。
    """
    if raw is None:
        return ()
    if isinstance(raw, str):
        parts = [p.strip() for p in raw.split(_FRAME_SEP)]
        return tuple(p for p in parts if p)
    if isinstance(raw, (list, tuple)):
        out: list[str] = []
        for item in raw:
            if isinstance(item, str) and item.strip():
                out.append(item.strip())
        return tuple(out)
    return ()


def _selector_from_string(raw: str) -> ElementSelector:
    """裸 selector 字符串:若含 frame 分隔符 ``>>`` 则拆成 frame 路径 + 末段 primary。"""
    if _FRAME_SEP in raw:
        segments = [s.strip() for s in raw.split(_FRAME_SEP) if s.strip()]
        if len(segments) >= 2:
            return ElementSelector(
                candidates=(segments[-1],),
                frame_selectors=tuple(segments[:-1]),
                primary=segments[-1],
            )
    stripped = raw.strip()
    return ElementSelector(candidates=(stripped,) if stripped else (), primary=stripped or None)


def normalize_element_target(raw: Any) -> ElementTargetSnapshot | None:
    """把各种入参形状归一为 ElementTargetSnapshot(纯函数)。

    接受形状:
    - 裸 selector 字符串(可含 ``>>`` frame 路径);
    - ``{"selector": "css"}`` / ``{"selector": "a >> b"}``(IHUI 既有形状);
    - ``{"candidates": [...], "primary": "...", "frameSelectors": [...]}``(Codex 形状);
    - ``{"selector": {...ElementInfoSelector...}}``(嵌套选择器对象)。
    返回 None 表示入参不含任何可定位信息(调用方回退到坐标等其他目标形态)。
    """
    if raw is None:
        return None
    if isinstance(raw, str):
        sel = _selector_from_string(raw)
        if not sel.ordered:
            return None
        return ElementTargetSnapshot(selector=sel)

    if not isinstance(raw, dict):
        return None

    selector_raw = raw.get("selector")
    candidates: tuple[str, ...] = ()
    frame_path: tuple[str, ...] = ()
    primary: str | None = None

    if isinstance(selector_raw, str):
        sel = _selector_from_string(selector_raw)
        candidates = sel.candidates
        frame_path = sel.frame_selectors
        primary = sel.primary
    elif isinstance(selector_raw, dict):
        candidates = _coerce_candidates(selector_raw.get("candidates"))
        frame_path = _coerce_frame_path(selector_raw.get("frameSelectors"))
        p = selector_raw.get("primary")
        primary = p.strip() if isinstance(p, str) and p.strip() else None
    elif isinstance(selector_raw, (list, tuple)):
        candidates = _coerce_candidates(selector_raw)

    # Codex 顶层也可能直接带 candidates/primary/frameSelectors(无 selector 包裹)
    if not candidates and not primary:
        candidates = _coerce_candidates(raw.get("candidates"))
    if not frame_path:
        frame_path = _coerce_frame_path(raw.get("frameSelectors") or raw.get("frame_selectors"))
    if not primary:
        p = raw.get("primary")
        primary = p.strip() if isinstance(p, str) and p.strip() else None

    if not candidates and not primary:
        return None

    selector = ElementSelector(
        candidates=candidates,
        frame_selectors=frame_path,
        primary=primary,
    )
    return ElementTargetSnapshot(
        selector=selector,
        visible_text=_opt_str(raw.get("visibleText") or raw.get("visible_text")),
        aria_name=_opt_str(raw.get("ariaName") or raw.get("aria_name")),
        role=_opt_str(raw.get("role")),
        tag_name=_opt_str(raw.get("tagName") or raw.get("tag_name")),
        test_id=_opt_str(raw.get("testId") or raw.get("test_id")),
    )


def _opt_str(value: Any) -> str | None:
    """可选字符串归一(空串→None)。"""
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def resolve_selector_candidates(raw: Any) -> tuple[str, ...]:
    """产出有序候选列表(primary 置首 + candidates 补齐去重);无候选返回空元组。

    这是回放执行器逐候选降级的判据入口:首选命中即用,失败降级到次选。
    """
    snap = normalize_element_target(raw)
    if snap is None:
        return ()
    return snap.selector.ordered


# frame 路径分隔符常量导出(调用方组装跨 frame 目标时复用同一分隔)
FRAME_SEPARATOR = _FRAME_SEP


__all__ = [
    "FRAME_SEPARATOR",
    "ElementSelector",
    "ElementTargetSnapshot",
    "normalize_element_target",
    "resolve_selector_candidates",
]
