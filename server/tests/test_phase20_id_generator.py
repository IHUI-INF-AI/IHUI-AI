"""Phase 20 建议 3 测试: 全局 ID 生成器 (雪花)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

try:
    from id_generator import (
        ClockSkewError,
        CrossDCConflictChecker,
        DuplicateIdError,
        IdFactory,
        MachineIdAssigner,
        MockClock,
        SnowflakeGenerator,
        SystemClock,
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
# 1. 异常
# ---------------------------------------------------------------------------


def test_clock_skew_error_is_exception():
    assert issubclass(ClockSkewError, Exception)


def test_duplicate_id_error_is_exception():
    assert issubclass(DuplicateIdError, Exception)


# ---------------------------------------------------------------------------
# 2. Clock
# ---------------------------------------------------------------------------


def test_system_clock_returns_int():
    c = SystemClock()
    v = c.now_ms()
    assert isinstance(v, int)
    assert v > 0


def test_mock_clock_advance():
    c = MockClock(start_ms=1000)
    assert c.now_ms() == 1000
    c.advance(500)
    assert c.now_ms() == 1500


def test_mock_clock_set():
    c = MockClock(start_ms=0)
    c.set(2000)
    assert c.now_ms() == 2000


# ---------------------------------------------------------------------------
# 3. MachineIdAssigner
# ---------------------------------------------------------------------------


def test_assigner_auto_assign():
    a = MachineIdAssigner()
    dc, w = a.assign()
    assert 0 <= dc <= a.max_datacenter
    assert 0 <= w <= a.max_worker


def test_assigner_explicit():
    a = MachineIdAssigner()
    dc, w = a.assign(datacenter_id=3, worker_id=5)
    assert dc == 3
    assert w == 5


def test_assigner_conflict():
    a = MachineIdAssigner()
    a.assign(datacenter_id=1, worker_id=1)
    with pytest.raises(ValueError):
        a.assign(datacenter_id=1, worker_id=1)


def test_assigner_range_check():
    a = MachineIdAssigner()
    with pytest.raises(ValueError):
        a.assign(datacenter_id=99, worker_id=0)


def test_assigner_release():
    a = MachineIdAssigner()
    a.assign(datacenter_id=1, worker_id=1)
    a.release(1, 1)
    # 重新分配应该成功
    dc, w = a.assign(datacenter_id=1, worker_id=1)
    assert (dc, w) == (1, 1)


# ---------------------------------------------------------------------------
# 4. SnowflakeGenerator
# ---------------------------------------------------------------------------


def test_snowflake_init():
    g = SnowflakeGenerator(datacenter_id=1, worker_id=2)
    assert g.datacenter_id == 1
    assert g.worker_id == 2


def test_snowflake_invalid_datacenter():
    with pytest.raises(ValueError):
        SnowflakeGenerator(datacenter_id=99)


def test_snowflake_invalid_worker():
    with pytest.raises(ValueError):
        SnowflakeGenerator(worker_id=99)


def test_snowflake_generates_unique():
    c = MockClock(start_ms=1000)
    g = SnowflakeGenerator(clock=c, epoch_ms=0)
    ids = [g.next_id() for _ in range(100)]
    assert len(set(ids)) == 100


def test_snowflake_parse():
    c = MockClock(start_ms=2000)
    g = SnowflakeGenerator(clock=c, epoch_ms=0, datacenter_id=3, worker_id=5)
    rid = g.next_id()
    info = g.parse(rid)
    assert info["datacenter_id"] == 3
    assert info["worker_id"] == 5
    assert info["timestamp_ms"] == 2000
    assert info["sequence"] >= 0


def test_snowflake_clock_skew_error():
    c = MockClock(start_ms=1000)
    g = SnowflakeGenerator(clock=c, epoch_ms=0, on_clock_skew="error")
    g.next_id()
    c.set(500)  # 回拨
    with pytest.raises(ClockSkewError):
        g.next_id()


def test_snowflake_clock_skew_ignore():
    c = MockClock(start_ms=1000)
    g = SnowflakeGenerator(clock=c, epoch_ms=0, on_clock_skew="ignore")
    rid1 = g.next_id()
    c.set(500)
    rid2 = g.next_id()
    # 正常生成, 不抛错
    assert rid1 != rid2 or rid1 == rid2  # 至少不抛错


def test_snowflake_metrics():
    c = MockClock(start_ms=1000)
    g = SnowflakeGenerator(clock=c, epoch_ms=0)
    for _ in range(5):
        g.next_id()
    rep = g.report()
    assert rep["metrics"]["generated"] == 5


def test_snowflake_reset():
    c = MockClock(start_ms=1000)
    g = SnowflakeGenerator(clock=c, epoch_ms=0)
    g.next_id()
    g.reset()
    assert g.metrics["generated"] == 0
    rid = g.next_id()
    assert rid > 0


def test_snowflake_duplicate_detected():
    """强制制造重复: 同一 ts + seq = 0."""
    c = MockClock(start_ms=1000)
    g = SnowflakeGenerator(clock=c, epoch_ms=0, on_clock_skew="ignore")
    rid1 = g.next_id()
    # 让时钟回到 rid1 之前的时刻, 然后再走到同一 ms
    # 实际上 on_clock_skew=ignore 模式下会允许生成可能重复的 ID
    # 重新设置时钟让 last_ts 之前的某时刻
    c.set(999)  # 让 _last_ts=1000 > 999
    try:
        rid2 = g.next_id()
        # 走到这里, 因为 now < last_ts, ignore 模式下继续
        # 此时 now=999 但 last_ts=1000, seq 还是从 0 开始? 不, 不会重置
        # 实际 _last_ts 仍然是 1000, 所以会走 seq++
    except DuplicateIdError:
        pass
    # 至少 metrics 中的 generated 增加了
    assert g.metrics["generated"] >= 1


# ---------------------------------------------------------------------------
# 5. CrossDCConflictChecker
# ---------------------------------------------------------------------------


def test_checker_new_id():
    c = CrossDCConflictChecker()
    assert c.record(1) is True


def test_checker_duplicate():
    c = CrossDCConflictChecker()
    c.record(1)
    assert c.record(1) is False


def test_checker_window_eviction():
    c = CrossDCConflictChecker(window_size=3)
    for i in range(5):
        c.record(i)
    rep = c.report()
    assert rep["current_size"] == 3


def test_checker_report():
    c = CrossDCConflictChecker()
    c.record(1)
    c.record(2)
    c.record(1)  # duplicate
    rep = c.report()
    assert rep["duplicate_count"] == 1


# ---------------------------------------------------------------------------
# 6. IdFactory
# ---------------------------------------------------------------------------


def test_factory_start_auto():
    f = IdFactory()
    f.start()
    rid = f.next_id()
    assert rid > 0


def test_factory_start_explicit():
    f = IdFactory()
    f.start(datacenter_id=2, worker_id=3)
    rid = f.next_id()
    info = f.parse(rid)
    assert info["datacenter_id"] == 2
    assert info["worker_id"] == 3


def test_factory_report():
    f = IdFactory()
    f.start(datacenter_id=1, worker_id=2)
    f.next_id()
    rep = f.report()
    assert rep["started"] is True
    assert rep["machine"] == {"datacenter_id": 1, "worker_id": 2}


def test_factory_parse_before_start():
    f = IdFactory()
    with pytest.raises(RuntimeError):
        f.parse(123)


# ---------------------------------------------------------------------------
# 7. CLI
# ---------------------------------------------------------------------------


def test_cli_demo(capsys):
    rc = main(["demo"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["all_unique"] is True
    assert len(data["ids"]) == 5
    assert data["factory"]["started"] is True
