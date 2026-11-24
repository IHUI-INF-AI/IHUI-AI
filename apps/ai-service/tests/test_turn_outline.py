# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""turn outline 纯函数单测。"""
from __future__ import annotations

from app.core.turn_outline import build_turn_outline, render_intent


def _item(seq: int, turn_id: str, item_type: str, **kwargs):
    return {"seq": seq, "turn_id": turn_id, "item_type": item_type, **kwargs}


def test_render_intent_collapses_lines_and_truncates_at_code_points():
    assert render_intent("  第一行\n\n第二行  ") == "第一行 第二行"
    assert render_intent("字" * 130, max_chars=120).endswith("…")
    assert len(render_intent("字" * 130, max_chars=120)) == 121
    assert render_intent("   ", max_chars=3) == ""
    assert render_intent("abc", max_chars=0) == ""


def test_outline_groups_items_and_counts_tools_files_errors():
    turns = [
        {"turn_id": "t1", "turn_seq": 1, "status": "completed", "started_at": 100.0, "ended_at": 102.5},
        {"turn_id": "t2", "turn_seq": 2, "status": "failed", "started_at": 110.0, "ended_at": 111.0},
    ]
    items = [
        _item(1, "t1", "user_message", content="修复 登录\n页"),
        _item(2, "t1", "agent_message", content="ok"),
        _item(3, "t1", "tool_call", tool="read_file"),
        _item(4, "t1", "tool_call", tool="apply_patch"),
        _item(5, "t1", "tool_call", tool="read_file"),
        _item(6, "t1", "file_edit"),
        _item(7, "t1", "tool_result"),
        _item(8, "t2", "user_message", content="第二次"),
        _item(9, "t2", "error"),
        _item(10, None, "user_message", content="无归属"),
        _item(11, "t2", "tool_call", tool="run_command"),
    ]
    outline = build_turn_outline(turns, items)
    assert [e.turn_id for e in outline] == ["t1", "t2"]
    first = outline[0]
    assert first.intent == "修复 登录 页"
    assert first.tool_calls == 3
    assert first.tool_names == (("read_file", 2), ("apply_patch", 1))
    assert first.file_edits == 1
    assert first.errors == 0
    assert (first.start_seq, first.end_seq, first.item_count) == (1, 7, 7)
    assert first.duration_ms == 2500
    second = outline[1]
    assert second.status == "failed"
    assert second.errors == 1
    assert second.tool_names == (("run_command", 1),)


def test_outline_keeps_empty_turn_without_fabricating_counts():
    outline = build_turn_outline(
        [{"turn_id": "t0", "turn_seq": 1, "status": "running", "started_at": 1.0}],
        [],
    )
    assert len(outline) == 1
    entry = outline[0]
    assert entry.intent == ""
    assert entry.item_count == 0
    assert entry.start_seq is None and entry.end_seq is None
    assert entry.duration_ms == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
