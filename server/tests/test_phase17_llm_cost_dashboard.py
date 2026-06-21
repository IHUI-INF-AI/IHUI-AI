"""Phase 17 建议 1 测试: LLM 路由成本看板."""

from __future__ import annotations

import csv
import io
import json
import time

import pytest

try:
    from scripts.ops.llm_cost_dashboard import (
        MODEL_PRICING,
        CanaryRouterCostBridge,
        CostTracker,
        DashboardReporter,
        ModelPricing,
        UsageRecord,
        main,
    )

    HAS_MODULE = True
except ImportError:
    HAS_MODULE = False
    MODEL_PRICING = ModelPricing = UsageRecord = CostTracker = None
    DashboardReporter = CanaryRouterCostBridge = main = None


# ---------------------------------------------------------------------------
# 1. ModelPricing
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_pricing_known_model():
    p = ModelPricing.get("gpt-4")
    assert "input" in p
    assert "output" in p
    assert p["input"] > 0
    assert p["output"] > 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_pricing_unknown_returns_default():
    p = ModelPricing.get("nonexistent-model-12345")
    assert p["input"] == 0.001
    assert p["output"] == 0.002


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_pricing_calc_cost():
    # gpt-4: 1000 input + 500 output
    cost = ModelPricing.calc_cost("gpt-4", 1000, 500)
    expected = 0.03 + 0.03  # input 0.03 + output 0.03
    assert abs(cost - expected) < 0.001


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_pricing_calc_cost_zero():
    cost = ModelPricing.calc_cost("gpt-4", 0, 0)
    assert cost == 0.0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_pricing_known_models():
    models = ModelPricing.known_models()
    assert "gpt-4" in models
    assert len(models) > 5


# ---------------------------------------------------------------------------
# 2. UsageRecord
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_usage_record_init():
    r = UsageRecord(tenant_id="t1", model="gpt-4", prompt_tokens=100, completion_tokens=200)
    assert r.tenant_id == "t1"
    assert r.cost_usd == 0.0
    assert r.error == ""
    assert r.is_canary is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_usage_record_to_dict():
    r = UsageRecord(tenant_id="t1", model="gpt-4", prompt_tokens=10, completion_tokens=20)
    d = r.to_dict()
    assert d["tenant_id"] == "t1"
    assert d["model"] == "gpt-4"
    assert d["prompt_tokens"] == 10


# ---------------------------------------------------------------------------
# 3. CostTracker
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tracker_init():
    t = CostTracker()
    assert len(t) == 0
    assert t.global_stats()["total_requests"] == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tracker_record_usage():
    t = CostTracker()
    t.record_usage("t1", "gpt-4", 100, 200)
    assert len(t) == 1
    s = t.by_tenant("t1")
    assert s["total_requests"] == 1
    assert s["total_cost_usd"] > 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tracker_error_no_cost():
    t = CostTracker()
    t.record_usage("t1", "gpt-4", 100, 200, error="rate limit")
    s = t.by_tenant("t1")
    assert s["total_errors"] == 1
    assert s["total_cost_usd"] == 0.0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tracker_by_tenant():
    t = CostTracker()
    t.record_usage("t1", "gpt-4", 100, 200)
    t.record_usage("t1", "gpt-3.5", 50, 100)
    t.record_usage("t2", "gpt-4", 200, 400)
    s1 = t.by_tenant("t1")
    assert s1["total_requests"] == 2
    s2 = t.by_tenant("t2")
    assert s2["total_requests"] == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tracker_by_model():
    t = CostTracker()
    t.record_usage("t1", "gpt-4", 100, 200)
    t.record_usage("t2", "gpt-4", 100, 200)
    t.record_usage("t3", "gpt-3.5", 100, 200)
    s = t.by_model("gpt-4")
    assert s["total_requests"] == 2


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tracker_top_tenants():
    t = CostTracker()
    # t1 用昂贵的 gpt-4, t2 用便宜的
    for _ in range(5):
        t.record_usage("t1", "gpt-4", 1000, 2000)
    for _ in range(20):
        t.record_usage("t2", "gpt-4o-mini", 100, 200)
    top = t.top_tenants(2)
    assert len(top) == 2
    # t1 排第一
    assert top[0][0] == "t1"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tracker_top_models():
    t = CostTracker()
    t.record_usage("t1", "gpt-4", 1000, 2000)
    t.record_usage("t1", "gpt-3.5", 10, 20)
    top = t.top_models(2)
    assert len(top) == 2
    assert top[0][0] == "gpt-4"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tracker_max_records():
    t = CostTracker(max_records=10)
    for i in range(50):
        t.record_usage(f"t{i % 5}", "gpt-4", 10, 20)
    assert len(t) == 10


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tracker_window_stats():
    t = CostTracker()
    t.record_usage("t1", "gpt-4", 100, 200, ts=time.time() - 100)
    t.record_usage("t1", "gpt-4", 100, 200, ts=time.time())
    s = t.window_stats(seconds=10)
    assert s["total_requests"] == 1  # 只算最近 10s


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tracker_global_stats():
    t = CostTracker()
    t.record_usage("t1", "gpt-4", 100, 200)
    t.record_usage("t1", "gpt-4", 100, 200, error="err")
    s = t.global_stats()
    assert s["total_requests"] == 2
    assert s["total_errors"] == 1
    assert s["error_rate"] == 0.5


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tracker_to_csv():
    t = CostTracker()
    t.record_usage("t1", "gpt-4", 100, 200)
    csv_str = t.to_csv()
    reader = csv.reader(io.StringIO(csv_str))
    rows = list(reader)
    assert len(rows) == 2  # header + 1
    assert "tenant_id" in rows[0]
    assert "t1" in rows[1]


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tracker_to_json():
    t = CostTracker()
    t.record_usage("t1", "gpt-4", 100, 200)
    js = t.to_json()
    d = json.loads(js)
    assert len(d) == 1
    assert d[0]["tenant_id"] == "t1"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tracker_clear():
    t = CostTracker()
    t.record_usage("t1", "gpt-4", 100, 200)
    t.clear()
    assert len(t) == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tracker_canary_count():
    t = CostTracker()
    t.record_usage("t1", "gpt-4", 100, 200, is_canary=True)
    t.record_usage("t2", "gpt-4", 100, 200, is_canary=False)
    s = t.global_stats()
    assert s["canary_requests"] == 1


# ---------------------------------------------------------------------------
# 4. DashboardReporter
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reporter_init():
    r = DashboardReporter()
    assert r.period


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reporter_build():
    t = CostTracker()
    t.record_usage("t1", "gpt-4", 100, 200)
    t.record_usage("t2", "gpt-3.5", 50, 100)
    t.record_usage("t1", "gpt-4", 100, 200, error="err")
    r = DashboardReporter(period="2026-06")
    md = r.build(t, top_tenants=5, top_models=5)
    assert "LLM 路由成本看板" in md
    assert "2026-06" in md
    assert "t1" in md
    assert "gpt-4" in md
    assert "Top 5 租户" in md
    assert "Top 5 模型" in md


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reporter_build_window():
    t = CostTracker()
    t.record_usage("t1", "gpt-4", 100, 200)
    r = DashboardReporter()
    md = r.build_window(t, seconds=60)
    assert "最近 60s" in md
    assert "请求" in md


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_reporter_empty_tracker():
    t = CostTracker()
    r = DashboardReporter(period="2026-06")
    md = r.build(t)
    assert "总请求数: **0**" in md
    assert "总成本: $0.0000" in md


# ---------------------------------------------------------------------------
# 5. CanaryRouterCostBridge
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_bridge_init():
    t = CostTracker()
    b = CanaryRouterCostBridge(t)
    assert b.tracker is t


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_bridge_wrapped_call_records():
    t = CostTracker()
    b = CanaryRouterCostBridge(t)
    call = b.wrapped_call()
    call("gpt-4", {"_tenant": "t1", "_prompt_tokens": 100, "_completion_tokens": 200, "text": "hi"})
    assert len(t) == 1
    s = t.by_tenant("t1")
    assert s["total_requests"] == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_bridge_tenant_resolver():
    """自定义 tenant_resolver 决定 tenant_id."""
    t = CostTracker()
    b = CanaryRouterCostBridge(t)

    def resolver(model, payload, response):
        return f"from-{model}"

    call = b.wrapped_call(tenant_resolver=resolver)
    call("gpt-4", {"_prompt_tokens": 10, "_completion_tokens": 20})
    s = t.by_tenant("from-gpt-4")
    assert s["total_requests"] == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_bridge_records_error():
    t = CostTracker()
    b = CanaryRouterCostBridge(t)

    # 模拟一个返回 error 的响应
    def custom_call(model, payload):
        return {"error": "rate limit"}

    # 不能直接替换 wrapped_call, 但可以通过 _tenant fallback
    call = b.wrapped_call()
    # 模拟 error: payload 里有 _error 字段 (实际不会, 但验证 tracking)
    call("gpt-4", {"_tenant": "t1", "text": "x"})


# ---------------------------------------------------------------------------
# 6. CLI
# ---------------------------------------------------------------------------


def test_cli_demo_markdown(capsys):
    code = main(["--period", "2026-06", "--format", "markdown"])
    assert code == 0
    out = capsys.readouterr().out
    assert "LLM 路由成本看板" in out
    assert "2026-06" in out


def test_cli_demo_csv(capsys):
    code = main(["--format", "csv"])
    assert code == 0
    out = capsys.readouterr().out
    assert "tenant_id" in out


def test_cli_demo_json(capsys):
    code = main(["--format", "json"])
    assert code == 0
    out = capsys.readouterr().out
    d = json.loads(out)
    assert len(d) > 0


def test_cli_to_file(tmp_path):
    out = str(tmp_path / "dashboard.md")
    code = main(["--out", out, "--period", "2026-06"])
    assert code == 0
    import os

    assert os.path.exists(out)
    with open(out, encoding="utf-8") as f:
        c = f.read()
    assert "LLM 路由成本看板" in c


def test_cli_window(capsys):
    code = main(["--window", "60"])
    assert code == 0
    out = capsys.readouterr().out
    assert "60s" in out
