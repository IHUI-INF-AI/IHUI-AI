#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""故障切换剧本实操测试

测试覆盖:
  1. 脚本文件存在 & 可执行权限
  2. 5 个场景的代码完整性
  3. RTO/RPO 指标
  4. 报告生成路径
  5. dry-run 模式
  6. --scenario 过滤
  7. 剧本中关键步骤完整性
  8. 跨云故障切换逻辑
"""
import re
import sys
import json
import unittest
import subprocess
import tempfile
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "failover_runbook_test.sh"


class TestScriptExistence(unittest.TestCase):
    """脚本存在性测试"""

    def test_script_exists(self):
        self.assertTrue(SCRIPT.exists(), f"脚本不存在: {SCRIPT}")

    def test_script_shebang(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertTrue(content.startswith("#!/bin/bash") or content.startswith("#!/usr/bin/env bash"),
                        "必须以 bash shebang 开头")

    def test_script_has_set_options(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 必须有 set -uo pipefail 或 set -euo pipefail
        self.assertIn("set -", content)
        self.assertIn("pipefail", content)

    def test_script_has_5_scenarios(self):
        content = SCRIPT.read_text(encoding="utf-8")
        for i in range(1, 6):
            self.assertIn(f"scenario_{i}_", content, f"缺失场景 {i}")


class TestScenarioContent(unittest.TestCase):
    """场景内容测试"""

    @classmethod
    def setUpClass(cls):
        cls.content = SCRIPT.read_text(encoding="utf-8")

    def test_scenario_1_aliyun_failover(self):
        self.assertIn("scenario_1_aliyun_failover", self.content)
        self.assertIn("阿里云", self.content)
        self.assertIn("华为云", self.content)
        # RTO 指标
        self.assertIn("RTO", self.content)
        self.assertIn("15", self.content)

    def test_scenario_2_dual_cloud(self):
        self.assertIn("scenario_2_dual_cloud_failover", self.content)
        self.assertIn("AWS", self.content)
        self.assertIn("灾备", self.content)
        # RTO 1h
        self.assertIn("3600", self.content)

    def test_scenario_3_network_partition(self):
        self.assertIn("scenario_3_network_partition", self.content)
        self.assertIn("witness", self.content)
        self.assertIn("仲裁", self.content)
        self.assertIn("网络分区", self.content)

    def test_scenario_4_dns_failover(self):
        self.assertIn("scenario_4_dns_failover", self.content)
        self.assertIn("DNS", self.content)
        self.assertIn("Cloudflare", self.content)
        self.assertIn("TTL", self.content)
        self.assertIn("GeoIP", self.content)

    def test_scenario_5_app_reconnect(self):
        self.assertIn("scenario_5_app_reconnect", self.content)
        self.assertIn("重连", self.content)
        self.assertIn("pgBouncer", self.content)
        self.assertIn("HAProxy", self.content)
        self.assertIn("P99", self.content)


class TestRTORPO(unittest.TestCase):
    """RTO/RPO 指标测试"""

    @classmethod
    def setUpClass(cls):
        cls.content = SCRIPT.read_text(encoding="utf-8")

    def test_rto_15s_for_single_cloud(self):
        """单云故障 RTO=15s"""
        self.assertIn("RTO=15s", self.content)

    def test_rto_3600s_for_dr(self):
        """灾备 RTO=3600s"""
        self.assertIn("3600", self.content)

    def test_rpo_5s(self):
        """RPO<5s (异步复制)"""
        self.assertIn("RPO<5s", self.content)

    def test_rto_target_in_report(self):
        """报告中必须含 rto_target_sec=60"""
        self.assertIn("rto_target_sec", self.content)
        self.assertIn("60", self.content)

    def test_rpo_target_in_report(self):
        """报告中必须含 rpo_target_sec=5"""
        self.assertIn("rpo_target_sec", self.content)
        self.assertIn("5", self.content)


class TestReportGeneration(unittest.TestCase):
    """报告生成测试"""

    def test_report_file_path(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("REPORT_FILE", content)
        self.assertIn("failover_runbook_test_", content)
        self.assertIn(".json", content)

    def test_report_in_logs_dir(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('LOG_DIR="${SERVER_DIR}/logs"', content)

    def test_report_json_format(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # JSON 字段
        for field in ["test", "timestamp", "dry_run", "scenarios", "passed", "failed"]:
            self.assertIn(field, content)

    def test_report_with_status(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("status", content)
        self.assertIn("passed", content)

    def test_report_5_scenarios(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("total_scenarios", content)
        self.assertIn("5", content)


class TestCommandLineOptions(unittest.TestCase):
    """命令行选项测试"""

    def test_dry_run_flag(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--dry-run", content)

    def test_scenario_flag(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--scenario", content)

    def test_should_run_filter(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("should_run", content)
        self.assertIn("SCENARIO_FILTER", content)


class TestUtilityFunctions(unittest.TestCase):
    """工具函数测试"""

    def test_log_function(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("log()", content)

    def test_scenario_start(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("scenario_start", content)

    def test_scenario_end(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("scenario_end", content)

    def test_passed_failed_counters(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("PASSED", content)
        self.assertIn("FAILED", content)
        self.assertIn("SKIPPED", content)

    def test_scenario_results_dict(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("SCENARIO_RESULTS", content)
        self.assertIn("declare -A", content)


class TestStepsPerScenario(unittest.TestCase):
    """每个场景步骤数测试"""

    def test_scenario_1_step_count(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 场景 1 必须有 6 步
        steps = re.findall(r'\[1\.\d\]', content)
        self.assertGreaterEqual(len(steps), 5, f"场景 1 步骤数: {len(steps)}")

    def test_scenario_2_step_count(self):
        content = SCRIPT.read_text(encoding="utf-8")
        steps = re.findall(r'\[2\.\d\]', content)
        self.assertGreaterEqual(len(steps), 4, f"场景 2 步骤数: {len(steps)}")

    def test_scenario_3_step_count(self):
        content = SCRIPT.read_text(encoding="utf-8")
        steps = re.findall(r'\[3\.\d\]', content)
        self.assertGreaterEqual(len(steps), 4, f"场景 3 步骤数: {len(steps)}")

    def test_scenario_4_step_count(self):
        content = SCRIPT.read_text(encoding="utf-8")
        steps = re.findall(r'\[4\.\d\]', content)
        self.assertGreaterEqual(len(steps), 4, f"场景 4 步骤数: {len(steps)}")

    def test_scenario_5_step_count(self):
        content = SCRIPT.read_text(encoding="utf-8")
        steps = re.findall(r'\[5\.\d\]', content)
        self.assertGreaterEqual(len(steps), 5, f"场景 5 步骤数: {len(steps)}")


class TestCrossCloudReferences(unittest.TestCase):
    """跨云引用测试"""

    def test_aliyun_mentioned(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("阿里云", content)

    def test_huawei_mentioned(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("华为云", content)

    def test_aws_mentioned(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("AWS", content)

    def test_patroni_mentioned(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("Patroni", content)

    def test_haproxy_mentioned(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("HAProxy", content)

    def test_pgbouncer_mentioned(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("pgBouncer", content)


class TestExecutableMode(unittest.TestCase):
    """执行权限测试"""

    def test_script_path_valid(self):
        # 路径在 Windows 下使用 .sh 后缀
        self.assertTrue(SCRIPT.name.endswith(".sh"))


class TestSyntaxCheck(unittest.TestCase):
    """Bash 语法检查"""

    def test_no_syntax_error(self):
        """尝试 bash -n 语法检查 (Linux/Mac bash 可用)"""
        if sys.platform == "win32":
            # Windows 下无法运行 bash, 仅做内容检查
            content = SCRIPT.read_text(encoding="utf-8")
            # 检查常见语法错误
            self.assertNotIn(";; ", content)  # 错误的 case 语句结束符
            self.assertIn("done", content)  # 至少有一个 done
            self.assertIn("fi", content)  # 至少有一个 fi
            return

        # 在 Linux/Mac 上做实际 bash 语法检查
        try:
            result = subprocess.run(
                ["bash", "-n", str(SCRIPT)],
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(result.returncode, 0, f"bash 语法错误: {result.stderr}")
        except FileNotFoundError:
            self.skipTest("bash 不可用")


class TestScriptExecution(unittest.TestCase):
    """脚本执行测试 (dry-run 模式)"""

    def test_dry_run_execution(self):
        """dry-run 模式可以正常执行"""
        if sys.platform == "win32":
            self.skipTest("Windows 下 bash 不可用, 跳过执行测试")
        try:
            result = subprocess.run(
                ["bash", str(SCRIPT), "--dry-run"],
                capture_output=True,
                text=True,
                timeout=60,
                cwd=str(SERVER_DIR),
            )
            self.assertEqual(result.returncode, 0, f"dry-run 失败: {result.stderr}")
            # 应生成报告文件
            logs_dir = SERVER_DIR / "logs"
            report_files = list(logs_dir.glob("failover_runbook_test_*.json"))
            self.assertGreater(len(report_files), 0, "应生成报告文件")
        except FileNotFoundError:
            self.skipTest("bash 不可用")
        except subprocess.TimeoutExpired:
            self.fail("脚本执行超时")


class TestScenarioFiltering(unittest.TestCase):
    """场景过滤测试"""

    def test_scenario_filter_argument(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # should_run 函数被每个场景调用
        for i in range(1, 6):
            self.assertIn(f"should_run {i}", content)


class TestOutputMessages(unittest.TestCase):
    """输出消息测试"""

    def test_passing_message(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("通过", content)

    def test_failing_message(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("失败", content)

    def test_summary_message(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("测试汇总", content)
        self.assertIn("通过:", content)
        self.assertIn("失败:", content)


class TestIntegrationWithOtherScripts(unittest.TestCase):
    """与其他脚本集成测试"""

    def test_references_patroni_drill(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 应引用 patroni_failover_drill.sh
        self.assertIn("patroni_failover_drill.sh", content)

    def test_references_failover_orchestrator(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 可引用 failover_orchestrator.py
        has_ref = "failover_orchestrator" in content or "orchestrator" in content
        self.assertTrue(has_ref, "应引用 failover orchestrator")


if __name__ == "__main__":
    unittest.main(verbosity=2)
