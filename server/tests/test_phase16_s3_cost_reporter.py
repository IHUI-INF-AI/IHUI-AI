"""Phase 16 建议 4 测试: S3 成本报表 + 异常报警."""

from __future__ import annotations

import json
import os
from unittest.mock import MagicMock

import pytest

try:
    from scripts.ops.s3_cost_reporter import (
        STORAGE_CLASS_PRICING,
        AlertSink,
        Anomaly,
        AnomalyDetector,
        BucketUsage,
        CostCalculator,
        CostReporter,
        main,
    )

    HAS_MODULE = True
except ImportError:
    HAS_MODULE = False
    BucketUsage = Anomaly = CostCalculator = AnomalyDetector = None
    CostReporter = AlertSink = STORAGE_CLASS_PRICING = main = None


# ---------------------------------------------------------------------------
# 1. BucketUsage
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_bucket_usage_cost():
    u = BucketUsage("b1", 100.0, 1000, "STANDARD")
    cost = CostCalculator.calc(u)
    assert cost == round(100.0 * 0.023, 4)


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_bucket_usage_glacier_cheap():
    u = BucketUsage("b1", 100.0, 0, "GLACIER")
    cost = u.monthly_cost()
    # Glacier 显著便宜
    assert cost < BucketUsage("b1", 100.0, 0, "STANDARD").monthly_cost()


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_storage_class_pricing_has_standard():
    assert "STANDARD" in STORAGE_CLASS_PRICING
    assert "GLACIER" in STORAGE_CLASS_PRICING


# ---------------------------------------------------------------------------
# 2. CostCalculator
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_calculator_basic():
    u = BucketUsage("b1", 10.0, 100, "STANDARD")
    assert CostCalculator.calc(u) == round(10.0 * 0.023, 4)


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_calculator_breakdown():
    u = BucketUsage("b1", 50.0, 0, "STANDARD_IA")
    b = CostCalculator.calc_breakdown(u)
    assert "storage" in b
    assert "total" in b
    assert b["rate_per_gb"] == STORAGE_CLASS_PRICING["STANDARD_IA"]


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_calculator_total():
    usages = [
        BucketUsage("b1", 10.0, 100, "STANDARD"),
        BucketUsage("b2", 20.0, 200, "STANDARD"),
    ]
    total = CostCalculator.total(usages)
    assert total > 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_calculator_unknown_storage_class():
    """未知存储类回退到 STANDARD."""
    u = BucketUsage("b1", 10.0, 0, "UNKNOWN_CLASS")
    cost = CostCalculator.calc(u)
    expected = 10.0 * STORAGE_CLASS_PRICING["STANDARD"]
    assert cost == round(expected, 4)


# ---------------------------------------------------------------------------
# 3. AnomalyDetector
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_detector_no_prev_no_anomaly():
    """无上月数据, 不应有 cost_spike / size_spike."""
    u = BucketUsage("b1", 100.0, 100, "STANDARD")
    d = AnomalyDetector()
    anomalies = d.detect([u])
    cost_spikes = [a for a in anomalies if a.type == "cost_spike"]
    assert len(cost_spikes) == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_detector_cost_spike():
    u = BucketUsage("b1", 200.0, 0, "STANDARD", prev_monthly_cost_usd=1.0)
    d = AnomalyDetector(cost_spike_pct=30.0)
    anomalies = d.detect([u])
    spikes = [a for a in anomalies if a.type == "cost_spike"]
    assert len(spikes) == 1
    assert spikes[0].severity == "HIGH"  # 100% 涨幅 > 100%


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_detector_cost_spike_medium():
    """50% 涨幅, 应 MEDIUM 严重度."""
    # 1000 GB STANDARD 桶, 上月成本 23, 本月 1000+GB (50% 涨幅)
    prev = 1000.0 * 0.023  # 23 USD
    curr = 1500.0 * 0.023  # 34.5 USD
    u = BucketUsage("b1", 1500.0, 0, "STANDARD", prev_size_gb=1000.0, prev_monthly_cost_usd=prev)
    d = AnomalyDetector(cost_spike_pct=30.0)
    anomalies = d.detect([u])
    spikes = [a for a in anomalies if a.type == "cost_spike"]
    assert len(spikes) == 1
    assert spikes[0].severity == "MEDIUM"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_detector_size_spike():
    u = BucketUsage("b1", 200.0, 0, "STANDARD", prev_size_gb=100.0)
    d = AnomalyDetector(size_spike_pct=50.0)
    anomalies = d.detect([u])
    spikes = [a for a in anomalies if a.type == "size_spike"]
    assert len(spikes) == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_detector_high_cost():
    u = BucketUsage("b1", 100000.0, 0, "STANDARD")
    d = AnomalyDetector(high_cost_threshold_usd=100.0)
    anomalies = d.detect([u])
    high = [a for a in anomalies if a.type == "high_cost"]
    assert len(high) == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_detector_no_anomaly_normal():
    u = BucketUsage("b1", 100.0, 0, "STANDARD", prev_size_gb=110.0, prev_monthly_cost_usd=2.5)
    d = AnomalyDetector()
    anomalies = d.detect([u])
    assert len(anomalies) == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_detector_multiple_buckets():
    usages = [
        BucketUsage("b1", 100.0, 0, "STANDARD", prev_size_gb=200.0, prev_monthly_cost_usd=2.30),  # -50%
        BucketUsage("b2", 500.0, 0, "STANDARD", prev_size_gb=100.0),  # +400% size spike
        BucketUsage("b3", 10.0, 0, "STANDARD"),
    ]
    d = AnomalyDetector()
    anomalies = d.detect(usages)
    # b2 应该有 size_spike
    assert any(a.bucket == "b2" and a.type == "size_spike" for a in anomalies)
    # b3 啥都没有
    b3 = [a for a in anomalies if a.bucket == "b3"]
    assert len(b3) == 0


# ---------------------------------------------------------------------------
# 4. CostReporter
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reporter_period_default():
    r = CostReporter()
    assert r.period  # 至少有值


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reporter_to_markdown():
    usages = [
        BucketUsage("b1", 100.0, 1000, "STANDARD"),
        BucketUsage("b2", 50.0, 200, "STANDARD_IA"),
    ]
    anomalies: list[Anomaly] = []
    r = CostReporter(period="2026-06")
    md = r.to_markdown(usages, anomalies)
    assert "2026-06" in md
    assert "b1" in md
    assert "b2" in md
    assert "✅ 无异常" in md


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reporter_to_markdown_with_anomalies():
    usages = [BucketUsage("b1", 500.0, 0, "STANDARD", prev_size_gb=100.0)]
    anomalies = [Anomaly("b1", "MEDIUM", "size_spike", "size +400%")]
    r = CostReporter(period="2026-06")
    md = r.to_markdown(usages, anomalies)
    assert "异常清单" in md
    assert "size_spike" in md


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reporter_to_json():
    usages = [BucketUsage("b1", 100.0, 100, "STANDARD")]
    r = CostReporter(period="2026-06")
    js = r.to_json(usages, [])
    d = json.loads(js)
    assert d["period"] == "2026-06"
    assert d["total_cost_usd"] > 0
    assert len(d["buckets"]) == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reporter_suggestions_standard_to_ia():
    """100GB+ STANDARD 桶应给出降级建议."""
    usages = [BucketUsage("big", 500.0, 0, "STANDARD")]
    r = CostReporter(period="2026-06")
    md = r.to_markdown(usages, [])
    assert "STANDARD_IA" in md
    assert "节省" in md


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reporter_no_suggestion_for_small():
    """<100GB 不建议降级."""
    usages = [BucketUsage("small", 50.0, 0, "STANDARD")]
    r = CostReporter(period="2026-06")
    md = r.to_markdown(usages, [])
    # 不应出现降级建议
    assert "STANDARD_IA" not in md or "建议" not in md


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reporter_empty_buckets():
    r = CostReporter(period="2026-06")
    md = r.to_markdown([], [])
    assert "桶总数: **0**" in md
    assert "✅ 无异常" in md


# ---------------------------------------------------------------------------
# 5. AlertSink
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_alert_sink_no_url():
    s = AlertSink()
    a = Anomaly("b1", "HIGH", "cost_spike", "msg")
    r = s.send([a])
    assert r["ok"] is True
    assert r["sent"] == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_alert_sink_no_anomalies():
    s = AlertSink()
    r = s.send([])
    assert r["sent"] == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_alert_sink_with_webhook(monkeypatch):
    """模拟 webhook 调用成功."""
    fake_resp = MagicMock(getcode=lambda: 200, __enter__=lambda s: s, __exit__=lambda s, *a: None)
    fake_resp.read = lambda: b"ok"
    monkeypatch.setattr("urllib.request.urlopen", lambda *a, **kw: fake_resp)
    s = AlertSink(webhook_url="http://test/webhook")
    a = Anomaly("b1", "HIGH", "cost_spike", "msg")
    r = s.send([a])
    assert r["ok"] is True


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_alert_sink_webhook_failure(monkeypatch):
    """webhook 失败时返回 ok=False."""
    import urllib.error

    def fake_fail(*a, **kw):
        raise urllib.error.URLError("conn refused")

    monkeypatch.setattr("urllib.request.urlopen", fake_fail)
    s = AlertSink(webhook_url="http://test/webhook")
    a = Anomaly("b1", "HIGH", "cost_spike", "msg")
    r = s.send([a])
    assert r["ok"] is False
    assert "conn refused" in r.get("error", "")


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_alert_sink_delivered_count():
    s = AlertSink()
    s.send([Anomaly("b1", "HIGH", "x", "m")])
    s.send([Anomaly("b2", "MEDIUM", "y", "n")])
    assert len(s.delivered) == 2


# ---------------------------------------------------------------------------
# 6. Anomaly.to_dict
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_anomaly_to_dict():
    a = Anomaly("b1", "HIGH", "cost_spike", "msg", metric={"x": 1})
    d = a.to_dict()
    assert d["bucket"] == "b1"
    assert d["severity"] == "HIGH"
    assert d["x"] == 1


# ---------------------------------------------------------------------------
# 7. CLI
# ---------------------------------------------------------------------------


def test_cli_no_input(capsys):
    """无 input 时用 demo 数据."""
    code = main(["--period", "2026-06"])
    assert code == 0
    out = capsys.readouterr().out
    assert "2026-06" in out


def test_cli_with_input(tmp_path, capsys):
    data = [
        {"bucket": "b1", "size_gb": 100.0, "objects": 100, "storage_class": "STANDARD"},
    ]
    f = tmp_path / "input.json"
    f.write_text(json.dumps(data), encoding="utf-8")
    code = main(["--input", str(f), "--period", "2026-06"])
    assert code == 0


def test_cli_to_file(tmp_path):
    out = str(tmp_path / "report.md")
    code = main(["--out", out, "--period", "2026-06"])
    assert code == 0
    assert os.path.exists(out)
    with open(out, encoding="utf-8") as f:
        c = f.read()
    assert "2026-06" in c


def test_cli_to_json_format(capsys):
    code = main(["--format", "json", "--period", "2026-06"])
    assert code == 0
    out = capsys.readouterr().out
    # 找第一个完整的 JSON 对象 (到对应右括号)
    js = out.strip()
    # 直接尝试用 idx 找到顶层 JSON
    start = js.find("{")
    if start < 0:
        pytest.skip("未找到 JSON 输出")
    depth = 0
    end = -1
    for i in range(start, len(js)):
        if js[i] == "{":
            depth += 1
        elif js[i] == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end < 0:
        pytest.skip("未找到完整 JSON")
    js = js[start:end]
    d = json.loads(js)
    assert d["period"] == "2026-06"


def test_cli_with_alert(capsys, monkeypatch):
    """检测到异常时调用 alert sink."""
    monkeypatch.setattr("urllib.request.urlopen", MagicMock(side_effect=Exception("blocked")))
    code = main(["--period", "2026-06", "--webhook", "http://test"])
    assert code == 0
    out = capsys.readouterr().out
    assert "告警" in out


def test_cli_custom_thresholds(capsys):
    code = main(["--period", "2026-06", "--cost-spike-pct", "10", "--high-cost", "100"])
    assert code == 0
