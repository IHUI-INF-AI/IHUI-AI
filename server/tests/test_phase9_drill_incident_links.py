"""Phase 9 建议 4: Grafana Annotations 跳板 (incident 短链 + runbook) 验证.

验证点:
  1. make_incident_id 确定性 (相同输入相同输出)
  2. 不同 run_id 产出不同 incident_id
  3. runbook/ticket/status URL 拼接正确
  4. build_annotations 必含: incident_id tag, runbook url, status page url
  5. 失败 job annotation 含 ticket + 抑制工单 跳板
  6. 成功 job annotation 不含 ticket
  7. summary annotation 跨 job 一致 (incident_id 相同)
  8. data 字段含 incident_id 供 Grafana 跳转变量
  9. workflow YAML 调用 push_drill_annotations 时传 --run-id
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.ops.push_drill_annotations import (  # noqa: E402
    INCIDENT_BASE,
    RUNBOOK_BASE,
    TICKET_BASE,
    build_annotations,
    build_runbook_url,
    build_status_url,
    build_ticket_url,
    make_incident_id,
)


def test_incident_id_deterministic():
    """相同 date+run_id 必须产出相同 incident_id."""
    a = make_incident_id("20260616", "12345")
    b = make_incident_id("20260616", "12345")
    assert a == b
    assert re.match(r"^INC-\d{8}-[A-F0-9]{6}$", a), f"格式不符: {a}"


def test_incident_id_differs_for_different_runs():
    """不同 run_id 产出不同 incident_id."""
    a = make_incident_id("20260616", "12345")
    b = make_incident_id("20260616", "67890")
    assert a != b


def test_runbook_url_format():
    url = build_runbook_url("canary-bridge-drill")
    assert url.startswith(RUNBOOK_BASE)
    assert "phase8/canary-bridge" in url


def test_runbook_url_unknown_job_fallback():
    """未知 job 走通用 phase8/general runbook."""
    url = build_runbook_url("totally-unknown-job")
    assert url.endswith("phase8/general")


def test_ticket_url_format():
    url = build_ticket_url("INC-20260616-ABCDEF")
    assert url.startswith(TICKET_BASE)
    assert "ZHS-INC-20260616-ABCDEF" in url


def test_status_url_format():
    url = build_status_url("INC-20260616-ABCDEF")
    assert url.startswith(INCIDENT_BASE)
    assert "INC-20260616-ABCDEF" in url


def test_build_annotations_includes_incident_id_tag():
    """每个 annotation 的 tags 必须含 incident:<id>."""
    results = {
        "check-alert-rules": "success",
        "canary-bridge-drill": "failure",
    }
    anns = build_annotations("20260616", results, "https://gh/runs/1", run_id="1")
    assert len(anns) >= 3  # 1 summary + 2 jobs
    incident_id = make_incident_id("20260616", "1")
    for a in anns:
        assert any(t.startswith("incident:") for t in a["tags"]), f"annotation 缺 incident tag: {a['tags']}"
        assert f"incident:{incident_id}" in a["tags"]


def test_build_annotations_includes_runbook_url():
    """每个 job annotation 必须含 runbook URL."""
    results = {"check-alert-rules": "success", "canary-bridge-drill": "failure"}
    anns = build_annotations("20260616", results, "https://gh/runs/1", run_id="1")
    # 跳过 summary annotation
    job_anns = [a for a in anns if "summary" not in a["tags"]]
    for a in job_anns:
        assert "wiki.zhs.top/runbook" in a["text"], f"缺 runbook url: {a['text']}"


def test_build_annotations_failure_includes_ticket():
    """失败 job annotation 必含 ticket URL."""
    results = {"canary-bridge-drill": "failure"}
    anns = build_annotations("20260616", results, "https://gh/runs/1", run_id="1")
    fail_ann = [a for a in anns if a["tags"][1] == "canary-bridge-drill"][0]
    assert "jira.zhs.top" in fail_ann["text"]
    assert "ZHS-INC-" in fail_ann["text"]
    assert "inhibit_tickets" in fail_ann["text"]


def test_build_annotations_success_no_ticket():
    """成功 job annotation 不应含 ticket URL."""
    results = {"check-alert-rules": "success"}
    anns = build_annotations("20260616", results, "https://gh/runs/1", run_id="1")
    succ_ann = [a for a in anns if a["tags"][1] == "check-alert-rules"][0]
    assert "jira.zhs.top" not in succ_ann["text"]
    assert "inhibit_tickets" not in succ_ann["text"]


def test_build_annotations_summary_uses_same_incident_id():
    """summary annotation 的 incident_id 与 job annotation 一致."""
    results = {"a": "success", "b": "failure"}
    anns = build_annotations("20260616", results, "url", run_id="99")
    summary = [a for a in anns if "summary" in a["tags"]][0]
    jobs = [a for a in anns if "summary" not in a["tags"]]
    summary_id = next(t for t in summary["tags"] if t.startswith("incident:"))
    for ja in jobs:
        assert summary_id in ja["tags"]


def test_build_annotations_data_field_structure():
    """data 字段含 incident_id/job/status/date/run_id 供 Grafana 跳转变量."""
    results = {"canary-bridge-drill": "failure"}
    anns = build_annotations("20260616", results, "https://gh/runs/1", run_id="1")
    job_ann = [a for a in anns if a["tags"][1] == "canary-bridge-drill"][0]
    data = job_ann["data"]
    for k in ("incident_id", "job", "status", "date", "run_id", "run_url", "runbook_url", "ticket_url"):
        assert k in data, f"data 缺 {k}: {data}"
    assert data["ticket_url"] != ""  # 失败时 ticket 必有


def test_workflow_passes_run_id_to_push_drill_annotations():
    """workflow YAML 调用 push_drill_annotations.py 必须传 --run-id."""
    wf_path = ROOT / ".github" / "workflows" / "weekly-phase8-drill.yml"
    wf_text = wf_path.read_text(encoding="utf-8")
    assert "--run-id" in wf_text
    assert "github.run_id" in wf_text


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
