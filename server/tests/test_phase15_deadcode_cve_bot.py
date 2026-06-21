"""Phase 15 建议 3 测试: 死代码 CI + CVE 自动 PR."""

from __future__ import annotations

import json
import os
import subprocess
from unittest.mock import MagicMock, patch

import pytest

try:
    from scripts.ci.deadcode_cve_bot import (
        AutoPRCreator,
        CVEItem,
        CVEReport,
        CVEScanner,
        DeadCodeItem,
        DeadCodeReport,
        DeadCodeScanner,
        GHAReportBuilder,
        main,
    )

    HAS_MODULE = True
except ImportError:
    HAS_MODULE = False
    DeadCodeItem = DeadCodeReport = DeadCodeScanner = None
    CVEItem = CVEReport = CVEScanner = None
    GHAReportBuilder = AutoPRCreator = main = None


# ---------------------------------------------------------------------------
# 1. 数据类
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_deadcode_item_to_markdown():
    x = DeadCodeItem(file="a/b.py", line=10, func="foo", confidence=85)
    md = x.to_markdown()
    assert "a/b.py" in md
    assert "10" in md
    assert "foo" in md
    assert "85" in md


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_deadcode_report_counts():
    r = DeadCodeReport(
        items=[
            DeadCodeItem("a.py", 1, "f1", 50),
            DeadCodeItem("b.py", 2, "f2", 90),
        ]
    )
    assert r.high_confidence_count == 1
    d = r.to_dict()
    assert d["total"] == 2
    assert d["high_confidence"] == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cve_item_to_markdown():
    x = CVEItem(package="requests", installed="2.0", fixed="2.20", severity="HIGH", cve_id="CVE-2023-0001")
    md = x.to_markdown()
    assert "requests" in md
    assert "HIGH" in md
    assert "CVE-2023-0001" in md


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cve_report_counts():
    r = CVEReport(
        items=[
            CVEItem("a", "1", "2", "CRITICAL", "C1"),
            CVEItem("b", "1", "2", "HIGH", "C2"),
            CVEItem("c", "1", "2", "LOW", "C3"),
        ]
    )
    assert r.critical_count == 1
    assert r.high_count == 1


# ---------------------------------------------------------------------------
# 2. DeadCodeScanner
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_deadcode_scanner_is_available_returns_bool():
    s = DeadCodeScanner()
    assert isinstance(s.is_available(), bool)


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_deadcode_scanner_parse_line():
    s = DeadCodeScanner()
    line = "scripts/ops/foo.py:123: unused_func (80% confidence)"
    item = s._parse_line(line)
    assert item is not None
    assert item.file == "scripts/ops/foo.py"
    assert item.line == 123
    assert item.func == "unused_func"
    assert item.confidence == 80


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_deadcode_scanner_parse_invalid():
    s = DeadCodeScanner()
    assert s._parse_line("garbage line") is None
    assert s._parse_line("") is None
    assert s._parse_line("a.py") is None


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_deadcode_scanner_unavailable():
    s = DeadCodeScanner()
    with patch.object(s, "is_available", return_value=False):
        r = s.scan(["scripts"])
    assert "vulture" in r.error


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_deadcode_scanner_parses_output():
    s = DeadCodeScanner()
    fake_output = "scripts/a.py:10: foo (80% confidence)\n" "scripts/b.py:20: bar (50% confidence)\n"
    fake_proc = MagicMock()
    fake_proc.stdout = fake_output
    fake_proc.returncode = 0
    with (
        patch.object(s, "is_available", return_value=True),
        patch("subprocess.run", side_effect=[fake_proc, MagicMock(stdout="scripts/a.py\n")]),
    ):
        r = s.scan(["scripts"])
    assert len(r.items) == 2
    assert r.items[0].func == "foo"
    assert r.items[0].confidence == 80


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_deadcode_scanner_timeout():
    s = DeadCodeScanner()
    with (
        patch.object(s, "is_available", return_value=True),
        patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="vulture", timeout=300)),
    ):
        r = s.scan(["scripts"])
    assert "超时" in r.error


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_deadcode_scanner_filenotfound():
    s = DeadCodeScanner()
    with (
        patch.object(s, "is_available", return_value=True),
        patch("subprocess.run", side_effect=FileNotFoundError("no vulture")),
    ):
        r = s.scan(["scripts"])
    assert "启动失败" in r.error


# ---------------------------------------------------------------------------
# 3. CVEScanner
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cve_scanner_is_available_returns_bool():
    s = CVEScanner()
    assert isinstance(s.is_available(), bool)


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cve_scanner_unavailable():
    s = CVEScanner()
    with patch.object(s, "is_available", return_value=False):
        r = s.scan("requirements.txt")
    assert "未安装" in r.error


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cve_scanner_pip_audit_parses():
    s = CVEScanner(severity_threshold="MEDIUM")
    pip_audit_json = json.dumps(
        [
            {
                "name": "requests",
                "version": "2.0.0",
                "vulns": [
                    {
                        "id": "CVE-2023-0001",
                        "severity": "HIGH",
                        "fix_versions": ["2.20.0"],
                        "description": "test vuln",
                    },
                    {
                        "id": "CVE-2023-0002",
                        "severity": "LOW",
                        "fix_versions": ["2.21.0"],
                        "description": "low severity",
                    },
                ],
            },
        ]
    )
    fake_proc = MagicMock(stdout=pip_audit_json, returncode=0)
    with (
        patch.object(s, "_which", side_effect=lambda x: "pip-audit" if x == "pip-audit" else None),
        patch("subprocess.run", return_value=fake_proc),
    ):
        r = s.scan("requirements.txt")
    # MEDIUM 阈值应过滤掉 LOW
    assert len(r.items) == 1
    assert r.items[0].package == "requests"
    assert r.items[0].severity == "HIGH"
    assert r.scanned_packages == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cve_scanner_safety_parses():
    s = CVEScanner(severity_threshold="MEDIUM")
    safety_json = json.dumps(
        {
            "vulnerabilities": [
                {
                    "package_name": "django",
                    "analyzed_version": "1.0",
                    "severity": "CRITICAL",
                    "CVE": "CVE-2024-9999",
                    "fixed_versions": ["1.1"],
                    "description": "bad",
                },
            ]
        }
    )
    fake_proc = MagicMock(stdout=safety_json, returncode=0)
    with (
        patch.object(s, "_which", side_effect=lambda x: "safety" if x == "safety" else None),
        patch("subprocess.run", return_value=fake_proc),
    ):
        r = s.scan("requirements.txt")
    assert len(r.items) == 1
    assert r.items[0].cve_id == "CVE-2024-9999"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cve_scanner_severity_filter():
    s = CVEScanner(severity_threshold="HIGH")
    pip_audit_json = json.dumps(
        [
            {
                "name": "pkg",
                "version": "1.0",
                "vulns": [
                    {"id": "C1", "severity": "CRITICAL", "fix_versions": ["2.0"]},
                    {"id": "C2", "severity": "MEDIUM", "fix_versions": ["2.0"]},
                ],
            }
        ]
    )
    fake_proc = MagicMock(stdout=pip_audit_json, returncode=0)
    with (
        patch.object(s, "_which", side_effect=lambda x: "pip-audit" if x == "pip-audit" else None),
        patch("subprocess.run", return_value=fake_proc),
    ):
        r = s.scan("requirements.txt")
    # HIGH 阈值: 1 CRITICAL 保留, 1 MEDIUM 过滤
    assert len(r.items) == 1
    assert r.items[0].severity == "CRITICAL"


# ---------------------------------------------------------------------------
# 4. GHAReportBuilder
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_report_builder_basic():
    dc = DeadCodeReport(
        items=[
            DeadCodeItem("a.py", 1, "f", 90),
        ],
        scanned_files=10,
    )
    cve = CVEReport(
        items=[
            CVEItem("p", "1", "2", "HIGH", "CVE-X"),
        ],
        scanned_packages=5,
    )
    report = GHAReportBuilder().build(dc, cve)
    assert "死代码 + CVE 扫描报告" in report
    assert "vulture" in report
    assert "pip-audit" in report
    assert "a.py" in report
    assert "p" in report
    assert "CVE-X" in report


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_report_builder_with_errors():
    dc = DeadCodeReport(error="vulture not found")
    cve = CVEReport(error="pip-audit not found")
    report = GHAReportBuilder().build(dc, cve)
    assert "vulture not found" in report
    assert "pip-audit not found" in report


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_report_builder_empty():
    dc = DeadCodeReport(scanned_files=5)
    cve = CVEReport(scanned_packages=3)
    report = GHAReportBuilder().build(dc, cve)
    assert "无死代码" in report
    assert "无已知漏洞" in report


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_report_builder_truncates_long_list():
    items = [DeadCodeItem(f"f{i}.py", i, f"func_{i}", 60) for i in range(50)]
    dc = DeadCodeReport(items=items, scanned_files=100)
    cve = CVEReport()
    report = GHAReportBuilder().build(dc, cve)
    assert "还有 20 项" in report


# ---------------------------------------------------------------------------
# 5. AutoPRCreator
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_pr_creator_init():
    p = AutoPRCreator("owner/repo", "token123", branch="zhs/test")
    assert p.repo == "owner/repo"
    assert p.token == "token123"
    assert p.branch == "zhs/test"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_pr_creator_creates_new():
    p = AutoPRCreator("owner/repo", "tok")
    # find_open_pr -> None
    with (
        patch.object(p, "find_open_pr", return_value=None),
        patch.object(p, "_api", return_value=(201, {"number": 42})) as mock_api,
    ):
        r = p.upsert_pr("title", "body")
    assert r["action"] == "created"
    assert r["number"] == 42
    # 最后一次调用应该是 POST /pulls
    last_call = mock_api.call_args_list[-1]
    assert last_call.args[0] == "/pulls"
    assert last_call.kwargs.get("method") == "POST"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_pr_creator_updates_existing():
    p = AutoPRCreator("owner/repo", "tok")
    existing = {"number": 7, "head": {"ref": "zhs/auto-fix-deps"}}
    with (
        patch.object(p, "find_open_pr", return_value=existing),
        patch.object(p, "_api", return_value=(200, {"number": 7})) as mock_api,
    ):
        r = p.upsert_pr("title", "body")
    assert r["action"] == "updated"
    assert r["number"] == 7
    last_call = mock_api.call_args_list[-1]
    assert last_call.args[0] == "/pulls/7"
    assert last_call.kwargs.get("method") == "PATCH"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_pr_creator_find_open_pr_empty():
    p = AutoPRCreator("owner/repo", "tok")
    with patch.object(p, "_api", return_value=(200, [])):
        r = p.find_open_pr("branch", "main")
    assert r is None


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_pr_creator_add_comment():
    p = AutoPRCreator("owner/repo", "tok")
    with patch.object(p, "_api", return_value=(201, {"id": 99})) as mock_api:
        r = p.add_comment(7, "comment body")
    assert r["code"] == 201
    assert mock_api.call_args[0][0] == "/issues/7/comments"


# ---------------------------------------------------------------------------
# 6. CLI
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cli_runs(tmp_path, capsys, monkeypatch):
    """CLI 能跑 (使用 mock 的 scanner)."""
    fake_dc = DeadCodeReport(items=[], scanned_files=10)
    fake_cve = CVEReport(items=[], scanned_packages=5)
    monkeypatch.setattr("scripts.ci.deadcode_cve_bot.DeadCodeScanner.scan", lambda self, paths: fake_dc)
    monkeypatch.setattr("scripts.ci.deadcode_cve_bot.CVEScanner.scan", lambda self, req: fake_cve)
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("GITHUB_REPOSITORY", raising=False)
    code = main(["--path", "scripts", "--dry-run"])
    assert code == 0
    out = capsys.readouterr().out
    assert "无死代码" in out
    assert "无已知漏洞" in out


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_cli_with_output_file(tmp_path, monkeypatch):
    """CLI 写报告到文件."""
    fake_dc = DeadCodeReport(items=[DeadCodeItem("x.py", 1, "f", 90)], scanned_files=1)
    fake_cve = CVEReport(items=[], scanned_packages=0)
    monkeypatch.setattr("scripts.ci.deadcode_cve_bot.DeadCodeScanner.scan", lambda self, paths: fake_dc)
    monkeypatch.setattr("scripts.ci.deadcode_cve_bot.CVEScanner.scan", lambda self, req: fake_cve)
    out_path = str(tmp_path / "report.md")
    code = main(["--path", "scripts", "--out", out_path, "--dry-run"])
    assert code == 0
    assert os.path.exists(out_path)
    with open(out_path, encoding="utf-8") as f:
        content = f.read()
    assert "x.py" in content
