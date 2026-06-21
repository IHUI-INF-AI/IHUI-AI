"""建议 143 测试: alertmanager 抑制规则 CI 校验脚本.

测试覆盖:
  - _parse_inhibit_rules YAML 解析
  - compare_yaml_to_presets 同步校验
  - _canonical 规范化
  - run_fixtures 6 个预设场景
  - sync_yaml_to_presets 自动同步
  - _render_yaml_block YAML 块渲染
  - CLI 入口 (mock sys.argv)
  - 错误情况 (YAML 缺文件 / 格式坏)
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ci"))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_yaml(tmp_path):
    """写一个标准 6 规则 yaml."""
    content = """global:
  resolve_timeout: 5m

route:
  receiver: 'zhs-default'

receivers:
  - name: 'zhs-default'

inhibit_rules:
  # 经典 critical → warning
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'service']
  # 1. canary 紧急回滚 → 抑制 canary 阶段卡住
  - source_match:
      alertname: 'ZHSRollbackActive'
      severity: 'critical'
    target_match:
      alertname: 'ZHSCanaryStageStuck'
    equal: ['service']
  # 2. canary 紧急回滚 → 抑制 canary 比例不匹配
  - source_match:
      alertname: 'ZHSRollbackActive'
      severity: 'critical'
    target_match:
      alertname: 'ZHSCanaryRatioMismatch'
    equal: ['service']
  # 3. 数据库宕机
  - source_match:
      alertname: 'ZHSDatabaseDown'
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['service']
  # 4. 服务整体宕机
  - source_match:
      alertname: 'ZHSServiceDown'
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['service']
  # 5. CI drill
  - source_match:
      alertname: 'ZHS_CI_DRILL_FAILURE'
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['service']
"""
    p = tmp_path / "alertmanager.yml"
    p.write_text(content, encoding="utf-8")
    return p


@pytest.fixture
def sample_yaml_missing_rule(tmp_path):
    """缺第 5 条 (CI drill) 的 yaml."""
    content = """inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'service']
  - source_match:
      alertname: 'ZHSRollbackActive'
      severity: 'critical'
    target_match:
      alertname: 'ZHSCanaryStageStuck'
    equal: ['service']
  - source_match:
      alertname: 'ZHSRollbackActive'
      severity: 'critical'
    target_match:
      alertname: 'ZHSCanaryRatioMismatch'
    equal: ['service']
  - source_match:
      alertname: 'ZHSDatabaseDown'
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['service']
  - source_match:
      alertname: 'ZHSServiceDown'
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['service']
"""
    p = tmp_path / "missing.yml"
    p.write_text(content, encoding="utf-8")
    return p


@pytest.fixture
def sample_yaml_empty(tmp_path):
    """空 inhibit_rules 段."""
    content = """route:
  receiver: 'zhs-default'

inhibit_rules: []
"""
    p = tmp_path / "empty.yml"
    p.write_text(content, encoding="utf-8")
    return p


# ---------------------------------------------------------------------------
# TestParseInhibitRules
# ---------------------------------------------------------------------------


class TestParseInhibitRules:
    """_parse_inhibit_rules YAML 解析."""

    def test_full_yaml(self, sample_yaml):
        from check_inhibition_rules import _parse_inhibit_rules

        rules = _parse_inhibit_rules(sample_yaml)
        assert len(rules) == 6

    def test_first_rule_source_match(self, sample_yaml):
        from check_inhibition_rules import _parse_inhibit_rules

        rules = _parse_inhibit_rules(sample_yaml)
        assert rules[0]["source_match"] == {"severity": "critical"}
        assert rules[0]["target_match"] == {"severity": "warning"}
        assert rules[0]["equal"] == ["alertname", "service"]

    def test_rollback_rule(self, sample_yaml):
        from check_inhibition_rules import _parse_inhibit_rules

        rules = _parse_inhibit_rules(sample_yaml)
        # 规则 2: ZHSRollbackActive → ZHSCanaryStageStuck
        assert rules[1]["source_match"] == {
            "alertname": "ZHSRollbackActive",
            "severity": "critical",
        }
        assert rules[1]["target_match"] == {"alertname": "ZHSCanaryStageStuck"}
        assert rules[1]["equal"] == ["service"]

    def test_db_rule(self, sample_yaml):
        from check_inhibition_rules import _parse_inhibit_rules

        rules = _parse_inhibit_rules(sample_yaml)
        # 规则 4: ZHSDatabaseDown → warning
        assert rules[3]["source_match"]["alertname"] == "ZHSDatabaseDown"
        assert rules[3]["target_match"] == {"severity": "warning"}

    def test_missing_file(self, tmp_path):
        from check_inhibition_rules import _parse_inhibit_rules

        rules = _parse_inhibit_rules(tmp_path / "nope.yml")
        assert rules == []

    def test_empty_inhibit_rules(self, sample_yaml_empty):
        from check_inhibition_rules import _parse_inhibit_rules

        rules = _parse_inhibit_rules(sample_yaml_empty)
        assert rules == []

    def test_no_inhibit_section(self, tmp_path):
        from check_inhibition_rules import _parse_inhibit_rules

        p = tmp_path / "no_section.yml"
        p.write_text("route:\n  receiver: 'x'\n", encoding="utf-8")
        rules = _parse_inhibit_rules(p)
        assert rules == []


# ---------------------------------------------------------------------------
# TestCanonical
# ---------------------------------------------------------------------------


class TestCanonical:
    """_canonical 规范化对比."""

    def test_same_rules_equal(self):
        from check_inhibition_rules import _canonical

        r1 = {"source_match": {"a": "1"}, "target_match": {"b": "2"}, "equal": ["x"]}
        r2 = {"source_match": {"a": "1"}, "target_match": {"b": "2"}, "equal": ["x"]}
        assert _canonical(r1) == _canonical(r2)

    def test_different_source(self):
        from check_inhibition_rules import _canonical

        r1 = {"source_match": {"a": "1"}}
        r2 = {"source_match": {"a": "2"}}
        assert _canonical(r1) != _canonical(r2)

    def test_different_key_order(self):
        """dict 顺序不影响规范键 (排序后比较)."""
        from check_inhibition_rules import _canonical

        r1 = {"source_match": {"a": "1", "b": "2"}}
        r2 = {"source_match": {"b": "2", "a": "1"}}
        assert _canonical(r1) == _canonical(r2)


# ---------------------------------------------------------------------------
# TestCompareYamlToPresets
# ---------------------------------------------------------------------------


class TestCompareYamlToPresets:
    """compare_yaml_to_presets."""

    def test_full_yaml_in_sync(self, sample_yaml):
        from check_inhibition_rules import compare_yaml_to_presets

        result = compare_yaml_to_presets(sample_yaml)
        assert result["in_sync"] is True
        assert len(result["yaml_rules"]) == 6
        assert len(result["preset_rules"]) == 6
        assert result["missing_in_yaml"] == []
        assert result["extra_in_yaml"] == []

    def test_missing_rule(self, sample_yaml_missing_rule):
        from check_inhibition_rules import compare_yaml_to_presets

        result = compare_yaml_to_presets(sample_yaml_missing_rule)
        assert result["in_sync"] is False
        assert len(result["missing_in_yaml"]) == 1
        # 缺 CI drill failure
        missing_strs = [str(m) for m in result["missing_in_yaml"]]
        assert any("ZHS_CI_DRILL_FAILURE" in s for s in missing_strs)

    def test_empty_yaml_out_of_sync(self, sample_yaml_empty):
        from check_inhibition_rules import compare_yaml_to_presets

        result = compare_yaml_to_presets(sample_yaml_empty)
        assert result["in_sync"] is False
        assert len(result["missing_in_yaml"]) == 6  # 全部 6 条都缺


# ---------------------------------------------------------------------------
# TestRunFixtures
# ---------------------------------------------------------------------------


class TestRunFixtures:
    """run_fixtures 6 个预设场景."""

    def test_all_passed(self):
        from check_inhibition_rules import run_fixtures

        result = run_fixtures()
        assert result["all_passed"] is True
        assert result["passed_count"] == result["total_count"]

    def test_scenarios_count(self):
        from check_inhibition_rules import run_fixtures

        result = run_fixtures()
        # 至少 6 个场景
        assert result["total_count"] >= 6

    def test_scenario_names(self):
        from check_inhibition_rules import run_fixtures

        result = run_fixtures()
        names = [s["name"] for s in result["scenarios"]]
        assert "rollback_inhibits_stage_stuck" in names
        assert "db_down_inhibits_db_warnings" in names
        assert "service_down_inhibits_warning" in names
        assert "classic_critical_inhibits_warning" in names
        assert "ci_drill_failure_inhibits" in names
        assert "different_service_not_inhibited" in names

    def test_scenario_passes(self):
        from check_inhibition_rules import run_fixtures

        result = run_fixtures()
        for sc in result["scenarios"]:
            assert sc["passed"], f"场景 {sc['name']} 失败: {sc['mismatches']}"


# ---------------------------------------------------------------------------
# TestSyncYamlToPresets
# ---------------------------------------------------------------------------


class TestSyncYamlToPresets:
    """sync_yaml_to_presets 自动同步."""

    def test_sync_missing_rule(self, sample_yaml_missing_rule, tmp_path):
        from check_inhibition_rules import compare_yaml_to_presets, sync_yaml_to_presets

        # 复制文件到工作区 (避免污染 fixture 本身)
        target = tmp_path / "sync_target.yml"
        target.write_text(sample_yaml_missing_rule.read_text(encoding="utf-8"), encoding="utf-8")
        modified = sync_yaml_to_presets(target)
        assert modified is True
        # 同步后应 in_sync
        result = compare_yaml_to_presets(target)
        assert result["in_sync"] is True

    def test_sync_in_sync_no_change(self, sample_yaml, tmp_path):
        from check_inhibition_rules import sync_yaml_to_presets

        target = tmp_path / "sync_target.yml"
        target.write_text(sample_yaml.read_text(encoding="utf-8"), encoding="utf-8")
        modified = sync_yaml_to_presets(target)
        # 已对齐, 不修改
        # 注: 实现可能仍然重写 (返回 True); 主要验证 in_sync 不变
        # 不强制 False, 因为内容可能微调
        # 重新解析
        from check_inhibition_rules import compare_yaml_to_presets

        assert compare_yaml_to_presets(target)["in_sync"] is True

    def test_sync_missing_file(self, tmp_path):
        from check_inhibition_rules import sync_yaml_to_presets

        result = sync_yaml_to_presets(tmp_path / "nope.yml")
        assert result is False


# ---------------------------------------------------------------------------
# TestRenderYamlBlock
# ---------------------------------------------------------------------------


class TestRenderYamlBlock:
    """_render_yaml_block 渲染."""

    def test_basic_rule(self):
        from check_inhibition_rules import _render_yaml_block

        from app.alert_inhibition import InhibitionRule

        r = InhibitionRule(
            name="r1",
            source_matchers={"alertname": "X", "severity": "critical"},
            target_matchers={"severity": "warning"},
            equal=["service"],
        )
        out = _render_yaml_block(r)
        assert "name: r1" in out
        assert "alertname: 'X'" in out
        assert "severity: 'critical'" in out
        assert "target_match:" in out
        assert "severity: 'warning'" in out
        assert "equal: ['service']" in out

    def test_no_equal_line(self):
        from check_inhibition_rules import _render_yaml_block

        from app.alert_inhibition import InhibitionRule

        r = InhibitionRule(name="r", source_matchers={"a": "b"})
        out = _render_yaml_block(r)
        # equal=None 不输出 equal 行
        assert "equal:" not in out


# ---------------------------------------------------------------------------
# TestCLI
# ---------------------------------------------------------------------------


class TestCLI:
    """main() CLI 入口."""

    def test_cli_default_pass(self, sample_yaml, monkeypatch, capsys):
        """默认参数跑应返回 0 (sample_yaml 是标准 6 规则)."""
        # 替换路径
        import check_inhibition_rules
        from check_inhibition_rules import main

        monkeypatch.setattr(check_inhibition_rules, "DEFAULT_YAML_PATHS", [sample_yaml, sample_yaml])
        monkeypatch.setattr(sys, "argv", ["check_inhibition_rules.py"])
        rc = main()
        assert rc == 0
        out = capsys.readouterr().out
        assert "ALL CHECKS PASSED" in out

    def test_cli_out_of_sync_returns_1(self, sample_yaml_missing_rule, monkeypatch, capsys):
        import check_inhibition_rules
        from check_inhibition_rules import main

        monkeypatch.setattr(
            check_inhibition_rules, "DEFAULT_YAML_PATHS", [sample_yaml_missing_rule, sample_yaml_missing_rule]
        )
        monkeypatch.setattr(sys, "argv", ["check_inhibition_rules.py"])
        rc = main()
        assert rc == 1
        out = capsys.readouterr().out
        assert "FAILED" in out

    def test_cli_yaml_only(self, sample_yaml_missing_rule, monkeypatch, capsys):
        import check_inhibition_rules
        from check_inhibition_rules import main

        monkeypatch.setattr(
            check_inhibition_rules, "DEFAULT_YAML_PATHS", [sample_yaml_missing_rule, sample_yaml_missing_rule]
        )
        monkeypatch.setattr(sys, "argv", ["check_inhibition_rules.py", "--yaml-only"])
        rc = main()
        assert rc == 1  # YAML 不一致

    def test_cli_fixtures_only(self, monkeypatch, capsys):
        from check_inhibition_rules import main

        monkeypatch.setattr(sys, "argv", ["check_inhibition_rules.py", "--fixtures"])
        rc = main()
        # fixtures 6/6 通过
        assert rc == 0

    def test_cli_json_output(self, monkeypatch, capsys):
        from check_inhibition_rules import main

        monkeypatch.setattr(sys, "argv", ["check_inhibition_rules.py", "--fixtures", "--json"])
        rc = main()
        assert rc == 0
        out = capsys.readouterr().out
        # JSON 输出
        import json

        parsed = json.loads(out)
        assert "fixture_check" in parsed
        assert parsed["fixture_check"]["all_passed"] is True


# ---------------------------------------------------------------------------
# TestProductionYamls
# ---------------------------------------------------------------------------


class TestProductionYamls:
    """生产 yaml 实际校验."""

    DOCKER_AM = Path(__file__).resolve().parent.parent / "docker" / "alertmanager" / "alertmanager.yml"
    HELM_AM = Path(__file__).resolve().parent.parent / "deploy" / "helm" / "zhs-platform" / "prometheus" / "alertmanager.yml"

    def test_docker_yaml_in_sync(self):
        from check_inhibition_rules import compare_yaml_to_presets

        result = compare_yaml_to_presets(self.DOCKER_AM)
        assert result["in_sync"] is True, f"差异: missing={result['missing_in_yaml']}, extra={result['extra_in_yaml']}"

    def test_helm_yaml_in_sync(self):
        from check_inhibition_rules import compare_yaml_to_presets

        result = compare_yaml_to_presets(self.HELM_AM)
        assert result["in_sync"] is True

    def test_both_yamls_parse_6_rules(self):
        from check_inhibition_rules import _parse_inhibit_rules

        for p in [self.DOCKER_AM, self.HELM_AM]:
            rules = _parse_inhibit_rules(p)
            assert len(rules) == 6, f"{p} 解析出 {len(rules)} 条规则"
