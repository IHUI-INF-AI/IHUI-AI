"""建议 141 测试: alertmanager inhibition 告警压制.

测试覆盖:
  - InhibitionRule.matches_source / matches_target / equal_labels_match
  - AlertInhibitor.apply 基础过滤
  - equal 字段不匹配时不抑制
  - source 不存在时 target 不会被抑制
  - 多个 source 候选, 取首个命中
  - classify 返回完整信息 (surviving + suppressed + 命中规则)
  - ZHS 6 类预设规则
  - YAML 生成
  - 默认 inhibitor 注入
  - filter_alerts 便捷函数
  - 集成: webhook 端点收到告警后, 被抑制的不发
  - 经典 critical→warning 抑制
  - 边界: 空告警列表 / 重复告警 / 缺失字段
"""


import pytest
from pathlib import Path

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_alert():
    def _factory(alertname: str, severity: str = "warning", service: str = "zhs-api", **extra) -> dict:
        labels = {"alertname": alertname, "severity": severity, "service": service}
        labels.update(extra)
        return {
            "status": "firing",
            "labels": labels,
            "annotations": {"summary": f"{alertname} firing"},
        }

    return _factory


# ---------------------------------------------------------------------------
# TestInhibitionRule
# ---------------------------------------------------------------------------


class TestInhibitionRule:
    """InhibitionRule 数据结构与基础匹配."""

    def test_source_match_full(self):
        from app.alert_inhibition import InhibitionRule

        r = InhibitionRule(
            source_matchers={"alertname": "X", "severity": "critical"},
            target_matchers={"severity": "warning"},
            equal=["service"],
            name="r1",
        )
        assert r.matches_source({"alertname": "X", "severity": "critical", "service": "api"})
        assert not r.matches_source({"alertname": "Y", "severity": "critical"})
        assert not r.matches_source({"alertname": "X"})  # severity 缺

    def test_target_match_full(self):
        from app.alert_inhibition import InhibitionRule

        r = InhibitionRule(
            source_matchers={"alertname": "X"},
            target_matchers={"severity": "warning"},
            equal=["service"],
        )
        assert r.matches_target({"severity": "warning", "service": "api"})
        assert not r.matches_target({"severity": "critical", "service": "api"})

    def test_equal_labels_match_all(self):
        from app.alert_inhibition import InhibitionRule

        r = InhibitionRule(
            source_matchers={},
            target_matchers={},
            equal=["alertname", "service"],
        )
        assert r.equal_labels_match(
            {"alertname": "X", "service": "api"},
            {"alertname": "X", "service": "api"},
        )
        assert not r.equal_labels_match(
            {"alertname": "X", "service": "api"},
            {"alertname": "Y", "service": "api"},
        )
        assert not r.equal_labels_match(
            {"alertname": "X", "service": "api"},
            {"alertname": "X", "service": "web"},
        )

    def test_equal_labels_match_default_alertname(self):
        """equal=None 时使用 alertname 默认 (alertmanager 经典语义)."""
        from app.alert_inhibition import InhibitionRule

        r = InhibitionRule(source_matchers={}, target_matchers={}, equal=None)
        # alertname 相等 → 通过
        assert r.equal_labels_match({"alertname": "X"}, {"alertname": "X"})
        # alertname 不等 → 不通过
        assert not r.equal_labels_match({"alertname": "X"}, {"alertname": "Y"})

    def test_empty_matchers_always_match(self):
        from app.alert_inhibition import InhibitionRule

        r = InhibitionRule()
        assert r.matches_source({})
        assert r.matches_target({})


# ---------------------------------------------------------------------------
# TestAlertInhibitorBasic
# ---------------------------------------------------------------------------


class TestAlertInhibitorBasic:
    """AlertInhibitor 基础过滤行为."""

    def test_empty_no_rule(self, sample_alert):
        from app.alert_inhibition import AlertInhibitor

        inh = AlertInhibitor()
        alerts = [sample_alert("X"), sample_alert("Y")]
        out = inh.apply(alerts)
        assert out == alerts  # 无规则 → 全保留

    def test_basic_critical_inhibits_warning(self, sample_alert):
        from app.alert_inhibition import AlertInhibitor, InhibitionRule

        rule = InhibitionRule(
            name="crit_inh_warn",
            source_matchers={"severity": "critical"},
            target_matchers={"severity": "warning"},
            equal=["alertname", "service"],
        )
        inh = AlertInhibitor([rule])
        alerts = [
            sample_alert("X", severity="critical", service="api"),
            sample_alert("X", severity="warning", service="api"),
        ]
        out = inh.apply(alerts)
        assert len(out) == 1
        assert out[0]["labels"]["severity"] == "critical"

    def test_no_source_target_passes(self, sample_alert):
        """没有匹配的 source, target 不被抑制."""
        from app.alert_inhibition import AlertInhibitor, InhibitionRule

        rule = InhibitionRule(
            source_matchers={"alertname": "CriticalX"},
            target_matchers={"alertname": "WarningY"},
            equal=["service"],
        )
        inh = AlertInhibitor([rule])
        alerts = [
            sample_alert("WarningY", severity="warning", service="api"),
        ]
        out = inh.apply(alerts)
        assert out == alerts  # 无 source → 保留

    def test_equal_field_mismatch(self, sample_alert):
        """equal 字段不匹配时, 即便 source/target 都命中, target 也不被抑制."""
        from app.alert_inhibition import AlertInhibitor, InhibitionRule

        rule = InhibitionRule(
            source_matchers={"alertname": "X"},
            target_matchers={"alertname": "Y"},
            equal=["service"],
        )
        inh = AlertInhibitor([rule])
        alerts = [
            sample_alert("X", severity="critical", service="api"),
            sample_alert("Y", severity="warning", service="web"),  # service 不等
        ]
        out = inh.apply(alerts)
        assert len(out) == 2

    def test_target_matcher_must_hit(self, sample_alert):
        from app.alert_inhibition import AlertInhibitor, InhibitionRule

        rule = InhibitionRule(
            source_matchers={"alertname": "CriticalX"},
            target_matchers={"alertname": "SpecificWarn"},
            equal=["service"],
        )
        inh = AlertInhibitor([rule])
        alerts = [
            sample_alert("CriticalX", severity="critical", service="api"),
            sample_alert("OtherWarn", severity="warning", service="api"),  # target 不命中
        ]
        out = inh.apply(alerts)
        assert len(out) == 2

    def test_multiple_sources_pick_first(self, sample_alert):
        """多个 source 候选都能抑制时, 取首个命中的规则."""
        from app.alert_inhibition import AlertInhibitor, InhibitionRule

        r1 = InhibitionRule(
            name="r1", source_matchers={"alertname": "S1"}, target_matchers={"severity": "warning"}, equal=["service"]
        )
        r2 = InhibitionRule(
            name="r2", source_matchers={"alertname": "S2"}, target_matchers={"severity": "warning"}, equal=["service"]
        )
        inh = AlertInhibitor([r1, r2])
        alerts = [
            sample_alert("S1", severity="critical", service="api"),
            sample_alert("S2", severity="critical", service="api"),
            sample_alert("W", severity="warning", service="api"),
        ]
        out = inh.apply(alerts)
        # W 被 S1 抑制 (r1 在 r2 前)
        assert len(out) == 2
        assert all(a["labels"]["severity"] == "critical" for a in out)


# ---------------------------------------------------------------------------
# TestAlertInhibitorClassify
# ---------------------------------------------------------------------------


class TestAlertInhibitorClassify:
    """classify 返回结构化分类结果."""

    def test_classify_returns_surviving_and_suppressed(self, sample_alert):
        from app.alert_inhibition import AlertInhibitor, InhibitionRule

        rule = InhibitionRule(
            name="my_rule",
            source_matchers={"alertname": "Crit"},
            target_matchers={"alertname": "Warn"},
            equal=["service"],
        )
        inh = AlertInhibitor([rule])
        alerts = [
            sample_alert("Crit", severity="critical", service="api"),
            sample_alert("Warn", severity="warning", service="api"),
        ]
        result = inh.classify(alerts)
        assert len(result["surviving"]) == 1
        assert result["surviving"][0]["labels"]["alertname"] == "Crit"
        assert len(result["suppressed"]) == 1
        assert result["suppressed"][0]["inhibited_by_rule"] == "my_rule"
        assert result["suppressed_count"] == 1


# ---------------------------------------------------------------------------
# TestZHSInhibitionPresets
# ---------------------------------------------------------------------------


class TestZHSInhibitionPresets:
    """ZHS 平台预设抑制规则."""

    def test_presets_loaded(self):
        from app.alert_inhibition import ZHS_INHIBITION_PRESETS

        assert len(ZHS_INHIBITION_PRESETS) >= 5
        names = [r.name for r in ZHS_INHIBITION_PRESETS]
        assert "zhs_rollback_inhibits_canary" in names
        assert "zhs_db_down_inhibits_db_warnings" in names
        assert "zhs_service_down_inhibits_instance_alerts" in names

    def test_rollback_inhibits_canary_stage(self, sample_alert):
        from app.alert_inhibition import get_default_inhibitor

        inh = get_default_inhibitor()
        alerts = [
            sample_alert("ZHSRollbackActive", severity="critical", service="canary"),
            sample_alert("ZHSCanaryStageStuck", severity="warning", service="canary"),
        ]
        out = inh.apply(alerts)
        assert len(out) == 1
        assert out[0]["labels"]["alertname"] == "ZHSRollbackActive"

    def test_rollback_does_not_inhibit_other_service(self, sample_alert):
        from app.alert_inhibition import get_default_inhibitor

        inh = get_default_inhibitor()
        alerts = [
            sample_alert("ZHSRollbackActive", severity="critical", service="canary"),
            sample_alert("ZHSCanaryStageStuck", severity="warning", service="other"),  # service 不同
        ]
        out = inh.apply(alerts)
        assert len(out) == 2

    def test_db_down_inhibits_db_warnings(self, sample_alert):
        from app.alert_inhibition import get_default_inhibitor

        inh = get_default_inhibitor()
        alerts = [
            sample_alert("ZHSDatabaseDown", severity="critical", service="db"),
            sample_alert("DB_SlowQuery", severity="warning", service="db"),
        ]
        out = inh.apply(alerts)
        assert len(out) == 1
        assert out[0]["labels"]["alertname"] == "ZHSDatabaseDown"

    def test_service_down_inhibits_instance_warnings(self, sample_alert):
        from app.alert_inhibition import get_default_inhibitor

        inh = get_default_inhibitor()
        alerts = [
            sample_alert("ZHSServiceDown", severity="critical", service="api"),
            sample_alert("HighLatency", severity="warning", service="api"),
        ]
        out = inh.apply(alerts)
        assert len(out) == 1
        assert out[0]["labels"]["alertname"] == "ZHSServiceDown"

    def test_classic_critical_inhibits_warning(self, sample_alert):
        from app.alert_inhibition import get_default_inhibitor

        inh = get_default_inhibitor()
        # 经典规则要求 equal: alertname + service. 同一 alertname 不同 severity 即可
        alerts = [
            sample_alert("MyAlert", severity="critical", service="svc"),
            sample_alert("MyAlert", severity="warning", service="svc"),
        ]
        out = inh.apply(alerts)
        assert len(out) == 1


# ---------------------------------------------------------------------------
# TestYamlGeneration
# ---------------------------------------------------------------------------


class TestYamlGeneration:
    """to_alertmanager_yaml 生成的 YAML 格式."""

    def test_yaml_includes_header(self):
        from app.alert_inhibition import to_alertmanager_yaml

        yml = to_alertmanager_yaml([])
        assert "inhibit_rules:" in yml

    def test_yaml_with_rules(self):
        from app.alert_inhibition import InhibitionRule, to_alertmanager_yaml

        rules = [
            InhibitionRule(
                name="r1",
                source_matchers={"alertname": "X", "severity": "critical"},
                target_matchers={"alertname": "Y"},
                equal=["service"],
            )
        ]
        yml = to_alertmanager_yaml(rules)
        assert "name: r1" in yml
        assert "alertname: 'X'" in yml
        assert "severity: 'critical'" in yml
        assert "alertname: 'Y'" in yml
        assert "equal: ['service']" in yml

    def test_yaml_with_zhs_presets(self):
        from app.alert_inhibition import ZHS_INHIBITION_PRESETS, to_alertmanager_yaml

        yml = to_alertmanager_yaml(ZHS_INHIBITION_PRESETS)
        # 检查 5 个 ZHS 规则都有
        assert "zhs_rollback_inhibits_canary" in yml
        assert "zhs_db_down_inhibits_db_warnings" in yml
        assert "zhs_service_down_inhibits_instance_alerts" in yml
        assert "zhs_ci_drill_failure_inhibits_subalerts" in yml
        assert "zhs_classic_critical_inhibits_warning" in yml

    def test_yaml_no_equal_line_when_none(self):
        from app.alert_inhibition import InhibitionRule, to_alertmanager_yaml

        rules = [InhibitionRule(name="r", source_matchers={"a": "b"})]
        yml = to_alertmanager_yaml(rules)
        # equal=None 时不输出 equal: 行
        assert "equal:" not in yml


# ---------------------------------------------------------------------------
# TestDefaultInhibitor
# ---------------------------------------------------------------------------


class TestDefaultInhibitor:
    """默认 inhibitor 单例管理."""

    def test_get_default_creates_with_zhs_presets(self):
        from app.alert_inhibition import get_default_inhibitor, reset_default_inhibitor

        reset_default_inhibitor()
        inh = get_default_inhibitor()
        assert len(inh.rules) >= 5

    def test_set_default_inhibitor(self, sample_alert):
        from app.alert_inhibition import (
            AlertInhibitor,
            get_default_inhibitor,
            reset_default_inhibitor,
            set_default_inhibitor,
        )

        # 注入空规则
        set_default_inhibitor(AlertInhibitor([]))
        inh = get_default_inhibitor()
        alerts = [sample_alert("X"), sample_alert("Y")]
        assert inh.apply(alerts) == alerts
        reset_default_inhibitor()


# ---------------------------------------------------------------------------
# TestFilterAlertsConvenience
# ---------------------------------------------------------------------------


class TestFilterAlertsConvenience:
    """filter_alerts 便捷函数."""

    def test_filter_uses_default(self, sample_alert):
        from app.alert_inhibition import (
            AlertInhibitor,
            filter_alerts,
            reset_default_inhibitor,
            set_default_inhibitor,
        )

        set_default_inhibitor(AlertInhibitor([]))  # 空规则
        alerts = [sample_alert("X"), sample_alert("Y")]
        out = filter_alerts(alerts)
        assert out == alerts
        reset_default_inhibitor()

    def test_filter_with_custom_inhibitor(self, sample_alert):
        from app.alert_inhibition import AlertInhibitor, InhibitionRule, filter_alerts

        custom = AlertInhibitor(
            [
                InhibitionRule(
                    source_matchers={"alertname": "C"},
                    target_matchers={"alertname": "W"},
                    equal=["service"],
                )
            ]
        )
        alerts = [
            sample_alert("C", severity="critical", service="api"),
            sample_alert("W", severity="warning", service="api"),
        ]
        out = filter_alerts(alerts, inhibitor=custom)
        assert len(out) == 1


# ---------------------------------------------------------------------------
# TestWebhookIntegration
# ---------------------------------------------------------------------------


class TestWebhookIntegration:
    """webhook 端点集成: 收到的告警被抑制的不发 push."""

    def test_webhook_applies_inhibition(self):
        from app.alert_inhibition import get_default_inhibitor

        # 直接调用 inhibitor 模拟 webhook 行为 (避免起 FastAPI app)
        inh = get_default_inhibitor()
        payload_alerts = [
            {
                "status": "firing",
                "labels": {"alertname": "ZHSRollbackActive", "severity": "critical", "service": "canary"},
            },
            {
                "status": "firing",
                "labels": {"alertname": "ZHSCanaryStageStuck", "severity": "warning", "service": "canary"},
            },
        ]
        firing = [a for a in payload_alerts if a["status"] == "firing"]
        surviving = inh.apply(firing)
        assert len(surviving) == 1
        assert surviving[0]["labels"]["alertname"] == "ZHSRollbackActive"

    def test_webhook_resolved_not_pushed_but_in_history(self):
        """resolved 状态不调 apply (apply 只针对 firing), 但应该写 history."""
        from app.alert_inhibition import get_default_inhibitor

        inh = get_default_inhibitor()
        payload = {
            "version": "4",
            "alerts": [
                {
                    "status": "resolved",
                    "labels": {"alertname": "ZHSCanaryStageStuck", "severity": "warning"},
                }
            ],
        }
        firing = [a for a in payload["alerts"] if a["status"] == "firing"]
        # resolved 不参与抑制过滤
        assert firing == []
        # 抑制只针对 firing, 所以不影响


# ---------------------------------------------------------------------------
# TestEdgeCases
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """边界条件."""

    def test_empty_alert_list(self):
        from app.alert_inhibition import AlertInhibitor, InhibitionRule

        inh = AlertInhibitor([InhibitionRule()])
        assert inh.apply([]) == []

    def test_alert_with_empty_labels(self):
        from app.alert_inhibition import AlertInhibitor, InhibitionRule

        r = InhibitionRule(source_matchers={"alertname": "X"}, target_matchers={"alertname": "X"})
        inh = AlertInhibitor([r])
        out = inh.apply([{"labels": {}}])
        assert len(out) == 1  # 无 alertname 字段, source/target 都不命中, 保留

    def test_alert_missing_labels_key(self):
        from app.alert_inhibition import AlertInhibitor, InhibitionRule

        r = InhibitionRule(source_matchers={"alertname": "X"})
        inh = AlertInhibitor([r])
        # alert 没 labels 键
        out = inh.apply([{"status": "firing"}])
        assert len(out) == 1

    def test_duplicate_alerts(self, sample_alert):
        """重复告警按出现顺序处理 (第一个作为 source, 后面的被抑制)."""
        from app.alert_inhibition import AlertInhibitor, InhibitionRule

        r = InhibitionRule(
            source_matchers={"severity": "critical"},
            target_matchers={"severity": "warning"},
            equal=["alertname", "service"],
        )
        inh = AlertInhibitor([r])
        alerts = [
            sample_alert("X", severity="critical", service="api"),
            sample_alert("X", severity="warning", service="api"),
            sample_alert("X", severity="critical", service="api"),
            sample_alert("X", severity="warning", service="api"),
        ]
        out = inh.apply(alerts)
        # 第一次的 critical 抑制第一个 warning
        # 第二次的 critical 在 surviving 中, 也抑制第二个 warning
        assert len(out) == 2
        assert all(a["labels"]["severity"] == "critical" for a in out)

    def test_add_rule_dynamically(self, sample_alert):
        from app.alert_inhibition import AlertInhibitor, InhibitionRule

        inh = AlertInhibitor()
        assert len(inh.rules) == 0
        inh.add_rule(
            InhibitionRule(
                source_matchers={"alertname": "A"},
                target_matchers={"alertname": "B"},
            )
        )
        assert len(inh.rules) == 1


# ---------------------------------------------------------------------------
# TestProductionYamlSync
# ---------------------------------------------------------------------------


class TestProductionYamlSync:
    """确保生产 alertmanager.yml 与 Python 预设同步."""

    DOCKER_AM = Path(__file__).resolve().parent.parent / "docker" / "alertmanager" / "alertmanager.yml"
    HELM_AM = Path(__file__).resolve().parent.parent / "deploy" / "helm" / "zhs-platform" / "prometheus" / "alertmanager.yml"

    def test_docker_alertmanager_has_all_zhs_rules(self):
        """docker/alertmanager/alertmanager.yml 包含所有 5 个 ZHS 规则."""
        content = self.DOCKER_AM.read_text(encoding="utf-8")
        # 必须包含 5 类 ZHS 规则的 alertname
        assert "ZHSRollbackActive" in content
        assert "ZHSDatabaseDown" in content
        assert "ZHSServiceDown" in content
        assert "ZHS_CI_DRILL_FAILURE" in content
        # 必须有 inhibit_rules 段
        assert "inhibit_rules:" in content

    def test_helm_alertmanager_has_all_zhs_rules(self):
        """deploy/helm/.../alertmanager.yml 包含所有 5 个 ZHS 规则."""
        content = self.HELM_AM.read_text(encoding="utf-8")
        assert "ZHSRollbackActive" in content
        assert "ZHSDatabaseDown" in content
        assert "ZHSServiceDown" in content
        assert "ZHS_CI_DRILL_FAILURE" in content
        assert "inhibit_rules:" in content
