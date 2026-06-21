"""Phase 19 建议 1 测试: 自适应限流."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

try:
    from adaptive_limiter import (
        AdaptiveLimiter,
        AdjustEvent,
        HealthSample,
        HealthWindow,
        LimiterConfig,
        TokenBucket,
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
# 1. TokenBucket
# ---------------------------------------------------------------------------


def test_bucket_init():
    b = TokenBucket(10, 1.0)
    assert b.capacity == 10
    assert b.refill_rate == 1.0
    assert b.tokens == 10.0


def test_bucket_acquire_consume():
    b = TokenBucket(5, 1.0)
    assert b.try_acquire(1) is True
    assert b.tokens == 4.0


def test_bucket_acquire_exhausted():
    b = TokenBucket(2, 0.0)
    assert b.try_acquire(2) is True
    assert b.try_acquire(1) is False


def test_bucket_refill():
    b = TokenBucket(10, 2.0)
    b.try_acquire(10)  # 耗尽
    # 跳到 1s 后, 应补充 2 个
    future = time.time() + 1.0
    assert b.try_acquire(2, now=future) is True


def test_bucket_refill_capped():
    b = TokenBucket(5, 10.0)
    future = time.time() + 100.0
    # 即使等很久也不能超过 capacity
    b.try_acquire(0, now=future)
    assert b.tokens == 5.0


def test_bucket_set_params():
    b = TokenBucket(10, 1.0)
    b.try_acquire(8)  # tokens=2
    b.set_params(20, 2.0)
    assert b.capacity == 20
    assert b.tokens == 2.0  # 不会突增


def test_bucket_available():
    b = TokenBucket(5, 1.0)
    b.try_acquire(2)
    assert b.available() == 3.0


# ---------------------------------------------------------------------------
# 2. HealthWindow
# ---------------------------------------------------------------------------


def test_health_window_empty():
    h = HealthWindow()
    s = h.stats()
    assert s["samples"] == 0
    assert s["error_rate"] == 0.0


def test_health_window_record():
    h = HealthWindow(window_seconds=60)
    now = time.time()
    for i in range(5):
        h.record(HealthSample(ts=now - i, success=True, latency_ms=100.0))
    s = h.stats()
    assert s["samples"] == 5
    assert s["error_rate"] == 0.0


def test_health_window_error_rate():
    h = HealthWindow()
    now = time.time()
    for i in range(10):
        h.record(HealthSample(ts=now - i, success=(i < 7), latency_ms=100.0))
    s = h.stats()
    assert s["error_rate"] == 0.3


def test_health_window_p99():
    h = HealthWindow()
    now = time.time()
    for i in range(100):
        h.record(HealthSample(ts=now - i, success=True, latency_ms=float(i)))
    s = h.stats()
    assert s["p99_latency_ms"] > 0


def test_health_window_cleanup():
    h = HealthWindow(window_seconds=1)
    h.record(HealthSample(ts=time.time() - 10, success=True, latency_ms=100.0))
    s = h.stats()
    assert s["samples"] == 0


def test_health_window_clear():
    h = HealthWindow()
    h.record(HealthSample(ts=time.time(), success=True, latency_ms=100.0))
    h.clear()
    assert h.stats()["samples"] == 0


# ---------------------------------------------------------------------------
# 3. AdaptiveLimiter
# ---------------------------------------------------------------------------


def test_limiter_init():
    l = AdaptiveLimiter()
    p = l.current_params()
    assert p["capacity"] == l.config.initial_capacity
    assert p["refill_rate"] == l.config.initial_refill_rate


def test_limiter_acquire():
    l = AdaptiveLimiter(LimiterConfig(initial_capacity=5, initial_refill_rate=0.0))
    for _ in range(5):
        assert l.acquire() is True
    assert l.acquire() is False


def test_limiter_observe():
    l = AdaptiveLimiter()
    l.observe(True, 100.0)
    l.observe(False, 500.0)
    s = l.health.stats()
    assert s["samples"] == 2
    assert s["error_rate"] == 0.5


def test_limiter_tick_no_samples():
    l = AdaptiveLimiter()
    ev = l.tick()
    assert ev is None


def test_limiter_tick_healthy_adjust_up():
    l = AdaptiveLimiter(
        LimiterConfig(
            initial_capacity=10,
            initial_refill_rate=1.0,
            target_error_rate=0.1,
            target_p99_latency_ms=1000.0,
            min_sample_size=5,
            cooldown_s=0.0,
        )
    )
    now = time.time()
    for i in range(10):
        l.observe(success=True, latency_ms=50.0, now=now - i)
    old_c = l.current_params()["capacity"]
    ev = l.tick()
    assert ev is not None
    assert ev.new_capacity > old_c


def test_limiter_tick_unhealthy_adjust_down():
    l = AdaptiveLimiter(
        LimiterConfig(
            initial_capacity=100,
            initial_refill_rate=10.0,
            target_error_rate=0.01,
            target_p99_latency_ms=100.0,
            min_sample_size=5,
            cooldown_s=0.0,
            multiply_factor_on_unhealthy=0.5,
        )
    )
    now = time.time()
    for i in range(10):
        l.observe(success=(i % 5 == 0), latency_ms=2000.0, now=now - i)  # 80% 失败
    old_c = l.current_params()["capacity"]
    ev = l.tick()
    assert ev is not None
    assert ev.new_capacity < old_c


def test_limiter_tick_cooldown():
    l = AdaptiveLimiter(
        LimiterConfig(
            initial_capacity=10,
            initial_refill_rate=1.0,
            target_error_rate=0.1,
            target_p99_latency_ms=1000.0,
            min_sample_size=5,
            cooldown_s=60.0,
        )
    )
    now = time.time()
    for i in range(10):
        l.observe(success=True, latency_ms=50.0, now=now - i)
    ev1 = l.tick()
    assert ev1 is not None
    ev2 = l.tick()
    assert ev2 is None  # cooldown


def test_limiter_metrics():
    l = AdaptiveLimiter(LimiterConfig(initial_capacity=2, initial_refill_rate=0.0))
    l.acquire()
    l.acquire()
    l.acquire()  # deny
    m = l.metrics()
    assert m["allow"] == 2
    assert m["deny"] == 1


def test_limiter_events_recorded():
    l = AdaptiveLimiter(
        LimiterConfig(
            initial_capacity=10,
            initial_refill_rate=1.0,
            target_error_rate=0.1,
            target_p99_latency_ms=1000.0,
            min_sample_size=5,
            cooldown_s=0.0,
        )
    )
    now = time.time()
    for i in range(10):
        l.observe(success=True, latency_ms=50.0, now=now - i)
    l.tick()
    assert len(l.events()) >= 1


def test_limiter_clamp_min():
    l = AdaptiveLimiter(
        LimiterConfig(
            initial_capacity=10,
            initial_refill_rate=1.0,
            target_error_rate=0.01,
            target_p99_latency_ms=100.0,
            min_sample_size=5,
            cooldown_s=0.0,
            min_capacity=2,
            min_refill_rate=0.1,
        )
    )
    now = time.time()
    for i in range(10):
        l.observe(success=False, latency_ms=5000.0, now=now - i)
    l.tick()
    # 多次调严, 应触底
    for _ in range(10):
        l.tick(now=time.time())
    p = l.current_params()
    assert p["capacity"] >= l.config.min_capacity
    assert p["refill_rate"] >= l.config.min_refill_rate


def test_limiter_clamp_max():
    l = AdaptiveLimiter(
        LimiterConfig(
            initial_capacity=10,
            initial_refill_rate=1.0,
            target_error_rate=0.1,
            target_p99_latency_ms=1000.0,
            min_sample_size=5,
            cooldown_s=0.0,
            max_capacity=20,
            max_refill_rate=5.0,
        )
    )
    now = time.time()
    for i in range(10):
        l.observe(success=True, latency_ms=10.0, now=now - i)
    for _ in range(20):
        l.observe(success=True, latency_ms=10.0, now=time.time())
        l.tick(now=time.time())
    p = l.current_params()
    assert p["capacity"] <= l.config.max_capacity
    assert p["refill_rate"] <= l.config.max_refill_rate


def test_limiter_report():
    l = AdaptiveLimiter()
    l.acquire()
    l.observe(True, 100.0)
    md = l.report()
    assert "自适应限流器报表" in md
    assert "capacity" in md


def test_adjust_event_to_dict():
    e = AdjustEvent(time.time(), 10, 20, 1.0, 2.0, "test")
    d = e.to_dict()
    assert d["old_capacity"] == 10
    assert d["new_capacity"] == 20
    assert "ts_iso" in d


# ---------------------------------------------------------------------------
# 4. CLI
# ---------------------------------------------------------------------------


def test_cli_demo(capsys):
    rc = main(["demo"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert "scenarios" in data
    assert len(data["scenarios"]) == 3


def test_cli_acquire_allow(capsys):
    rc = main(["acquire", "--cost", "1.0"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["acquire"] is True


def test_cli_observe(capsys):
    rc = main(["observe", "--success", "true", "--latency-ms", "100"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["samples"] == 1


def test_cli_tick(capsys):
    rc = main(["tick"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert "params" in data


def test_cli_report(capsys):
    rc = main(["report"])
    out = capsys.readouterr().out
    assert "自适应限流器报表" in out
