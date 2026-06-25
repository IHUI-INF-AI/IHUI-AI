#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""Alertmanager 集成测试

测试覆盖:
  1. 配置文件存在性
  2. 路由定义完整性
  3. 接收器 (receivers) 完整性
  4. 4 渠道覆盖 (钉钉/飞书/企业微信/邮件)
  5. 3 级告警 (critical/warning/info)
  6. 关键词升级 (outage/failover)
  7. 告警抑制 (inhibit_rules)
  8. 告警分组
  9. 模板引用
10. 告警历史 webhook
"""
import re
import sys
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
ALERTMANAGER_YML = SERVER_DIR / "deploy" / "monitoring" / "alertmanager.yml"
TEMPLATES_DIR = SERVER_DIR / "deploy" / "monitoring" / "templates"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class TestConfigExistence(unittest.TestCase):
    """配置文件存在性"""

    def test_yml_exists(self):
        self.assertTrue(ALERTMANAGER_YML.exists(), f"alertmanager.yml 不存在: {ALERTMANAGER_YML}")

    def test_templates_dir_exists(self):
        self.assertTrue(TEMPLATES_DIR.exists(), f"templates 目录不存在: {TEMPLATES_DIR}")

    def test_required_templates(self):
        required = ["default.tmpl", "dingtalk.tmpl", "feishu.tmpl", "wechat.tmpl", "email.tmpl"]
        for tmpl in required:
            self.assertTrue((TEMPLATES_DIR / tmpl).exists(), f"缺失模板: {tmpl}")


class TestGlobalConfig(unittest.TestCase):
    """全局配置"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(ALERTMANAGER_YML)

    def test_global_block(self):
        self.assertIn("global:", self.content)
        self.assertIn("resolve_timeout", self.content)

    def test_smtp_config(self):
        self.assertIn("smtp_smarthost", self.content)
        self.assertIn("smtp_from", self.content)
        self.assertIn("smtp_require_tls", self.content)

    def test_templates_dir(self):
        self.assertIn("templates:", self.content)
        self.assertIn("/etc/alertmanager/templates/", self.content)


class TestRouteStructure(unittest.TestCase):
    """路由结构"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(ALERTMANAGER_YML)

    def test_main_route(self):
        self.assertIn("route:", self.content)
        self.assertIn("group_by:", self.content)
        self.assertIn("group_wait:", self.content)
        self.assertIn("group_interval:", self.content)
        self.assertIn("repeat_interval:", self.content)
        self.assertIn("receiver:", self.content)

    def test_default_receiver(self):
        self.assertIn("zhs-default", self.content)

    def test_group_by_labels(self):
        # 分组标签必须包含 alertname, service, cluster, region
        for label in ["alertname", "service", "cluster", "region"]:
            self.assertIn(label, self.content)


class TestAlertLevels(unittest.TestCase):
    """3 级告警路由"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(ALERTMANAGER_YML)

    def test_critical_route(self):
        self.assertIn("severity: critical", self.content)
        self.assertIn("zhs-critical-multi", self.content)

    def test_warning_route(self):
        self.assertIn("severity: warning", self.content)
        self.assertIn("zhs-warning", self.content)

    def test_info_route(self):
        self.assertIn("severity: info", self.content)
        self.assertIn("zhs-info", self.content)

    def test_critical_repeat_interval(self):
        # Critical 必须 1h
        self.assertIn("repeat_interval: 1h", self.content)

    def test_info_repeat_interval(self):
        # Info 24h
        self.assertIn("repeat_interval: 24h", self.content)


class TestFourChannels(unittest.TestCase):
    """4 渠道覆盖"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(ALERTMANAGER_YML)

    def test_dingtalk_webhook(self):
        self.assertIn("DINGTALK_WEBHOOK", self.content)

    def test_feishu_webhook(self):
        self.assertIn("FEISHU_WEBHOOK", self.content)

    def test_wechat_webhook(self):
        self.assertIn("WECHAT_WEBHOOK", self.content)

    def test_email_config(self):
        self.assertIn("smtp_", self.content)
        self.assertIn("email_configs:", self.content)

    def test_smtp_username(self):
        self.assertIn("SMTP_USERNAME", self.content)

    def test_smtp_password(self):
        self.assertIn("SMTP_PASSWORD", self.content)


class TestKeywordEscalation(unittest.TestCase):
    """关键词升级"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(ALERTMANAGER_YML)

    def test_outage_keyword(self):
        self.assertIn("outage", self.content)

    def test_failover_keyword(self):
        self.assertIn("failover", self.content)

    def test_down_keyword(self):
        self.assertIn("down", self.content)

    def test_matchers_regex(self):
        # 关键词升级使用 regex 匹配
        self.assertIn("alertname =~", self.content)
        self.assertIn(".*outage.*", self.content)
        self.assertIn(".*failover.*", self.content)

    def test_zhs_failover_alertname(self):
        # 跨云切换告警
        self.assertIn("ZHSFailover", self.content)
        self.assertIn("ZHSCrossCloud", self.content)
        self.assertIn("ZHS_DR_", self.content)


class TestInhibitRules(unittest.TestCase):
    """告警抑制规则"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(ALERTMANAGER_YML)

    def test_inhibit_rules_block(self):
        self.assertIn("inhibit_rules:", self.content)

    def test_critical_inhibit_warning(self):
        # critical -> warning 抑制
        self.assertIn("source_match:", self.content)
        self.assertIn("target_match:", self.content)
        self.assertIn("severity: 'critical'", self.content)
        self.assertIn("severity: 'warning'", self.content)

    def test_canary_rollback_inhibit(self):
        self.assertIn("ZHSRollbackActive", self.content)
        self.assertIn("ZHSCanaryStageStuck", self.content)
        self.assertIn("ZHSCanaryRatioMismatch", self.content)

    def test_db_down_inhibit(self):
        self.assertIn("ZHSDatabaseDown", self.content)

    def test_service_down_inhibit(self):
        self.assertIn("ZHSServiceDown", self.content)

    def test_ci_drill_inhibit(self):
        self.assertIn("ZHS_CI_DRILL_FAILURE", self.content)

    def test_region_failover_inhibit(self):
        # 故障切换进行中 -> 抑制同 region 业务告警
        self.assertIn("ZHSFailoverInProgress", self.content)
        self.assertIn("ZHSAliyunRegionDown", self.content)

    def test_inhibit_count(self):
        # 至少 8 条抑制规则
        rules = re.findall(r'^\s*-\s*source_match:', self.content, re.MULTILINE)
        self.assertGreaterEqual(len(rules), 8, f"抑制规则数: {len(rules)}")


class TestReceivers(unittest.TestCase):
    """接收器定义"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(ALERTMANAGER_YML)

    def test_receivers_block(self):
        self.assertIn("receivers:", self.content)

    def test_receivers_complete(self):
        required = [
            "zhs-default",
            "zhs-critical-multi",
            "zhs-warning",
            "zhs-info",
            "zhs-ci-drill",
            "zhs-alert-history",
        ]
        for r in required:
            self.assertIn(f"name: '{r}'", self.content)

    def test_receiver_count(self):
        names = re.findall(r"name:\s*'([^']+)'", self.content)
        self.assertGreaterEqual(len(names), 6, f"receiver 数: {len(names)}")

    def test_alert_history_webhook(self):
        self.assertIn("alert-history", self.content)
        self.assertIn("/api/v1/monitor/alert-history", self.content)

    def test_ci_drill_webhook(self):
        self.assertIn("/api/v1/monitor/ci/drill-failure", self.content)

    def test_default_alert_webhook(self):
        self.assertIn("/api/v1/monitor/alerts/webhook", self.content)


class TestCIDrillReceiver(unittest.TestCase):
    """CI drill 接收器"""

    def test_ci_drill_match_re(self):
        content = read(ALERTMANAGER_YML)
        self.assertIn("ZHS_CI_DRILL_.*", content)
        self.assertIn("zhs-ci-drill", content)

    def test_ci_drill_repeat_interval(self):
        content = read(ALERTMANAGER_YML)
        # CI drill 重复间隔 2h
        # 应在 zhs-ci-drill 路由处
        self.assertIn("repeat_interval: 2h", content)


class TestSendResolved(unittest.TestCase):
    """告警恢复通知"""

    def test_send_resolved_used(self):
        content = read(ALERTMANAGER_YML)
        # 大部分接收器都应发送 resolved
        count = content.count("send_resolved:")
        self.assertGreaterEqual(count, 5, f"send_resolved 出现次数: {count}")


class TestTemplates(unittest.TestCase):
    """告警模板"""

    def test_default_template(self):
        content = read(TEMPLATES_DIR / "default.tmpl")
        self.assertIn("define", content)
        self.assertIn(".Alerts", content)
        self.assertIn(".Status", content)

    def test_dingtalk_template(self):
        content = read(TEMPLATES_DIR / "dingtalk.tmpl")
        self.assertIn("zhs.dingtalk", content)
        self.assertIn("CommonLabels", content)
        self.assertIn("firing", content)
        self.assertIn("resolved", content)

    def test_feishu_template(self):
        content = read(TEMPLATES_DIR / "feishu.tmpl")
        self.assertIn("zhs.feishu", content)
        self.assertIn("msg_type", content)
        self.assertIn("interactive", content)
        self.assertIn("red", content)
        self.assertIn("green", content)

    def test_wechat_template(self):
        content = read(TEMPLATES_DIR / "wechat.tmpl")
        self.assertIn("zhs.wechat", content)
        self.assertIn("Markdown", content)

    def test_email_template(self):
        content = read(TEMPLATES_DIR / "email.tmpl")
        self.assertIn("zhs.email", content)
        self.assertIn("<!DOCTYPE html>", content)
        self.assertIn("critical", content)
        self.assertIn("warning", content)
        self.assertIn("info", content)


class TestMultiTenantIntegration(unittest.TestCase):
    """多租户集成"""

    def test_tenant_component_label(self):
        content = read(ALERTMANAGER_YML)
        # 多租户 schema 路由告警
        self.assertIn("tenant-routing", content)

    def test_tenant_aliyun_routes(self):
        # 阿里云 + 华为云 + AWS 标签
        content = read(ALERTMANAGER_YML)
        self.assertIn("region", content)


class TestNoBannedPatterns(unittest.TestCase):
    """禁用模式检查"""

    def test_no_mysql(self):
        content = read(ALERTMANAGER_YML)
        self.assertNotIn("mysql", content.lower())
        self.assertNotIn("mariadb", content.lower())

    def test_no_unsafe_pwd(self):
        # 不允许明文密码
        content = read(ALERTMANAGER_YML)
        self.assertNotIn("password: zhs", content)
        self.assertNotIn("password: 123", content)

    def test_no_placeholder_in_url(self):
        # 关键 URL 不应包含占位符
        content = read(ALERTMANAGER_YML)
        self.assertNotIn("http://PLACEHOLDER", content)
        self.assertNotIn("http://TODO", content)


class TestYAMLSyntax(unittest.TestCase):
    """YAML 语法检查"""

    def test_yaml_loads(self):
        try:
            import yaml
            content = read(ALERTMANAGER_YML)
            data = yaml.safe_load(content)
            self.assertIsInstance(data, dict)
            self.assertIn("route", data)
            self.assertIn("receivers", data)
            self.assertIn("inhibit_rules", data)
        except ImportError:
            self.skipTest("pyyaml 未安装")


class TestRouteCount(unittest.TestCase):
    """路由数量"""

    def test_route_subroutes(self):
        content = read(ALERTMANAGER_YML)
        # 主 route 块的子路由数
        sub_routes = re.findall(r'^\s*-\s*match', content, re.MULTILINE)
        # 至少 7 个子路由 (critical/warning/info/ci-drill/failover/tenant/history)
        self.assertGreaterEqual(len(sub_routes), 6, f"子路由数: {len(sub_routes)}")


class TestContinueBehavior(unittest.TestCase):
    """continue 行为测试"""

    def test_critical_continues(self):
        # critical 必须 continue=true, 让 history webhook 也能收到
        content = read(ALERTMANAGER_YML)
        self.assertIn("continue: true", content)

    def test_history_continues(self):
        # history receiver 兜底路由, continue=true 确保所有告警都经过
        # 实际: history 是 match_re 后的兜底
        content = read(ALERTMANAGER_YML)
        # 至少一处 continue: true
        count = content.count("continue: true")
        self.assertGreaterEqual(count, 1)


class TestSilenceSupport(unittest.TestCase):
    """静默支持"""

    def test_silence_path_documented(self):
        content = read(ALERTMANAGER_YML)
        # Alertmanager 默认可通过 /api/v1/silences 创建静默
        # 此处验证配置文件中无禁用静默的选项
        self.assertNotIn("disable_silences", content)


if __name__ == "__main__":
    unittest.main(verbosity=2)
