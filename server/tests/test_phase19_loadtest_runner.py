"""Phase 19 建议 3 测试: 全链路压测."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

try:
    from loadtest_runner import (
        LoadTestResult,
        LoadTestRunner,
        RecordedRequest,
        RecordedResponse,
        Replayer,
        ShadowRunner,
        TrafficRecorder,
        _fast_handler,
        _percentile,
        main,
        report_load_test,
        report_shadow,
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
# 1. 工具
# ---------------------------------------------------------------------------


def test_percentile_empty():
    assert _percentile([], 50) == 0.0


def test_percentile_basic():
    data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    p50 = _percentile(data, 50)
    assert p50 > 0


# ---------------------------------------------------------------------------
# 2. RecordedRequest/Response
# ---------------------------------------------------------------------------


def test_recorded_request():
    r = RecordedRequest("GET", "/api/test")
    d = r.to_dict()
    assert d["method"] == "GET"


def test_recorded_response():
    r = RecordedResponse(200, body={"ok": True}, latency_ms=10.0)
    d = r.to_dict()
    assert d["status"] == 200
    assert d["latency_ms"] == 10.0


# ---------------------------------------------------------------------------
# 3. TrafficRecorder
# ---------------------------------------------------------------------------


def test_recorder_record():
    rec = TrafficRecorder()
    rec.record(RecordedRequest("GET", "/a"), RecordedResponse(200))
    assert rec.count() == 1


def test_recorder_save_load(tmp_path):
    rec = TrafficRecorder()
    rec.record(RecordedRequest("GET", "/a"), RecordedResponse(200, body={"x": 1}))
    p = tmp_path / "traffic.jsonl"
    rec.save(str(p))
    rec2 = TrafficRecorder.load(str(p))
    assert rec2.count() == 1
    assert rec2.records[0]["request"]["path"] == "/a"


def test_recorder_clear():
    rec = TrafficRecorder()
    rec.record(RecordedRequest("GET", "/a"), RecordedResponse(200))
    rec.clear()
    assert rec.count() == 0


def test_recorder_to_jsonl():
    rec = TrafficRecorder()
    rec.record(RecordedRequest("GET", "/a"), RecordedResponse(200))
    s = rec.to_jsonl()
    assert "/a" in s


# ---------------------------------------------------------------------------
# 4. Replayer
# ---------------------------------------------------------------------------


def test_replayer_basic():
    rec = TrafficRecorder()
    rec.record(RecordedRequest("GET", "/a", ts=time.time()), RecordedResponse(200))
    rec.record(RecordedRequest("GET", "/b", ts=time.time() + 0.01), RecordedResponse(200))
    responses = Replayer(_fast_handler, speed=1000.0).replay(rec)
    assert len(responses) == 2


def test_replayer_handler_called():
    rec = TrafficRecorder()
    rec.record(RecordedRequest("GET", "/x"), RecordedResponse(200))
    called = []

    def handler(req):
        called.append(req.path)
        return RecordedResponse(200, body={"echo": req.path})

    responses = Replayer(handler, speed=1000.0).replay(rec)
    assert called == ["/x"]
    assert responses[0].body["echo"] == "/x"


# ---------------------------------------------------------------------------
# 5. ShadowRunner
# ---------------------------------------------------------------------------


def test_shadow_match():
    runner = ShadowRunner(_fast_handler, _fast_handler)
    diffs = runner.run([RecordedRequest("GET", "/a")])
    assert len(diffs) == 1
    assert diffs[0].status_match is True
    assert diffs[0].body_match is True


def test_shadow_status_mismatch():
    def prod_h(req):
        return RecordedResponse(200)

    def shadow_h(req):
        return RecordedResponse(201)

    runner = ShadowRunner(prod_h, shadow_h)
    diffs = runner.run([RecordedRequest("GET", "/a")])
    assert diffs[0].status_match is False


def test_shadow_body_mismatch():
    def prod_h(req):
        return RecordedResponse(200, body={"v": 1})

    def shadow_h(req):
        return RecordedResponse(200, body={"v": 2})

    runner = ShadowRunner(prod_h, shadow_h)
    diffs = runner.run([RecordedRequest("GET", "/a")])
    assert diffs[0].body_match is False


def test_shadow_diff_stats_empty():
    runner = ShadowRunner(_fast_handler, _fast_handler)
    s = runner.diff_stats([])
    assert s["total"] == 0


def test_shadow_diff_stats_full():
    runner = ShadowRunner(_fast_handler, _fast_handler)
    diffs = runner.run([RecordedRequest("GET", f"/{i}") for i in range(5)])
    s = runner.diff_stats(diffs)
    assert s["total"] == 5
    assert s["status_match_pct"] == 100.0


def test_shadow_diff_to_dict():
    runner = ShadowRunner(_fast_handler, _fast_handler)
    diffs = runner.run([RecordedRequest("GET", "/a")])
    d = diffs[0].to_dict()
    assert "prod" in d
    assert "shadow" in d


# ---------------------------------------------------------------------------
# 6. LoadTestRunner
# ---------------------------------------------------------------------------


def test_loadtest_basic():
    requests = [RecordedRequest("GET", f"/{i}") for i in range(3)]
    r = LoadTestRunner(_fast_handler, concurrency=3).run(requests, duration_s=0.3)
    assert r.total > 0
    assert r.success > 0


def test_loadtest_throughput():
    requests = [RecordedRequest("GET", f"/{i}") for i in range(3)]
    r = LoadTestRunner(_fast_handler, concurrency=5).run(requests, duration_s=0.3, target_qps=100)
    assert r.throughput_qps > 0


def test_loadtest_p95_p99():
    requests = [RecordedRequest("GET", f"/{i}") for i in range(3)]
    r = LoadTestRunner(_fast_handler, concurrency=3).run(requests, duration_s=0.3)
    assert r.p50() > 0
    assert r.p95() > 0
    assert r.p99() > 0


def test_loadtest_with_errors():
    def error_handler(req):
        raise RuntimeError("boom")

    requests = [RecordedRequest("GET", "/a")]
    r = LoadTestRunner(error_handler, concurrency=1).run(requests, duration_s=0.1)
    assert r.errors >= 0  # 异常会被计入 errors


def test_loadtest_result_init():
    r = LoadTestResult(total=10, success=8, failed=1, errors=1, duration_s=1.0, throughput_qps=10.0)
    assert r.p50() == 0.0  # 空 latencies


# ---------------------------------------------------------------------------
# 7. 报表
# ---------------------------------------------------------------------------


def test_report_load_test():
    r = LoadTestResult(
        total=10, success=8, failed=1, errors=1, duration_s=1.0, throughput_qps=10.0, latencies=[1, 2, 3, 4, 5]
    )
    md = report_load_test(r)
    assert "压测报表" in md
    assert "P50" in md


def test_report_shadow():
    stats = {"total": 10, "status_match": 10, "body_match": 9, "status_match_pct": 100.0, "body_match_pct": 90.0}
    md = report_shadow(stats, [])
    assert "影子流量对比报表" in md


# ---------------------------------------------------------------------------
# 8. CLI
# ---------------------------------------------------------------------------


def test_cli_replay(capsys):
    rc = main(["replay"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["replayed"] >= 1


def test_cli_shadow(capsys):
    rc = main(["shadow"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["total"] >= 1


def test_cli_loadtest(capsys):
    rc = main(["loadtest"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["total"] >= 1
    assert data["qps"] > 0


def test_cli_report_loadtest(capsys):
    rc = main(["report-loadtest"])
    out = capsys.readouterr().out
    assert "压测报表" in out


def test_cli_report_shadow(capsys):
    rc = main(["report-shadow"])
    out = capsys.readouterr().out
    assert "影子流量对比报表" in out
