"""Phase 17 建议 3 测试: AI 灰度自动回滚."""

from __future__ import annotations

import json
import time
from unittest.mock import MagicMock

import pytest

try:
    from scripts.ops.ai_canary_autorevert import (
        AutoRollbackController,
        CallRecord,
        HealthThresholds,
        RollbackAction,
        RollbackEvent,
        RollbackReason,
        WindowedMonitor,
        main,
    )

    HAS_MODULE = True
except ImportError:
    HAS_MODULE = False
    RollbackAction = RollbackReason = HealthThresholds = CallRecord = RollbackEvent = None
    WindowedMonitor = AutoRollbackController = main = None


# ---------------------------------------------------------------------------
# 1. 枚举
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_action_values():
    assert RollbackAction.NONE.value == "none"
    assert RollbackAction.ALERT.value == "alert"
    assert RollbackAction.DISABLE.value == "disable"
    assert RollbackAction.ROLLBACK.value == "rollback"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reason_values():
    assert RollbackReason.HIGH_ERROR_RATE.value == "high_error_rate"
    assert RollbackReason.HIGH_LATENCY.value == "high_latency"
    assert RollbackReason.COST_SPIKE.value == "cost_spike"


# ---------------------------------------------------------------------------
# 2. HealthThresholds / CallRecord / RollbackEvent
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_thresholds_defaults():
    t = HealthThresholds()
    assert t.max_error_rate == 0.05
    assert t.max_p99_latency_ms == 5000.0
    assert t.max_cost_multiplier == 2.0
    assert t.min_sample_size == 10


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_call_record_init():
    r = CallRecord(model="canary", is_canary=True, success=True, latency_ms=100, cost_usd=0.001)
    assert r.model == "canary"
    assert r.is_canary is True


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_event_to_dict():
    e = RollbackEvent(ts=time.time(), reason="x", action="y", details={"k": 1})
    d = e.to_dict()
    assert d["reason"] == "x"
    assert d["action"] == "y"
    assert d["k"] == 1
    assert "ts_iso" in d


# ---------------------------------------------------------------------------
# 3. WindowedMonitor
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_monitor_init():
    m = WindowedMonitor(HealthThresholds())
    assert m.thresholds is not None


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_monitor_record():
    m = WindowedMonitor(HealthThresholds())
    m.record(CallRecord("canary", True, True, 100, 0.001))
    s = m.stats("canary", True)
    assert s["samples"] == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_monitor_window_cleanup():
    t = HealthThresholds(window_seconds=1)
    m = WindowedMonitor(t)
    m.record(CallRecord("canary", True, True, 100, 0.001, ts=time.time() - 10))
    s = m.stats("canary", True)
    assert s["samples"] == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_monitor_stats_error_rate():
    m = WindowedMonitor(HealthThresholds())
    for i in range(10):
        m.record(CallRecord("canary", True, i < 8, 100, 0.001))  # 8 ok, 2 fail
    s = m.stats("canary", True)
    assert s["error_rate"] == 0.2


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_monitor_stats_p99():
    m = WindowedMonitor(HealthThresholds())
    for i in range(100):
        m.record(CallRecord("canary", True, True, 100 + i, 0.001))
    s = m.stats("canary", True)
    # P99 应该是较高分位
    assert s["p99_latency_ms"] >= 195


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_monitor_stats_total_cost():
    m = WindowedMonitor(HealthThresholds())
    for _ in range(5):
        m.record(CallRecord("canary", True, True, 100, 0.01))
    s = m.stats("canary", True)
    assert abs(s["total_cost_usd"] - 0.05) < 0.001


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_monitor_evaluate_healthy():
    m = WindowedMonitor(HealthThresholds())
    for _ in range(20):
        m.record(CallRecord("canary", True, True, 100, 0.001))
    r = m.evaluate()
    assert r["action"] == "none"
    assert r["status"] == "healthy"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_monitor_evaluate_high_error():
    t = HealthThresholds(max_error_rate=0.05, min_sample_size=10)
    m = WindowedMonitor(t)
    for i in range(20):
        m.record(CallRecord("canary", True, i >= 5, 100, 0.001))  # 25% 失败
    r = m.evaluate()
    assert r["action"] == "rollback"
    assert r["reason"] == "high_error_rate"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_monitor_evaluate_high_latency():
    t = HealthThresholds(max_p99_latency_ms=1000, min_sample_size=10)
    m = WindowedMonitor(t)
    for i in range(20):
        m.record(CallRecord("canary", True, True, 5000, 0.001))
    r = m.evaluate()
    assert r["action"] == "disable"
    assert r["reason"] == "high_latency"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_monitor_evaluate_cost_spike():
    t = HealthThresholds(max_cost_multiplier=2.0, min_sample_size=10)
    m = WindowedMonitor(t)
    # conventional: 0.001, canary: 0.01 (10x)
    for _ in range(20):
        m.record(CallRecord("conventional", False, True, 100, 0.001))
    for _ in range(20):
        m.record(CallRecord("canary", True, True, 100, 0.01))
    r = m.evaluate()
    assert r["action"] == "alert"
    assert r["reason"] == "cost_spike"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_monitor_evaluate_insufficient_data():
    t = HealthThresholds(min_sample_size=100)
    m = WindowedMonitor(t)
    m.record(CallRecord("canary", True, False, 100, 0.001))
    r = m.evaluate()
    assert r["action"] == "none"
    assert r["status"] == "insufficient_data"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_monitor_clear():
    m = WindowedMonitor(HealthThresholds())
    m.record(CallRecord("canary", True, True, 100, 0.001))
    m.clear()
    assert m.stats("canary", True)["samples"] == 0


# ---------------------------------------------------------------------------
# 4. AutoRollbackController
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_controller_init():
    m = WindowedMonitor(HealthThresholds())
    c = AutoRollbackController(m, check_interval_s=0.01)
    assert c.is_canary_enabled() is True


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_controller_observe():
    m = WindowedMonitor(HealthThresholds())
    c = AutoRollbackController(m)
    c.observe(CallRecord("canary", True, True, 100, 0.001))
    assert m.stats("canary", True)["samples"] == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_controller_tick_healthy():
    m = WindowedMonitor(HealthThresholds())
    c = AutoRollbackController(m, check_interval_s=0.01)
    for _ in range(20):
        c.observe(CallRecord("canary", True, True, 100, 0.001))
    r = c.tick()
    assert r["action"] == "none"
    assert c.is_canary_enabled() is True


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_controller_tick_high_error_rollback():
    t = HealthThresholds(max_error_rate=0.05, min_sample_size=10)
    m = WindowedMonitor(t)
    c = AutoRollbackController(m, check_interval_s=0.01)
    for i in range(20):
        c.observe(CallRecord("canary", True, i < 5, 100, 0.001))  # 75% 失败
    r = c.tick()
    assert r["action"] == "rollback"
    assert c.is_canary_enabled() is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_controller_tick_high_latency_disable():
    t = HealthThresholds(max_p99_latency_ms=1000, min_sample_size=10)
    m = WindowedMonitor(t)
    c = AutoRollbackController(m, check_interval_s=0.01)
    for _ in range(20):
        c.observe(CallRecord("canary", True, True, 5000, 0.001))
    r = c.tick()
    assert r["action"] == "disable"
    assert c.is_canary_enabled() is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_controller_on_rollback_called():
    m = WindowedMonitor(HealthThresholds(max_error_rate=0.05, min_sample_size=10))
    on_rb = MagicMock()
    c = AutoRollbackController(m, on_rollback=on_rb, check_interval_s=0.01)
    for i in range(20):
        c.observe(CallRecord("canary", True, i < 5, 100, 0.001))
    c.tick()
    assert on_rb.called


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_controller_bind_strategy():
    """绑定 canary strategy 后, 回滚时改 strategy.enabled."""

    class FakeStrategy:
        enabled = True

    m = WindowedMonitor(HealthThresholds(max_error_rate=0.05, min_sample_size=10))
    c = AutoRollbackController(m, check_interval_s=0.01)
    fs = FakeStrategy()
    c.bind_canary_strategy(fs)
    for i in range(20):
        c.observe(CallRecord("canary", True, i < 5, 100, 0.001))
    c.tick()
    assert fs.enabled is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_controller_force_re_enable():
    m = WindowedMonitor(HealthThresholds(max_error_rate=0.05, min_sample_size=10))
    c = AutoRollbackController(m, check_interval_s=0.01)
    for i in range(20):
        c.observe(CallRecord("canary", True, i < 5, 100, 0.001))
    c.tick()
    assert c.is_canary_enabled() is False
    c.force_re_enable()
    assert c.is_canary_enabled() is True


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_controller_tick_skipped_interval():
    """检查间隔内重复 tick 应被跳过."""
    m = WindowedMonitor(HealthThresholds())
    c = AutoRollbackController(m, check_interval_s=10.0)
    r1 = c.tick()
    r2 = c.tick()
    assert r1["action"] == "skipped" or r2["action"] == "skipped"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_controller_events_recorded():
    m = WindowedMonitor(HealthThresholds(max_error_rate=0.05, min_sample_size=10))
    c = AutoRollbackController(m, check_interval_s=0.01)
    for i in range(20):
        c.observe(CallRecord("canary", True, i < 5, 100, 0.001))
    c.tick()
    events = c.events()
    assert len(events) >= 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_controller_report():
    m = WindowedMonitor(HealthThresholds())
    c = AutoRollbackController(m, check_interval_s=0.01)
    md = c.report()
    assert "AI 灰度自动回滚报表" in md
    assert "错误率阈值" in md


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_controller_auto_re_enable():
    """60s 后自动重启用."""
    t = HealthThresholds(max_p99_latency_ms=1000, min_sample_size=10)
    m = WindowedMonitor(t)
    c = AutoRollbackController(m, check_interval_s=0.001)
    # 触发 disable
    for _ in range(20):
        c.observe(CallRecord("canary", True, True, 5000, 0.001))
    c.tick()
    assert c.is_canary_enabled() is False
    # 强制时间跳到 61s 后
    future = time.time() + 61
    c.tick(now=future)
    assert c.is_canary_enabled() is True


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


def test_cli_demo_healthy(capsys):
    code = main(["demo", "--simulate", "healthy"])
    assert code == 0
    out = capsys.readouterr().out
    d = _last_json(out)
    assert d["status"] == "healthy"


def test_cli_demo_errors(capsys):
    code = main(["demo", "--simulate", "errors"])
    assert code == 0
    out = capsys.readouterr().out
    d = _last_json(out)
    assert d["action"] == "rollback"


def test_cli_demo_latency(capsys):
    code = main(["demo", "--simulate", "latency"])
    assert code == 0
    out = capsys.readouterr().out
    d = _last_json(out)
    assert d["action"] == "disable"


def test_cli_demo_cost(capsys):
    code = main(["demo", "--simulate", "cost"])
    assert code == 0
    out = capsys.readouterr().out
    d = _last_json(out)
    assert d["action"] == "alert"


def test_cli_report(capsys):
    code = main(["report"])
    assert code == 0
    out = capsys.readouterr().out
    assert "AI 灰度自动回滚报表" in out


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
    if not candidates:
        raise ValueError(f"未找到 JSON: {text[:200]}")
    return json.loads(candidates[-1])
