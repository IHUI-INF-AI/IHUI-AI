"""Prometheus 业务指标 tenant label 验证 (建议 117).

覆盖:
  - zhs_biz_requests_total labels 含 tenant_id
  - zhs_slow_sql_with_trace_total labels 含 tenant_id
  - BizTimer 默认走 tenant_id (不只 with_user=True)
  - 实际写入后 /metrics 输出含 tenant_id label
  - _trim_tenant_label cardinality 保护 (None / 空 / 过长)
  - set_request_context(tenant_id='xxx') 后 BizTimer 真的把 tenant_id='xxx' 写进 metric
  - drill_slow_sql_alert 写入的 tenant_id 不污染真实租户 (_drill_ 占位)
  - 多租户聚合 PromQL 示例可在 rules.yml / dashboards 中可用
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# 1. 指标定义层 (BIZ_REQUEST_TOTAL / SLOW_SQL_WITH_TRACE)
# ---------------------------------------------------------------------------


def test_biz_request_total_has_tenant_id_label():
    """BIZ_REQUEST_TOTAL 指标 labels 必须含 tenant_id."""
    from app.metrics_business import BIZ_REQUEST_TOTAL

    assert (
        "tenant_id" in BIZ_REQUEST_TOTAL._labelnames
    ), f"BIZ_REQUEST_TOTAL 应含 tenant_id label, 实际: {BIZ_REQUEST_TOTAL._labelnames}"


def test_slow_sql_with_trace_has_tenant_id_label():
    """SLOW_SQL_WITH_TRACE 指标 labels 必须含 tenant_id."""
    from app.monitoring import SLOW_SQL_WITH_TRACE

    assert (
        "tenant_id" in SLOW_SQL_WITH_TRACE._labelnames
    ), f"SLOW_SQL_WITH_TRACE 应含 tenant_id label, 实际: {SLOW_SQL_WITH_TRACE._labelnames}"


def test_biz_request_total_keeps_existing_labels():
    """旧 labels (endpoint / status) 不能丢."""
    from app.metrics_business import BIZ_REQUEST_TOTAL

    for k in ("endpoint", "status", "tenant_id"):
        assert k in BIZ_REQUEST_TOTAL._labelnames


def test_slow_sql_with_trace_keeps_existing_labels():
    """旧 labels (engine / table) 不能丢."""
    from app.monitoring import SLOW_SQL_WITH_TRACE

    for k in ("engine", "table", "tenant_id"):
        assert k in SLOW_SQL_WITH_TRACE._labelnames


# ---------------------------------------------------------------------------
# 2. _trim_tenant_label 行为
# ---------------------------------------------------------------------------


def test_trim_tenant_label_handles_none():
    from app.metrics_business import _trim_tenant_label

    assert _trim_tenant_label(None) == "anonymous"


def test_trim_tenant_label_handles_empty_string():
    from app.metrics_business import _trim_tenant_label

    assert _trim_tenant_label("") == "anonymous"


def test_trim_tenant_label_passes_through_short_string():
    from app.metrics_business import _trim_tenant_label

    assert _trim_tenant_label("tenant-1") == "tenant-1"


def test_trim_tenant_label_truncates_overlong_string():
    from app.metrics_business import _trim_tenant_label

    long = "a" * 200
    out = _trim_tenant_label(long)
    assert len(out) <= 64, f"截断后应 <= 64 字符, 实际: {len(out)}"
    assert "..." in out, "应含省略号占位"


def test_trim_tenant_label_converts_int():
    from app.metrics_business import _trim_tenant_label

    assert _trim_tenant_label(42) == "42"


# ---------------------------------------------------------------------------
# 3. BizTimer 默认带 tenant_id (不只 with_user=True)
# ---------------------------------------------------------------------------


def test_biztimer_default_uses_tenant_from_context():
    """BizTimer 默认应读 telemetry context 里的 tenant_id."""
    from app import telemetry
    from app.metrics_business import BIZ_REQUEST_TOTAL, BizTimer

    telemetry.set_request_context(tenant_id="acme-corp", reset=True)

    v0 = BIZ_REQUEST_TOTAL.labels(
        endpoint="default_tenant_test",
        status="200",
        tenant_id="acme-corp",
    )._value.get()
    with BizTimer("default_tenant_test") as t:
        t.status = "200"
    v1 = BIZ_REQUEST_TOTAL.labels(
        endpoint="default_tenant_test",
        status="200",
        tenant_id="acme-corp",
    )._value.get()
    assert v1 == v0 + 1, f"default BizTimer 应 +1, 实际 {v0} -> {v1}"


def test_biztimer_uses_anonymous_when_no_tenant_context():
    """context 为空时 BizTimer 应写 tenant_id='anonymous'."""
    from app import telemetry
    from app.metrics_business import BIZ_REQUEST_TOTAL, BizTimer

    telemetry.set_request_context(reset=True)

    v0 = BIZ_REQUEST_TOTAL.labels(
        endpoint="no_tenant_test",
        status="200",
        tenant_id="anonymous",
    )._value.get()
    with BizTimer("no_tenant_test") as t:
        t.status = "200"
    v1 = BIZ_REQUEST_TOTAL.labels(
        endpoint="no_tenant_test",
        status="200",
        tenant_id="anonymous",
    )._value.get()
    assert v1 == v0 + 1


def test_biztimer_with_user_also_writes_tenant_to_biz_request_total():
    """with_user=True 时, BIZ_REQUEST_TOTAL (非 by_user) 也应带 tenant_id."""
    from app import telemetry
    from app.metrics_business import BIZ_REQUEST_TOTAL, BizTimer

    telemetry.set_request_context(user_id="u-9", tenant_id="t-9", reset=True)

    v0 = BIZ_REQUEST_TOTAL.labels(
        endpoint="wuser_tenant_test",
        status="200",
        tenant_id="t-9",
    )._value.get()
    with BizTimer("wuser_tenant_test", with_user=True) as t:
        t.status = "200"
    v1 = BIZ_REQUEST_TOTAL.labels(
        endpoint="wuser_tenant_test",
        status="200",
        tenant_id="t-9",
    )._value.get()
    assert v1 == v0 + 1


# ---------------------------------------------------------------------------
# 4. drill 占位不污染真实租户指标
# ---------------------------------------------------------------------------


def test_drill_slow_sql_uses_drill_tenant_placeholder():
    """drill 场景的 SLOW_SQL_WITH_TRACE 应写 tenant_id='_drill_' 占位."""
    import scripts.ci.drill_slow_sql_alert as drill
    from app.monitoring import SLOW_SQL_WITH_TRACE

    v0 = SLOW_SQL_WITH_TRACE.labels(
        engine="pytest_drill_tenant",
        table="t_drill_tenant",
        tenant_id="_drill_",
    )._value.get()
    drill._simulate_slow_sql(sleep_s=0.0, engine="pytest_drill_tenant", table="t_drill_tenant", with_trace=True)
    v1 = SLOW_SQL_WITH_TRACE.labels(
        engine="pytest_drill_tenant",
        table="t_drill_tenant",
        tenant_id="_drill_",
    )._value.get()
    assert v1 == v0 + 1


# ---------------------------------------------------------------------------
# 5. video.py 内部 hardcode 改 anonymous
# ---------------------------------------------------------------------------


def test_video_hls_transcode_uses_anonymous_tenant():
    """app/api/v1/video.py 内部应 hardcode tenant_id='anonymous' (兜底)."""
    text = (ROOT / "app" / "api" / "v1" / "video.py").read_text(encoding="utf-8")
    assert 'tenant_id="anonymous"' in text, "video.py BIZ_REQUEST_TOTAL 应 hardcode tenant_id='anonymous'"


# ---------------------------------------------------------------------------
# 6. rules.yml + dashboard PromQL 应能按 tenant 维度聚合
# ---------------------------------------------------------------------------


def test_rules_yml_uses_tenant_aggregation_in_zhs_biz_requests():
    """rules.yml 应能按 tenant 维度聚合 zhs_biz_requests_total."""
    rules = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml"
    text = rules.read_text(encoding="utf-8")
    # 既有的 tenant-dominant-traffic 告警应按 tenant 聚合
    assert "zhs_biz_requests_total" in text
    # sum by (tenant) 是建议 117 关键表达式
    assert "sum by (tenant)" in text, "rules.yml 应支持 sum by (tenant) 聚合 (建议 117 多租户告警)"


def test_dashboard_supports_tenant_legend():
    """Grafana dashboard 应能按 tenant 维度显示图例."""
    dashboard = ROOT / "deploy" / "helm" / "zhs-platform" / "dashboards" / "zhs_biz_overview.json"
    text = dashboard.read_text(encoding="utf-8")
    # 应有 sum by (tenant) 类的表达式
    assert "by (tenant" in text or "by (tenant)" in text, "dashboard 应支持 by (tenant) 维度 (建议 117 多租户面板)"


# ---------------------------------------------------------------------------
# 7. Cardinality 保护 (Prometheus 侧文档)
# ---------------------------------------------------------------------------


def test_metrics_business_doc_mentions_cardinality_protection():
    """metrics_business.py 顶部应有 cardinality 保护说明."""
    text = (ROOT / "app" / "metrics_business.py").read_text(encoding="utf-8")
    assert "cardinality" in text.lower()
    assert "_trim_tenant_label" in text


def test_tenant_label_value_normalized_to_anonymous_for_empty():
    """空 tenant 统一归一为 'anonymous' (避免 '_unknown_' 与 'anonymous' 混用)."""
    from app.metrics_business import _trim_tenant_label, _trim_user_label

    # 两个函数的空值处理必须一致
    assert _trim_tenant_label(None) == _trim_user_label(None), "空值 fallback 必须一致 (anonymous)"
    assert _trim_tenant_label("") == _trim_user_label(""), "空字符串 fallback 必须一致 (anonymous)"
