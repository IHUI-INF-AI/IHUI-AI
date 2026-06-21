"""Phase 20 建议 2 测试: 事件溯源."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

try:
    from event_store import (
        AggregateSnapshot,
        ConflictError,
        EventBus,
        EventStore,
        Projection,
        ReplayEngine,
        SnapshotStore,
        StoredEvent,
        main,
    )

    HAS_MODULE = True
except Exception:  # pragma: no cover
    HAS_MODULE = False


pytestmark = pytest.mark.skipif(not HAS_MODULE, reason="module not importable")


def _last_json(text: str):
    text = text.strip()
    candidates: list[str] = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ch not in "{[":
            i += 1
            continue
        open_ch = ch
        close_ch = "}" if ch == "{" else "]"
        depth = 0
        in_str = False
        escape = False
        for j in range(i, len(text)):
            c = text[j]
            if escape:
                escape = False
                continue
            if c == "\\":
                escape = True
                continue
            if in_str:
                if c == '"':
                    in_str = False
                continue
            if c == '"':
                in_str = True
                continue
            if c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    candidate = text[i : j + 1]
                    try:
                        json.loads(candidate)
                        candidates.append(candidate)
                    except json.JSONDecodeError:
                        pass
                    i = j + 1
                    break
        else:
            i += 1
    return json.loads(candidates[-1])


# ---------------------------------------------------------------------------
# 1. 数据类
# ---------------------------------------------------------------------------


def test_event_to_dict():
    e = StoredEvent(id="x", type="T", aggregate_id="a", payload={"k": 1})
    d = e.to_dict()
    assert d["type"] == "T"
    assert "ts_iso" in d


def test_snapshot_to_dict():
    s = AggregateSnapshot("a", 1, {"x": 1})
    d = s.to_dict()
    assert d["aggregate_id"] == "a"
    assert d["state"] == {"x": 1}


# ---------------------------------------------------------------------------
# 2. EventStore
# ---------------------------------------------------------------------------


def test_store_init():
    s = EventStore()
    assert s.count() == 0


def test_store_append():
    s = EventStore()
    e = s.append(StoredEvent(id="", type="T", aggregate_id="a"))
    assert e.id != ""
    assert e.version == 1
    assert s.count() == 1


def test_store_append_auto_id():
    s = EventStore()
    e = s.append(StoredEvent(id="", type="T", aggregate_id="a"))
    assert e.id != ""


def test_store_version_increment():
    s = EventStore()
    e1 = s.append(StoredEvent(id="", type="T", aggregate_id="a"))
    e2 = s.append(StoredEvent(id="", type="T", aggregate_id="a", prev_version=e1.version))
    assert e1.version == 1
    assert e2.version == 2


def test_store_conflict():
    s = EventStore()
    s.append(StoredEvent(id="", type="T", aggregate_id="a"))
    with pytest.raises(ConflictError):
        s.append(StoredEvent(id="", type="T", aggregate_id="a", prev_version=99))


def test_store_load():
    s = EventStore()
    s.append(StoredEvent(id="", type="T", aggregate_id="a"))
    s.append(StoredEvent(id="", type="T", aggregate_id="b"))
    a_events = s.load("a")
    assert len(a_events) == 1


def test_store_latest_version():
    s = EventStore()
    assert s.latest_version("x") == 0
    e1 = s.append(StoredEvent(id="", type="T", aggregate_id="x"))
    e2 = s.append(StoredEvent(id="", type="T", aggregate_id="x", prev_version=e1.version))
    assert s.latest_version("x") == e2.version


def test_store_query_by_type():
    s = EventStore()
    e1 = s.append(StoredEvent(id="", type="A", aggregate_id="x"))
    s.append(StoredEvent(id="", type="B", aggregate_id="x", prev_version=e1.version))
    a_events = s.query(event_type="A")
    assert len(a_events) == 1


def test_store_query_by_agg():
    s = EventStore()
    s.append(StoredEvent(id="", type="A", aggregate_id="x"))
    s.append(StoredEvent(id="", type="A", aggregate_id="y"))
    x_events = s.query(aggregate_id="x")
    assert len(x_events) == 1


def test_store_query_by_ts():
    s = EventStore()
    now = time.time()
    e1 = s.append(StoredEvent(id="", type="A", aggregate_id="x", ts=now - 100))
    s.append(StoredEvent(id="", type="A", aggregate_id="x", ts=now - 10, prev_version=e1.version))
    out = s.query(from_ts=now - 50)
    assert len(out) == 1


def test_store_get_by_id():
    s = EventStore()
    e = s.append(StoredEvent(id="x1", type="A", aggregate_id="x"))
    got = s.get("x1")
    assert got is not None


def test_store_clear():
    s = EventStore()
    s.append(StoredEvent(id="", type="A", aggregate_id="x"))
    s.clear()
    assert s.count() == 0


# ---------------------------------------------------------------------------
# 3. SnapshotStore
# ---------------------------------------------------------------------------


def test_snapshot_save_load():
    ss = SnapshotStore()
    ss.save("a", 1, {"x": 1})
    snap = ss.load("a")
    assert snap.version == 1
    assert snap.state == {"x": 1}


def test_snapshot_load_missing():
    ss = SnapshotStore()
    assert ss.load("x") is None


def test_snapshot_all():
    ss = SnapshotStore()
    ss.save("a", 1, {})
    ss.save("b", 1, {})
    assert len(ss.all()) == 2


# ---------------------------------------------------------------------------
# 4. Projection
# ---------------------------------------------------------------------------


def test_projection_init():
    p = Projection("p", initial={"count": 0})
    assert p.state() == {"count": 0}


def test_projection_apply():
    def reducer(state, event):
        state["count"] = state.get("count", 0) + 1
        return state

    p = Projection("p", initial={"count": 0}, reducer=reducer)
    e = StoredEvent(id="", type="A", aggregate_id="x")
    p.apply(e)
    assert p.state()["count"] == 1


def test_projection_apply_many():
    def reducer(state, event):
        state["count"] = state.get("count", 0) + 1
        return state

    p = Projection("p", initial={"count": 0}, reducer=reducer)
    for _ in range(5):
        p.apply(StoredEvent(id="", type="A", aggregate_id="x"))
    assert p.state()["count"] == 5


def test_projection_replay():
    s = EventStore()
    s.append(StoredEvent(id="", type="A", aggregate_id="x"))
    s.append(StoredEvent(id="", type="A", aggregate_id="x", prev_version=1))
    s.append(StoredEvent(id="", type="A", aggregate_id="x", prev_version=2))

    def reducer(state, event):
        state["count"] = state.get("count", 0) + 1
        return state

    p = Projection("p", initial={"count": 0}, reducer=reducer)
    p.replay(s)
    assert p.state()["count"] == 3


def test_projection_state_isolated():
    """state() 返回副本, 修改不影响原状态."""
    p = Projection("p", initial={"k": 1})
    s = p.state()
    s["k"] = 99
    assert p.state()["k"] == 1


# ---------------------------------------------------------------------------
# 5. EventBus
# ---------------------------------------------------------------------------


def test_bus_subscribe_publish():
    bus = EventBus()
    received = []
    bus.subscribe("A", lambda e: received.append(e.type))
    bus.publish(StoredEvent(id="", type="A", aggregate_id="x"))
    bus.publish(StoredEvent(id="", type="B", aggregate_id="x"))
    assert received == ["A"]


def test_bus_wildcard():
    bus = EventBus()
    received = []
    bus.subscribe("*", lambda e: received.append(e.type))
    bus.publish(StoredEvent(id="", type="A", aggregate_id="x"))
    bus.publish(StoredEvent(id="", type="B", aggregate_id="x"))
    assert received == ["A", "B"]


def test_bus_unsubscribe():
    bus = EventBus()
    received = []
    h = lambda e: received.append(e.type)
    bus.subscribe("A", h)
    bus.unsubscribe("A", h)
    bus.publish(StoredEvent(id="", type="A", aggregate_id="x"))
    assert received == []


# ---------------------------------------------------------------------------
# 6. ReplayEngine
# ---------------------------------------------------------------------------


def test_replay_no_snapshots():
    s = EventStore()
    s.append(StoredEvent(id="", type="A", aggregate_id="x"))
    s.append(StoredEvent(id="", type="A", aggregate_id="x", prev_version=1))

    def reducer(state, event):
        state["count"] = state.get("count", 0) + 1
        return state

    p = Projection("p", initial={"count": 0}, reducer=reducer)
    engine = ReplayEngine(s)
    engine.replay_projection(p)
    assert p.state()["count"] == 2


def test_replay_with_snapshots():
    s = EventStore()
    s.append(StoredEvent(id="", type="A", aggregate_id="x"))
    s.append(StoredEvent(id="", type="A", aggregate_id="x", prev_version=1))
    s.append(StoredEvent(id="", type="A", aggregate_id="x", prev_version=2))
    snaps = SnapshotStore()
    snaps.save("x", 1, {"count": 1})

    def reducer(state, event):
        state["count"] = state.get("count", 0) + 1
        return state

    p = Projection("p", initial={"count": 0}, reducer=reducer)
    engine = ReplayEngine(s, snaps)
    engine.replay_projection(p, use_snapshots=True)
    # 快照后还有 2 个事件
    assert p.state()["count"] == 3


def test_replay_from_version():
    s = EventStore()
    s.append(StoredEvent(id="", type="A", aggregate_id="x"))
    s.append(StoredEvent(id="", type="A", aggregate_id="x", prev_version=1))
    s.append(StoredEvent(id="", type="A", aggregate_id="x", prev_version=2))

    def reducer(state, event):
        state["count"] = state.get("count", 0) + 1
        return state

    p = Projection("p", initial={"count": 0}, reducer=reducer)
    p.replay(s, from_version=3)
    assert p.state()["count"] == 1


# ---------------------------------------------------------------------------
# 7. CLI
# ---------------------------------------------------------------------------


def test_cli_demo(capsys):
    rc = main(["demo"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["events"] == 4
    assert data["u1_events"] == 3
    assert "u1" in data["projection"]
    assert data["projection"]["u1"]["name"] == "Alice Smith"
    assert data["projection"]["u1"]["status"] == "inactive"
