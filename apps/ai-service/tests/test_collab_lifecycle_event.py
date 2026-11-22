# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""collab_lifecycle_event 行为测试（逆向 codex 协同会话生命周期，2026-11-18）。

覆盖三面:
1. ``CollabLifecycleEvent`` 十事件封闭集（五组 × begin/end，逐字对照 codex wire）；
2. ``event_wire_name`` serde rename 逐字 + ``event_role`` begin/end 角色；
3. ``validate_sequence`` 阶段序判据（未知/重入/孤儿/无 spawn 恢复四档）+ 反向变异；
4. ``stage_order`` 生命周期阶段可机检。
"""

from __future__ import annotations

import pytest

from app.core.collab_lifecycle_event import (
    CODEX_COLLAB_EVENT_TOTAL,
    COLLAB_LIFECYCLE_EVENT_VALUES,
    CollabEventError,
    CollabEventRole,
    CollabLifecycleEvent,
    ensure_collab_event,
    event_role,
    event_wire_name,
    stage_order,
    validate_sequence,
)

# ---------- 封闭集 ----------

def test_closed_set_ten_events_five_pairs():
    """十事件 = 五组 × begin/end，逐字对照 codex wire serde。"""
    assert set(CollabLifecycleEvent) == {
        "spawn_begin", "spawn_end",
        "interaction_begin", "interaction_end",
        "waiting_begin", "waiting_end",
        "close_begin", "close_end",
        "resume_begin", "resume_end",
    }


def test_total_constant_matches_members():
    assert CODEX_COLLAB_EVENT_TOTAL == len(CollabLifecycleEvent) == 10


def test_literal_table_matches_members():
    assert tuple(m.value for m in CollabLifecycleEvent) == COLLAB_LIFECYCLE_EVENT_VALUES


def test_begin_end_pairs_cover_five_stages():
    """每组都有 begin/end 配对。"""
    stages = {"spawn", "interaction", "waiting", "close", "resume"}
    for stage in stages:
        assert f"{stage}_begin" in CollabLifecycleEvent._value2member_map_
        assert f"{stage}_end" in CollabLifecycleEvent._value2member_map_


# ---------- wire 名逐字 ----------

@pytest.mark.parametrize(
    ("event", "wire"),
    [
        ("spawn_begin", "collab_agent_spawn_begin"),
        ("spawn_end", "collab_agent_spawn_end"),
        ("interaction_begin", "collab_agent_interaction_begin"),
        ("interaction_end", "collab_agent_interaction_end"),
        ("waiting_begin", "collab_waiting_begin"),
        ("waiting_end", "collab_waiting_end"),
        ("close_begin", "collab_close_begin"),
        ("close_end", "collab_close_end"),
        ("resume_begin", "collab_resume_begin"),
        ("resume_end", "collab_resume_end"),
    ],
)
def test_wire_name_verbatim(event: str, wire: str):
    """逐字对照 codex EventMsg serde rename。"""
    assert event_wire_name(event) == wire


def test_wire_names_all_distinct():
    wires = [event_wire_name(e.value) for e in CollabLifecycleEvent]
    assert len(set(wires)) == 10


# ---------- 角色 ----------

@pytest.mark.parametrize("event", [e.value for e in CollabLifecycleEvent])
def test_role_begin_or_end(event: str):
    assert event_role(event) in {CollabEventRole.BEGIN, CollabEventRole.END}


def test_role_split():
    assert event_role("spawn_begin") is CollabEventRole.BEGIN
    assert event_role("close_end") is CollabEventRole.END


# ---------- 值域闭合 ----------

@pytest.mark.parametrize("raw", [None, "", "unknown", "spawn", "collab", "SPAWN_BEGIN", "  "])
def test_ensure_unknown_raises(raw):
    with pytest.raises(CollabEventError):
        ensure_collab_event(raw)


def test_ensure_known_passthrough():
    assert ensure_collab_event("spawn_begin") == "spawn_begin"


def test_event_wire_name_unknown_raises():
    with pytest.raises(CollabEventError):
        event_wire_name("spawn")  # 半档不登记


def test_event_role_unknown_raises():
    with pytest.raises(CollabEventError):
        event_role("bogus")


# ---------- 阶段序判据 ----------

def test_sequence_happy_path():
    seq = [
        "spawn_begin", "spawn_end",
        "interaction_begin", "interaction_end",
        "waiting_begin", "waiting_end",
        "close_begin", "close_end",
    ]
    result = validate_sequence(seq)
    assert result["status"] == "OK"
    assert result["violations"] == []


def test_sequence_resume_after_spawn_ok():
    seq = ["spawn_begin", "spawn_end", "resume_begin", "resume_end"]
    assert validate_sequence(seq)["status"] == "OK"


def test_sequence_unknown_event():
    result = validate_sequence(["spawn_begin", "bogus_event"])
    assert result["status"] == "UNKNOWN_EVENT"
    assert result["violations"][0]["event"] == "bogus_event"


def test_sequence_nested_stage():
    """同阶段 begin 后未 end 又 begin = 重入违规。"""
    result = validate_sequence(["spawn_begin", "spawn_begin", "spawn_end"])
    assert result["status"] == "NESTED_STAGE"
    assert result["violations"][0]["event"] == "spawn_begin"
    assert "重入" in result["violations"][0]["expected"]


def test_sequence_orphan_end():
    """end 出现时同阶段无未收 begin = 孤儿违规。"""
    result = validate_sequence(["spawn_end"])
    assert result["status"] == "ORPHAN_END"
    assert result["violations"][0]["event"] == "spawn_end"


def test_sequence_resume_without_spawn():
    """从未 spawn 就 resume = 违规（协同会话未建立即恢复）。"""
    result = validate_sequence(["resume_begin", "resume_end"])
    assert result["status"] == "RESUME_WITHOUT_SPAWN"
    assert "spawn" in result["violations"][0]["expected"]


def test_sequence_priority_unknown_over_nested():
    """未知事件优先级最高（先点名再谈序）。"""
    result = validate_sequence(["bogus", "spawn_begin", "spawn_begin"])
    assert result["status"] == "UNKNOWN_EVENT"


def test_sequence_collects_all_violations_not_failfast():
    """一次报全部违规，非 fail-fast。"""
    result = validate_sequence(["bogus", "spawn_end", "spawn_begin", "spawn_begin"])
    assert len(result["violations"]) >= 3  # bogus + orphan end + nested begin


# ---------- 阶段序可机检 ----------

def test_stage_order_machine_checkable():
    assert stage_order() == ("spawn", "interaction", "waiting", "close", "resume")


# ---------- 反向变异（守不住即测试失败） ----------

def test_mutation_wire_name_off_by_one():
    """若 wire 名错一位（如 spawn_end→spawn_begin 复用）应被抓。"""
    with pytest.raises(AssertionError):
        assert event_wire_name("spawn_end") == "collab_agent_spawn_begin"


def test_mutation_sequence_accepts_orphan_resume():
    """若阶段序判据漏掉 resume-without-spawn 应被抓。"""
    result = validate_sequence(["resume_begin"])
    with pytest.raises(AssertionError):
        assert result["status"] == "OK"


def test_mutation_closed_set_missing_pair():
    """若封闭集漏掉任一配对档（如 resume_end）应被抓：常量总数须等于实登记成员数。"""
    assert len(CollabLifecycleEvent) == CODEX_COLLAB_EVENT_TOTAL
    for stage in ("spawn", "interaction", "waiting", "close", "resume"):
        assert f"{stage}_begin" in CollabLifecycleEvent._value2member_map_
        assert f"{stage}_end" in CollabLifecycleEvent._value2member_map_
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
