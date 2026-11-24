# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批 56：world_state_tools.ToolsState / PreviousSectionState 测试。

覆盖: 描述首行截断/排序、Known 相等不渲染、空+Absent/Unknown 不渲染、
Absent/Unknown 渲染 Deferred 组、Known 渲染 Added/Removed 组、空+Known 渲染
Removed+empty-state、XML 五字符转义、超预算省略计数、fragment 形状。
"""

from __future__ import annotations

import re

from app.core.world_state_tools import (
    TOOLS_CLOSE_TAG,
    TOOLS_OPEN_TAG,
    PreviousSectionState,
    ToolsState,
    build_tools_fragment,
    render_namespace_groups,
    rendered_namespace,
)


def _body_of(fragment):
    return fragment["content"][0]["text"]


def _inner(body):
    assert body.startswith(TOOLS_OPEN_TAG)
    assert body.endswith(TOOLS_CLOSE_TAG)
    return body[len(TOOLS_OPEN_TAG) : -len(TOOLS_CLOSE_TAG)]


def test_description_first_line_trim_and_truncate():
    state = ToolsState({"ns": "  first line\nsecond line ignored  "})
    assert state.deferred_namespaces == {"ns": "first line"}


def test_description_truncated_to_250():
    state = ToolsState({"ns": "x" * 300})
    assert len(state.deferred_namespaces["ns"]) == 250


def test_keys_sorted():
    state = ToolsState({"b": "B", "a": "A", "c": "C"})
    assert list(state.deferred_namespaces.keys()) == ["a", "b", "c"]


def test_known_equal_returns_none():
    state = ToolsState({"a": "A"})
    prev = PreviousSectionState.known({"a": "A"})
    assert state.render_diff(prev) is None


def test_empty_and_absent_returns_none():
    state = ToolsState({})
    assert state.render_diff(PreviousSectionState.absent()) is None


def test_empty_and_unknown_returns_none():
    state = ToolsState({})
    assert state.render_diff(PreviousSectionState.unknown()) is None


def test_absent_renders_deferred_group():
    state = ToolsState({"alpha": "desc alpha", "beta": "desc beta"})
    frag = state.render_diff(PreviousSectionState.absent())
    assert frag is not None
    inner = _inner(_body_of(frag))
    assert inner.startswith("\nDeferred tool namespaces:\n")
    assert "- alpha: desc alpha\n" in inner
    assert "- beta: desc beta\n" in inner
    assert frag["role"] == "developer"


def test_unknown_renders_deferred_group():
    state = ToolsState({"alpha": "desc alpha"})
    frag = state.render_diff(PreviousSectionState.unknown())
    assert frag is not None
    inner = _inner(_body_of(frag))
    assert "Deferred tool namespaces:\n" in inner


def test_known_added_removed_groups():
    state = ToolsState({"a": "A2", "b": "B", "c": "C"})
    prev = PreviousSectionState.known({"a": "A1", "b": "B", "x": "X"})
    frag = state.render_diff(prev)
    assert frag is not None
    inner = _inner(_body_of(frag))
    assert "Added deferred tool namespaces:\n" in inner
    assert "Removed deferred tool namespaces:\n" in inner
    assert "- a: A2\n" in inner
    assert "- c: C\n" in inner
    assert "- x: X\n" in inner
    # 未变化的 b 不出现
    assert "b: B" not in inner


def test_known_empty_current_renders_removed_and_empty_state():
    state = ToolsState({})
    prev = PreviousSectionState.known({"a": "A"})
    frag = state.render_diff(prev)
    assert frag is not None
    inner = _inner(_body_of(frag))
    assert "Removed deferred tool namespaces:\n" in inner
    assert "- a: A\n" in inner
    assert inner.endswith("No deferred tool namespaces remain.\n")


def test_xml_escape_five_chars():
    ns = 'a&b<c>d"e\'f'
    desc = 'x&y<z>w"v\'u'
    entry = rendered_namespace(ns, desc)
    assert "&amp;" in entry
    assert "&lt;" in entry
    assert "&gt;" in entry
    assert "&quot;" in entry
    assert "&apos;" in entry
    assert entry.startswith("- ")
    assert entry.endswith("\n")


def test_render_namespace_groups_omitted_count():
    big = "y" * 100
    namespaces = {f"ns{i:03d}": big for i in range(200)}
    groups = [("Deferred tool namespaces", namespaces)]
    body = render_namespace_groups(groups, current_is_empty=False)
    assert "... " in body
    assert " additional namespaces omitted.\n" in body
    m = re.search(r"\.\.\. (\d+) additional namespaces omitted\.\n", body)
    assert m is not None
    omitted = int(m.group(1))
    assert omitted > 0


def test_build_tools_fragment_shape():
    frag = build_tools_fragment("\nhello\n")
    assert frag["type"] == "message"
    assert frag["role"] == "developer"
    assert frag["content"][0]["type"] == "input_text"
    assert frag["content"][0]["text"] == (
        f"{TOOLS_OPEN_TAG}\nhello\n{TOOLS_CLOSE_TAG}"
    )
