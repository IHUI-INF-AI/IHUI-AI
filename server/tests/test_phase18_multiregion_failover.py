"""Phase 18 建议 1 测试: 多区域容灾."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

try:
    from multiregion_failover import (
        DataReplicator,
        DNSRouter,
        FailoverAction,
        FailoverController,
        FailoverEvent,
        FailoverReason,
        HealthCheck,
        HealthThresholds,
        Region,
        RegionHealthMonitor,
        RegionRole,
        RegionState,
        main,
    )

    HAS_MODULE = True
except Exception:  # pragma: no cover
    HAS_MODULE = False


pytestmark = pytest.mark.skipif(not HAS_MODULE, reason="module not importable")


def _last_json(text: str):
    """从含多 JSON 块的输出中提取最后一个 JSON 对象."""
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
    assert RegionRole.PRIMARY.value == "primary"
    assert RegionState.HEALTHY.value == "healthy"
    assert FailoverAction.FAILOVER.value == "failover"
    assert FailoverReason.PRIMARY_DOWN.value == "primary_down"


def test_region_init():
    r = Region("us-east-1", "https://us-east-1.zhs.io", RegionRole.PRIMARY)
    assert r.region_id == "us-east-1"
    assert r.state == RegionState.HEALTHY
    assert r.weight == 100


def test_region_custom_id():
    r = Region("us-east-1", "https://...", RegionRole.PRIMARY, region_id="use1")
    assert r.region_id == "use1"


def test_health_check_init():
    hc = HealthCheck("r1", time.time(), 100.0, True)
    assert hc.success is True
    assert hc.status_code == 200


def test_event_to_dict():
    e = FailoverEvent(time.time(), "failover", "primary_down", "us-east-1", "us-west-2")
    d = e.to_dict()
    assert d["action"] == "failover"
    assert "ts_iso" in d


# ---------------------------------------------------------------------------
# 2. RegionHealthMonitor
# ---------------------------------------------------------------------------


def test_monitor_init():
    m = RegionHealthMonitor(HealthThresholds())
    h = m.evaluate("r1")
    assert h.status == "insufficient_data"
    assert h.samples == 0


def test_monitor_record_and_evaluate():
    m = RegionHealthMonitor(HealthThresholds(min_sample_size=3))
    now = time.time()
    for i in range(5):
        m.record(HealthCheck("r1", now - i, 100.0, True))
    h = m.evaluate("r1")
    assert h.samples == 5
    assert h.error_rate == 0.0
    assert h.status == "healthy"


def test_monitor_consecutive_failures():
    m = RegionHealthMonitor(HealthThresholds(min_sample_size=3, consecutive_failure_to_offline=3))
    now = time.time()
    for i in range(5):
        m.record(HealthCheck("r1", now - i, 100.0, False))
    h = m.evaluate("r1")
    assert h.consecutive_failures == 5
    assert h.status == "offline"


def test_monitor_high_error_rate():
    m = RegionHealthMonitor(HealthThresholds(min_sample_size=5, max_error_rate=0.1, consecutive_failure_to_offline=100))
    now = time.time()
    for i in range(10):
        m.record(HealthCheck("r1", now - i, 100.0, i < 7))  # 3 fail / 7 ok = 30%
    h = m.evaluate("r1")
    assert h.error_rate == 0.3
    # max_error_rate * 2 = 0.2, 0.3 > 0.2 -> offline
    assert h.status == "offline"


def test_monitor_high_latency():
    m = RegionHealthMonitor(HealthThresholds(min_sample_size=3, max_latency_ms=500))
    now = time.time()
    for i in range(5):
        m.record(HealthCheck("r1", now - i, 2000.0, True))
    h = m.evaluate("r1")
    assert h.status == "degraded"


def test_monitor_window_cleanup():
    m = RegionHealthMonitor(HealthThresholds(window_seconds=1, min_sample_size=1))
    m.record(HealthCheck("r1", time.time() - 10, 100.0, True))
    h = m.evaluate("r1")
    assert h.samples == 0


def test_monitor_clear():
    m = RegionHealthMonitor(HealthThresholds(min_sample_size=1))
    m.record(HealthCheck("r1", time.time(), 100.0, True))
    m.clear("r1")
    h = m.evaluate("r1")
    assert h.samples == 0


def test_monitor_recovery_resets_consecutive():
    m = RegionHealthMonitor(HealthThresholds(min_sample_size=1))
    m.record(HealthCheck("r1", time.time(), 100.0, False))
    m.record(HealthCheck("r1", time.time(), 100.0, True))
    h = m.evaluate("r1")
    assert h.consecutive_failures == 0


# ---------------------------------------------------------------------------
# 3. DNSRouter
# ---------------------------------------------------------------------------


def test_router_add_resolve():
    r = DNSRouter()
    r.add_record("api.zhs.io", "us-east-1")
    assert r.resolve("api.zhs.io") == "us-east-1"


def test_router_switch():
    r = DNSRouter()
    r.add_record("api.zhs.io", "us-east-1", ["us-west-2"])
    ok = r.switch("api.zhs.io", "us-west-2")
    assert ok is True
    assert r.resolve("api.zhs.io") == "us-west-2"


def test_router_switch_same():
    r = DNSRouter()
    r.add_record("api.zhs.io", "us-east-1")
    ok = r.switch("api.zhs.io", "us-east-1")
    assert ok is False


def test_router_switch_unknown():
    r = DNSRouter()
    ok = r.switch("unknown.zhs.io", "us-east-1")
    assert ok is False


def test_router_history():
    r = DNSRouter()
    r.add_record("api.zhs.io", "us-east-1")
    r.switch("api.zhs.io", "us-west-2")
    h = r.history()
    assert len(h) == 1
    assert h[0]["from"] == "us-east-1"
    assert h[0]["to"] == "us-west-2"


def test_router_snapshot():
    r = DNSRouter()
    r.add_record("a", "x", ["y"])
    r.add_record("b", "y")
    s = r.snapshot()
    assert s["routing_table"] == {"a": "x", "b": "y"}


# ---------------------------------------------------------------------------
# 4. DataReplicator
# ---------------------------------------------------------------------------


def test_replicator_set_get_lag():
    r = DataReplicator()
    r.set_lag("us-east-1", "us-west-2", 5.0)
    assert r.get_lag("us-east-1", "us-west-2") == 5.0


def test_replicator_lag_ok():
    r = DataReplicator()
    r.set_lag("a", "b", 3.0)
    assert r.lag_ok("a", "b", 5.0) is True
    assert r.lag_ok("a", "b", 2.0) is False


def test_replicator_all_lags():
    r = DataReplicator()
    r.set_lag("a", "b", 1.0)
    r.set_lag("b", "c", 2.0)
    lags = r.all_lags()
    assert "a->b" in lags
    assert "b->c" in lags


def test_replicator_negative_clamped():
    r = DataReplicator()
    r.set_lag("a", "b", -5.0)
    assert r.get_lag("a", "b") == 0.0


# ---------------------------------------------------------------------------
# 5. FailoverController
# ---------------------------------------------------------------------------


def _setup_controller():
    regions = [
        Region("us-east-1", "https://us-east-1.zhs.io", RegionRole.PRIMARY),
        Region("us-west-2", "https://us-west-2.zhs.io", RegionRole.SECONDARY),
        Region("eu-west-1", "https://eu-west-1.zhs.io", RegionRole.SECONDARY),
    ]
    router = DNSRouter()
    router.add_record("api.zhs.io", "us-east-1", ["us-west-2", "eu-west-1"])
    replicator = DataReplicator()
    monitor = RegionHealthMonitor(HealthThresholds(min_sample_size=3))
    c = FailoverController(monitor, router, replicator, regions)
    return c, regions, router, replicator, monitor


def test_controller_init_primary():
    c, *_ = _setup_controller()
    assert c.current_primary() == "us-east-1"


def test_controller_noop_healthy():
    c, *_ = _setup_controller()
    now = time.time()
    for rid in ["us-east-1", "us-west-2", "eu-west-1"]:
        for i in range(5):
            c.record_health(HealthCheck(rid, now - i, 100.0, True))
    r = c.tick()
    assert r["action"] == "noop"
    assert c.current_primary() == "us-east-1"


def test_controller_failover_on_primary_down():
    c, regions, router, *_ = _setup_controller()
    now = time.time()
    # primary 连续失败
    for i in range(8):
        c.record_health(HealthCheck("us-east-1", now - i, 100.0, False))
    for rid in ["us-west-2", "eu-west-1"]:
        for i in range(5):
            c.record_health(HealthCheck(rid, now - i, 100.0, True))
    r = c.tick()
    assert r["action"] == "failover"
    assert c.current_primary() in ("us-west-2", "eu-west-1")
    # 状态变更
    assert regions[0].state == RegionState.DRAINING
    assert regions[0].role == RegionRole.SECONDARY
    # DNS 已切
    assert router.resolve("api.zhs.io") == c.current_primary()


def test_controller_failback():
    c, regions, _, replicator, monitor = _setup_controller()
    now = time.time()
    # 1) primary down
    for i in range(8):
        c.record_health(HealthCheck("us-east-1", now - i, 100.0, False))
    for i in range(5):
        c.record_health(HealthCheck("us-west-2", now - i, 100.0, True))
    c.tick()
    # 2) primary 恢复但 lag 高 -> 清空旧数据再注入新数据, 避免窗口污染
    monitor.clear()
    fresh = time.time()
    for i in range(5):
        c.record_health(HealthCheck("us-east-1", fresh - i, 100.0, True))
    for i in range(5):
        c.record_health(HealthCheck("us-west-2", fresh - i, 100.0, True))
    replicator.set_lag("us-east-1", "us-west-2", 100.0)
    r1 = c.tick()
    # 不应 failback
    assert c.current_primary() != "us-east-1"
    # 3) lag 降下来
    replicator.set_lag("us-east-1", "us-west-2", 1.0)
    r2 = c.tick()
    # 应 failback
    assert c.current_primary() == "us-east-1"


def test_controller_force_failover():
    c, regions, router, *_ = _setup_controller()
    ev = c.force_failover("us-west-2")
    assert c.current_primary() == "us-west-2"
    assert router.resolve("api.zhs.io") == "us-west-2"


def test_controller_force_failover_same():
    c, *_ = _setup_controller()
    ev = c.force_failover("us-east-1")
    assert ev.action == "noop"


def test_controller_mark_degraded():
    c, *_ = _setup_controller()
    now = time.time()
    # primary 慢但不挂
    for i in range(5):
        c.record_health(HealthCheck("us-east-1", now - i, 3000.0, True))
    for rid in ["us-west-2", "eu-west-1"]:
        for i in range(5):
            c.record_health(HealthCheck(rid, now - i, 100.0, True))
    r = c.tick()
    assert r["action"] in ("mark_degraded", "failover")


def test_controller_on_failover_called():
    c, *_ = _setup_controller()
    called = []
    c.on_failover = lambda ev: called.append(ev)
    c.force_failover("us-west-2")
    assert len(called) == 1


def test_controller_events_recorded():
    c, *_ = _setup_controller()
    c.force_failover("us-west-2")
    c.force_failover("eu-west-1")
    evs = c.events()
    assert len(evs) == 2


def test_controller_report():
    c, *_ = _setup_controller()
    md = c.report()
    assert "多区域容灾报表" in md
    assert "us-east-1" in md
    assert "us-west-2" in md


# ---------------------------------------------------------------------------
# 6. CLI
# ---------------------------------------------------------------------------


def test_cli_demo_healthy(capsys):
    rc = main(["demo"])
    out = capsys.readouterr().out
    assert rc == 0
    data = _last_json(out)
    assert data["action"] == "noop"


def test_cli_demo_primary_down(capsys):
    rc = main(["demo", "--simulate", "primary_down"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["action"] == "failover"


def test_cli_demo_failback(capsys):
    rc = main(["demo", "--simulate", "failback"])
    out = capsys.readouterr().out
    data = _last_json(out)
    # 最后一步应该是 failback 或仍为 noop (取决于 lag 设置)
    assert "step1_failover" in data
    assert data["step1_failover"]["action"] == "failover"
    assert data["step3_failback"]["action"] == "failback"


def test_cli_report(capsys):
    rc = main(["report"])
    out = capsys.readouterr().out
    assert "多区域容灾报表" in out
