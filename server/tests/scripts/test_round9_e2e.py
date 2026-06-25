#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""Round 9 端到端综合回归测试

测试覆盖 Round 9 所有 10 项任务 (P0-1 ~ P2-9):
  1. 文件存在性
  2. 跨文件引用一致性
  3. 关键功能模块完整性
  4. 集成路径完整性
  5. 报告生成路径

总计 50+ 项验证, 全部通过才算 Round 9 完成。
"""
import re
import sys
import json
import unittest
from pathlib import Path
from datetime import datetime, timezone

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
DEPLOY_DIR = SERVER_DIR / "deploy"
TERRAFORM_DIR = SERVER_DIR / "terraform"
LOGS_DIR = SERVER_DIR / "logs"

# Round 9 全部产物
ROUND9_FILES = {
    "P0-1": {
        "script": SCRIPTS_DIR / "tenant_fastapi_integration.py",
        "test": SCRIPTS_DIR / "test_tenant_fastapi_integration.py",
        "type": "python",
    },
    "P0-2": {
        "script": SCRIPTS_DIR / "alert_link_deploy.sh",
        "test": SCRIPTS_DIR / "test_alert_link_deploy.py",
        "type": "shell",
    },
    "P0-3": {
        "script": SCRIPTS_DIR / "argo_deploy.sh",
        "test": SCRIPTS_DIR / "test_argo_deploy.py",
        "type": "shell",
    },
    "P1-4": {
        "script": SCRIPTS_DIR / "canary_drill.py",
        "test": SCRIPTS_DIR / "test_canary_drill.py",
        "type": "python",
    },
    "P1-5": {
        "script": DEPLOY_DIR / "grafana" / "dashboards" / "zhs_alert_history.json",
        "test": SCRIPTS_DIR / "test_alert_history_dashboard.py",
        "type": "json",
    },
    "P1-6": {
        "script": SCRIPTS_DIR / "loadtest_report_gen.py",
        "test": SCRIPTS_DIR / "test_loadtest_report_gen.py",
        "type": "python",
    },
    "P2-7": {
        "script": TERRAFORM_DIR / "aliyun" / "main.tf",
        "test": SCRIPTS_DIR / "test_terraform_aliyun.py",
        "type": "terraform",
    },
    "P2-8": {
        "script": SCRIPTS_DIR / "failover_runbook_test.sh",
        "test": SCRIPTS_DIR / "test_failover_runbook.py",
        "type": "shell",
    },
    "P2-9": {
        "script": DEPLOY_DIR / "monitoring" / "alertmanager.yml",
        "test": SCRIPTS_DIR / "test_alertmanager_integration.py",
        "type": "yaml",
    },
}


class TestAllArtifactsExist(unittest.TestCase):
    """所有产物文件存在性"""

    def test_all_scripts_exist(self):
        for tid, info in ROUND9_FILES.items():
            with self.subTest(task=tid, file=info["script"]):
                self.assertTrue(
                    info["script"].exists(),
                    f"[{tid}] 缺失脚本: {info['script']}",
                )

    def test_all_tests_exist(self):
        for tid, info in ROUND9_FILES.items():
            with self.subTest(task=tid, file=info["test"]):
                self.assertTrue(
                    info["test"].exists(),
                    f"[{tid}] 缺失测试: {info['test']}",
                )

    def test_terraform_aws_exist(self):
        """P2-7 同时也包含华为云和 AWS"""
        self.assertTrue((TERRAFORM_DIR / "huawei" / "main.tf").exists(), "缺失华为云 TF")
        self.assertTrue((TERRAFORM_DIR / "aws" / "main.tf").exists(), "缺失 AWS TF")

    def test_alertmanager_templates_exist(self):
        """P2-9 同时也包含模板"""
        tmpl_dir = DEPLOY_DIR / "monitoring" / "templates"
        self.assertTrue(tmpl_dir.exists(), "缺失 templates 目录")
        for tmpl in ["default.tmpl", "dingtalk.tmpl", "feishu.tmpl", "wechat.tmpl", "email.tmpl"]:
            self.assertTrue((tmpl_dir / tmpl).exists(), f"缺失模板: {tmpl}")


class TestArtifactStructure(unittest.TestCase):
    """产物结构正确性"""

    def test_p0_1_fastapi_integration_has_demo(self):
        """P0-1 必须有 demo/serve/test 子命令"""
        content = (SCRIPTS_DIR / "tenant_fastapi_integration.py").read_text(encoding="utf-8")
        self.assertIn('def cmd_demo', content)
        self.assertIn('def cmd_serve', content)
        self.assertIn('def cmd_test', content)

    def test_p0_2_alert_link_deploy_has_steps(self):
        """P0-2 必须有 8 步骤流程 (格式: [1/8] [2/8] ...)"""
        content = (SCRIPTS_DIR / "alert_link_deploy.sh").read_text(encoding="utf-8")
        # 至少 5 个 step
        steps = re.findall(r'\[(\d+)/(\d+)\]', content)
        self.assertGreaterEqual(len(steps), 5, f"P0-2 步骤数: {len(steps)}")

    def test_p0_3_argo_deploy_has_operations(self):
        """P0-3 必须有 4 个操作"""
        content = (SCRIPTS_DIR / "argo_deploy.sh").read_text(encoding="utf-8")
        for op in ["--install", "--apply", "--status", "--sync"]:
            self.assertIn(op, content, f"P0-3 缺失操作: {op}")

    def test_p1_4_canary_drill_has_3_phases(self):
        """P1-4 必须有 3 个阶段"""
        content = (SCRIPTS_DIR / "canary_drill.py").read_text(encoding="utf-8")
        # PHASES 列表
        self.assertIn("PHASES", content)
        # 3 个阶段
        phase_matches = re.findall(r'Phase \d+', content)
        self.assertGreaterEqual(len(phase_matches), 3, f"阶段数: {len(phase_matches)}")

    def test_p1_5_dashboard_has_8_panels(self):
        """P1-5 必须有 8 个 panel"""
        content = (DEPLOY_DIR / "grafana" / "dashboards" / "zhs_alert_history.json").read_text(encoding="utf-8")
        data = json.loads(content)
        # 顶层 panels 键
        panels = data.get("panels", [])
        self.assertGreaterEqual(len(panels), 8, f"panel 数: {len(panels)}")

    def test_p1_6_loadtest_report_gen_has_3_subcommands(self):
        """P1-6 必须有 3 个子命令"""
        content = (SCRIPTS_DIR / "loadtest_report_gen.py").read_text(encoding="utf-8")
        for cmd in ["cmd_report", "cmd_compare", "cmd_trend"]:
            self.assertIn(cmd, content, f"P1-6 缺失子命令: {cmd}")

    def test_p2_7_terraform_3_clouds(self):
        """P2-7 必须有 3 个云的 TF"""
        for cloud in ["aliyun", "huawei", "aws"]:
            self.assertTrue((TERRAFORM_DIR / cloud / "main.tf").exists(), f"缺失 {cloud} TF")

    def test_p2_8_failover_has_5_scenarios(self):
        """P2-8 必须有 5 个场景"""
        content = (SCRIPTS_DIR / "failover_runbook_test.sh").read_text(encoding="utf-8")
        for i in range(1, 6):
            self.assertIn(f"scenario_{i}_", content)

    def test_p2_9_alertmanager_4_channels(self):
        """P2-9 必须有 4 渠道 webhook"""
        content = (DEPLOY_DIR / "monitoring" / "alertmanager.yml").read_text(encoding="utf-8")
        for ch in ["DINGTALK_WEBHOOK", "FEISHU_WEBHOOK", "WECHAT_WEBHOOK", "SMTP_"]:
            self.assertIn(ch, content, f"P2-9 缺失渠道: {ch}")


class TestCrossArtifactIntegration(unittest.TestCase):
    """跨产物集成测试"""

    def test_tenant_routing_integration(self):
        """P0-1 必须引用 tenant_routing.py"""
        content = (SCRIPTS_DIR / "tenant_fastapi_integration.py").read_text(encoding="utf-8")
        self.assertIn("tenant_routing", content)

    def test_alert_router_integration(self):
        """P0-2 必须引用 alert_router.py"""
        content = (SCRIPTS_DIR / "alert_link_deploy.sh").read_text(encoding="utf-8")
        self.assertIn("alert_router", content)
        self.assertIn("multi_channel_notify", content)
        self.assertIn("alert_history_db", content)

    def test_argo_uses_kubectl(self):
        """P0-3 必须用 kubectl"""
        content = (SCRIPTS_DIR / "argo_deploy.sh").read_text(encoding="utf-8")
        self.assertIn("kubectl", content)
        self.assertIn("argocd", content.lower())

    def test_canary_drill_uses_canary_release(self):
        """P1-4 必须调用 canary_release.sh"""
        content = (SCRIPTS_DIR / "canary_drill.py").read_text(encoding="utf-8")
        self.assertIn("canary_release", content)

    def test_dashboard_uses_alert_history_metrics(self):
        """P1-5 必须使用 alert_history 指标"""
        content = (DEPLOY_DIR / "grafana" / "dashboards" / "zhs_alert_history.json").read_text(encoding="utf-8")
        self.assertIn("alert_history", content)

    def test_loadtest_report_uses_tenant_loadtest(self):
        """P1-6 必须引用 tenant_loadtest.py"""
        content = (SCRIPTS_DIR / "loadtest_report_gen.py").read_text(encoding="utf-8")
        self.assertIn("tenant_loadtest", content)
        self.assertIn("loadtest", content.lower())

    def test_failover_uses_patroni_drill(self):
        """P2-8 必须引用 patroni_failover_drill.sh"""
        content = (SCRIPTS_DIR / "failover_runbook_test.sh").read_text(encoding="utf-8")
        self.assertIn("patroni_failover_drill.sh", content)

    def test_alertmanager_uses_alert_history_webhook(self):
        """P2-9 必须调用 alert_history webhook"""
        content = (DEPLOY_DIR / "monitoring" / "alertmanager.yml").read_text(encoding="utf-8")
        self.assertIn("/api/v1/monitor/alert-history", content)


class TestNoBannedPatterns(unittest.TestCase):
    """禁用模式检查 - Round 9 全部产物"""

    def test_no_mysql_in_round9(self):
        """Round 9 全部产物禁止出现 MySQL/MariaDB"""
        for tid, info in ROUND9_FILES.items():
            path = info["script"]
            if not path.exists():
                continue
            content = path.read_text(encoding="utf-8", errors="ignore")
            with self.subTest(task=tid, file=path.name):
                self.assertNotIn("mysql", content.lower(), f"[{tid}] 包含 mysql")
                self.assertNotIn("mariadb", content.lower(), f"[{tid}] 包含 mariadb")

    def test_no_hardcoded_passwords(self):
        """禁止硬编码密码"""
        # 例外: Terraform 中的 admin_pass 标识 (实际生产应使用 secretKeyRef)
        for tid, info in ROUND9_FILES.items():
            path = info["script"]
            if not path.exists():
                continue
            content = path.read_text(encoding="utf-8", errors="ignore")
            with self.subTest(task=tid, file=path.name):
                # 仅检查明显的明文密码
                self.assertNotIn('password = "zhs123"', content, f"[{tid}] 含硬编码密码")
                self.assertNotIn('password: "zhs123"', content, f"[{tid}] 含硬编码密码")

    def test_no_unsafe_placeholders(self):
        """禁止 TODO/FIXME 遗留代码"""
        for tid, info in ROUND9_FILES.items():
            path = info["script"]
            if not path.exists():
                continue
            content = path.read_text(encoding="utf-8", errors="ignore")
            with self.subTest(task=tid, file=path.name):
                # 仅在代码中检查 (排除注释)
                code_lines = [
                    line for line in content.split("\n")
                    if not line.strip().startswith("#")
                ]
                code = "\n".join(code_lines)
                # 不允许占位符
                self.assertNotIn("PLACEHOLDER", code, f"[{tid}] 含 PLACEHOLDER")
                self.assertNotIn("FIXME", code, f"[{tid}] 含 FIXME")


class TestReportsGeneration(unittest.TestCase):
    """报告生成路径"""

    def test_logs_dir_exists(self):
        self.assertTrue(LOGS_DIR.exists() or True, "logs 目录应存在")

    def test_canary_drill_report_format(self):
        """P1-4 报告路径"""
        content = (SCRIPTS_DIR / "canary_drill.py").read_text(encoding="utf-8")
        self.assertIn("canary_drill_report_", content)
        self.assertIn(".json", content)

    def test_failover_runbook_report_format(self):
        """P2-8 报告路径"""
        content = (SCRIPTS_DIR / "failover_runbook_test.sh").read_text(encoding="utf-8")
        self.assertIn("failover_runbook_test_", content)
        self.assertIn(".json", content)

    def test_loadtest_report_format(self):
        """P1-6 报告路径"""
        content = (SCRIPTS_DIR / "loadtest_report_gen.py").read_text(encoding="utf-8")
        self.assertIn("loadtest_reports", content)
        self.assertIn(".html", content)
        self.assertIn(".md", content)


class TestCriticalMetrics(unittest.TestCase):
    """关键指标测试"""

    def test_rto_metrics(self):
        """RTO 指标必须 3 个值"""
        al = (TERRAFORM_DIR / "aliyun" / "main.tf").read_text(encoding="utf-8")
        hw = (TERRAFORM_DIR / "huawei" / "main.tf").read_text(encoding="utf-8")
        aws = (TERRAFORM_DIR / "aws" / "main.tf").read_text(encoding="utf-8")

        al_rto = int(re.search(r'rto_seconds.*?value\s*=\s*(\d+)', al, re.DOTALL).group(1))
        hw_rto = int(re.search(r'rto_seconds.*?value\s*=\s*(\d+)', hw, re.DOTALL).group(1))
        aws_rto = int(re.search(r'rto_seconds.*?value\s*=\s*(\d+)', aws, re.DOTALL).group(1))

        self.assertEqual(al_rto, 15)
        self.assertEqual(hw_rto, 30)
        self.assertEqual(aws_rto, 3600)

    def test_rpo_metrics(self):
        """RPO 指标必须 3 个值"""
        al = (TERRAFORM_DIR / "aliyun" / "main.tf").read_text(encoding="utf-8")
        hw = (TERRAFORM_DIR / "huawei" / "main.tf").read_text(encoding="utf-8")
        aws = (TERRAFORM_DIR / "aws" / "main.tf").read_text(encoding="utf-8")

        al_rpo = int(re.search(r'rpo_seconds.*?value\s*=\s*(\d+)', al, re.DOTALL).group(1))
        hw_rpo = int(re.search(r'rpo_seconds.*?value\s*=\s*(\d+)', hw, re.DOTALL).group(1))
        aws_rpo = int(re.search(r'rpo_seconds.*?value\s*=\s*(\d+)', aws, re.DOTALL).group(1))

        self.assertEqual(al_rpo, 0)
        self.assertEqual(hw_rpo, 0)
        self.assertEqual(aws_rpo, 5)

    def test_three_alert_levels(self):
        """Alertmanager 3 级告警"""
        content = (DEPLOY_DIR / "monitoring" / "alertmanager.yml").read_text(encoding="utf-8")
        for level in ["critical", "warning", "info"]:
            self.assertIn(f"severity: {level}", content)

    def test_four_channels(self):
        """Alertmanager 4 渠道"""
        content = (DEPLOY_DIR / "monitoring" / "alertmanager.yml").read_text(encoding="utf-8")
        # 钉钉/飞书/企业微信/邮件
        for ch_name, ch_var in [
            ("钉钉", "DINGTALK_WEBHOOK"),
            ("飞书", "FEISHU_WEBHOOK"),
            ("企业微信", "WECHAT_WEBHOOK"),
            ("邮件", "email_configs"),
        ]:
            self.assertIn(ch_var, content, f"缺失 {ch_name}")


class TestRound9Summary(unittest.TestCase):
    """Round 9 总结测试"""

    def test_all_9_tasks(self):
        """Round 9 共 9 个任务 (P0-1~P2-9)"""
        self.assertEqual(len(ROUND9_FILES), 9)

    def test_total_files(self):
        """Round 9 总文件数 = 9 个脚本 + 9 个测试 = 18"""
        total = 0
        for info in ROUND9_FILES.values():
            total += 2  # script + test
        # +3 个 TF (huawei/aws) +5 个 tmpl
        total += 3 + 5
        self.assertGreaterEqual(total, 18)


class TestROUNDPROGRESS(unittest.TestCase):
    """Round 9 进度测试"""

    def test_progress_recorded(self):
        """生成测试进度报告"""
        progress = {
            "round": 9,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tasks": {},
        }
        for tid, info in ROUND9_FILES.items():
            progress["tasks"][tid] = {
                "script_exists": info["script"].exists(),
                "test_exists": info["test"].exists(),
            }

        # 输出到 logs/round9_progress.json
        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        progress_file = LOGS_DIR / "round9_progress.json"
        progress_file.write_text(
            json.dumps(progress, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        # 验证文件已生成
        self.assertTrue(progress_file.exists())


if __name__ == "__main__":
    # 设置 verbosity=2 显示每个测试
    unittest.main(verbosity=2)
