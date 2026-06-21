"""Prometheus 告警规则规范化 (建议 110) 单元测试.

覆盖:
  - check_alert_rules.py 主函数 (默认参数 / --no-helm-check / --path 自定义)
  - 验证所有告警有 service=zhs-platform
  - 验证所有告警有合法 severity (critical / warning / info)
  - 验证所有告警有 summary / description annotation
  - 验证 expr 健全性 (PromQL 关键字 或 比较运算符)
  - 验证 helm 副本与主副本一致
  - 注入坏规则应能检测并返回非 0
  - dashboard 顶层 link 用 service:zhs-platform 搜索
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
import check_alert_rules as checker  # noqa: E402

# ---------------------------------------------------------------------------
# 1. 主函数 + argparse
# ---------------------------------------------------------------------------


def test_main_default_returns_zero(monkeypatch):
    """默认参数 (检查 docker/prometheus/rules.yml) 应 PASS."""
    test_args = ["check_alert_rules.py"]
    monkeypatch.setattr(sys, "argv", test_args)
    rc = checker.main()
    assert rc == 0, f"默认检查应 PASS, 实际 rc={rc}"


def test_main_with_explicit_path(monkeypatch):
    """--path 自定义路径."""
    test_args = ["check_alert_rules.py", "--path", str(ROOT / "docker" / "prometheus" / "rules.yml"), "--no-helm-check"]
    monkeypatch.setattr(sys, "argv", test_args)
    rc = checker.main()
    assert rc == 0


def test_main_no_helm_check(monkeypatch, capsys):
    """--no-helm-check 跳过 helm 一致性检查."""
    test_args = ["check_alert_rules.py", "--no-helm-check"]
    monkeypatch.setattr(sys, "argv", test_args)
    rc = checker.main()
    captured = capsys.readouterr()
    assert rc == 0
    assert "跳过" in captured.out


# ---------------------------------------------------------------------------
# 2. _load_rules + check_labels
# ---------------------------------------------------------------------------


def test_load_rules_returns_list():
    rules = checker._load_rules(ROOT / "docker" / "prometheus" / "rules.yml")
    assert isinstance(rules, list)
    assert len(rules) >= 10, f"应有 10+ 条告警, 实际: {len(rules)}"


def test_check_labels_passes_current():
    rules = checker._load_rules(ROOT / "docker" / "prometheus" / "rules.yml")
    errs = checker.check_labels(rules)
    assert errs == [], f"当前 rules.yml 应通过, 实际错误: {errs}"


def test_check_labels_detects_missing_service(tmp_path):
    """注入一条缺 service label 的告警应被检测."""
    bad = tmp_path / "bad_no_service.yml"
    bad.write_text(
        "groups:\n"
        "  - name: g\n"
        "    rules:\n"
        "      - alert: ZHSTestNoService\n"
        "        expr: zhs_x > 1\n"
        "        labels: {severity: warning}\n"
        "        annotations: {summary: 'test'}\n",
        encoding="utf-8",
    )
    rules = checker._load_rules(bad)
    errs = checker.check_labels(rules)
    assert any("ZHSTestNoService" in e and "service" in e for e in errs), f"应报缺 service, 实际: {errs}"


def test_check_labels_detects_wrong_service(tmp_path):
    """service 错值应被检测."""
    bad = tmp_path / "bad_wrong_service.yml"
    bad.write_text(
        "groups:\n"
        "  - name: g\n"
        "    rules:\n"
        "      - alert: ZHSTestWrongService\n"
        "        expr: zhs_x > 1\n"
        "        labels: {service: 'other-app', severity: warning}\n"
        "        annotations: {summary: 'test'}\n",
        encoding="utf-8",
    )
    rules = checker._load_rules(bad)
    errs = checker.check_labels(rules)
    assert any("ZHSTestWrongService" in e and "zhs-platform" in e for e in errs)


def test_check_labels_detects_bad_severity(tmp_path):
    """severity 不是 critical/warning/info 应被检测."""
    bad = tmp_path / "bad_sev.yml"
    bad.write_text(
        "groups:\n"
        "  - name: g\n"
        "    rules:\n"
        "      - alert: ZHSTestBadSev\n"
        "        expr: zhs_x > 1\n"
        "        labels: {service: zhs-platform, severity: 'super-critical'}\n"
        "        annotations: {summary: 'test'}\n",
        encoding="utf-8",
    )
    rules = checker._load_rules(bad)
    errs = checker.check_labels(rules)
    assert any("ZHSTestBadSev" in e and "severity" in e for e in errs)


# ---------------------------------------------------------------------------
# 3. check_annotations
# ---------------------------------------------------------------------------


def test_check_annotations_passes_current():
    rules = checker._load_rules(ROOT / "docker" / "prometheus" / "rules.yml")
    errs = checker.check_annotations(rules)
    assert errs == [], f"应通过, 实际: {errs}"


def test_check_annotations_detects_missing(tmp_path):
    """缺 summary 和 description 应被检测."""
    bad = tmp_path / "bad_anno.yml"
    bad.write_text(
        "groups:\n"
        "  - name: g\n"
        "    rules:\n"
        "      - alert: ZHSNoAnno\n"
        "        expr: zhs_x > 1\n"
        "        labels: {service: zhs-platform, severity: warning}\n"
        "        annotations: {}\n",
        encoding="utf-8",
    )
    rules = checker._load_rules(bad)
    errs = checker.check_annotations(rules)
    assert any("ZHSNoAnno" in e for e in errs)


# ---------------------------------------------------------------------------
# 4. check_expr_syntax
# ---------------------------------------------------------------------------


def test_check_expr_syntax_passes_current():
    rules = checker._load_rules(ROOT / "docker" / "prometheus" / "rules.yml")
    errs = checker.check_expr_syntax(rules)
    assert errs == [], f"应通过, 实际: {errs}"


def test_check_expr_syntax_detects_junk(tmp_path):
    """junk expr 应被检测."""
    bad = tmp_path / "bad_expr.yml"
    bad.write_text(
        "groups:\n"
        "  - name: g\n"
        "    rules:\n"
        "      - alert: ZHSJunkExpr\n"
        "        expr: 'just_a_metric_name'\n"
        "        labels: {service: zhs-platform, severity: warning}\n"
        "        annotations: {summary: 'test'}\n",
        encoding="utf-8",
    )
    rules = checker._load_rules(bad)
    errs = checker.check_expr_syntax(rules)
    assert any("ZHSJunkExpr" in e for e in errs)


def test_check_expr_syntax_multiline_ok(tmp_path):
    """多行 expr 折叠后能识别."""
    good = tmp_path / "good_multiline.yml"
    good.write_text(
        "groups:\n"
        "  - name: g\n"
        "    rules:\n"
        "      - alert: ZHSMulti\n"
        "        expr: |\n"
        "          sum(rate(zhs_x[5m])) > 0.05\n"
        "        labels: {service: zhs-platform, severity: warning}\n"
        "        annotations: {summary: 'test'}\n",
        encoding="utf-8",
    )
    rules = checker._load_rules(good)
    errs = checker.check_expr_syntax(rules)
    assert errs == []


# ---------------------------------------------------------------------------
# 5. helm 副本一致性
# ---------------------------------------------------------------------------


def test_helm_consistency_passes_current():
    errs = checker.check_helm_consistency()
    assert errs == [], f"应一致, 实际: {errs}"


def test_helm_consistency_detects_mismatch(tmp_path, monkeypatch):
    """helm 副本与主副本不一致应被检测."""
    fake_helm = tmp_path / "rules_helm.yml"
    fake_helm.write_text("groups: []\n", encoding="utf-8")
    monkeypatch.setattr(checker, "HELM_RULES_PATH", fake_helm)
    errs = checker.check_helm_consistency()
    assert len(errs) >= 1
    assert any("一致" in e for e in errs)


# ---------------------------------------------------------------------------
# 6. main() 集成: 注入坏规则应返回 1
# ---------------------------------------------------------------------------


def test_main_returns_one_when_bad_rules(tmp_path, monkeypatch):
    """注入坏规则 main() 应返回 1."""
    bad = tmp_path / "bad.yml"
    bad.write_text(
        "groups:\n"
        "  - name: g\n"
        "    rules:\n"
        "      - alert: ZHSNoLabel\n"
        "        expr: zhs_x > 1\n"
        "        labels: {}\n"
        "        annotations: {}\n",
        encoding="utf-8",
    )
    test_args = ["check_alert_rules.py", "--path", str(bad), "--no-helm-check"]
    monkeypatch.setattr(sys, "argv", test_args)
    rc = checker.main()
    assert rc == 1, f"坏规则应 FAIL, 实际 rc={rc}"


# ---------------------------------------------------------------------------
# 7. dashboard 顶层 link 用 service:zhs-platform 搜索
# ---------------------------------------------------------------------------


def test_dashboard_top_link_uses_service_filter():
    """zhs_biz_overview.json 顶层 link 应用 service:zhs-platform 搜索."""
    import json

    dash_path = ROOT / "deploy" / "grafana" / "dashboards" / "zhs_biz_overview.json"
    d = json.loads(dash_path.read_text(encoding="utf-8"))
    links = d.get("links", [])
    assert any(
        "service:zhs-platform" in link.get("url", "") for link in links
    ), f"应有 link 含 service:zhs-platform, 实际: {links}"


def test_dashboard_helm_top_link_uses_service_filter():
    """helm 副本 zhs_biz_overview.json 顶层 link 一致."""
    import json

    dash_path = ROOT / "deploy" / "helm" / "zhs-platform" / "dashboards" / "zhs_biz_overview.json"
    d = json.loads(dash_path.read_text(encoding="utf-8"))
    links = d.get("links", [])
    assert any(
        "service:zhs-platform" in link.get("url", "") for link in links
    ), f"应有 link 含 service:zhs-platform, 实际: {links}"


def test_dashboard_no_legacy_search():
    """顶层 link 不应再用旧的 ?search=zhs (含 service: 才是规范)."""
    import json

    for dash_path in [
        ROOT / "deploy" / "grafana" / "dashboards" / "zhs_biz_overview.json",
        ROOT / "deploy" / "helm" / "zhs-platform" / "dashboards" / "zhs_biz_overview.json",
    ]:
        d = json.loads(dash_path.read_text(encoding="utf-8"))
        for link in d.get("links", []):
            url = link.get("url", "")
            assert "?search=zhs" not in url, f"{dash_path.name} 还在用 ?search=zhs (旧): {url}"
            assert '?search=zhs"' not in url
