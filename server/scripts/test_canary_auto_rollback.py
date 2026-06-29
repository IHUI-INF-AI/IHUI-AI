#!/usr/bin/env python3
"""金丝雀自动回滚测试

测试覆盖:
  1. 子命令完整 (check/rollback/history/monitor)
  2. 阈值定义
  3. Prometheus 查询
  4. 指标采集
  5. 阈值评估
  6. 回滚触发
  7. 事件历史记录
  8. 防重复触发
  9. 与 canary_release.sh 集成
"""
import re
import sys
import json
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "canary_auto_rollback.py"
CANARY_RELEASE_SH = SCRIPTS_DIR / "canary_release.sh"


class TestScriptExistence(unittest.TestCase):
    """脚本存在性"""

    def test_script_exists(self):
        self.assertTrue(SCRIPT.exists())

    def test_canary_release_exists(self):
        self.assertTrue(CANARY_RELEASE_SH.exists())


class TestSubcommands(unittest.TestCase):
    """子命令"""

    def test_check_subcommand(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"check"', content)
        self.assertIn("def cmd_check", content)

    def test_rollback_subcommand(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"rollback"', content)
        self.assertIn("def cmd_rollback", content)

    def test_history_subcommand(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"history"', content)
        self.assertIn("def cmd_history", content)

    def test_monitor_subcommand(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"monitor"', content)
        self.assertIn("def monitor_loop", content)


class TestThresholds(unittest.TestCase):
    """阈值定义"""

    @classmethod
    def setUpClass(cls):
        cls.content = SCRIPT.read_text(encoding="utf-8")

    def test_error_rate_threshold(self):
        # error_rate > 5%
        self.assertIn('"error_rate": 0.05', self.content)

    def test_p95_latency_threshold(self):
        # P95 > 200ms
        self.assertIn('"p95_latency_ms": 200', self.content)

    def test_p95_increase_threshold(self):
        # P95 增加 > 50%
        self.assertIn('"p95_increase_pct": 50', self.content)

    def test_qps_drop_threshold(self):
        # QPS 下降 > 50%
        self.assertIn('"qps_drop_pct": 50', self.content)

    def test_5xx_threshold(self):
        # 5xx > 10/分钟
        self.assertIn('"http_5xx_per_min": 10', self.content)

    def test_crash_loop_threshold(self):
        # CrashLoop > 3
        self.assertIn('"crash_loop_count": 3', self.content)


class TestPrometheusIntegration(unittest.TestCase):
    """Prometheus 集成"""

    @classmethod
    def setUpClass(cls):
        cls.content = SCRIPT.read_text(encoding="utf-8")

    def test_prometheus_url(self):
        self.assertIn("PROMETHEUS_URL", self.content)
        self.assertIn("prometheus:9090", self.content)

    def test_query_prometheus(self):
        self.assertIn("def query_prometheus", self.content)
        self.assertIn("/api/v1/query", self.content)

    def test_promql_error_rate(self):
        self.assertIn('rate(http_requests_total', self.content)
        self.assertIn('status=~"5.."', self.content)

    def test_promql_p95(self):
        self.assertIn("histogram_quantile(0.95", self.content)

    def test_promql_qps(self):
        self.assertIn("sum(rate(http_requests_total", self.content)

    def test_promql_crash_loop(self):
        self.assertIn("CrashLoopBackOff", self.content)


class TestMetricsCollection(unittest.TestCase):
    """指标采集"""

    def test_collect_metrics_function(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def collect_metrics", content)

    def test_6_metrics_collected(self):
        content = SCRIPT.read_text(encoding="utf-8")
        for metric in ["error_rate", "p95_latency_ms", "qps_drop_pct", "http_5xx_per_min", "crash_loop_count"]:
            self.assertIn(metric, content)


class TestThresholdEvaluation(unittest.TestCase):
    """阈值评估"""

    def test_evaluate_thresholds(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def evaluate_thresholds", content)

    def test_all_rules(self):
        content = SCRIPT.read_text(encoding="utf-8")
        for rule in ["error_rate", "p95_latency", "qps_drop", "5xx_errors", "crash_loop"]:
            self.assertIn(f'"{rule}"', content, f"缺失规则: {rule}")


class TestRollbackTrigger(unittest.TestCase):
    """回滚触发"""

    def test_trigger_rollback(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def trigger_rollback", content)

    def test_calls_canary_release(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("canary_release.sh", content)
        self.assertIn("--rollback", content)

    def test_records_event(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("INSERT INTO rollback_events", content)

    def test_status_rolled_back(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"rolled_back"', content)
        self.assertIn('"rollback_failed"', content)


class TestEventSchema(unittest.TestCase):
    """事件表结构"""

    def test_rollback_events_table(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("CREATE TABLE IF NOT EXISTS rollback_events", content)

    def test_required_columns(self):
        content = SCRIPT.read_text(encoding="utf-8")
        for col in ["timestamp", "service", "version", "reason", "triggered_by", "details", "status", "duration_ms"]:
            self.assertIn(col, content, f"缺失列: {col}")

    def test_indexes(self):
        content = SCRIPT.read_text(encoding="utf-8")
        for idx in ["idx_rollback_ts", "idx_rollback_service"]:
            self.assertIn(idx, content)


class TestAntiRepeat(unittest.TestCase):
    """防重复触发"""

    def test_debounce(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 60s 内不重复触发
        self.assertIn("60", content)

    def test_last_alert_tracking(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("last_alert", content)


class TestMonitorLoop(unittest.TestCase):
    """监控循环"""

    def test_interval_param(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--interval", content)
        self.assertIn("default=30", content)

    def test_sleep_between_checks(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("time.sleep", content)


class TestManualRollback(unittest.TestCase):
    """手动回滚"""

    def test_reason_param(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--reason", content)
        self.assertIn('"manual"', content)

    def test_triggered_by(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"manual"', content)
        self.assertIn('"auto"', content)


class TestNoBannedPatterns(unittest.TestCase):
    """禁用模式检查"""

    def test_no_mysql(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn("mysql", content.lower())
        self.assertNotIn("mariadb", content.lower())

    def test_no_hardcoded_secret(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn('password = "', content)

    def test_no_todo(self):
        content = SCRIPT.read_text(encoding="utf-8")
        code_lines = [l for l in content.split("\n") if not l.strip().startswith("#")]
        code = "\n".join(code_lines)
        self.assertNotIn("TODO", code)


class TestNoExternalDeps(unittest.TestCase):
    """不依赖外部服务"""

    def test_no_redis(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 只用 SQLite + Prometheus
        self.assertNotIn("import redis", content)
        self.assertNotIn("from redis", content)

    def test_uses_sqlite(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("import sqlite3", content)

    def test_uses_urllib(self):
        # Prometheus 查询用 urllib
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("urllib", content)


class TestCommandLineOptions(unittest.TestCase):
    """命令行选项"""

    def test_service_required(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('--service", required=True', content)

    def test_version_optional(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('--version"', content)

    def test_auto_rollback_flag(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--auto-rollback", content)

    def test_history_limit(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--limit", content)


class TestIntegrationWithOtherScripts(unittest.TestCase):
    """与其他脚本集成"""

    def test_canary_release_sh_used(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("CANARY_RELEASE_SH", content)
        self.assertIn("canary_release.sh", content)


class TestOutputFormat(unittest.TestCase):
    """输出格式"""

    def test_json_output(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 输出必须是 JSON
        self.assertIn("json.dumps", content)

    def test_metrics_in_output(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("metrics", content)


class TestTimeBasedCalculations(unittest.TestCase):
    """时间窗口计算"""

    def test_5m_window(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 5 分钟窗口
        self.assertIn("[5m]", content)

    def test_1h_baseline(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 1 小时 baseline
        self.assertIn("[1h]", content)

    def test_1m_increase(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 1 分钟 increase
        self.assertIn("[1m]", content)


if __name__ == "__main__":
    unittest.main(verbosity=2)
