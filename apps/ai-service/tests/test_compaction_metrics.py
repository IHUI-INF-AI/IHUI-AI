# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""1-3 压缩生产指标采集测试(2026-09-12 立,PROJECT_PLAN H7)。

覆盖:压缩比计算与事件字段 / Prometheus 双通道计数 / 回捞命中计数 /
run outcome 记录 / 报告聚合(avg_ratio/hit_rate/success_rate)/
对比报告纯函数(within_threshold 边界)/ fail-open / reset 隔离。
"""

import pytest
from prometheus_client import REGISTRY

from app.services import compaction_metrics as cm


@pytest.fixture(autouse=True)
def _reset_metrics():
    """测试隔离:每个用例前后清空进程内存储(报告断言不受其他用例污染)。"""
    cm.reset_compaction_metrics()
    yield
    cm.reset_compaction_metrics()


def _sample_info(**overrides) -> dict:
    info = {
        "compressed": True,
        "original_tokens": 10000,
        "compressed_tokens": 6000,
        "removed_count": 8,
        "trigger": "ratio",
        "llm_summary": False,
    }
    info.update(overrides)
    return info


def _prom_count(name: str, labels: dict) -> float:
    value = REGISTRY.get_sample_value(name, labels)
    return float(value or 0.0)


def test_record_event_ratio_and_fields():
    metric = cm.record_compaction_event(
        session_id="s1",
        info=_sample_info(),
        source="agent_loop",
        run_id="r1",
        duration_ms=12.5,
    )
    # 压缩比 = 6000/10000 = 0.6;结构化字段完整
    assert metric["ratio"] == 0.6
    assert metric["original_tokens"] == 10000
    assert metric["compressed_tokens"] == 6000
    assert metric["trigger"] == "ratio"
    assert metric["llm_summary"] is False
    assert metric["duration_ms"] == 12.5
    assert metric["run_id"] == "r1"
    assert metric["event_id"].startswith("cme-")
    # 报告端点通道:事件计数 + 平均压缩比
    report = cm.get_compaction_metrics_report()
    assert report["events_total"] == 1
    assert report["avg_ratio"] == 0.6
    assert report["by_trigger"]["ratio"] == 1


def test_record_event_prometheus_channel():
    before = _prom_count(
        "ihui_compaction_events_total", {"trigger": "ratio", "llm_summary": "False"}
    )
    cm.record_compaction_event(session_id="s1", info=_sample_info())
    after = _prom_count(
        "ihui_compaction_events_total", {"trigger": "ratio", "llm_summary": "False"}
    )
    assert after == before + 1
    # 耗时直方图样本存在(observe 过)
    assert REGISTRY.get_sample_value("ihui_compaction_duration_seconds_count") is not None


def test_record_event_retention_from_quality():
    info = _sample_info(
        llm_summary=True,
        trigger="llm",
        quality={"report": {"retention_ratio": 0.875}},
    )
    metric = cm.record_compaction_event(session_id="s2", info=info)
    assert metric["llm_summary"] is True
    assert metric["retention_ratio"] == 0.875
    report = cm.get_compaction_metrics_report()
    assert report["avg_retention_ratio"] == 0.875
    assert report["by_trigger"]["llm"] == 1


def test_record_event_original_zero_ratio_zero():
    metric = cm.record_compaction_event(
        session_id="s3", info=_sample_info(original_tokens=0, compressed_tokens=0)
    )
    assert metric["ratio"] == 0.0


def test_record_event_fail_open_on_bad_info():
    """info 字段非法 → 不抛异常,返回空 dict(fail-open,绝不影响主链路)。"""
    metric = cm.record_compaction_event(
        session_id="s4", info={"original_tokens": "abc"}  # type: ignore[dict-item]
    )
    assert metric == {}


def test_recall_hit_rate_in_report():
    cm.record_recall_query(session_id="s1", hit=True, result_count=3)
    cm.record_recall_query(session_id="s1", hit=False, result_count=0)
    report = cm.get_compaction_metrics_report()
    assert report["recall"]["queries"] == 2
    assert report["recall"]["hits"] == 1
    assert report["recall"]["hit_rate"] == 0.5


def test_run_outcome_success_rate_in_report():
    cm.record_compaction_run_outcome(
        run_id="r1", session_id="s1", success=True, event_count=2
    )
    cm.record_compaction_run_outcome(
        run_id="r2", session_id="s1", success=False, event_count=1
    )
    report = cm.get_compaction_metrics_report()
    assert report["runs"]["total"] == 2
    assert report["runs"]["success"] == 1
    assert report["runs"]["success_rate"] == 0.5


def test_report_recent_events_limit_newest_first():
    for i in range(3):
        cm.record_compaction_event(
            session_id=f"s{i}", info=_sample_info(original_tokens=1000 + i)
        )
    report = cm.get_compaction_metrics_report(limit=2)
    assert len(report["recent_events"]) == 2
    # 最新在前:最新事件的 original_tokens = 1002
    assert report["recent_events"][0]["original_tokens"] == 1002


def test_reset_clears_state():
    cm.record_compaction_event(session_id="s1", info=_sample_info())
    cm.record_recall_query(session_id="s1", hit=True)
    cm.record_compaction_run_outcome(run_id="r1", session_id="s1", success=True)
    cm.reset_compaction_metrics()
    report = cm.get_compaction_metrics_report()
    assert report["events_total"] == 0
    assert report["recall"]["queries"] == 0
    assert report["runs"]["total"] == 0
    assert report["recent_events"] == []


def _results(n: int, passes: int) -> list[dict]:
    return [{"id": f"t{i}", "pass": i < passes} for i in range(n)]


def test_comparison_report_within_threshold():
    off = _results(10, 10)
    on = _results(10, 10)
    report = cm.build_comparison_report(off, on)
    assert report["off"]["pass_rate"] == 1.0
    assert report["on"]["pass_rate"] == 1.0
    assert report["success_rate_drop"] == 0.0
    assert report["within_threshold"] is True
    assert report["comparison_valid"] is True


def test_comparison_report_drop_exactly_2_percent_ok():
    # 100 任务掉 2 个:下降恰好 2% → 阈值内(≤ 2%)
    off = _results(100, 100)
    on = _results(100, 98)
    report = cm.build_comparison_report(off, on)
    assert report["success_rate_drop"] == 0.02
    assert report["within_threshold"] is True


def test_comparison_report_drop_exceeds_threshold():
    off = _results(100, 100)
    on = _results(100, 97)
    report = cm.build_comparison_report(off, on)
    assert report["success_rate_drop"] == 0.03
    assert report["within_threshold"] is False


def test_comparison_report_on_better_drop_negative():
    off = _results(10, 8)
    on = _results(10, 10)
    report = cm.build_comparison_report(off, on)
    assert report["success_rate_drop"] == -0.2
    assert report["within_threshold"] is True


def test_comparison_report_invalid_mismatched_counts():
    off = _results(10, 10)
    on = _results(8, 8)
    report = cm.build_comparison_report(off, on)
    assert report["comparison_valid"] is False
    assert report["within_threshold"] is False


def test_comparison_report_empty_off_invalid():
    report = cm.build_comparison_report([], _results(2, 2))
    assert report["off"]["total"] == 0
    assert report["comparison_valid"] is False
    assert report["within_threshold"] is False


async def test_metrics_report_endpoint_admin_gate(monkeypatch):
    """/metrics-report 端点:非 admin 403;admin 返回全量指标报告。"""
    from types import SimpleNamespace

    from fastapi import HTTPException

    import app.routers.context_compaction as router_mod

    cm.record_compaction_event(
        session_id="s1", info=_sample_info(), source="agent_loop", run_id="r1"
    )
    monkeypatch.setattr(router_mod, "get_current_user_id_sync", lambda request: "u1")

    # 非 admin(role_id=0)→ 403
    req = SimpleNamespace(state=SimpleNamespace(role_id=0))
    with pytest.raises(HTTPException) as exc_info:
        await router_mod.get_compaction_metrics(request=req, limit=10)  # type: ignore[arg-type]
    assert exc_info.value.status_code == 403

    # admin(role_id >= 1)→ 报告含已记录事件
    req_admin = SimpleNamespace(state=SimpleNamespace(role_id=2))
    report = await router_mod.get_compaction_metrics(request=req_admin, limit=10)  # type: ignore[arg-type]
    assert report["events_total"] == 1
    assert report["recent_events"][0]["session_id"] == "s1"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
