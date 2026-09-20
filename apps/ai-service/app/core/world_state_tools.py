# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""world_state_tools(2026-09-20 第五十六批, 对标 codex context/world_state/tools.rs)。

延迟工具命名空间(ToolsState)的世界状态片段渲染:

- deferred_namespaces 描述取首行 trim 并截断 250 字符; 键排序(BTreeMap 语义)。
- render_diff 三态语义: Known 相等 / 空且 Absent·Unknown 不渲染;
  Absent·Unknown 渲染 "Deferred tool namespaces:" 组; Known 渲染
  "Added ... / Removed ..." 两组; 当前为空且 Known 非空含
  "No deferred tool namespaces remain.\n"。
- 字节预算 MAX_RENDERED_FRAGMENT_BYTES(4096) 扣减开闭标签后, 超预算条目计入
  "... N additional namespaces omitted.\n"。
"""

from __future__ import annotations

from typing import Any, Generic, TypeVar
from xml.sax.saxutils import escape as _sax_escape

__all__ = [
    "MAX_RENDERED_FRAGMENT_BYTES",
    "MAX_NAMESPACE_DESCRIPTION_CHARS",
    "OMITTED_LINE_RESERVE_BYTES",
    "TOOLS_OPEN_TAG",
    "TOOLS_CLOSE_TAG",
    "PreviousSectionState",
    "ToolsState",
    "build_tools_fragment",
    "render_namespace_groups",
    "rendered_namespace",
]

MAX_RENDERED_FRAGMENT_BYTES = 4096
MAX_NAMESPACE_DESCRIPTION_CHARS = 250
OMITTED_LINE_RESERVE_BYTES = 64

TOOLS_OPEN_TAG = "<tools>"
TOOLS_CLOSE_TAG = "</tools>"

_ESCAPE_ENTITIES = {"\"": "&quot;", "'": "&apos;"}

T = TypeVar("T")


def _xml_escape(value: str) -> str:
    """转义 & < > " ' 五字符, 对齐 codex push_xml_escaped_text。"""
    return _sax_escape(value, _ESCAPE_ENTITIES)


def _byte_len(value: str) -> int:
    """UTF-8 字节长度(对齐 Rust String::len 的预算语义)。"""
    return len(value.encode("utf-8"))


class PreviousSectionState(Generic[T]):
    """模型可见世界状态片段的上一次已知状态三态。

    Known(snapshot): 精确持久化快照可用。
    Absent: 保留历史中无该片段。
    Unknown: 保留历史含该片段但类型化快照不可用。
    """

    __slots__ = ("_kind", "snapshot")

    def __init__(self, kind: str, snapshot: T | None = None) -> None:
        self._kind: str = kind
        self.snapshot: T | None = snapshot

    @classmethod
    def known(cls, snapshot: T) -> PreviousSectionState[T]:
        return cls("known", snapshot)

    @classmethod
    def absent(cls) -> PreviousSectionState[T]:
        return cls("absent", None)

    @classmethod
    def unknown(cls) -> PreviousSectionState[T]:
        return cls("unknown", None)

    @property
    def kind(self) -> str:
        return self._kind

    def is_known(self) -> bool:
        return self._kind == "known"

    def is_absent(self) -> bool:
        return self._kind == "absent"

    def is_unknown(self) -> bool:
        return self._kind == "unknown"


class ToolsState:
    """延迟工具命名空间(ToolsState), 对标 codex ToolsState。"""

    def __init__(self, deferred_namespaces: dict[str, str]) -> None:
        self.deferred_namespaces: dict[str, str] = {}
        for namespace in sorted(deferred_namespaces):
            self.deferred_namespaces[namespace] = self._normalize_description(
                deferred_namespaces[namespace]
            )

    @staticmethod
    def _normalize_description(description: str) -> str:
        first_line = description.split("\n", 1)[0]
        return first_line.strip()[:MAX_NAMESPACE_DESCRIPTION_CHARS]

    def snapshot(self) -> dict[str, str]:
        return dict(self.deferred_namespaces)

    def render_diff(
        self, previous: PreviousSectionState[dict[str, str]]
    ) -> dict[str, Any] | None:
        current = self.snapshot()
        prev_snapshot = previous.snapshot
        if (previous.is_known() and prev_snapshot == current) or (
            not self.deferred_namespaces
            and (previous.is_absent() or previous.is_unknown())
        ):
            return None

        current_is_empty = not self.deferred_namespaces
        if previous.is_known():
            assert prev_snapshot is not None
            prev = prev_snapshot
            added = {
                ns: desc
                for ns, desc in self.deferred_namespaces.items()
                if prev.get(ns) != desc
            }
            removed = {
                ns: desc
                for ns, desc in prev.items()
                if ns not in self.deferred_namespaces
            }
            added = {ns: added[ns] for ns in sorted(added)}
            removed = {ns: removed[ns] for ns in sorted(removed)}
            groups = [
                ("Added deferred tool namespaces", added),
                ("Removed deferred tool namespaces", removed),
            ]
        else:
            groups = [("Deferred tool namespaces", dict(self.deferred_namespaces))]

        body = render_namespace_groups(groups, current_is_empty)
        return build_tools_fragment(body)


def rendered_namespace(namespace: str, description: str) -> str:
    """渲染单条命名空间(对齐 codex rendered_namespace, 含 XML 转义)。"""
    rendered = "- "
    rendered += _xml_escape(namespace)
    if description:
        rendered += ": " + _xml_escape(description)
    rendered += "\n"
    return rendered


def render_namespace_groups(
    groups: list[tuple[str, dict[str, str]]],
    current_is_empty: bool,
) -> str:
    """渲染分组并做字节预算扣减(对齐 codex render_namespace_groups)。"""
    body_budget = (
        MAX_RENDERED_FRAGMENT_BYTES
        - _byte_len(TOOLS_OPEN_TAG)
        - _byte_len(TOOLS_CLOSE_TAG)
    )
    empty_state = "No deferred tool namespaces remain.\n" if current_is_empty else None

    fixed_bytes = 1 + sum(
        _byte_len(label) + _byte_len(":\n") + OMITTED_LINE_RESERVE_BYTES
        for label, namespaces in groups
        if namespaces
    )
    if empty_state is not None:
        fixed_bytes += _byte_len(empty_state)
    remaining_entry_bytes = body_budget - fixed_bytes

    rendered = "\n"
    for label, namespaces in groups:
        if not namespaces:
            continue
        rendered += label + ":\n"
        omitted = 0
        for namespace, description in namespaces.items():
            entry = rendered_namespace(namespace, description)
            if _byte_len(entry) <= remaining_entry_bytes:
                remaining_entry_bytes -= _byte_len(entry)
                rendered += entry
            else:
                omitted += 1
        if omitted > 0:
            rendered += "... " + str(omitted) + " additional namespaces omitted.\n"
    if empty_state is not None:
        rendered += empty_state
    return rendered


def build_tools_fragment(body: str) -> dict[str, Any]:
    """构造延迟工具命名空间片段(developer 角色, 带 <tools> 标记)。

    content kind: tools.deferred_namespaces
    """
    return {
        "type": "message",
        "role": "developer",
        "content": [
            {
                "type": "input_text",
                "text": f"{TOOLS_OPEN_TAG}{body}{TOOLS_CLOSE_TAG}",
            }
        ],
    }
