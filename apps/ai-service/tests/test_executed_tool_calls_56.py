# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core 测试:executed_tool_calls.py 第五十六批(对标 Codex
# executed_tool_calls.rs / seen_ids.rs / request_metadata.rs 单测语义)。

import pytest

from app.core.executed_tool_calls import (
    ExecutedToolCalls,
    SeenIds,
    build_executed_tool_calls_fragment,
    build_request_metadata,
)


def _rec(*pairs):
    """构造记录器并按 (call_id, name) 对顺序 record。"""
    rec = ExecutedToolCalls()
    for call_id, name in pairs:
        rec.record(call_id, name)
    return rec


# ---------------------------------------------------------------------------
# 1. record 幂等:同 call_id 重复 record 返回 False 且无副作用
# ---------------------------------------------------------------------------
def test_record_idempotent_returns_false_on_dup():
    rec = ExecutedToolCalls()
    assert rec.record("c1", "tool_a") is True
    assert rec.record("c1", "tool_a") is False
    assert rec.record("c1", "tool_a") is False
    assert len(rec.entries()) == 1


# ---------------------------------------------------------------------------
# 2. seen_ids 去重:同 call_id 只记一次
# ---------------------------------------------------------------------------
def test_seen_ids_dedup_only_once():
    rec = _rec(("c1", "tool_a"), ("c1", "tool_b"))
    assert len(rec.entries()) == 1
    assert rec.entries()[0] == {"name": "tool_a", "call_id": "c1"}


# ---------------------------------------------------------------------------
# 3. seen_ids.observe_call_id 直接语义:fresh / 重复
# ---------------------------------------------------------------------------
def test_seen_ids_observe_semantics():
    seen = SeenIds()
    assert seen.observe_call_id("x") is True
    assert seen.observe_call_id("x") is False
    assert seen.observe_call_id("y") is True
    assert "x" in seen and "y" in seen


# ---------------------------------------------------------------------------
# 4. limit 最近优先截断:先记录 5 个,limit=2 -> 最新 2 个且顺序正确
# ---------------------------------------------------------------------------
def test_bound_recent_priority_truncation():
    rec = _rec(
        ("c1", "t1"), ("c2", "t2"), ("c3", "t3"), ("c4", "t4"), ("c5", "t5")
    )
    out = rec.bound_for_prompt(limit=2)
    assert out == [
        {"name": "t4", "call_id": "c4"},
        {"name": "t5", "call_id": "c5"},
    ]


# ---------------------------------------------------------------------------
# 5. limit >= 总数 -> 全部保留,顺序不变
# ---------------------------------------------------------------------------
def test_bound_limit_ge_total_keeps_all():
    rec = _rec(("c1", "t1"), ("c2", "t2"), ("c3", "t3"))
    assert rec.bound_for_prompt(limit=3) == [
        {"name": "t1", "call_id": "c1"},
        {"name": "t2", "call_id": "c2"},
        {"name": "t3", "call_id": "c3"},
    ]
    assert rec.bound_for_prompt(limit=99) == rec.entries()


# ---------------------------------------------------------------------------
# 6. limit <= 0 -> 空列表
# ---------------------------------------------------------------------------
def test_bound_limit_nonpositive_empty():
    rec = _rec(("c1", "t1"))
    assert rec.bound_for_prompt(limit=0) == []
    assert rec.bound_for_prompt(limit=-1) == []


# ---------------------------------------------------------------------------
# 7. reset 清空所有记录
# ---------------------------------------------------------------------------
def test_reset_clears_entries():
    rec = _rec(("c1", "t1"), ("c2", "t2"))
    rec.reset()
    assert rec.entries() == []
    assert rec.bound_for_prompt(limit=10) == []
    # reset 后同 call_id 可重新记录
    assert rec.record("c1", "t1") is True


# ---------------------------------------------------------------------------
# 8. 空 bound_for_prompt 返回空列表
# ---------------------------------------------------------------------------
def test_empty_bound_returns_empty():
    rec = ExecutedToolCalls()
    assert rec.bound_for_prompt(limit=5) == []


# ---------------------------------------------------------------------------
# 9. build_request_metadata 空 -> None
# ---------------------------------------------------------------------------
def test_build_request_metadata_empty_none():
    assert build_request_metadata([]) is None
    assert build_executed_tool_calls_fragment([]) is None


# ---------------------------------------------------------------------------
# 10. build_request_metadata 形态与源码一致
# ---------------------------------------------------------------------------
def test_build_request_metadata_shape():
    entries = [
        {"name": "t1", "call_id": "c1"},
        {"name": "t2", "call_id": "c2"},
    ]
    meta = build_request_metadata(entries)
    assert meta is not None
    assert set(meta.keys()) == {"executed_tool_calls", "tool_calls_complete"}
    assert meta["tool_calls_complete"] is True
    assert meta["executed_tool_calls"] == entries


# ---------------------------------------------------------------------------
# 11. record 乱序 call_id 不影响 name 绑定
# ---------------------------------------------------------------------------
def test_out_of_order_call_ids_keep_name_binding():
    rec = ExecutedToolCalls()
    rec.record("c3", "tool_c")
    rec.record("c1", "tool_a")
    rec.record("c2", "tool_b")
    rec.record("c3", "tool_c_again")  # dup, ignored
    assert rec.entries() == [
        {"name": "tool_c", "call_id": "c3"},
        {"name": "tool_a", "call_id": "c1"},
        {"name": "tool_b", "call_id": "c2"},
    ]


# ---------------------------------------------------------------------------
# 12. 同 call_id 重复 record 不改变已绑定 name(首次胜出)
# ---------------------------------------------------------------------------
def test_dup_call_id_keeps_first_name():
    rec = _rec(("c1", "tool_a"))
    assert rec.record("c1", "tool_other") is False
    assert rec.entries() == [{"name": "tool_a", "call_id": "c1"}]


# ---------------------------------------------------------------------------
# 13. 条目字段与源码回灌形态一致(name + call_id)
# ---------------------------------------------------------------------------
def test_entry_fields_match_source_shape():
    rec = _rec(("c1", "tool_a"))
    entries = rec.bound_for_prompt(limit=10)
    assert len(entries) == 1
    assert set(entries[0].keys()) == {"name", "call_id"}
    assert entries[0]["name"] == "tool_a"
    assert entries[0]["call_id"] == "c1"


# ---------------------------------------------------------------------------
# 14. build_executed_tool_calls_fragment 与 build_request_metadata 一致
# ---------------------------------------------------------------------------
def test_fragment_aliases_request_metadata():
    entries = [{"name": "t1", "call_id": "c1"}]
    assert build_executed_tool_calls_fragment(entries) == build_request_metadata(entries)


# ---------------------------------------------------------------------------
# 15. 多次 reset 后仍幂等
# ---------------------------------------------------------------------------
def test_repeated_reset_idempotent():
    rec = _rec(("c1", "t1"))
    rec.reset()
    rec.reset()
    assert rec.record("c1", "t1") is True
    assert rec.bound_for_prompt(limit=10) == [{"name": "t1", "call_id": "c1"}]
