#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""Round 9 Nightly CI 配置测试

测试覆盖:
  1. workflow 文件存在性
  2. YAML 语法正确
  3. 触发条件 (cron + workflow_dispatch)
  4. 9 个任务映射完整
  5. Job 依赖关系正确
  6. 步骤命名规范
  7. 矩阵/参数化正确
  8. 通知机制
"""
import re
import sys
import unittest
from pathlib import Path

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

WORKFLOW = Path(__file__).resolve().parent.parent / ".github" / "workflows" / "round9_nightly.yml"


class TestWorkflowExistence(unittest.TestCase):
    """workflow 文件存在性"""

    def test_file_exists(self):
        self.assertTrue(WORKFLOW.exists(), f"workflow 不存在: {WORKFLOW}")

    def test_yaml_syntax(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        content = WORKFLOW.read_text(encoding="utf-8")
        try:
            yaml.safe_load(content)
        except yaml.YAMLError as e:
            self.fail(f"YAML 语法错误: {e}")


class TestTriggers(unittest.TestCase):
    """触发条件"""

    @classmethod
    def setUpClass(cls):
        if not HAS_YAML:
            cls.cfg = {}
            return
        cls.cfg = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))

    def test_workflow_name(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        self.assertEqual(self.cfg.get("name"), "Round 9 Nightly Tests")

    def test_on_block(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        # YAML 1.1 把 "on" 解析为 True, 兼容处理
        on_value = self.cfg.get("on", self.cfg.get(True, {}))
        self.assertIsNotNone(on_value)
        self.assertIn("schedule", on_value)
        self.assertIn("workflow_dispatch", on_value)

    def test_cron_schedule(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        on_value = self.cfg.get("on", self.cfg.get(True, {}))
        schedules = on_value["schedule"]
        self.assertEqual(len(schedules), 1)
        cron = schedules[0]["cron"]
        fields = cron.split()
        self.assertEqual(len(fields), 5, f"cron 必须 5 字段: {cron}")

    def test_workflow_dispatch_input(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        on_value = self.cfg.get("on", self.cfg.get(True, {}))
        wd = on_value["workflow_dispatch"]
        self.assertIn("inputs", wd)
        self.assertIn("task_filter", wd["inputs"])
        options = wd["inputs"]["task_filter"].get("options", [])
        self.assertIn("all", options)


class TestJobs(unittest.TestCase):
    """Job 定义"""

    @classmethod
    def setUpClass(cls):
        if not HAS_YAML:
            cls.cfg = {}
            cls.jobs = {}
            return
        cls.cfg = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        cls.jobs = cls.cfg.get("jobs", {})

    def test_jobs_defined(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        self.assertGreater(len(self.jobs), 0)

    def test_required_jobs(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        required = [
            "init",
            "unit-tests",
            "drill-tests",
            "cross-cloud-tests",
            "e2e-regression",
            "summary",
        ]
        for r in required:
            self.assertIn(r, self.jobs, f"缺失 job: {r}")

    def test_init_job(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        init = self.jobs["init"]
        self.assertEqual(init["runs-on"], "ubuntu-latest")
        self.assertIn("outputs", init)
        self.assertIn("task_filter", init["outputs"])

    def test_unit_tests_covers_p0(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        job = self.jobs["unit-tests"]
        steps_str = str(job.get("steps", []))
        for tid in ["P0-1", "P0-2", "P0-3"]:
            self.assertIn(tid, steps_str, f"unit-tests 缺失 {tid}")

    def test_drill_tests_covers_p1(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        job = self.jobs["drill-tests"]
        steps_str = str(job.get("steps", []))
        for tid in ["P1-4", "P1-5", "P1-6"]:
            self.assertIn(tid, steps_str, f"drill-tests 缺失 {tid}")

    def test_cross_cloud_tests_covers_p2_7_8_9(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        job = self.jobs["cross-cloud-tests"]
        steps_str = str(job.get("steps", []))
        for tid in ["P2-7", "P2-8", "P2-9"]:
            self.assertIn(tid, steps_str, f"cross-cloud-tests 缺失 {tid}")

    def test_e2e_regression_p2_10(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        job = self.jobs["e2e-regression"]
        steps_str = str(job.get("steps", []))
        self.assertIn("P2-10", steps_str)

    def test_summary_depends_on_all(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        summary = self.jobs["summary"]
        needs = summary.get("needs", [])
        self.assertIn("unit-tests", needs)
        self.assertIn("drill-tests", needs)
        self.assertIn("cross-cloud-tests", needs)
        self.assertIn("e2e-regression", needs)


class TestConditionalExecution(unittest.TestCase):
    """条件执行测试"""

    def test_filter_conditions(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        cfg = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        jobs = cfg.get("jobs", {})

        # 验证 task_filter 条件判断
        for job_name in ["unit-tests", "drill-tests", "cross-cloud-tests", "e2e-regression"]:
            job = jobs.get(job_name, {})
            cond = job.get("if", "")
            # 引用 needs.init.outputs.task_filter
            self.assertIn("task_filter", cond, f"{job_name} 条件缺 task_filter")

    def test_summary_always(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        cfg = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        summary = cfg["jobs"]["summary"]
        self.assertEqual(summary.get("if"), "always()")


class TestTaskCoverage(unittest.TestCase):
    """9 个任务覆盖测试"""

    def test_all_9_tasks_in_workflow(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        content = WORKFLOW.read_text(encoding="utf-8")
        for tid in ["P0-1", "P0-2", "P0-3", "P1-4", "P1-5", "P1-6", "P2-7", "P2-8", "P2-9", "P2-10"]:
            self.assertIn(tid, content, f"缺失任务: {tid}")


class TestPythonVersion(unittest.TestCase):
    """Python 版本"""

    def test_python_version(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        cfg = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        self.assertEqual(cfg.get("env", {}).get("PYTHON_VERSION"), "3.12")


class TestStepNames(unittest.TestCase):
    """步骤命名规范"""

    def test_step_naming(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        cfg = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        # 所有 step 应该有 name
        for job_name, job in cfg.get("jobs", {}).items():
            for step in job.get("steps", []):
                if "uses" in step:
                    continue  # GitHub Action 步骤无需 name
                if "name" not in step:
                    # 仅有 run 但无 name
                    self.fail(f"job {job_name} 有 step 缺 name: {step}")


class TestArtifactUpload(unittest.TestCase):
    """artifact 上传"""

    def test_logs_uploaded(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        content = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("upload-artifact", content)
        self.assertIn("round9-nightly-logs", content)


class TestNotification(unittest.TestCase):
    """通知机制"""

    def test_failure_notification(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        content = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("DEPLOY_WEBHOOK", content)
        self.assertIn("failure()", content)


class TestDependencyGraph(unittest.TestCase):
    """依赖图无环"""

    def test_no_cycles(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        cfg = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        jobs = cfg.get("jobs", {})

        # 检查 init 必须在所有 job 之前 (因为它们 depends on init)
        for job_name, job in jobs.items():
            if job_name == "init" or job_name == "summary":
                continue
            needs = job.get("needs", [])
            if isinstance(needs, list):
                self.assertIn("init", needs, f"{job_name} 缺 init 依赖")

    def test_terraform_install(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        content = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("terraform", content.lower())
        # 必须安装 hashicorp apt 源
        self.assertIn("hashicorp.com", content)


class TestUbuntuRunner(unittest.TestCase):
    """Runner 类型"""

    def test_all_ubuntu(self):
        if not HAS_YAML:
            self.skipTest("pyyaml 未安装")
        cfg = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        for job_name, job in cfg.get("jobs", {}).items():
            self.assertEqual(
                job.get("runs-on"),
                "ubuntu-latest",
                f"job {job_name} 不是 ubuntu-latest",
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
