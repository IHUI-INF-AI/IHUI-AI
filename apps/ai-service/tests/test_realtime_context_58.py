# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:realtime 系片段测试 — 对标 codex realtime 5 文件语义。"""

from __future__ import annotations

import pytest

from app.core.realtime_context import (
    CONTENT_KIND_CUSTOM_START,
    CONTENT_KIND_DELEGATION,
    CONTENT_KIND_END,
    CONTENT_KIND_START,
    END_INSTRUCTIONS,
    MAX_REALTIME_DELEGATION_FIELD_BYTES,
    REALTIME_CONVERSATION_CLOSE_TAG,
    REALTIME_CONVERSATION_OPEN_TAG,
    SOURCE_TRANSCRIPT_TAIL_FLUSH,
    START_INSTRUCTIONS,
    RealtimeState,
    build_realtime_delegation_fragment,
    build_realtime_end_instructions_fragment,
    build_realtime_start_instructions_fragment,
    build_realtime_start_with_instructions_fragment,
    escape_xml_text_bounded,
)


def _text(frag: dict) -> str:
    return frag["content"][0]["text"]


# ---------- start / end / custom start ----------
def test_start_fragment_verbatim() -> None:
    frag = build_realtime_start_instructions_fragment()
    assert frag["role"] == "developer"
    assert frag["content_kind"] == CONTENT_KIND_START
    assert _text(frag) == f"\n{START_INSTRUCTIONS.strip()}\n"
    assert "backend executor behind an intermediary" in _text(frag)


def test_end_fragment_default_verbatim() -> None:
    frag = build_realtime_end_instructions_fragment()
    assert frag["role"] == "developer"
    assert frag["content_kind"] == CONTENT_KIND_END
    assert _text(frag) == f"\n{END_INSTRUCTIONS.strip()}\n"
    assert "Resume normal chat behavior." in _text(frag)


def test_end_fragment_custom_instructions() -> None:
    frag = build_realtime_end_instructions_fragment("custom end text")
    assert _text(frag) == "\ncustom end text\n"


def test_custom_start_fragment() -> None:
    frag = build_realtime_start_with_instructions_fragment("my instructions")
    assert frag["role"] == "developer"
    assert frag["content_kind"] == CONTENT_KIND_CUSTOM_START
    assert _text(frag) == "\nmy instructions\n"


def test_markers_constant_pair() -> None:
    assert REALTIME_CONVERSATION_OPEN_TAG == "<realtime_conversation>"
    assert REALTIME_CONVERSATION_CLOSE_TAG == "</realtime_conversation>"


# ---------- delegation ----------
def test_delegation_handoff_input_only() -> None:
    frag = build_realtime_delegation_fragment("hello there")
    assert frag["role"] == "user"
    assert frag["content_kind"] == CONTENT_KIND_DELEGATION
    assert _text(frag) == "\n  <input>hello there</input>\n"


def test_delegation_with_transcript_delta() -> None:
    frag = build_realtime_delegation_fragment("in", "delta text")
    assert "  <input>in</input>" in _text(frag)
    assert "  <transcript_delta>delta text</transcript_delta>" in _text(frag)


def test_delegation_tail_flush_source_line() -> None:
    frag = build_realtime_delegation_fragment(
        "x", source=SOURCE_TRANSCRIPT_TAIL_FLUSH
    )
    assert "  <source>transcript_tail_flush</source>\n" in _text(frag)


def test_delegation_handoff_has_no_source_line() -> None:
    frag = build_realtime_delegation_fragment("x")
    assert "<source>" not in _text(frag)


def test_delegation_empty_delta_omitted() -> None:
    frag = build_realtime_delegation_fragment("x", "")
    assert "<transcript_delta>" not in _text(frag)


def test_delegation_xml_escaping() -> None:
    frag = build_realtime_delegation_fragment("a<b>&c>d")
    assert "a&lt;b&gt;&amp;c&gt;d" in _text(frag)


# ---------- bounded truncation ----------
def test_escape_bounded_within_budget() -> None:
    text = "x" * 100
    assert escape_xml_text_bounded(text, "start") == text


def test_escape_bounded_start_retained() -> None:
    text = "前" * 5000  # 每字 3 字节,转义不变
    out = escape_xml_text_bounded(text, "start")
    assert out.endswith("…")
    assert len(out.encode("utf-8")) <= MAX_REALTIME_DELEGATION_FIELD_BYTES
    assert out.startswith("前")


def test_escape_bounded_end_retained() -> None:
    text = "后" * 5000
    out = escape_xml_text_bounded(text, "end")
    assert out.startswith("…")
    assert len(out.encode("utf-8")) <= MAX_REALTIME_DELEGATION_FIELD_BYTES
    assert out.endswith("后")


def test_escape_bounded_no_broken_multibyte() -> None:
    text = "中" * 5000
    for retain in ("start", "end"):
        out = escape_xml_text_bounded(text, retain)  # type: ignore[arg-type]
        out.encode("utf-8")  # 不抛 UnicodeDecodeError 即边界完整


# ---------- RealtimeState diff ----------
def test_state_known_same_none() -> None:
    state = RealtimeState(True)
    assert state.render_diff(True) is None


def test_state_known_false_to_true_start() -> None:
    state = RealtimeState(True)
    frag = state.render_diff(False)
    assert frag is not None
    assert frag["content_kind"] == CONTENT_KIND_START


def test_state_known_true_to_false_end() -> None:
    state = RealtimeState(False)
    frag = state.render_diff(True)
    assert frag is not None
    assert frag["content_kind"] == CONTENT_KIND_END


def test_state_unknown_active_start() -> None:
    assert RealtimeState(True).render_diff(None) is not None
    assert RealtimeState(False).render_diff(None) is None


def test_state_custom_start_instructions_used() -> None:
    state = RealtimeState(True, start_instructions="custom start")
    frag = state.render_diff(False)
    assert frag is not None
    assert frag["content_kind"] == CONTENT_KIND_CUSTOM_START


def test_state_custom_end_instructions_used() -> None:
    state = RealtimeState(False, end_instructions="custom end")
    frag = state.render_diff(True)
    assert frag is not None
    assert "custom end" in _text(frag)


def test_state_delegation_build_end_to_end() -> None:
    state = RealtimeState(True)
    frag = state.render_diff(None)
    assert frag is not None
    delegation = build_realtime_delegation_fragment("hi")
    assert delegation["role"] == "user"
