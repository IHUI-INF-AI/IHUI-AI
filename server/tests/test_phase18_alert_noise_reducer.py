"""Phase 18 建议 3 测试: 智能告警降噪."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

try:
    from alert_noise_reducer import (
        ActionType,
        Aggregator,
        AlertEvent,
        AlertNoiseReducer,
        CorrelationRule,
        Correlator,
        Deduplicator,
        Severity,
        Silencer,
        SilenceRule,
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
# 1. 枚举 / 数据类
# ---------------------------------------------------------------------------


def test_enum_values():
    assert Severity.INFO.value == "info"
    assert ActionType.SUPPRESS.value == "suppress"


def test_event_fingerprint_stable():
    e1 = AlertEvent("id1", "HighCPU", Severity.WARNING, "node-1", labels={"host": "n1"})
    e2 = AlertEvent("id2", "HighCPU", Severity.WARNING, "node-1", labels={"host": "n1"})
    assert e1.fingerprint() == e2.fingerprint()


def test_event_fingerprint_different_labels():
    e1 = AlertEvent("id1", "HighCPU", Severity.WARNING, "node-1", labels={"host": "n1"})
    e2 = AlertEvent("id2", "HighCPU", Severity.WARNING, "node-1", labels={"host": "n2"})
    assert e1.fingerprint() != e2.fingerprint()


def test_event_to_dict():
    e = AlertEvent("id1", "HighCPU", Severity.WARNING, "node-1", labels={"host": "n1"})
    d = e.to_dict()
    assert d["severity"] == "warning"
    assert "fingerprint" in d


# ---------------------------------------------------------------------------
# 2. Deduplicator
# ---------------------------------------------------------------------------


def test_dedup_first_pass():
    d = Deduplicator(window_seconds=60)
    e = AlertEvent("id1", "A", Severity.WARNING, "n1")
    assert d.should_pass(e) is True


def test_dedup_duplicate_suppress():
    d = Deduplicator(window_seconds=60)
    e = AlertEvent("id1", "A", Severity.WARNING, "n1", labels={"h": "n1"})
    assert d.should_pass(e) is True
    e2 = AlertEvent("id2", "A", Severity.WARNING, "n1", labels={"h": "n1"})
    assert d.should_pass(e2) is False


def test_dedup_different_fingerprint_pass():
    d = Deduplicator(window_seconds=60)
    e1 = AlertEvent("id1", "A", Severity.WARNING, "n1", labels={"h": "n1"})
    e2 = AlertEvent("id2", "A", Severity.WARNING, "n1", labels={"h": "n2"})
    assert d.should_pass(e1) is True
    assert d.should_pass(e2) is True


def test_dedup_window_expire():
    d = Deduplicator(window_seconds=1)
    e = AlertEvent("id1", "A", Severity.WARNING, "n1", labels={"h": "n1"})
    assert d.should_pass(e) is True
    # 强制时间跳到 2s 后
    future = time.time() + 2
    assert d.should_pass(e, now=future) is True


def test_dedup_seen_count():
    d = Deduplicator()
    d.should_pass(AlertEvent("id1", "A", Severity.WARNING, "n1", labels={"h": "1"}))
    d.should_pass(AlertEvent("id2", "A", Severity.WARNING, "n1", labels={"h": "2"}))
    assert d.seen_count() == 2


def test_dedup_clear():
    d = Deduplicator()
    d.should_pass(AlertEvent("id1", "A", Severity.WARNING, "n1", labels={"h": "1"}))
    d.clear()
    assert d.seen_count() == 0


# ---------------------------------------------------------------------------
# 3. Aggregator
# ---------------------------------------------------------------------------


def test_aggregator_empty():
    a = Aggregator()
    assert a.aggregate([], group_by=["alertname"]) == []


def test_aggregator_group_by_alertname():
    a = Aggregator()
    now = time.time()
    events = [
        AlertEvent("1", "A", Severity.WARNING, "n1", ts=now - 1),
        AlertEvent("2", "A", Severity.WARNING, "n1", ts=now - 2),
        AlertEvent("3", "B", Severity.ERROR, "n1", ts=now - 3),
    ]
    out = a.aggregate(events, group_by=["alertname"], window_seconds=600)
    keys = {x.group_key for x in out}
    assert "alertname=A" in keys
    assert "alertname=B" in keys


def test_aggregator_count():
    a = Aggregator()
    now = time.time()
    events = [
        AlertEvent("1", "A", Severity.WARNING, "n1", ts=now - 1),
        AlertEvent("2", "A", Severity.WARNING, "n1", ts=now - 2),
        AlertEvent("3", "A", Severity.WARNING, "n1", ts=now - 3),
    ]
    out = a.aggregate(events, group_by=["alertname"], window_seconds=600)
    assert len(out) == 1
    assert out[0].count == 3


def test_aggregator_top_severity():
    a = Aggregator()
    now = time.time()
    events = [
        AlertEvent("1", "A", Severity.WARNING, "n1", ts=now - 1),
        AlertEvent("2", "A", Severity.CRITICAL, "n1", ts=now - 2),
        AlertEvent("3", "A", Severity.ERROR, "n1", ts=now - 3),
    ]
    out = a.aggregate(events, group_by=["alertname"], window_seconds=600)
    assert out[0].severity == Severity.CRITICAL


def test_aggregator_window_filter():
    a = Aggregator()
    now = time.time()
    events = [
        AlertEvent("1", "A", Severity.WARNING, "n1", ts=now - 1),
        AlertEvent("2", "A", Severity.WARNING, "n1", ts=now - 1000),  # 过期
    ]
    out = a.aggregate(events, group_by=["alertname"], window_seconds=600)
    assert out[0].count == 1


# ---------------------------------------------------------------------------
# 4. Silencer
# ---------------------------------------------------------------------------


def test_silence_match_alertname():
    s = Silencer()
    s.add(SilenceRule(match_alertname="HighCPU", duration_minutes=30))
    e = AlertEvent("1", "HighCPU", Severity.WARNING, "n1")
    ok, reason = s.is_silenced(e)
    assert ok is True
    assert "HighCPU" in reason


def test_silence_no_match():
    s = Silencer()
    s.add(SilenceRule(match_alertname="HighCPU", duration_minutes=30))
    e = AlertEvent("1", "Other", Severity.WARNING, "n1")
    ok, _ = s.is_silenced(e)
    assert ok is False


def test_silence_match_labels():
    s = Silencer()
    s.add(SilenceRule(match_alertname="HighCPU", match_labels={"host": "node-1"}, duration_minutes=30))
    e1 = AlertEvent("1", "HighCPU", Severity.WARNING, "n1", labels={"host": "node-1"})
    e2 = AlertEvent("2", "HighCPU", Severity.WARNING, "n2", labels={"host": "node-2"})
    ok1, _ = s.is_silenced(e1)
    ok2, _ = s.is_silenced(e2)
    assert ok1 is True
    assert ok2 is False


def test_silence_wildcard():
    s = Silencer()
    s.add(SilenceRule(match_alertname="*", duration_minutes=30))
    e1 = AlertEvent("1", "A", Severity.WARNING, "n1")
    e2 = AlertEvent("2", "B", Severity.ERROR, "n1")
    ok1, _ = s.is_silenced(e1)
    ok2, _ = s.is_silenced(e2)
    assert ok1 is True
    assert ok2 is True


def test_silence_expired():
    s = Silencer()
    s.add(SilenceRule(match_alertname="A", duration_minutes=1))
    e = AlertEvent("1", "A", Severity.WARNING, "n1")
    future = time.time() + 120
    ok, _ = s.is_silenced(e, now=future)
    assert ok is False


def test_silence_cleanup():
    s = Silencer()
    s.add(SilenceRule(match_alertname="A", duration_minutes=1))
    s.add(SilenceRule(match_alertname="B", duration_minutes=30))
    s.cleanup(now=time.time() + 120)
    rules = s.rules()
    assert len(rules) == 1
    assert rules[0]["match_alertname"] == "B"


# ---------------------------------------------------------------------------
# 5. Correlator
# ---------------------------------------------------------------------------


def test_correlator_no_rule():
    c = Correlator()
    e = AlertEvent("1", "A", Severity.WARNING, "n1")
    ok, _ = c.is_suppressed(e)
    assert ok is False


def test_correlator_parent_active():
    c = Correlator()
    c.add_rule(CorrelationRule("ServiceDown", ["HighCPU", "HighLatency"]))
    parent = AlertEvent("1", "ServiceDown", Severity.CRITICAL, "lb-1")
    c.observe(parent)
    child = AlertEvent("2", "HighCPU", Severity.WARNING, "n1")
    ok, reason = c.is_suppressed(child)
    assert ok is True
    assert "ServiceDown" in reason


def test_correlator_parent_expired():
    c = Correlator(window_seconds=60)
    c.add_rule(CorrelationRule("ServiceDown", ["HighCPU"]))
    parent = AlertEvent("1", "ServiceDown", Severity.CRITICAL, "lb-1")
    c.observe(parent)
    child = AlertEvent("2", "HighCPU", Severity.WARNING, "n1")
    future = time.time() + 120
    ok, _ = c.is_suppressed(child, now=future)
    assert ok is False


def test_correlator_not_matched_child():
    c = Correlator()
    c.add_rule(CorrelationRule("ServiceDown", ["HighCPU"]))
    parent = AlertEvent("1", "ServiceDown", Severity.CRITICAL, "lb-1")
    c.observe(parent)
    child = AlertEvent("2", "Other", Severity.WARNING, "n1")
    ok, _ = c.is_suppressed(child)
    assert ok is False


def test_correlator_active_parents():
    c = Correlator()
    c.add_rule(CorrelationRule("ServiceDown", ["X"]))
    c.observe(AlertEvent("1", "ServiceDown", Severity.CRITICAL, "lb-1"))
    parents = c.active_parents()
    assert "ServiceDown" in parents


# ---------------------------------------------------------------------------
# 6. AlertNoiseReducer (pipeline)
# ---------------------------------------------------------------------------


def test_pipeline_dedup():
    r = AlertNoiseReducer()
    e = AlertEvent("1", "A", Severity.WARNING, "n1", labels={"h": "1"})
    res1 = r.process(e)
    res2 = r.process(AlertEvent("2", "A", Severity.WARNING, "n1", labels={"h": "1"}))
    assert res1.action == ActionType.PASS
    assert res2.action == ActionType.SUPPRESS
    assert res2.reason == "duplicate"


def test_pipeline_silence():
    r = AlertNoiseReducer()
    r.silencer.add(SilenceRule(match_alertname="A", duration_minutes=30))
    res = r.process(AlertEvent("1", "A", Severity.WARNING, "n1"))
    assert res.action == ActionType.SUPPRESS
    assert "silenced" in res.reason


def test_pipeline_correlate():
    r = AlertNoiseReducer()
    r.correlator.add_rule(CorrelationRule("Parent", ["Child"]))
    r.process(AlertEvent("1", "Parent", Severity.CRITICAL, "n1"))
    res = r.process(AlertEvent("2", "Child", Severity.WARNING, "n1"))
    assert res.action == ActionType.SUPPRESS
    assert "Parent" in res.reason


def test_pipeline_stats():
    r = AlertNoiseReducer()
    for i in range(3):
        r.process(AlertEvent(f"id{i}", "A", Severity.WARNING, "n1", labels={"i": str(i)}))
    s = r.stats()
    assert s["received"] == 3
    assert s["passed"] == 3


def test_pipeline_aggregate_passed():
    r = AlertNoiseReducer()
    for i in range(3):
        r.process(AlertEvent(f"id{i}", "A", Severity.WARNING, "n1"))
    r.process(AlertEvent("id3", "B", Severity.ERROR, "n1"))
    agg = r.aggregate_passed(group_by=["alertname"], window_s=600)
    assert len(agg) == 2


def test_pipeline_passed_and_suppressed():
    r = AlertNoiseReducer()
    r.process(AlertEvent("1", "A", Severity.WARNING, "n1", labels={"h": "1"}))
    r.process(AlertEvent("2", "A", Severity.WARNING, "n1", labels={"h": "1"}))  # dup
    assert len(r.passed()) == 1
    assert len(r.suppressed()) == 1


def test_pipeline_reset():
    r = AlertNoiseReducer()
    r.process(AlertEvent("1", "A", Severity.WARNING, "n1", labels={"h": "1"}))
    r.reset()
    assert r.stats()["received"] == 0
    assert len(r.passed()) == 0


# ---------------------------------------------------------------------------
# 7. CLI
# ---------------------------------------------------------------------------


def test_cli_demo_storm(capsys):
    rc = main(["demo"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert "results" in data
    assert "stats" in data


def test_cli_demo_silence(capsys):
    rc = main(["demo", "--simulate", "silence"])
    out = capsys.readouterr().out
    data = _last_json(out)
    s = data["stats"]
    assert s["suppressed_silence"] >= 1


def test_cli_demo_correlate(capsys):
    rc = main(["demo", "--simulate", "correlate"])
    out = capsys.readouterr().out
    data = _last_json(out)
    s = data["stats"]
    assert s["suppressed_correlate"] >= 1


def test_cli_report(capsys):
    rc = main(["report"])
    out = capsys.readouterr().out
    assert "告警降噪报表" in out
