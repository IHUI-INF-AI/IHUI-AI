"""Phase 9 建议 5: Phase 8 演练报告归档验证.

验证点:
  1. collect_artifacts 收集 drill_report + inhibit + oidc 3 类
  2. make_zip 生成有效 zip, 含 manifest + 所有 artifacts
  3. SHA256 校验和与 manifest 一致
  4. push_to_s3_or_local local 模式推到 logs/archive/_s3_mock/
  5. 归档清单 (manifest) 含 file list + retention_days
  6. workflow YAML 含 archive-drill-report job + upload-artifact
"""

from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.ops.archive_phase8_drill import (  # noqa: E402
    _sha256,
    build_manifest,
    collect_artifacts,
    make_zip,
    push_to_s3_or_local,
)


@pytest.fixture
def setup_demo_artifacts(tmp_path, monkeypatch):
    """准备演示产物: drill_report + 抑制工单 + oidc 审计."""
    # drill_report.md
    drill = ROOT / "drill_report.md"
    if not drill.exists():
        drill.write_text(
            "## Phase 8 Drill\n" "- check-alert-rules: success\n" "- canary-bridge-drill: failure\n",
            encoding="utf-8",
        )

    # 抑制工单
    inhibit_dir = ROOT / "logs" / "inhibit_tickets"
    inhibit_dir.mkdir(parents=True, exist_ok=True)
    (inhibit_dir / "20260101.md").write_text("# 抑制工单 20260101\n", encoding="utf-8")
    (inhibit_dir / "20260101.json").write_text(
        json.dumps({"ticket_count": 2, "tickets": []}, ensure_ascii=False),
        encoding="utf-8",
    )

    # OIDC 审计
    oidc_dir = ROOT / "logs" / "oidc_test"
    oidc_dir.mkdir(parents=True, exist_ok=True)
    (oidc_dir / "grafana.tok").write_text("mock.token", encoding="utf-8")
    (oidc_dir / "grafana.tok.meta.json").write_text(
        json.dumps({"provider": "grafana", "ttl_min": 30}, ensure_ascii=False),
        encoding="utf-8",
    )

    yield

    # 不清理 - 复用现有产物, 避免污染其他测试


def test_collect_artifacts_includes_drill_report(setup_demo_artifacts):
    """collect_artifacts 必须收集到 drill_report."""
    artifacts = collect_artifacts("20260101")
    assert "drill_report" in artifacts
    assert artifacts["drill_report"].name == "drill_report.md"


def test_collect_artifacts_includes_inhibit_ticket(setup_demo_artifacts):
    """抑制工单 md 和 json 都被收集."""
    artifacts = collect_artifacts("20260101")
    assert "inhibit_md" in artifacts
    assert "inhibit_json" in artifacts


def test_collect_artifacts_includes_oidc_audit(setup_demo_artifacts):
    """OIDC 审计目录被收集."""
    artifacts = collect_artifacts("20260101")
    assert "oidc_audit" in artifacts


def test_collect_artifacts_empty_for_missing_date():
    """不存在的日期 - 抑制工单类不会进 artifacts, 但 drill_report.md 永远在."""
    artifacts = collect_artifacts("99991231")
    # drill_report 始终在, 但 inhibit_<suffix> 不会
    inhibit_keys = [k for k in artifacts if k.startswith("inhibit_")]
    assert inhibit_keys == []


def test_make_zip_creates_valid_archive(setup_demo_artifacts, tmp_path):
    """make_zip 生成有效 zip, 含所有 artifacts."""
    artifacts = collect_artifacts("20260101")
    out_path = tmp_path / "test.zip"
    result = make_zip("20260101", artifacts, out_path)
    assert result == out_path
    assert out_path.exists()
    assert zipfile.is_zipfile(out_path)
    # 打开 zip 验证内容
    with zipfile.ZipFile(out_path, "r") as zf:
        names = zf.namelist()
        # 必有 drill_report.md
        assert any("drill_report.md" in n for n in names)
        # 必有抑制工单
        assert any("20260101.md" in n for n in names)
        assert any("20260101.json" in n for n in names)
        # 必有 oidc 审计文件
        assert any("oidc_audit/" in n for n in names)


def test_manifest_has_retention_and_compliance(setup_demo_artifacts, tmp_path):
    """manifest 含 retention_days + compliance 字段."""
    artifacts = collect_artifacts("20260101")
    zip_path = tmp_path / "test.zip"
    make_zip("20260101", artifacts, zip_path)
    manifest = build_manifest("20260101", artifacts, zip_path)
    assert manifest["retention_days"] == 90
    assert "ISO27001" in manifest["compliance"]
    assert "file_count" in manifest
    assert manifest["file_count"] >= 1
    assert manifest["zip_sha256"] == _sha256(zip_path)


def test_push_to_s3_or_local_creates_mock_file(setup_demo_artifacts, tmp_path):
    """local 模式推到 logs/archive/_s3_mock/<key>."""
    artifacts = collect_artifacts("20260101")
    zip_path = tmp_path / "test.zip"
    make_zip("20260101", artifacts, zip_path)
    result = push_to_s3_or_local(zip_path, "local", "phase8/20260101/test.zip")
    assert result["target"] == "local-mock"
    assert result["bucket"] == "local"
    # Windows 路径用反斜杠, 校验末段
    assert result["key"].replace("\\", "/").endswith("phase8/20260101/test.zip")
    # 验证文件真的被复制
    mock_file = ROOT / result["key"]
    assert mock_file.exists()
    assert mock_file.stat().st_size == zip_path.stat().st_size
    # 清理 mock 文件
    mock_file.unlink()
    mock_dir = mock_file.parent
    if mock_dir.exists() and not any(mock_dir.iterdir()):
        mock_dir.rmdir()


def test_workflow_contains_archive_drill_report_job():
    """workflow YAML 含 archive-drill-report job."""
    wf_path = ROOT / ".github" / "workflows" / "weekly-phase8-drill.yml"
    data = yaml.safe_load(wf_path.read_text(encoding="utf-8"))
    # yaml 1.1 把 on 解析为 True, jobs 仍在顶层
    jobs = data["jobs"]
    assert "archive-drill-report" in jobs
    archive_job = jobs["archive-drill-report"]
    assert "Archive Phase 8 Drill Report" in archive_job.get("name", "")


def test_workflow_archive_uses_upload_artifact():
    """archive job 含 actions/upload-artifact@v4 步骤."""
    wf_text = (ROOT / ".github" / "workflows" / "weekly-phase8-drill.yml").read_text(encoding="utf-8")
    assert "actions/upload-artifact@v4" in wf_text
    assert "phase8-drill-archive-" in wf_text
    assert "retention-days: 30" in wf_text


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
