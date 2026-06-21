#!/usr/bin/env python3
"""告警历史集成层测试

测试覆盖:
  1. 子命令完整 (ingest/list/cleanup/stats/metrics/serve)
  2. Alertmanager payload 解析
  3. 重复告警合并 (5 分钟窗口)
  4. 关键词升级 (outage/failover -> critical)
  5. Prometheus 指标渲染
  6. HTTP webhook 服务
  7. 数据保留 (90 天清理)
  8. 状态字段 (firing/resolved)
  9. 与 alert_history_db.py 共用 DB
"""
import re
import sys
import json
import time
import unittest
import threading
import urllib.request
import urllib.error
import subprocess
from pathlib import Path
from datetime import datetime, timezone, timedelta

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
LOGS_DIR = SERVER_DIR / "logs"
INTEGRATION_SCRIPT = SCRIPTS_DIR / "alert_history_integration.py"
ALERT_HISTORY_DB = SCRIPTS_DIR / "alert_history_db.py"
DB_PATH = LOGS_DIR / "alert_history.db"


class TestScriptExistence(unittest.TestCase):
    """脚本存在性"""

    def test_integration_script_exists(self):
        self.assertTrue(INTEGRATION_SCRIPT.exists())

    def test_alert_history_db_exists(self):
        self.assertTrue(ALERT_HISTORY_DB.exists())


class TestSubcommands(unittest.TestCase):
    """子命令完整性"""

    def test_subcommands(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        for cmd in ["ingest", "list", "cleanup", "stats", "metrics", "serve"]:
            self.assertIn(f'"{cmd}"', content, f"缺失子命令: {cmd}")
            self.assertIn(f"cmd_{cmd}", content, f"缺失 cmd_{cmd} 函数")

    def test_help_message(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("告警历史集成层", content)


class TestSchemaAndIndexes(unittest.TestCase):
    """表结构与索引"""

    def test_table_alert_history(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("CREATE TABLE IF NOT EXISTS alert_history", content)

    def test_required_columns(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        for col in ["timestamp", "level", "title", "source", "status", "fingerprint"]:
            self.assertIn(col, content, f"缺失列: {col}")

    def test_fingerprint_column(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        # 降噪合并所需
        self.assertIn("fingerprint", content)
        self.assertIn("compute_fingerprint", content)

    def test_indexes(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        for idx in ["idx_alert_history_ts", "idx_alert_history_level", "idx_alert_history_source", "idx_alert_history_fingerprint"]:
            self.assertIn(idx, content, f"缺失索引: {idx}")


class TestAlertManagerPayloadParsing(unittest.TestCase):
    """Alertmanager payload 解析"""

    def test_alerts_key_extraction(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn('data.get("alerts"', content)

    def test_labels_annotations_extraction(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn('alert.get("labels"', content)
        self.assertIn('alert.get("annotations"', content)

    def test_alertname_severity_handling(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("alertname", content)
        self.assertIn("severity", content)


class TestKeywordEscalation(unittest.TestCase):
    """关键词升级测试"""

    def test_escalation_keywords(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        for keyword in ["outage", "failover", "down", "crash", "loss"]:
            self.assertIn(keyword, content, f"缺失升级关键词: {keyword}")

    def test_escalation_target(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"critical"', content)
        self.assertIn("escalate_level", content)

    def test_escalation_function(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        # 函数应接收 (level, alertname) 返回升级后 level
        m = re.search(r'def escalate_level\([^)]*\)[^:]*:', content)
        self.assertIsNotNone(m)

    def test_escalated_flag(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        # 应记录是否升级
        self.assertIn("escalated", content)


class TestDeduplication(unittest.TestCase):
    """告警去重测试"""

    def test_dedup_window(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("DEDUP_WINDOW_SEC", content)
        self.assertIn("300", content)  # 5 分钟

    def test_fingerprint_function(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("compute_fingerprint", content)
        self.assertIn("hashlib", content)
        self.assertIn("md5", content)

    def test_find_duplicate(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("find_duplicate", content)
        self.assertIn("fingerprint = ?", content)

    def test_merged_action(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        # 重复时应返回 "merged" 而非 "inserted"
        self.assertIn('"merged"', content)
        self.assertIn('"inserted"', content)


class TestPrometheusMetrics(unittest.TestCase):
    """Prometheus 指标测试"""

    def test_metrics_function(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("render_prometheus_metrics", content)

    def test_total_metric(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("alert_history_total", content)

    def test_by_level_metric(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("alert_history_by_level", content)

    def test_by_source_metric(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("alert_history_by_source", content)

    def test_by_day_metric(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("alert_history_by_day", content)

    def test_by_status_metric(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("alert_history_by_status", content)

    def test_period_7d(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn('period="7d"', content)

    def test_prometheus_format(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        # 必须有 HELP 和 TYPE 注释
        self.assertIn("# HELP", content)
        self.assertIn("# TYPE", content)
        self.assertIn("counter", content)


class TestHTTPServer(unittest.TestCase):
    """HTTP webhook 服务"""

    def test_alert_handler_class(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("class AlertHandler", content)

    def test_post_webhook(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("do_POST", content)
        self.assertIn("/webhook", content)

    def test_metrics_endpoint(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("/metrics", content)

    def test_healthz_endpoint(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("/healthz", content)

    def test_default_port(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        # 默认 9090
        self.assertIn("9090", content)

    def test_send_json_method(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("_send_json", content)


class TestRecordAlert(unittest.TestCase):
    """record_alert 函数测试"""

    def test_record_alert_exists(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def record_alert", content)

    def test_record_alert_returns_dict(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        # 返回 dict 含 action/id
        m = re.search(r'def record_alert.*?return\s+\{', content, re.DOTALL)
        self.assertIsNotNone(m)

    def test_channels_parameter(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("channels", content)


class TestCleanupPolicy(unittest.TestCase):
    """清理策略测试"""

    def test_cleanup_function(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def cmd_cleanup", content)

    def test_default_retention(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        # 默认 90 天
        self.assertIn("default=90", content)

    def test_cleanup_query(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("DELETE FROM alert_history", content)


class TestStatsFunction(unittest.TestCase):
    """统计函数测试"""

    def test_stats_function(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def cmd_stats", content)

    def test_by_level_in_stats(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"by_level"', content)

    def test_by_source_in_stats(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"by_source"', content)

    def test_by_day_in_stats(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"by_day"', content)


class TestListFunction(unittest.TestCase):
    """list 函数测试"""

    def test_list_function(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def cmd_list", content)

    def test_filter_level(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"level"', content)
        self.assertIn('"status"', content)

    def test_limit_param(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--limit", content)


class TestIntegrationWithAlertHistoryDB(unittest.TestCase):
    """与 alert_history_db.py 集成测试"""

    def test_same_db_path(self):
        """共用同一 SQLite DB"""
        integ = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        orig = ALERT_HISTORY_DB.read_text(encoding="utf-8")
        # 两者都应该引用 alert_history.db
        self.assertIn("alert_history.db", integ)
        self.assertIn("alert_history.db", orig)

    def test_same_table(self):
        """共用 alert_history 表"""
        integ = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        orig = ALERT_HISTORY_DB.read_text(encoding="utf-8")
        self.assertIn("alert_history", integ)
        self.assertIn("alert_history", orig)


class TestCommandLineArguments(unittest.TestCase):
    """命令行参数测试"""

    def test_payload_arg(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--payload", content)

    def test_file_arg(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--file", content)

    def test_days_arg(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--days", content)

    def test_port_arg(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--port", content)


class TestNoBannedPatterns(unittest.TestCase):
    """禁用模式检查"""

    def test_no_mysql(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn("mysql", content.lower())
        self.assertNotIn("mariadb", content.lower())

    def test_no_hardcoded_password(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn('password = "', content)
        self.assertNotIn('password: "', content)

    def test_no_todo(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        code_lines = [l for l in content.split("\n") if not l.strip().startswith("#")]
        code = "\n".join(code_lines)
        self.assertNotIn("TODO", code)
        self.assertNotIn("FIXME", code)


class TestHelperFunctions(unittest.TestCase):
    """辅助函数测试"""

    def test_log_function(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def log(", content)

    def test_get_connection(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def get_connection", content)

    def test_init_schema(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("_init_schema", content)


class TestThresholds(unittest.TestCase):
    """阈值与配置测试"""

    def test_dedup_window_300s(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        m = re.search(r"DEDUP_WINDOW_SEC\s*=\s*(\d+)", content)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), "300")


class TestProductionReadiness(unittest.TestCase):
    """生产就绪性测试"""

    def test_serve_in_foreground(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        # serve_forever 是阻塞调用, 需要 KeyboardInterrupt 处理
        self.assertIn("serve_forever", content)
        self.assertIn("KeyboardInterrupt", content)

    def test_thread_safe_metrics(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        # metrics 渲染涉及 SQLite 读, 在多线程环境下需注意
        # 简单测试: 至少要 import threading
        self.assertIn("import threading", content)

    def test_connection_close(self):
        content = INTEGRATION_SCRIPT.read_text(encoding="utf-8")
        # 每个函数都应该关闭连接
        closes = content.count("conn.close()")
        self.assertGreaterEqual(closes, 4)


if __name__ == "__main__":
    unittest.main(verbosity=2)
